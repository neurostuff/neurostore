"""A record's owner is served as their Auth0 id only to that owner; everyone else
sees the username alone."""

import pytest

from neurostore.models import Annotation, BaseStudy, Image, Point, Study, Studyset, User
from neurostore.tests.request_utils import AsyncClient

pytestmark = pytest.mark.anyio

OWNER = "user1-id"


def _owned(model):
    query = model.query.filter_by(user_id=OWNER)
    if hasattr(model, "public"):
        query = query.filter_by(public=True)
    return query.first()


def _paths():
    studyset = _owned(Studyset)
    study = _owned(Study)
    annotation = _owned(Annotation)
    base_study = _owned(BaseStudy)
    point = _owned(Point)
    image = _owned(Image)
    user = User.query.filter_by(external_id=OWNER).one()
    return [
        "/api/studysets/",
        "/api/studysets/?nested=true",
        f"/api/studysets/{studyset.id}",
        f"/api/studysets/{studyset.id}?nested=true",
        "/api/studies/",
        "/api/studies/?nested=true",
        f"/api/studies/{study.id}",
        f"/api/studies/{study.id}?nested=true",
        "/api/base-studies/",
        f"/api/base-studies/{base_study.id}",
        "/api/analyses/",
        "/api/analyses/?nested=true",
        "/api/conditions/",
        "/api/points/",
        f"/api/points/{point.id}",
        "/api/images/",
        f"/api/images/{image.id}",
        "/api/annotations/",
        f"/api/annotations/{annotation.id}",
        "/api/users/",
        f"/api/users/{user.id}",
    ]


@pytest.fixture
async def anonymous_client(app):
    client = AsyncClient(token=None, asgi_app=app.asgi_app)
    try:
        yield client
    finally:
        await client.aclose()


async def test_no_endpoint_serves_another_users_auth0_id(
    anonymous_client, auth_clients, user_data, session
):
    other = next(c for c in auth_clients if c.username == "user2-id")
    for path in _paths():
        for client in (anonymous_client, other):
            resp = await client.get(path)
            assert resp.status_code in (200, 401), (path, resp.status_code)
            assert OWNER not in resp.text, (path, client.username)


async def test_the_owner_sees_their_own_auth0_id(auth_client, user_data, session):
    assert auth_client.username == OWNER
    study = _owned(Study)
    user = User.query.filter_by(external_id=OWNER).one()

    resp = await auth_client.get(f"/api/studies/{study.id}?nested=true")
    assert resp.json()["user"] == OWNER

    resp = await auth_client.get(f"/api/users/{user.id}")
    assert resp.json()["external_id"] == OWNER


async def test_others_see_the_username_without_the_id(
    anonymous_client, user_data, session
):
    study = _owned(Study)
    resp = await anonymous_client.get(f"/api/studies/{study.id}")
    assert resp.json()["user"] is None
    assert resp.json()["username"] == "user1"


async def test_a_cached_owner_response_is_not_served_to_others(
    auth_client, anonymous_client, user_data, session
):
    study = _owned(Study)
    path = f"/api/studies/{study.id}?nested=true"
    assert (await auth_client.get(path)).json()["user"] == OWNER
    assert (await anonymous_client.get(path)).json()["user"] is None
