import pytest
from starlette.testclient import TestClient
from werkzeug.routing import Rule

from .request_utils import Client


@pytest.fixture(scope="module")
def cors_test_client(app):
    endpoint_name = "__cors_test_status"
    if endpoint_name not in app.view_functions:
        from flask import jsonify

        def _cors_status(status_code):
            if status_code == 204:
                return "", 204
            return jsonify({"status": status_code}), status_code

        app.url_map.add(
            Rule(
                "/__test/cors/<int:status_code>",
                endpoint=endpoint_name,
                methods=["GET"],
            )
        )
        app.view_functions[endpoint_name] = _cors_status

    client = TestClient(app.extensions["connexion_asgi"])
    try:
        yield client
    finally:
        client.close()


@pytest.fixture
def anonymous_client():
    return Client(token=None)


@pytest.mark.parametrize(
    "client_fixture, method, path, expected_status",
    [
        ("auth_client", "get", "/api/specifications?page_size=1", 200),
        ("cors_test_client", "get", "/__test/cors/204", 204),
        ("cors_test_client", "get", "/__test/cors/400", 400),
        ("anonymous_client", "post", "/api/annotations", 401),
        ("cors_test_client", "get", "/__test/cors/404", 404),
        ("cors_test_client", "get", "/__test/cors/420", 420),
        ("cors_test_client", "get", "/__test/cors/500", 500),
    ],
)
def test_cors_headers_present(
    client_fixture, method, path, expected_status, request, user_data
):
    client = request.getfixturevalue(client_fixture)
    headers = {"Origin": "https://client.example"}
    response = getattr(client, method)(path, headers=headers)

    assert response.status_code == expected_status
    assert response.headers.get("Access-Control-Allow-Origin") == "*"
