import json
import logging
from datetime import datetime, timezone
from typing import Optional

import requests
from flask import abort, current_app, request
from flask.views import MethodView
from marshmallow import ValidationError
from redis import Redis
from sqlalchemy import select

from ..database import db
from ..models import MetaAnalysis
from ..schemas import MetaAnalysisJobRequestSchema
from .analysis import _make_json_response, get_current_user, is_user_admin

logger = logging.getLogger(__name__)

JOB_CACHE_PREFIX = "compose:jobs"
JOB_CACHE_TTL_SECONDS = 60 * 60 * 24 * 3  # 3 days
LOG_TIME_PADDING_MS = 5 * 60 * 1000  # pad log queries by 5 minutes on each side

_job_store_client: Optional[Redis] = None


class JobStoreError(RuntimeError):
    """Raised when the job cache cannot be accessed."""


class ComposeRunnerError(RuntimeError):
    """Raised when the external compose runner call fails."""


def get_job_store() -> Redis:
    """Return a Redis client configured from the Celery result backend."""
    global _job_store_client
    if _job_store_client is not None:
        return _job_store_client

    redis_url = current_app.config.get("CELERY_RESULT_BACKEND")
    if not redis_url:
        raise JobStoreError("CELERY_RESULT_BACKEND is not configured.")

    try:
        client = Redis.from_url(redis_url)
        client.ping()
    except Exception as exc:  # noqa: BLE001
        raise JobStoreError("unable to reach redis job store") from exc

    _job_store_client = client
    return client


def _job_cache_key(job_id: str) -> str:
    return f"{JOB_CACHE_PREFIX}:{job_id}"


def _iso_to_epoch_millis(value: Optional[str]) -> Optional[int]:
    """Convert an ISO 8601 timestamp to epoch milliseconds."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    except ValueError:
        logger.warning("Invalid ISO timestamp when querying logs: %s", value)
        return None


def _store_job(job_id: str, payload: dict) -> None:
    try:
        client = get_job_store()
        client.setex(_job_cache_key(job_id), JOB_CACHE_TTL_SECONDS, json.dumps(payload))
    except JobStoreError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise JobStoreError("failed to cache job state") from exc


def _load_job(job_id: str) -> Optional[dict]:
    try:
        client = get_job_store()
        cached = client.get(_job_cache_key(job_id))
    except JobStoreError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise JobStoreError("failed to read job state") from exc

    if not cached:
        return None
    if isinstance(cached, bytes):
        cached = cached.decode("utf-8")
    return json.loads(cached)


def call_lambda(url: Optional[str], payload: dict) -> dict:
    """Call an external AWS Lambda-style HTTPS endpoint."""
    if not url:
        raise ComposeRunnerError("compose runner url is not configured")
    try:
        response = requests.post(url, json=payload, timeout=30)
    except requests.RequestException as exc:  # noqa: PERF203
        raise ComposeRunnerError("compose runner request failed") from exc

    if response.status_code >= 400:
        raise ComposeRunnerError(f"compose runner returned HTTP {response.status_code}")

    try:
        return response.json()
    except ValueError as exc:  # noqa: BLE001
        raise ComposeRunnerError("invalid compose runner response") from exc


def _abort_with_runner_error(exc: Exception) -> None:
    logger.exception("Compose runner call failed", exc_info=exc)
    abort(502, description="compose runner unavailable")


def _abort_with_job_store_error(exc: Exception) -> None:
    logger.exception("Job store error", exc_info=exc)
    abort(503, description="job store unavailable")


def _ensure_authenticated_user():
    user = get_current_user()
    if not user:
        abort(401, description="authentication required")
    return user


def submit_job():
    schema = MetaAnalysisJobRequestSchema()
    try:
        request_data = request.get_json(force=True)
    except Exception:  # noqa: BLE001
        abort(400, description="invalid JSON payload")

    try:
        data = schema.load(request_data or {})
    except ValidationError as exc:
        abort(422, description=f"input does not conform to specification: {exc}")

    current_user = _ensure_authenticated_user()

    meta_analysis = (
        db.session.execute(
            select(MetaAnalysis).where(MetaAnalysis.id == data["meta_analysis_id"])
        )
        .scalars()
        .first()
    )
    if meta_analysis is None:
        abort(404, description="meta-analysis not found")

    is_admin = is_user_admin(current_user)
    if meta_analysis.user_id != current_user.external_id and not is_admin:
        abort(
            403,
            description=(
                "user is not authorized to submit jobs for this "
                "meta-analysis. Must be the owner or an admin."
            ),
        )

    submit_url = current_app.config.get("COMPOSE_RUNNER_SUBMIT_URL")
    environment = current_app.config.get("ENV", "production")

    submission_payload = {
        "meta_analysis_id": meta_analysis.id,
        "environment": environment,
        "no_upload": data.get("no_upload", False),
    }

    try:
        submission_response = call_lambda(submit_url, submission_payload)
    except (ComposeRunnerError, Exception) as exc:  # noqa: BLE001
        _abort_with_runner_error(exc)

    job_id = submission_response.get("job_id")
    artifact_prefix = submission_response.get("artifact_prefix")
    status = submission_response.get("status", "SUBMITTED")

    if not job_id:
        abort(502, description="compose runner returned an invalid response")

    now = datetime.now(timezone.utc).isoformat()
    status_url = f"/meta-analysis-jobs/{job_id}"
    cached_payload = {
        "job_id": job_id,
        "meta_analysis_id": meta_analysis.id,
        "artifact_prefix": artifact_prefix,
        "status": status,
        "environment": environment,
        "no_upload": data.get("no_upload", False),
        "user_id": current_user.external_id,
        "status_url": status_url,
        "created_at": now,
        "updated_at": now,
        "output": submission_response.get("output"),
        "start_time": submission_response.get("start_time"),
        "stop_time": submission_response.get("stop_time"),
        "logs": submission_response.get("logs", []),
    }

    try:
        _store_job(job_id, cached_payload)
    except JobStoreError as exc:
        _abort_with_job_store_error(exc)

    response_payload = cached_payload.copy()
    response_payload["status"] = status

    return _make_json_response(response_payload, status=202)


def get_job_status(job_id: str):
    try:
        cached_job = _load_job(job_id)
    except JobStoreError as exc:
        _abort_with_job_store_error(exc)

    if cached_job is None:
        abort(404, description="job not found")

    status_url = current_app.config.get("COMPOSE_RUNNER_STATUS_URL")
    logs_url = current_app.config.get("COMPOSE_RUNNER_LOGS_URL")

    try:
        status_response = call_lambda(status_url, {"job_id": job_id})
        logs_payload = {"events": []}
        artifact_prefix = status_response.get("artifact_prefix") or cached_job.get(
            "artifact_prefix"
        )
        start_time_iso = status_response.get("start_time") or cached_job.get(
            "start_time"
        )
        stop_time_iso = status_response.get("stop_time") or cached_job.get("stop_time")
        if artifact_prefix:
            logs_request = {"artifact_prefix": artifact_prefix}
            start_ms = _iso_to_epoch_millis(start_time_iso)
            stop_ms = _iso_to_epoch_millis(stop_time_iso)
            if start_ms is not None:
                logs_request["start_time"] = max(0, start_ms - LOG_TIME_PADDING_MS)
            if stop_ms is not None:
                logs_request["end_time"] = stop_ms + LOG_TIME_PADDING_MS
            logs_payload = call_lambda(logs_url, logs_request)
    except (ComposeRunnerError, Exception) as exc:  # noqa: BLE001
        _abort_with_runner_error(exc)

    now = datetime.now(timezone.utc).isoformat()
    cached_job.update(
        {
            "status": status_response.get("status", cached_job.get("status")),
            "artifact_prefix": artifact_prefix,
            "start_time": start_time_iso,
            "stop_time": stop_time_iso,
            "output": status_response.get("output"),
            "updated_at": now,
        }
    )
    cached_job["logs"] = [
        {
            "timestamp": event.get("timestamp"),
            "message": event.get("message"),
        }
        for event in logs_payload.get("events", []) or []
    ]

    try:
        _store_job(job_id, cached_job)
    except JobStoreError as exc:
        _abort_with_job_store_error(exc)

    return _make_json_response(cached_job)


def list_jobs():
    current_user = _ensure_authenticated_user()
    try:
        client = get_job_store()
        keys = list(client.scan_iter(f"{JOB_CACHE_PREFIX}:*"))
    except JobStoreError as exc:
        _abort_with_job_store_error(exc)
    except Exception as exc:  # noqa: BLE001
        error = JobStoreError("failed to list jobs")
        error.__cause__ = exc
        _abort_with_job_store_error(error)

    jobs = []
    for key in keys:
        if isinstance(key, bytes):
            key = key.decode("utf-8")
        job_id = key[len(JOB_CACHE_PREFIX) + 1:]
        try:
            job = _load_job(job_id)
        except JobStoreError as exc:
            _abort_with_job_store_error(exc)
        if not job:
            continue
        if job.get("user_id") != current_user.external_id:
            continue
        jobs.append(job)

    jobs.sort(
        key=lambda job: job.get("updated_at") or job.get("created_at") or "",
        reverse=True,
    )
    payload = {"results": jobs, "metadata": {"count": len(jobs)}}
    return _make_json_response(payload)


class MetaAnalysisJobsResource(MethodView):
    @classmethod
    def post(cls):
        return submit_job()

    @classmethod
    def get(cls):
        return list_jobs()


class MetaAnalysisJobResource(MethodView):
    @classmethod
    def get(cls, job_id: str):
        return get_job_status(job_id)
