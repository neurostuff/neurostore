import httpx
import pytest

from neurostore import create_asgi_app

pytestmark = pytest.mark.anyio


def _client(app):
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://testserver",
        follow_redirects=True,
    )


async def test_async_app_serves_openapi_validation_errors_with_cors():
    async with _client(create_asgi_app()) as client:
        response = await client.post(
            "/api/pipeline-configs/",
            json=[],
            headers={"Origin": "https://client.example"},
        )

    assert response.status_code == 400
    assert response.headers["Access-Control-Allow-Origin"] == "https://client.example"
    assert response.headers["Access-Control-Allow-Credentials"] == "true"


async def test_async_app_preserves_protected_operation_auth_errors():
    async with _client(create_asgi_app()) as client:
        response = await client.post(
            "/api/pipelines/",
            json={},
            headers={"Origin": "https://client.example"},
        )

    assert response.status_code == 401
    assert response.json()["title"] == "Unauthorized"
    assert response.headers["Access-Control-Allow-Origin"] == "https://client.example"


async def test_async_admin_requires_the_configured_username_and_password(monkeypatch):
    from neurostore.config import DockerTestConfig

    monkeypatch.setattr(DockerTestConfig, "ADMIN_USERNAME", "operator")
    monkeypatch.setattr(DockerTestConfig, "ADMIN_PASSWORD", "secret")

    async with _client(create_asgi_app()) as client:
        unauthenticated = await client.get("/admin/", follow_redirects=False)
        authenticated = await client.post(
            "/admin/login",
            data={"username": "operator", "password": "secret"},
            follow_redirects=False,
        )
        dashboard = await client.get("/admin/")

    assert unauthenticated.status_code == 302
    assert unauthenticated.headers["location"].endswith("/admin/login")
    assert authenticated.status_code == 302
    assert dashboard.status_code == 200
    assert "NeuroStore Admin" in dashboard.text


async def test_async_app_serves_a_cached_resource_through_the_native_request_path(
    app, db
):
    async with _client(app.asgi_app) as client:
        first = await client.get("/api/studies/?page=1&page_size=10")
        second = await client.get("/api/studies/?page_size=10&page=1")

    assert first.status_code == 200
    assert first.json()["metadata"]["total_count"] == 0
    assert second.status_code == 200
    assert second.json() == first.json()
