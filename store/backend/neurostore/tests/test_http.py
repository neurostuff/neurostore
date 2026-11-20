import re

import httpx
import pytest

from neurostore import create_asgi_app

pytestmark = pytest.mark.anyio


def _client(app):
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
        base_url="https://testserver",
        follow_redirects=True,
    )


async def test_app_serves_openapi_validation_errors_with_cors():
    async with _client(create_asgi_app()) as client:
        response = await client.post(
            "/api/pipeline-configs/",
            json=[],
            headers={"Origin": "https://client.example"},
        )

    assert response.status_code == 400
    assert response.headers["Access-Control-Allow-Origin"] == "https://client.example"
    assert response.headers["Access-Control-Allow-Credentials"] == "true"


async def test_app_preserves_protected_operation_auth_errors():
    async with _client(create_asgi_app()) as client:
        response = await client.post(
            "/api/pipelines/",
            json={},
            headers={"Origin": "https://client.example"},
        )

    assert response.status_code == 401
    assert response.json()["title"] == "Unauthorized"
    assert response.headers["Access-Control-Allow-Origin"] == "https://client.example"


async def test_admin_requires_the_configured_username_and_password(monkeypatch):
    from neurostore.config import DockerTestConfig

    monkeypatch.setattr(DockerTestConfig, "ADMIN_USERNAME", "operator")
    monkeypatch.setattr(DockerTestConfig, "ADMIN_PASSWORD", "secret")

    async with _client(create_asgi_app()) as client:
        login_page = await client.get("/admin/login")
        unauthenticated = await client.get("/admin/", follow_redirects=False)
        authenticated = await client.post(
            "/admin/login",
            data={"username": "operator", "password": "secret"},
            follow_redirects=False,
        )
        dashboard = await client.get("/admin/")

    assert unauthenticated.status_code == 302
    assert unauthenticated.headers["location"].endswith("/admin/login")
    assert 'action="https://testserver/admin/login"' in login_page.text
    assert authenticated.status_code == 302
    assert "secure" in authenticated.headers["set-cookie"].lower()
    assert "samesite=lax" in authenticated.headers["set-cookie"].lower()
    assert dashboard.status_code == 200
    assert "NeuroStore Admin" in dashboard.text
    assert 'href="#admin-menu-auth"' in dashboard.text
    assert "ti ti-list" in dashboard.text
    assert "border-start" in dashboard.text


def _admin_app(monkeypatch):
    from neurostore.config import DockerTestConfig

    monkeypatch.setattr(DockerTestConfig, "ADMIN_USERNAME", "operator")
    monkeypatch.setattr(DockerTestConfig, "ADMIN_PASSWORD", "secret")
    return create_asgi_app()


async def _log_in(client):
    await client.post("/admin/login", data={"username": "operator", "password": "secret"})


async def test_admin_user_edit_form_offers_only_roles_among_relationships(
    monkeypatch, session
):
    from neurostore.models import Role, User

    role = Role(name="admin")
    user = User(name="pondie-uploader", external_id="client@clients", roles=[role])
    session.add_all([role, user])
    session.commit()
    user_id = user.id

    async with _client(_admin_app(monkeypatch)) as client:
        await _log_in(client)
        edit = await client.get(f"/admin/user/edit/{user_id}")

    assert edit.status_code == 200
    assert 'name="roles"' in edit.text
    # Each of these is a select of every row in its table: millions on a real database.
    for relationship in ("studies", "analyses", "points", "point_values", "base_studies"):
        assert f'name="{relationship}"' not in edit.text


async def test_admin_user_edit_form_names_each_role_it_offers(monkeypatch, session):
    from neurostore.models import Role, User

    admin, reviewer = Role(name="admin"), Role(name="admin-reviewer")
    user = User(name="James Kent", external_id="github|1", roles=[reviewer])
    session.add_all([admin, reviewer, user])
    session.commit()
    user_id = user.id

    async with _client(_admin_app(monkeypatch)) as client:
        await _log_in(client)
        edit = await client.get(f"/admin/user/edit/{user_id}")

    assert re.search(r"<option[^>]*>\s*admin\s*</option>", edit.text)
    assert re.search(r"<option[^>]*selected[^>]*>\s*admin-reviewer\s*</option>", edit.text)
    assert "Role object at" not in edit.text


async def test_admin_user_edit_form_grants_a_role(monkeypatch, session):
    from neurostore.models import Role, User

    role = Role(name="admin")
    user = User(name="pondie-uploader", external_id="client@clients")
    session.add_all([role, user])
    session.commit()
    user_id, role_id = user.id, role.id

    async with _client(_admin_app(monkeypatch)) as client:
        await _log_in(client)
        saved = await client.post(
            f"/admin/user/edit/{user_id}",
            data={"name": "pondie-uploader", "external_id": "client@clients", "roles": role_id},
            follow_redirects=False,
        )

    session.expire_all()
    assert saved.status_code == 302
    assert [r.name for r in session.get(User, user_id).roles] == ["admin"]


async def test_admin_role_details_page_renders_despite_its_dynamic_users(
    monkeypatch, session
):
    from neurostore.models import Role, User

    role = Role(name="admin")
    session.add_all([role, User(name="someone", external_id="someone", roles=[role])])
    session.commit()
    role_id = role.id

    async with _client(_admin_app(monkeypatch)) as client:
        await _log_in(client)
        details = await client.get(f"/admin/role/details/{role_id}")

    assert details.status_code == 200


async def test_app_serves_a_cached_resource_through_the_native_request_path(app, db):
    async with _client(app.asgi_app) as client:
        first = await client.get("/api/studies/?page=1&page_size=10")
        second = await client.get("/api/studies/?page_size=10&page=1")

    assert first.status_code == 200
    assert first.json()["metadata"]["total_count"] == 0
    assert second.status_code == 200
    assert second.json() == first.json()
