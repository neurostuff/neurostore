import pytest

from neurostore.cache_versioning import bump_cache_versions
from neurostore.extensions import cache
from neurostore.models import Study
from neurostore.resources import base as base_resource
from neurostore.tests.request_utils import AsyncClient

pytestmark = pytest.mark.anyio


async def test_list_cache_key_matches_flask_shape(auth_client, mock_add_users, session):
    response = await auth_client.get("/api/studies/?b=2&a=1&b=1")

    assert response.status_code == 200
    expected_key = (
        "/api/studies/_(('a', '1'), ('b', '1'), ('b', '2'))_"
        f"{mock_add_users['user1']['id']}_v=0"
    )
    assert cache.cache.get(expected_key) is not None


async def test_list_cache_key_embeds_existing_version(
    auth_client, mock_add_users, session
):
    bump_cache_versions({"studies": ["study-1"]})

    response = await auth_client.get("/api/studies/?nested=false")

    assert response.status_code == 200
    expected_key = (
        "/api/studies/_(('nested', 'false'),)_" f"{mock_add_users['user1']['id']}_v=1"
    )
    assert cache.cache.get(expected_key) is not None


async def test_list_cache_serves_warm_value_with_flask_compatible_key(
    auth_client, mock_add_users, user_data
):
    cache_key = f"/api/studies/_()_{mock_add_users['user1']['id']}_v=0"

    cold_response = await auth_client.get("/api/studies/")

    assert cold_response.status_code == 200
    assert cache.cache.get(cache_key) is not None

    cached_payload = (
        {"results": [], "metadata": {"total_count": 0}, "warm_cache": True},
        200,
        {"Content-Type": "application/json"},
    )
    cache.cache.set(cache_key, cached_payload, timeout=60)

    warm_response = await auth_client.get("/api/studies/")

    assert warm_response.status_code == 200
    assert warm_response.json()["warm_cache"] is True


def _record_cache_writes(monkeypatch):
    written = []
    original_set = cache.cache.set

    def record_set(*args, **kwargs):
        written.append(args[0])
        return original_set(*args, **kwargs)

    monkeypatch.setattr(cache.cache, "set", record_set)
    return written


async def test_a_detail_entry_is_shared_by_callers_who_own_nothing_in_it(
    app, auth_clients, mock_add_users, user_data, session, monkeypatch
):
    owner = next(c for c in auth_clients if c.username == "user1-id")
    other = next(c for c in auth_clients if c.username == "user2-id")
    anonymous = AsyncClient(token=None, asgi_app=app.asgi_app)
    study = session.query(Study).filter_by(user_id="user1-id", public=True).first()
    path = f"/api/studies/{study.id}"
    shared_key = f"{path}_()__v=0_owners"
    written = _record_cache_writes(monkeypatch)

    try:
        assert (await other.get(path)).json()["user"] is None
        assert written == [shared_key]
        assert (await anonymous.get(path)).json()["user"] is None
        assert written == [shared_key]

        # The owner's own id is in the response, so the owner gets an entry of their own.
        assert (await owner.get(path)).json()["user"] == "user1-id"
        assert written == [shared_key, f"{path}_()_{mock_add_users['user1']['id']}_v=0"]
        assert (await anonymous.get(path)).json()["user"] is None
    finally:
        await anonymous.aclose()


async def test_an_owner_first_response_is_kept_from_everyone_else(
    app, auth_clients, user_data, session, monkeypatch
):
    owner = next(c for c in auth_clients if c.username == "user1-id")
    other = next(c for c in auth_clients if c.username == "user2-id")
    study = session.query(Study).filter_by(user_id="user1-id", public=True).first()
    path = f"/api/studies/{study.id}?nested=true"

    assert (await owner.get(path)).json()["user"] == "user1-id"
    assert (await other.get(path)).json()["user"] is None


async def test_a_warm_shared_detail_entry_is_served(
    auth_client, user_data, session, monkeypatch
):
    study = session.query(Study).filter_by(user_id="user2-id", public=True).first()
    shared_key = f"/api/studies/{study.id}_()__v=0_owners"
    cached_payload = (
        {"id": study.id, "name": "warm-cache-study"},
        200,
        {"Content-Type": "application/json"},
    )
    cache.cache.set(shared_key, (cached_payload, frozenset({"user2-id"})), timeout=60)

    warm_response = await auth_client.get(f"/api/studies/{study.id}")

    assert warm_response.status_code == 200
    assert warm_response.json()["name"] == "warm-cache-study"


def test_cache_key_creator_preserves_extra_args(monkeypatch):
    class DummyRequest:
        url = type("URL", (), {"path": "/api/studies/"})()

        class query_params:
            @staticmethod
            def multi_items():
                return [("b", "2"), ("a", "1")]

    class DummyUser:
        id = "user-1"

    monkeypatch.setattr(base_resource, "request", DummyRequest())
    monkeypatch.setattr(base_resource, "get_current_user", lambda: DummyUser())

    key = base_resource.cache_key_creator(extra_args={"b": ["1", "3"], "z": "last"})

    assert (
        key == "/api/studies/_(('a', '1'), ('b', '1'), ('b', '2'), "
        "('b', '3'), ('z', 'last'))_user-1_v=0"
    )
