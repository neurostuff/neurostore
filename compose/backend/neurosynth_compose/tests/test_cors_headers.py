import httpx
import pytest
from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import Response
from starlette.routing import Route

from neurosynth_compose.tests.request_utils import Client


@pytest.fixture
def anonymous_client(app):
    return Client(token=None, asgi_app=app.asgi_app)


@pytest.fixture
def invalid_token_client(app):
    return Client(token="not-a-real-token", asgi_app=app.asgi_app)


@pytest.mark.parametrize(
    "client_fixture, method, path, expected_status",
    [
        ("auth_client", "get", "/api/specifications?page_size=1", 200),
        ("anonymous_client", "post", "/api/snapshot-annotations", 401),
        ("invalid_token_client", "post", "/api/snapshot-annotations", 401),
        ("anonymous_client", "get", "/api/not-a-real-route", 404),
    ],
)
def test_cors_headers_present(
    client_fixture, method, path, expected_status, request, user_data
):
    client = request.getfixturevalue(client_fixture)
    origin = "https://client.example"
    headers = {"Origin": origin}
    response = getattr(client, method)(path, headers=headers)

    assert response.status_code == expected_status
    assert response.headers.get("Access-Control-Allow-Origin") == origin
    assert response.headers.get("Access-Control-Allow-Credentials") == "true"
    assert response.headers.get("Vary") == "Origin"


def test_cors_headers_on_empty_delete_response(auth_client, user_data):
    origin = "https://client.example"
    created = auth_client.post("/api/projects", data={"name": "cors-project"})
    assert created.status_code == 200

    response = auth_client.delete(
        f"/api/projects/{created.json['id']}", headers={"Origin": origin}
    )

    assert response.status_code == 204
    assert response.headers.get("Access-Control-Allow-Origin") == origin
    assert response.headers.get("Access-Control-Allow-Credentials") == "true"


def test_cors_headers_on_malformed_json(auth_client, user_data):
    origin = "https://client.example"
    response = auth_client.post(
        "/api/meta-analysis-jobs",
        data="{",
        content_type="application/json",
        headers={"Origin": origin},
        json_dump=False,
    )

    assert response.status_code == 422
    assert response.headers.get("Access-Control-Allow-Origin") == origin
    assert response.headers.get("Access-Control-Allow-Credentials") == "true"


def test_cors_headers_on_validation_error(auth_client, user_data):
    origin = "https://client.example"
    response = auth_client.post(
        "/api/meta-analyses",
        data={"name": 123},
        headers={"Origin": origin},
    )

    assert response.status_code == 422
    assert response.headers.get("Access-Control-Allow-Origin") == origin
    assert response.headers.get("Access-Control-Allow-Credentials") == "true"


@pytest.mark.anyio
async def test_cors_headers_on_nonstandard_error_status():
    async def rate_limited(_request):
        return Response(status_code=420)

    app = CORSMiddleware(
        Starlette(routes=[Route("/rate-limited", rate_limited)]),
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    origin = "https://client.example"

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        response = await client.get("/rate-limited", headers={"Origin": origin})

    assert response.status_code == 420
    assert response.headers.get("Access-Control-Allow-Origin") == origin
    assert response.headers.get("Access-Control-Allow-Credentials") == "true"
