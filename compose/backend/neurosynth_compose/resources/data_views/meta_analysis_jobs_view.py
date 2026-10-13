import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional

import requests
from connexion import request
from marshmallow import ValidationError
from redis import Redis
from sqlalchemy import select

from neurosynth_compose.asgi_requests import raise_http_error, read_json
from neurosynth_compose.database import db
from neurosynth_compose.models import MetaAnalysis
from neurosynth_compose.resources.common import (
    get_current_user,
    is_user_admin,
    make_json_response,
)
from neurosynth_compose.schemas import MetaAnalysisJobRequestSchema

logger = logging.getLogger(__name__)

JOB_CACHE_PREFIX = "compose:jobs"
USER_JOB_INDEX_PREFIX = "compose:user-jobs"
META_ANALYSIS_JOB_INDEX_PREFIX = "compose:meta-analysis-jobs"
STATUS_CACHE_PREFIX = "compose:job-status"
JOB_CACHE_TTL_SECONDS = 60 * 60 * 24 * 3  # 3 days
STATUS_CACHE_TTL_SECONDS = 15  # throttle Lambda status polls to at most 1 per 15 s
LOG_TIME_PADDING_MS = 5 * 60 * 1000  # pad log queries by 5 minutes on each side

# Step Functions execution statuses that will never change again.
TERMINAL_STATUSES = frozenset({"SUCCEEDED", "FAILED", "TIMED_OUT", "ABORTED"})

# Transient compose runner responses (Lambda throttling / unavailability).
RETRYABLE_STATUS_CODES = frozenset({429, 503})
LAMBDA_MAX_RETRIES = 2
LAMBDA_RETRY_BACKOFF_SECONDS = 0.5
LAMBDA_MAX_RETRY_DELAY_SECONDS = 2.0


class JobStoreError(RuntimeError):
    """Raised when the job cache cannot be accessed."""


class ComposeRunnerError(RuntimeError):
    """Raised when the external compose runner call fails."""


class ComposeRunnerThrottledError(ComposeRunnerError):
    """Raised when the compose runner keeps returning a transient error."""


def get_job_store() -> Redis:
    """Return a Redis client configured from the Celery result backend."""
    redis_url = request.state.settings.get("CELERY_RESULT_BACKEND")
    if not redis_url:
        raise JobStoreError("CELERY_RESULT_BACKEND is not configured.")

    try:
        client = Redis.from_url(redis_url)
        client.ping()
    except Exception as exc:  # noqa: BLE001
        raise JobStoreError("unable to reach redis job store") from exc

    return client


def _job_cache_key(job_id: str) -> str:
    return f"{JOB_CACHE_PREFIX}:{job_id}"


def _user_job_index_key(user_id: str) -> str:
    return f"{USER_JOB_INDEX_PREFIX}:{user_id}"


def _meta_analysis_job_index_key(meta_analysis_id: str) -> str:
    return f"{META_ANALYSIS_JOB_INDEX_PREFIX}:{meta_analysis_id}"


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
        user_id = payload.get("user_id")
        if user_id:
            client.sadd(_user_job_index_key(user_id), job_id)
            client.expire(_user_job_index_key(user_id), JOB_CACHE_TTL_SECONDS)
        meta_analysis_id = payload.get("meta_analysis_id")
        if meta_analysis_id:
            client.sadd(_meta_analysis_job_index_key(meta_analysis_id), job_id)
            client.expire(
                _meta_analysis_job_index_key(meta_analysis_id), JOB_CACHE_TTL_SECONDS
            )
    except JobStoreError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise JobStoreError("failed to cache job state") from exc


def _status_cache_key(job_id: str) -> str:
    return f"{STATUS_CACHE_PREFIX}:{job_id}"


def _get_cached_status(client: Redis, job_id: str) -> Optional[dict]:
    """Return the cached Lambda status response for *job_id*, or None on miss."""
    try:
        raw = client.get(_status_cache_key(job_id))
    except Exception:  # noqa: BLE001
        return None
    if not raw:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    try:
        return json.loads(raw)
    except ValueError:
        return None


def _set_cached_status(client: Redis, job_id: str, data: dict) -> None:
    """Cache the Lambda status response for *job_id* with a short TTL."""
    try:
        client.setex(
            _status_cache_key(job_id),
            STATUS_CACHE_TTL_SECONDS,
            json.dumps(data),
        )
    except Exception:  # noqa: BLE001
        pass  # cache failures are non-fatal


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


def _retry_delay(response, attempt: int) -> float:
    """Return the delay before retrying, honoring Retry-After when present."""
    retry_after = response.headers.get("Retry-After") if response is not None else None
    if retry_after:
        try:
            return min(max(float(retry_after), 0.0), LAMBDA_MAX_RETRY_DELAY_SECONDS)
        except ValueError:
            pass
    return min(
        LAMBDA_RETRY_BACKOFF_SECONDS * (2**attempt), LAMBDA_MAX_RETRY_DELAY_SECONDS
    )


def call_lambda(url: Optional[str], payload: dict) -> dict:
    """Call an external AWS Lambda-style HTTPS endpoint."""
    if not url:
        raise ComposeRunnerError("compose runner url is not configured")

    attempt = 0
    while True:
        try:
            response = requests.post(url, json=payload, timeout=30)
        except requests.RequestException as exc:  # noqa: PERF203
            raise ComposeRunnerError("compose runner request failed") from exc

        if response.status_code not in RETRYABLE_STATUS_CODES:
            break
        if attempt >= LAMBDA_MAX_RETRIES:
            raise ComposeRunnerThrottledError(
                f"compose runner returned HTTP {response.status_code}"
            )
        time.sleep(_retry_delay(response, attempt))
        attempt += 1

    if response.status_code >= 400:
        raise ComposeRunnerError(f"compose runner returned HTTP {response.status_code}")

    try:
        return response.json()
    except ValueError as exc:  # noqa: BLE001
        raise ComposeRunnerError("invalid compose runner response") from exc


def _abort_with_runner_error(exc: Exception) -> None:
    logger.exception("Compose runner call failed", exc_info=exc)
    raise_http_error(502, "compose runner unavailable")


def _abort_with_job_store_error(exc: Exception) -> None:
    logger.exception("Job store error", exc_info=exc)
    raise_http_error(503, "job store unavailable")


def _ensure_authenticated_user():
    user = get_current_user()
    if not user:
        raise_http_error(401, "authentication required")
    return user


def submit_job():
    schema = MetaAnalysisJobRequestSchema()
    try:
        request_data = read_json(request)
    except Exception:  # noqa: BLE001
        raise_http_error(400, "invalid JSON payload")

    try:
        data = schema.load(request_data or {})
    except ValidationError as exc:
        raise_http_error(422, f"input does not conform to specification: {exc}")

    current_user = _ensure_authenticated_user()

    meta_analysis = (
        db.session.execute(
            select(MetaAnalysis).where(MetaAnalysis.id == data["meta_analysis_id"])
        )
        .scalars()
        .first()
    )
    if meta_analysis is None:
        raise_http_error(404, "meta-analysis not found")

    is_admin = is_user_admin(current_user)
    if meta_analysis.user_id != current_user.external_id and not is_admin:
        raise_http_error(
            403,
            (
                "user is not authorized to submit jobs for this "
                "meta-analysis. Must be the owner or an admin."
            ),
        )

    config = request.state.settings
    submit_url = config.get("COMPOSE_RUNNER_SUBMIT_URL")
    environment = config.get("ENV", "production")

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
        raise_http_error(502, "compose runner returned an invalid response")

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

    return make_json_response(response_payload, status=202)


def get_job_status(job_id: str):
    try:
        cached_job = _load_job(job_id)
    except JobStoreError as exc:
        _abort_with_job_store_error(exc)

    if cached_job is None:
        raise_http_error(404, "job not found")

    # Finished executions never change; serve them from the cache instead of
    # invoking the compose runner Lambdas on every poll.
    if cached_job.get("status") in TERMINAL_STATUSES:
        return make_json_response(cached_job)

    config = request.state.settings
    status_url = config.get("COMPOSE_RUNNER_STATUS_URL")
    logs_url = config.get("COMPOSE_RUNNER_LOGS_URL")

    try:
        job_store_client = get_job_store()
    except JobStoreError as exc:
        _abort_with_job_store_error(exc)

    try:
        # Use a short-TTL cache so rapid polls don't each hit the Lambda.
        status_response = _get_cached_status(job_store_client, job_id)
        if status_response is None:
            status_response = call_lambda(status_url, {"job_id": job_id})
            _set_cached_status(job_store_client, job_id, status_response)
    except ComposeRunnerThrottledError as exc:
        # Transient throttling: return the last known state rather than a 502.
        logger.warning(
            "Compose runner throttled; returning cached job state for %s: %s",
            job_id,
            exc,
        )
        stale_job = cached_job.copy()
        stale_job["stale"] = True
        return make_json_response(stale_job)
    except (ComposeRunnerError, Exception) as exc:  # noqa: BLE001
        _abort_with_runner_error(exc)

    artifact_prefix = status_response.get("artifact_prefix") or cached_job.get(
        "artifact_prefix"
    )
    start_time_iso = status_response.get("start_time") or cached_job.get("start_time")
    stop_time_iso = status_response.get("stop_time") or cached_job.get("stop_time")

    new_status = status_response.get("status", cached_job.get("status"))
    logs = cached_job.get("logs") or []
    logs_refreshed = True
    if artifact_prefix:
        logs_request = {"artifact_prefix": artifact_prefix}
        start_ms = _iso_to_epoch_millis(start_time_iso)
        stop_ms = _iso_to_epoch_millis(stop_time_iso)
        if start_ms is not None:
            logs_request["start_time"] = max(0, start_ms - LOG_TIME_PADDING_MS)
        if stop_ms is not None:
            logs_request["end_time"] = stop_ms + LOG_TIME_PADDING_MS
        try:
            logs_payload = call_lambda(logs_url, logs_request)
            logs = [
                {
                    "timestamp": event.get("timestamp"),
                    "message": event.get("message"),
                }
                for event in logs_payload.get("events", []) or []
            ]
        except ComposeRunnerThrottledError as exc:
            # Keep the fresh status; reuse previously cached logs.
            logger.warning(
                "Compose runner log poller throttled for %s; reusing cached logs: %s",
                job_id,
                exc,
            )
            logs_refreshed = False
        except (ComposeRunnerError, Exception) as exc:  # noqa: BLE001
            _abort_with_runner_error(exc)

    previous_status = cached_job.get("status")
    now = datetime.now(timezone.utc).isoformat()
    cached_job.update(
        {
            "status": new_status,
            "artifact_prefix": artifact_prefix,
            "start_time": start_time_iso,
            "stop_time": stop_time_iso,
            "output": status_response.get("output"),
            "updated_at": now,
        }
    )
    cached_job["logs"] = logs

    if not logs_refreshed:
        cached_job["stale"] = True
        stored_job = cached_job.copy()
        stored_job.pop("stale", None)
        if new_status in TERMINAL_STATUSES:
            # Don't cache a terminal status with incomplete logs, otherwise the
            # terminal short-circuit above would freeze the stale logs forever.
            stored_job["status"] = previous_status
    else:
        cached_job.pop("stale", None)
        stored_job = cached_job

    try:
        _store_job(job_id, stored_job)
    except JobStoreError as exc:
        _abort_with_job_store_error(exc)

    return make_json_response(cached_job)


def list_jobs():
    current_user = _ensure_authenticated_user()
    try:
        client = get_job_store()
        job_ids = client.smembers(_user_job_index_key(current_user.external_id))
    except JobStoreError as exc:
        _abort_with_job_store_error(exc)
    except Exception as exc:  # noqa: BLE001
        error = JobStoreError("failed to list indexed jobs")
        error.__cause__ = exc
        _abort_with_job_store_error(error)

    jobs = []
    for job_id in job_ids:
        if isinstance(job_id, bytes):
            job_id = job_id.decode("utf-8")
        try:
            job = _load_job(job_id)
        except JobStoreError as exc:
            _abort_with_job_store_error(exc)
        if not job:
            try:
                client.srem(_user_job_index_key(current_user.external_id), job_id)
            except Exception:
                pass
            continue
        jobs.append(job)

    jobs.sort(
        key=lambda job: job.get("updated_at") or job.get("created_at") or "",
        reverse=True,
    )
    payload = {"results": jobs, "metadata": {"count": len(jobs)}}
    return make_json_response(payload)


class MetaAnalysisJobsView:
    @classmethod
    def post(cls):
        return submit_job()

    @classmethod
    def get(cls, job_id: str | None = None):
        if job_id is None:
            return list_jobs()
        return get_job_status(job_id)

    @classmethod
    def search(cls):
        return cls.get()
