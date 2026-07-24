import pytest
import connexion
import httpx
from connexion.exceptions import OAuthProblem, ProblemException
from starlette.exceptions import HTTPException
from starlette.middleware.cors import CORSMiddleware

from neurostore import _DatabaseSessionMiddleware
from neurostore.exceptions.base import NeuroStoreException
from neurostore.exceptions.factories import create_not_found_error
from neurostore.exceptions.handlers import (
    general_exception_handler,
    http_exception_handler,
    neurostore_exception_handler,
    problem_exception_handler,
)
from neurostore.resources.auth import asgi_oauth_problem_handler


pytestmark = pytest.mark.anyio


def _assert_json_error_with_cors(response, origin=None):
    assert response.headers["content-type"].startswith("application/json")
    assert "application/problem+json" not in response.headers["content-type"]
    if origin is not None:
        assert response.headers["Access-Control-Allow-Origin"] == origin
        assert response.headers["Access-Control-Allow-Credentials"] == "true"
        assert response.headers["Vary"] == "Origin"


async def _raise_http_error(request):
    raise HTTPException(request.path_params["status_code"], "test HTTP error")


async def _raise_domain_error(request):
    raise create_not_found_error("Widget", "abc")


async def _raise_runtime_error(request):
    raise RuntimeError("asgi runtime failure")


@pytest.fixture(scope="module")
async def asgi_error_client():
    app = connexion.AsyncApp(__name__)
    app.add_url_rule("/abort/{status_code}", "abort", _raise_http_error)
    app.add_url_rule("/domain", "domain", _raise_domain_error)
    app.add_url_rule("/runtime", "runtime", _raise_runtime_error)
    app.add_error_handler(NeuroStoreException, neurostore_exception_handler)
    app.add_error_handler(OAuthProblem, asgi_oauth_problem_handler)
    app.add_error_handler(ProblemException, problem_exception_handler)
    app.add_error_handler(HTTPException, http_exception_handler)
    app.add_error_handler(Exception, general_exception_handler)
    wrapped_app = _DatabaseSessionMiddleware(
        CORSMiddleware(
            app,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=wrapped_app, raise_app_exceptions=False),
        base_url="http://testserver",
    ) as client:
        yield client


async def test_connexion_validation_error_is_handled_by_asgi(app):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app.asgi_app, raise_app_exceptions=False),
        base_url="http://testserver",
    ) as client:
        response = await client.post("/api/pipeline-configs/", json=[])

    assert response.status_code == 400
    _assert_json_error_with_cors(response)
    body = response.json()
    assert body["status"] == 400
    assert body["title"] == "Bad Request"


async def test_connexion_security_error_is_handled_by_asgi(app):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app.asgi_app, raise_app_exceptions=False),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/api/pipelines/",
            json={},
            headers={"Origin": "https://client.example"},
        )

    assert response.status_code == 401
    _assert_json_error_with_cors(response, "https://client.example")
    body = response.json()
    assert body["status"] == 401
    assert body["title"] == "Unauthorized"


@pytest.mark.parametrize("status_code", [401, 404, 422])
async def test_native_http_errors_are_handled_by_asgi(asgi_error_client, status_code):
    response = await asgi_error_client.get(
        f"/abort/{status_code}",
        headers={"Origin": "https://client.example"},
    )

    assert response.status_code == status_code
    _assert_json_error_with_cors(response, "https://client.example")
    body = response.json()
    assert body["status"] == status_code
    assert body["detail"] == "test HTTP error"


async def test_neurostore_domain_error_is_handled_by_asgi(asgi_error_client):
    response = await asgi_error_client.get("/domain")

    assert response.status_code == 404
    _assert_json_error_with_cors(response)
    body = response.json()
    assert body["status"] == 404
    assert body["title"] == "Not Found"


async def test_generic_api_error_is_handled_by_asgi(asgi_error_client):
    response = await asgi_error_client.get("/runtime")

    assert response.status_code == 500
    _assert_json_error_with_cors(response)
    body = response.json()
    assert body["status"] == 500
    assert body["title"] == "Internal Server Error"
