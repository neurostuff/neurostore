import json
from copy import deepcopy
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from neurosynth_compose.models import MetaAnalysis, User
from neurosynth_compose.resources.data_views import (
    meta_analysis_jobs_view as meta_analysis_jobs_resource,
)


class FakeRedis:
    """Minimal Redis-like store for testing."""

    def __init__(self):
        self._store = {}
        self._ttl = {}
        self._sets = {}

    def setex(self, key, ttl, value):
        if isinstance(value, str):
            value = value.encode("utf-8")
        self._store[key] = value
        self._ttl[key] = ttl

    def get(self, key):
        return self._store.get(key)

    def delete(self, key):
        self._store.pop(key, None)
        self._ttl.pop(key, None)

    def flushall(self):
        self._store.clear()
        self._ttl.clear()
        self._sets.clear()

    def sadd(self, key, *values):
        bucket = self._sets.setdefault(key, set())
        bucket.update(values)

    def smembers(self, key):
        return set(self._sets.get(key, set()))

    def srem(self, key, *values):
        bucket = self._sets.get(key)
        if bucket is None:
            return
        for value in values:
            bucket.discard(value)

    def expire(self, key, ttl):
        self._ttl[key] = ttl

    def scan_iter(self, match=None):
        match = match or "*"
        if match.endswith("*"):
            prefix = match[:-1]
            for key in list(self._store.keys()):
                if key.startswith(prefix):
                    yield key
        else:
            if match in self._store:
                yield match


@pytest.fixture
def fake_job_store(monkeypatch):
    store = FakeRedis()
    monkeypatch.setattr(
        "neurosynth_compose.resources.meta_analysis_jobs_view.get_job_store",
        lambda: store,
    )
    return store


@pytest.fixture
def lambda_responses(monkeypatch):
    calls = []
    responses = {}

    def set_response(url, payload):
        responses[url] = payload

    def call_lambda(url, payload):
        calls.append({"url": url, "payload": deepcopy(payload)})
        result = responses.get(url)
        if isinstance(result, Exception):
            raise result
        return deepcopy(result)

    monkeypatch.setattr(
        "neurosynth_compose.resources.meta_analysis_jobs_view.call_lambda", call_lambda
    )
    return {"calls": calls, "set_response": set_response}


def _get_user_meta_analysis(db, auth_client):
    user = (
        db.session.execute(select(User).where(User.external_id == auth_client.username))
        .scalars()
        .one()
    )
    return (
        db.session.execute(select(MetaAnalysis).where(MetaAnalysis.user == user))
        .scalars()
        .first()
    )


def _store_job(payload):
    meta_analysis_jobs_resource._store_job(payload["job_id"], payload)


def test_submit_job_success(
    app,
    db,
    auth_client,
    fake_job_store,
    lambda_responses,
    mock_add_users,
    user_data,
):
    app.config.update(
        {
            "ENV": "production",
            "COMPOSE_RUNNER_SUBMIT_URL": "https://submit.example",
            "COMPOSE_RUNNER_STATUS_URL": "https://status.example",
            "COMPOSE_RUNNER_LOGS_URL": "https://logs.example",
        }
    )

    lambda_responses["set_response"](
        "https://submit.example",
        {
            "job_id": "arn:aws:states:us-east-1:123456789012:execution:StateMachine:job",
            "artifact_prefix": "job-prefix",
            "status": "SUBMITTED",
        },
    )

    meta_analysis = _get_user_meta_analysis(db, auth_client)

    response = auth_client.post(
        "/api/meta-analysis-jobs",
        data={"meta_analysis_id": meta_analysis.id},
    )
    assert response.status_code == 202, response.json()

    payload = response.json
    assert payload["job_id"].endswith("job")
    assert payload["status"] == "SUBMITTED"
    assert payload["artifact_prefix"] == "job-prefix"
    assert payload["meta_analysis_id"] == meta_analysis.id
    assert payload["environment"] == "production"
    assert payload["no_upload"] is False

    cached = fake_job_store.get(
        "compose:jobs:arn:aws:states:us-east-1:123456789012:execution:StateMachine:job"
    )
    assert cached is not None
    cached_data = json.loads(cached.decode("utf-8"))
    assert cached_data["meta_analysis_id"] == meta_analysis.id
    assert cached_data["status"] == "SUBMITTED"
    assert cached_data["artifact_prefix"] == "job-prefix"
    assert cached_data["environment"] == "production"
    assert cached_data["no_upload"] is False

    submit_call = lambda_responses["calls"][0]
    assert submit_call["url"] == "https://submit.example"
    assert submit_call["payload"]["meta_analysis_id"] == meta_analysis.id
    assert submit_call["payload"]["environment"] == "production"
    assert submit_call["payload"]["no_upload"] is False


def test_submit_job_forbidden_for_non_owner(
    app, db, auth_clients, fake_job_store, lambda_responses, user_data
):
    app.config["COMPOSE_RUNNER_SUBMIT_URL"] = "https://submit.example"
    auth_client = auth_clients[1]
    other_client = auth_clients[0]
    meta_analysis = _get_user_meta_analysis(db, other_client)

    response = auth_client.post(
        "/api/meta-analysis-jobs",
        data={"meta_analysis_id": meta_analysis.id},
    )

    assert response.status_code == 403
    assert fake_job_store._store == {}
    assert lambda_responses["calls"] == []


def test_submit_job_propagates_lambda_errors(
    app, db, auth_client, fake_job_store, lambda_responses, user_data
):
    app.config["COMPOSE_RUNNER_SUBMIT_URL"] = "https://submit.example"
    lambda_responses["set_response"]("https://submit.example", RuntimeError("boom"))

    meta_analysis = _get_user_meta_analysis(db, auth_client)
    response = auth_client.post(
        "/api/meta-analysis-jobs",
        data={"meta_analysis_id": meta_analysis.id},
    )

    assert response.status_code == 502
    assert response.json.get("detail") == "compose runner unavailable"
    assert (
        fake_job_store.get(
            "compose:jobs:arn:aws:states:us-east-1:123456789012:execution:StateMachine:job"
        )
        is None
    )


def test_get_job_status_and_logs(
    app, db, auth_client, fake_job_store, lambda_responses, user_data
):
    job_id = "arn:aws:states:us-east-1:123456789012:execution:StateMachine:job"
    app.config.update(
        {
            "COMPOSE_RUNNER_STATUS_URL": "https://status.example",
            "COMPOSE_RUNNER_LOGS_URL": "https://logs.example",
        }
    )
    _store_job(
        {
            "job_id": job_id,
            "meta_analysis_id": "meta123",
            "artifact_prefix": "job-prefix",
            "status": "SUBMITTED",
            "environment": "production",
            "no_upload": False,
            "user_id": auth_client.username,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    lambda_responses["set_response"](
        "https://status.example",
        {
            "job_id": job_id,
            "status": "RUNNING",
            "start_time": "2025-10-21T01:32:05.920000+00:00",
            "output": {"result": "pending"},
            "artifact_prefix": "job-prefix",
        },
    )
    lambda_responses["set_response"](
        "https://logs.example",
        {
            "artifact_prefix": "job-prefix",
            "events": [
                {
                    "timestamp": 1761010403921,
                    "message": "workflow.start",
                },
                {
                    "timestamp": 1761010415502,
                    "message": "workflow.success",
                },
            ],
        },
    )

    response = auth_client.get(f"/api/meta-analysis-jobs/{job_id}")
    assert response.status_code == 200, response.json()

    payload = response.json
    assert payload["job_id"] == job_id
    assert payload["status"] == "RUNNING"
    assert payload["start_time"] == "2025-10-21T01:32:05.920000+00:00"
    assert payload["output"] == {"result": "pending"}
    assert payload["artifact_prefix"] == "job-prefix"
    assert payload["logs"] == [
        {"timestamp": 1761010403921, "message": "workflow.start"},
        {"timestamp": 1761010415502, "message": "workflow.success"},
    ]

    cached = json.loads(fake_job_store.get(f"compose:jobs:{job_id}").decode("utf-8"))
    assert cached["status"] == "RUNNING"
    assert cached["output"] == {"result": "pending"}
    assert cached["logs"] == payload["logs"]

    urls = {call["url"] for call in lambda_responses["calls"]}
    assert urls == {"https://status.example", "https://logs.example"}


def test_get_job_missing_returns_404(app, auth_client, fake_job_store, user_data):
    job_id = "arn:aws:states:us-east-1:missing"

    response = auth_client.get(f"/api/meta-analysis-jobs/{job_id}")
    assert response.status_code == 404


def test_get_job_lambda_error(
    app, auth_client, fake_job_store, lambda_responses, user_data
):
    job_id = "arn:aws:states:us-east-1:123456789012:execution:StateMachine:job"
    app.config["COMPOSE_RUNNER_STATUS_URL"] = "https://status.example"
    app.config["COMPOSE_RUNNER_LOGS_URL"] = "https://logs.example"
    _store_job(
        {
            "job_id": job_id,
            "meta_analysis_id": "meta123",
            "artifact_prefix": "job-prefix",
            "status": "SUBMITTED",
            "user_id": auth_client.username,
        }
    )

    lambda_responses["set_response"]("https://status.example", RuntimeError("boom"))

    response = auth_client.get(f"/api/meta-analysis-jobs/{job_id}")
    assert response.status_code == 502
    assert response.json.get("detail") == "compose runner unavailable"


def test_list_jobs_returns_only_current_user_jobs(
    app, auth_clients, fake_job_store, user_data
):
    user_client = auth_clients[0]
    other_client = auth_clients[1]

    now = datetime.now(timezone.utc).isoformat()
    job_entries = [
        (
            "arn:aws:states:us-east-1:execution:job1",
            {
                "job_id": "arn:aws:states:us-east-1:execution:job1",
                "meta_analysis_id": "meta1",
                "user_id": user_client.username,
                "status": "SUBMITTED",
                "created_at": now,
            },
        ),
        (
            "arn:aws:states:us-east-1:execution:job2",
            {
                "job_id": "arn:aws:states:us-east-1:execution:job2",
                "meta_analysis_id": "meta2",
                "user_id": user_client.username,
                "status": "RUNNING",
                "created_at": now,
            },
        ),
        (
            "arn:aws:states:us-east-1:execution:job3",
            {
                "job_id": "arn:aws:states:us-east-1:execution:job3",
                "meta_analysis_id": "meta3",
                "user_id": other_client.username,
                "status": "SUBMITTED",
                "created_at": now,
            },
        ),
    ]
    for job_id, payload in job_entries:
        _store_job(payload)

    response = user_client.get("/api/meta-analysis-jobs")
    assert response.status_code == 200
    results = response.json["results"]
    assert len(results) == 2
    job_ids = {job["job_id"] for job in results}
    meta_ids = {job["meta_analysis_id"] for job in results}
    assert job_ids == {
        "arn:aws:states:us-east-1:execution:job1",
        "arn:aws:states:us-east-1:execution:job2",
    }
    assert meta_ids == {"meta1", "meta2"}


JOB_ID = "arn:aws:states:us-east-1:123456789012:execution:StateMachine:job"


def _configure_runner_urls(app):
    app.config.update(
        {
            "COMPOSE_RUNNER_STATUS_URL": "https://status.example",
            "COMPOSE_RUNNER_LOGS_URL": "https://logs.example",
        }
    )


def _store_running_job(username, **overrides):
    payload = {
        "job_id": JOB_ID,
        "meta_analysis_id": "meta123",
        "artifact_prefix": "job-prefix",
        "status": "RUNNING",
        "user_id": username,
        "logs": [{"timestamp": 1, "message": "cached"}],
    }
    payload.update(overrides)
    _store_job(payload)


@pytest.mark.parametrize("status", ["SUCCEEDED", "FAILED", "TIMED_OUT", "ABORTED"])
def test_get_job_terminal_status_skips_lambda(
    app, auth_client, fake_job_store, lambda_responses, user_data, status
):
    _configure_runner_urls(app)
    _store_running_job(auth_client.username, status=status)

    response = auth_client.get(f"/api/meta-analysis-jobs/{JOB_ID}")
    assert response.status_code == 200
    assert response.json["status"] == status
    assert lambda_responses["calls"] == []


def test_get_job_reuses_cached_status_response(
    app, auth_client, fake_job_store, lambda_responses, user_data
):
    _configure_runner_urls(app)
    _store_running_job(auth_client.username)
    lambda_responses["set_response"](
        "https://status.example", {"job_id": JOB_ID, "status": "RUNNING"}
    )
    lambda_responses["set_response"]("https://logs.example", {"events": []})

    for _ in range(3):
        response = auth_client.get(f"/api/meta-analysis-jobs/{JOB_ID}")
        assert response.status_code == 200

    status_calls = [
        call
        for call in lambda_responses["calls"]
        if call["url"] == "https://status.example"
    ]
    assert len(status_calls) == 1
    assert (
        fake_job_store._ttl[f"compose:job-status:{JOB_ID}"]
        == meta_analysis_jobs_resource.STATUS_CACHE_TTL_SECONDS
    )


def test_get_job_status_throttled_returns_stale_cached_job(
    app, auth_client, fake_job_store, lambda_responses, user_data
):
    _configure_runner_urls(app)
    _store_running_job(auth_client.username)
    lambda_responses["set_response"](
        "https://status.example",
        meta_analysis_jobs_resource.ComposeRunnerThrottledError("HTTP 429"),
    )

    response = auth_client.get(f"/api/meta-analysis-jobs/{JOB_ID}")
    assert response.status_code == 200
    assert response.json["status"] == "RUNNING"
    assert response.json["stale"] is True
    assert response.json["logs"] == [{"timestamp": 1, "message": "cached"}]

    cached = json.loads(fake_job_store.get(f"compose:jobs:{JOB_ID}").decode("utf-8"))
    assert "stale" not in cached


def test_get_job_logs_throttled_keeps_status_but_not_terminal(
    app, auth_client, fake_job_store, lambda_responses, user_data
):
    _configure_runner_urls(app)
    _store_running_job(auth_client.username)
    lambda_responses["set_response"](
        "https://status.example", {"job_id": JOB_ID, "status": "SUCCEEDED"}
    )
    lambda_responses["set_response"](
        "https://logs.example",
        meta_analysis_jobs_resource.ComposeRunnerThrottledError("HTTP 429"),
    )

    response = auth_client.get(f"/api/meta-analysis-jobs/{JOB_ID}")
    assert response.status_code == 200
    assert response.json["status"] == "SUCCEEDED"
    assert response.json["stale"] is True
    assert response.json["logs"] == [{"timestamp": 1, "message": "cached"}]

    # The terminal status is not persisted until logs are refreshed, so the
    # next poll fetches logs again instead of short-circuiting.
    cached = json.loads(fake_job_store.get(f"compose:jobs:{JOB_ID}").decode("utf-8"))
    assert cached["status"] == "RUNNING"

    lambda_responses["set_response"](
        "https://logs.example",
        {"events": [{"timestamp": 2, "message": "workflow.success"}]},
    )
    response = auth_client.get(f"/api/meta-analysis-jobs/{JOB_ID}")
    assert response.status_code == 200
    assert "stale" not in response.json
    assert response.json["logs"] == [{"timestamp": 2, "message": "workflow.success"}]

    cached = json.loads(fake_job_store.get(f"compose:jobs:{JOB_ID}").decode("utf-8"))
    assert cached["status"] == "SUCCEEDED"


class _FakeResponse:
    def __init__(self, status_code, payload=None, headers=None):
        self.status_code = status_code
        self._payload = payload or {}
        self.headers = headers or {}

    def json(self):
        return self._payload


def test_call_lambda_retries_throttled_responses(monkeypatch):
    responses = [
        _FakeResponse(429, headers={"Retry-After": "1"}),
        _FakeResponse(503),
        _FakeResponse(200, {"status": "RUNNING"}),
    ]
    sleeps = []
    monkeypatch.setattr(
        meta_analysis_jobs_resource.requests,
        "post",
        lambda *args, **kwargs: responses.pop(0),
    )
    monkeypatch.setattr(meta_analysis_jobs_resource.time, "sleep", sleeps.append)

    result = meta_analysis_jobs_resource.call_lambda("https://status.example", {})

    assert result == {"status": "RUNNING"}
    assert sleeps == [1.0, 1.0]


def test_call_lambda_raises_throttled_after_max_retries(monkeypatch):
    monkeypatch.setattr(
        meta_analysis_jobs_resource.requests,
        "post",
        lambda *args, **kwargs: _FakeResponse(429),
    )
    monkeypatch.setattr(meta_analysis_jobs_resource.time, "sleep", lambda _: None)

    with pytest.raises(meta_analysis_jobs_resource.ComposeRunnerThrottledError):
        meta_analysis_jobs_resource.call_lambda("https://status.example", {})
