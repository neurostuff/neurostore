import pytest

pytestmark = pytest.mark.anyio

async def test_get_conditions(async_auth_client, ingest_neurovault, session):
    resp = await async_auth_client.get("/api/conditions/")
    assert resp.status_code == 200
    assert len(resp.json()["results"]) > 1


async def test_post_conditions(async_auth_client, ingest_neurovault, session):
    my_condition = {"name": "ice cream", "description": "surprise, it's rocky road!"}
    post_resp = await async_auth_client.post("/api/conditions/", data=my_condition)
    assert post_resp.status_code == 200
    post_data = post_resp.json()
    get_data = (await async_auth_client.get(f"/api/conditions/{post_data['id']}")).json()
    for attr in my_condition.keys():
        assert post_data[attr] == get_data[attr] == my_condition[attr]


def test_put_conditions():
    pass
