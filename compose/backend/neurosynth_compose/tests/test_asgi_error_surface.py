import pytest
from flask import abort
from jose.jwt import encode
from starlette.testclient import TestClient
from werkzeug.routing import Rule


def _assert_json_error_with_cors(response, origin=None):
    assert response.headers["content-type"].startswith("application/json")
    assert "application/problem+json" not in response.headers["content-type"]
    if origin is not None:
        assert response.headers["Access-Control-Allow-Origin"] == origin
        assert response.headers["Access-Control-Allow-Credentials"] == "true"
        assert response.headers["Vary"] == "Origin"


def _install_asgi_error_test_routes(app):
    if "__asgi_error_abort" not in app.view_functions:

        def _abort_status(status_code):
            abort(status_code, description=f"test abort {status_code}")

        app.url_map.add(
            Rule(
                "/__test/asgi-errors/abort/<int:status_code>",
                endpoint="__asgi_error_abort",
                methods=["GET"],
            )
        )
        app.view_functions["__asgi_error_abort"] = _abort_status

    if "__asgi_error_runtime" not in app.view_functions:

        def _raise_runtime_error():
            raise RuntimeError("asgi runtime failure")

        app.url_map.add(
            Rule(
                "/__test/asgi-errors/runtime",
                endpoint="__asgi_error_runtime",
                methods=["GET"],
            )
        )
        app.view_functions["__asgi_error_runtime"] = _raise_runtime_error


@pytest.fixture(scope="module")
def asgi_error_client(app):
    _install_asgi_error_test_routes(app)
    client = TestClient(app.extensions["connexion_asgi"], raise_server_exceptions=False)
    try:
        yield client
    finally:
        client.close()


def test_connexion_parameter_validation_error_is_handled_by_asgi(asgi_error_client):
    response = asgi_error_client.get("/api/meta-analyses?page_size=not-an-int")

    assert response.status_code == 400
    _assert_json_error_with_cors(response)
    body = response.json()
    assert body["status"] == 400
    assert body["title"] == "Bad Request"


def test_connexion_body_validation_error_is_handled_by_asgi(
    asgi_error_client, mock_add_users
):
    token = encode({"sub": "user1-id"}, "abc", algorithm="HS256")

    response = asgi_error_client.post(
        "/api/meta-analyses",
        json={"name": 123},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 400
    _assert_json_error_with_cors(response)
    body = response.json()
    assert body["status"] == 400
    assert body["title"] == "Bad Request"


@pytest.mark.parametrize("status_code", [401, 404, 422])
def test_flask_abort_errors_are_handled_by_asgi(asgi_error_client, status_code):
    response = asgi_error_client.get(
        f"/__test/asgi-errors/abort/{status_code}",
        headers={"Origin": "https://client.example"},
    )

    assert response.status_code == status_code
    _assert_json_error_with_cors(response, "https://client.example")
    body = response.json()
    assert body["status"] == status_code
    assert body["detail"] == f"test abort {status_code}"


def test_generic_api_error_is_handled_by_asgi(asgi_error_client):
    response = asgi_error_client.get("/__test/asgi-errors/runtime")

    assert response.status_code == 500
    _assert_json_error_with_cors(response)
    body = response.json()
    assert body["status"] == 500
    assert body["title"] == "Internal Server Error"


def test_admin_auth_failure_remains_flask_owned_with_cors(asgi_error_client):
    response = asgi_error_client.get(
        "/admin/",
        headers={"Origin": "https://client.example"},
    )

    assert response.status_code == 401
    assert response.text == "Authentication required"
    assert response.headers["WWW-Authenticate"] == 'Basic realm="Admin"'
    assert response.headers["Access-Control-Allow-Origin"] == "https://client.example"
    assert response.headers["Access-Control-Allow-Credentials"] == "true"
    assert response.headers["Vary"] == "Origin"
