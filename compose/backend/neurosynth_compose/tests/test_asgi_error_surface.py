import pytest
from jose.jwt import encode
from starlette.testclient import TestClient


def _assert_json_error_with_cors(response, origin=None):
    assert response.headers["content-type"].startswith("application/json")
    assert "application/problem+json" not in response.headers["content-type"]
    if origin is not None:
        assert response.headers["Access-Control-Allow-Origin"] == origin
        assert response.headers["Access-Control-Allow-Credentials"] == "true"
        assert response.headers["Vary"] == "Origin"


@pytest.fixture(scope="module")
def asgi_error_client(app):
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

    assert response.status_code == 422
    _assert_json_error_with_cors(response)
    body = response.json()
    assert body["status"] == 422
    assert "Not a valid string" in body["title"]


def test_not_found_errors_are_handled_by_asgi(asgi_error_client):
    response = asgi_error_client.get(
        "/api/not-a-real-route",
        headers={"Origin": "https://client.example"},
    )

    assert response.status_code == 404
    _assert_json_error_with_cors(response, "https://client.example")
    body = response.json()
    assert body["status"] == 404


def test_admin_unauthenticated_request_redirects_to_login_with_cors(asgi_error_client):
    response = asgi_error_client.get(
        "/admin/",
        headers={"Origin": "https://client.example"},
        follow_redirects=False,
    )

    assert response.status_code in {302, 303}
    assert response.headers["location"].endswith("/admin/login")
    assert response.headers["Access-Control-Allow-Origin"] == "https://client.example"
    assert response.headers["Access-Control-Allow-Credentials"] == "true"
    assert "Origin" in response.headers["Vary"]
