import json
from copy import deepcopy
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from neurosynth_compose.models import MetaAnalysis, User


class FakeRedis:
    """Minimal Redis-like store for testing."""

    def __init__(self):
        self._store = {}
        self._ttl = {}

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
        "neurosynth_compose.resources.meta_analysis_jobs.get_job_store",
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
        "neurosynth_compose.resources.meta_analysis_jobs.call_lambda", call_lambda
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
    fake_job_store.setex(
        f"compose:jobs:{job_id}",
        60,
        json.dumps(
            {
                "job_id": job_id,
                "meta_analysis_id": "meta123",
                "artifact_prefix": "job-prefix",
                "status": "SUBMITTED",
                "environment": "production",
                "no_upload": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ),
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
    fake_job_store.setex(
        f"compose:jobs:{job_id}",
        60,
        json.dumps(
            {
                "job_id": job_id,
                "meta_analysis_id": "meta123",
                "artifact_prefix": "job-prefix",
                "status": "SUBMITTED",
            }
        ),
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
        fake_job_store.setex(
            f"compose:jobs:{job_id}",
            60,
            json.dumps(payload),
        )

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
