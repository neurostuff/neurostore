"""A record's owner is served as their Auth0 id only to that owner; everyone else
sees the username alone."""

from sqlalchemy import select

from neurosynth_compose.models import MetaAnalysis, Project, Specification, User
from neurosynth_compose.tests.request_utils import Client

OWNER = "user1-id"


def _owned(session, model):
    query = select(model).where(model.user_id == OWNER)
    if hasattr(model, "public"):
        query = query.where(model.public.is_(True))
    return session.execute(query.limit(1)).scalar_one()


def _paths(session):
    project = _owned(session, Project)
    meta_analysis = _owned(session, MetaAnalysis)
    specification = _owned(session, Specification)
    user = session.execute(select(User).where(User.external_id == OWNER)).scalar_one()
    return [
        "/api/projects",
        f"/api/projects/{project.id}",
        f"/api/projects/{project.id}?info=true",
        "/api/meta-analyses",
        "/api/meta-analyses?nested=true",
        f"/api/meta-analyses/{meta_analysis.id}",
        f"/api/meta-analyses/{meta_analysis.id}?nested=true",
        "/api/specifications",
        f"/api/specifications/{specification.id}",
        "/api/users",
        f"/api/users/{user.id}",
    ]


def test_no_endpoint_serves_another_users_auth0_id(app, auth_clients, user_data, session):
    anonymous = Client(token=None, asgi_app=app.asgi_app)
    other = next(c for c in auth_clients if c.username == "user2-id")
    for path in _paths(session):
        for client in (anonymous, other):
            resp = client.get(path)
            assert resp.status_code == 200, (path, resp.status_code)
            assert OWNER not in resp.text, (path, client.username)


def test_the_owner_sees_their_own_auth0_id(auth_client, user_data, session):
    assert auth_client.username == OWNER
    project = _owned(session, Project)
    user = session.execute(select(User).where(User.external_id == OWNER)).scalar_one()

    assert auth_client.get(f"/api/projects/{project.id}").json["user"] == OWNER
    assert auth_client.get(f"/api/users/{user.id}").json["external_id"] == OWNER


def test_others_see_the_username_without_the_id(app, user_data, session):
    anonymous = Client(token=None, asgi_app=app.asgi_app)
    project = _owned(session, Project)
    resp = anonymous.get(f"/api/projects/{project.id}")
    assert resp.json["user"] is None
    assert resp.json["username"] == "user1"


def test_a_refused_delete_does_not_name_the_owner(auth_clients, user_data, session):
    other = next(c for c in auth_clients if c.username == "user2-id")
    project = _owned(session, Project)
    resp = other.delete(f"/api/projects/{project.id}")
    assert resp.status_code == 403
    assert OWNER not in resp.text

