import pytest

from neurostore.models import ApiKey, Study
from neurostore.tests.request_utils import AsyncClient

pytestmark = pytest.mark.anyio


async def _create_key(client, scopes, name="script"):
    resp = await client.post("/api/api-keys/", data={"name": name, "scopes": scopes})
    assert resp.status_code == 201, resp.json()
    return resp.json()


@pytest.fixture
async def key_client(app):
    clients = []

    def make(key):
        client = AsyncClient(token=key, asgi_app=app.asgi_app)
        clients.append(client)
        return client

    yield make
    for client in clients:
        await client.aclose()


async def test_created_key_is_shown_once_and_stored_hashed(auth_client, session):
    created = await _create_key(auth_client, ["read", "write"])

    assert created["key"].startswith("nsk_")
    assert created["key"].startswith(created["prefix"])
    stored = session.get(ApiKey, created["id"])
    assert created["key"] not in (stored.key_hash, stored.prefix)

    listed = (await auth_client.get("/api/api-keys/")).json()["results"]
    assert [k["id"] for k in listed] == [created["id"]]
    assert "key" not in listed[0]


async def test_write_key_acts_as_its_owner(auth_client, key_client, session):
    created = await _create_key(auth_client, ["read", "write"])
    client = key_client(created["key"])

    resp = await client.post("/api/studies/", data={"name": "made with a key"})

    assert resp.status_code == 200, resp.json()
    assert session.get(Study, resp.json()["id"]).user_id == auth_client.username
    assert session.get(ApiKey, created["id"]).last_used_at is not None


async def test_read_key_cannot_write(auth_client, key_client):
    created = await _create_key(auth_client, ["read"])
    client = key_client(created["key"])

    resp = await client.get("/api/api-keys/introspect")
    assert resp.status_code == 200
    resp = await client.post("/api/studies/", data={"name": "nope"})
    assert resp.status_code == 403


async def test_write_key_can_read(auth_client, key_client):
    created = await _create_key(auth_client, ["write"])

    resp = await key_client(created["key"]).get("/api/api-keys/introspect")

    assert resp.status_code == 200


async def test_introspect_reports_owner_and_scopes(auth_client, key_client):
    created = await _create_key(auth_client, ["read", "write"])

    resp = await key_client(created["key"]).get("/api/api-keys/introspect")

    assert resp.json() == {
        "user": auth_client.username,
        "name": "user1",
        "scopes": ["read", "write"],
    }


async def test_introspect_needs_an_api_key(auth_client):
    resp = await auth_client.get("/api/api-keys/introspect")
    assert resp.status_code == 400


async def test_keys_cannot_manage_keys(auth_client, key_client):
    created = await _create_key(auth_client, ["read", "write"])
    client = key_client(created["key"])

    resp = await client.get("/api/api-keys/")
    assert resp.status_code == 403
    resp = await client.post("/api/api-keys/", data={"name": "x", "scopes": ["read"]})
    assert resp.status_code == 403
    resp = await client.delete(f"/api/api-keys/{created['id']}")
    assert resp.status_code == 403


async def test_revoked_key_is_refused(auth_client, key_client):
    created = await _create_key(auth_client, ["read", "write"])
    client = key_client(created["key"])

    resp = await auth_client.delete(f"/api/api-keys/{created['id']}")
    assert resp.status_code == 204

    resp = await client.get("/api/api-keys/introspect")
    assert resp.status_code == 401
    listed = (await auth_client.get("/api/api-keys/")).json()["results"]
    assert listed[0]["revoked_at"] is not None


async def test_unknown_key_is_refused(key_client):
    resp = await key_client("nsk_not-a-real-key").get("/api/api-keys/introspect")
    assert resp.status_code == 401


async def test_users_cannot_see_or_revoke_each_others_keys(auth_clients):
    owner, other = auth_clients[0], auth_clients[1]
    created = await _create_key(owner, ["read"])

    resp = await other.get("/api/api-keys/")
    assert resp.json()["results"] == []
    resp = await other.delete(f"/api/api-keys/{created['id']}")
    assert resp.status_code == 404


@pytest.mark.parametrize("scopes", [[], ["admin"]])
async def test_scopes_are_validated(auth_client, scopes):
    resp = await auth_client.post("/api/api-keys/", data={"name": "x", "scopes": scopes})
    assert resp.status_code == 400
