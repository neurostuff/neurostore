import pytest

from neurosynth_compose.tests.request_utils import Client


@pytest.fixture
def anonymous_client():
    return Client(token=None)


@pytest.fixture
def invalid_token_client():
    return Client(token="not-a-real-token")


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
