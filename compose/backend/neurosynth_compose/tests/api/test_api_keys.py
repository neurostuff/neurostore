"""API keys are issued by Neurostore; Compose checks each one with its introspection
endpoint, which these tests stand in for at the HTTP boundary."""

from types import SimpleNamespace

import pytest

from neurosynth_compose.models import Specification, User
from neurosynth_compose.resources import auth
from neurosynth_compose.tests.request_utils import Client

SPEC = {
    "estimator": {"type": "ALE"},
    "type": "cbma",
    "conditions": [True],
    "weights": [1],
    "corrector": {"type": "FDRCorrector"},
    "filter": "eyes",
}


@pytest.fixture
def neurostore_keys(monkeypatch):
    """Keys Neurostore knows, keyed by plaintext, and the keys it was asked about."""
    keys, asked = {}, []

    def fetch(key, settings):
        asked.append(key)
        if key not in keys:
            return 401, None
        return 200, keys[key]

    monkeypatch.setattr(auth, "_fetch_introspection", fetch)
    monkeypatch.setattr(auth, "_introspected", {})
    return keys, asked


def _client(app, key):
    return Client(token=key, asgi_app=app.asgi_app)


def test_write_key_acts_as_its_owner(app, session, mock_add_users, neurostore_keys):
    keys, _ = neurostore_keys
    keys["nsk_w"] = {"user": "user1-id", "name": "user1", "scopes": ["write"]}

    resp = _client(app, "nsk_w").post("/api/specifications", data=SPEC)

    assert resp.status_code == 200, resp.json()
    assert session.get(Specification, resp.json()["id"]).user_id == "user1-id"


def test_key_owner_new_to_compose_is_named_by_neurostore(
    app, session, mock_add_users, neurostore_keys
):
    keys, _ = neurostore_keys
    keys["nsk_new"] = {"user": "store-only-id", "name": "Ada", "scopes": ["write"]}

    resp = _client(app, "nsk_new").post("/api/specifications", data=SPEC)

    assert resp.status_code == 200, resp.json()
    assert User.query.filter_by(external_id="store-only-id").one().name == "Ada"


def test_read_key_cannot_write(app, mock_add_users, neurostore_keys):
    keys, _ = neurostore_keys
    keys["nsk_r"] = {"user": "user1-id", "name": "user1", "scopes": ["read"]}
    resp = _client(app, "nsk_r").post("/api/specifications", data=SPEC)

    assert resp.status_code == 403


def test_key_neurostore_refuses_is_refused(app, mock_add_users, neurostore_keys):
    resp = _client(app, "nsk_revoked").post("/api/specifications", data=SPEC)
    assert resp.status_code == 401


def test_neurostore_unreachable_is_not_reported_as_bad_key(
    app, mock_add_users, monkeypatch
):
    monkeypatch.setattr(auth, "_fetch_introspection", lambda key, settings: (None, None))
    monkeypatch.setattr(auth, "_introspected", {})

    resp = _client(app, "nsk_any").post("/api/specifications", data=SPEC)

    assert resp.status_code == 503


def test_introspection_is_cached_until_ttl(
    app, mock_add_users, neurostore_keys, monkeypatch
):
    keys, asked = neurostore_keys
    keys["nsk_w"] = {"user": "user1-id", "name": "user1", "scopes": ["write"]}
    client = _client(app, "nsk_w")
    clock = [1000.0]
    monkeypatch.setattr(auth, "time", SimpleNamespace(monotonic=lambda: clock[0]))

    assert client.post("/api/specifications", data=SPEC).status_code == 200
    assert client.post("/api/specifications", data=SPEC).status_code == 200
    assert asked == ["nsk_w"]

    del keys["nsk_w"]  # revoked in Neurostore
    clock[0] += auth.INTROSPECTION_TTL_SECONDS + 1
    assert client.post("/api/specifications", data=SPEC).status_code == 401
    assert asked == ["nsk_w", "nsk_w"]
