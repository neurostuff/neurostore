import pytest

from neurostore.cache_versioning import bump_cache_versions
from neurostore.extensions import cache
from neurostore.models import Study
from neurostore.resources import base as base_resource


pytestmark = pytest.mark.anyio


async def test_list_cache_key_matches_flask_shape(
    async_auth_client, mock_add_users, session
):
    response = await async_auth_client.get("/api/studies/?b=2&a=1&b=1")

    assert response.status_code == 200
    expected_key = (
        "/api/studies/_(('a', '1'), ('b', '1'), ('b', '2'))_"
        f"{mock_add_users['user1']['id']}_v=0"
    )
    assert cache.cache.get(expected_key) is not None


async def test_list_cache_key_embeds_existing_version(
    async_auth_client, mock_add_users, session
):
    bump_cache_versions({"studies": ["study-1"]})

    response = await async_auth_client.get("/api/studies/?nested=false")

    assert response.status_code == 200
    expected_key = (
        "/api/studies/_(('nested', 'false'),)_"
        f"{mock_add_users['user1']['id']}_v=1"
    )
    assert cache.cache.get(expected_key) is not None


async def test_list_cache_serves_warm_value_with_flask_compatible_key(
    async_auth_client, mock_add_users, user_data
):
    cache_key = f"/api/studies/_()_{mock_add_users['user1']['id']}_v=0"

    cold_response = await async_auth_client.get("/api/studies/")

    assert cold_response.status_code == 200
    assert cache.cache.get(cache_key) is not None

    cached_payload = (
        {"results": [], "metadata": {"total_count": 0}, "warm_cache": True},
        200,
        {"Content-Type": "application/json"},
    )
    cache.cache.set(cache_key, cached_payload, timeout=60)

    warm_response = await async_auth_client.get("/api/studies/")

    assert warm_response.status_code == 200
    assert warm_response.json()["warm_cache"] is True


async def test_object_cache_serves_warm_value_with_flask_compatible_key(
    async_auth_client, mock_add_users, user_data, session, monkeypatch
):
    study = session.query(Study).filter_by(public=True).first()
    # Detail GET is anonymous in the OpenAPI contract, so Connexion does not
    # invoke optional Bearer authentication and Flask used an empty user slot.
    cache_key = f"/api/studies/{study.id}_()__v=0"
    written_keys = []
    original_set = cache.cache.set

    def record_set(*args, **kwargs):
        written_keys.append(args[0])
        return original_set(*args, **kwargs)

    monkeypatch.setattr(cache.cache, "set", record_set)

    cold_response = await async_auth_client.get(f"/api/studies/{study.id}")

    assert cold_response.status_code == 200
    assert cache_key in written_keys
    assert cache.cache.get(cache_key) is not None

    cached_payload = (
        {"id": study.id, "name": "warm-cache-study"},
        200,
        {"Content-Type": "application/json"},
    )
    cache.cache.set(cache_key, cached_payload, timeout=60)

    warm_response = await async_auth_client.get(f"/api/studies/{study.id}")

    assert warm_response.status_code == 200
    assert warm_response.json()["name"] == "warm-cache-study"


def test_cache_key_creator_preserves_extra_args(monkeypatch):
    class DummyRequest:
        path = "/api/studies/"

        @staticmethod
        def query_items():
            return [("b", "2"), ("a", "1")]

    class DummyUser:
        id = "user-1"

    monkeypatch.setattr(base_resource, "request", DummyRequest())
    monkeypatch.setattr(base_resource, "get_current_user", lambda: DummyUser())

    key = base_resource.cache_key_creator(
        extra_args={"b": ["1", "3"], "z": "last"}
    )

    assert (
        key
        == "/api/studies/_(('a', '1'), ('b', '1'), ('b', '2'), "
        "('b', '3'), ('z', 'last'))_user-1_v=0"
    )
