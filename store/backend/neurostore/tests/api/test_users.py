import pytest

pytestmark = pytest.mark.anyio

from neurostore.models import User


async def test_create_user(async_auth_client, session):
    new_user = {
        "name": "fake name",
        "external_id": "1234",
    }
    resp = await async_auth_client.post("/api/users/", data=new_user)

    assert resp.status_code == 200
    assert User.query.filter_by(external_id="1234").first() is not None


async def test_list_users(async_auth_client, session):
    resp = await async_auth_client.get("/api/users/")
    assert resp.status_code == 200


async def test_list_user(async_auth_client, session):
    user = User.query.filter_by(name="user1").first()
    resp = await async_auth_client.get(f"/api/users/{user.id}")
    assert resp.status_code == 200
