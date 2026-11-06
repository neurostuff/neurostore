"""A study's `public` can be written, so Compose can keep a project's meta study as
private as the project."""

import pytest

from neurostore.models import Study
from neurostore.tests.request_utils import AsyncClient

pytestmark = pytest.mark.anyio


async def test_the_compose_bot_can_make_a_meta_study_private(
    app, auth_clients, mock_add_users, session
):
    owner = next(c for c in auth_clients if c.username == "user1-id")
    bot = next(c for c in auth_clients if c.username.endswith("@clients"))
    created = await owner.post("/api/studies/", data={"name": "my project", "level": "meta"})
    assert created.status_code == 200
    study_id = created.json()["id"]
    assert session.get(Study, study_id).public is True

    resp = await bot.put(f"/api/studies/{study_id}", data={"public": False})
    assert resp.status_code == 200
    session.expire_all()
    assert session.get(Study, study_id).public is False

    anonymous = AsyncClient(token=None, asgi_app=app.asgi_app)
    try:
        listed = await anonymous.get("/api/studies/?level=meta")
    finally:
        await anonymous.aclose()
    assert study_id not in [s["id"] for s in listed.json()["results"]]


async def test_the_owner_can_make_their_study_public_again(
    auth_clients, mock_add_users, session
):
    owner = next(c for c in auth_clients if c.username == "user1-id")
    created = await owner.post("/api/studies/", data={"name": "s", "public": False})
    study_id = created.json()["id"]
    assert session.get(Study, study_id).public is False

    await owner.put(f"/api/studies/{study_id}", data={"public": True})
    session.expire_all()
    assert session.get(Study, study_id).public is True
