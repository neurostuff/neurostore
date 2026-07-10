import pytest

from neurostore.tests.conftest import auth_test
from neurostore.tests.request_utils import Client


@auth_test
def test_decode_token(add_users):
    from connexion.exceptions import OAuthProblem
    from neurostore.resources.auth import decode_token

    with pytest.raises(OAuthProblem) as exc_info:
        decode_token("improper_token")

    assert exc_info.value.status_code == 401

    for user in add_users.values():
        decode_token(user["token"])


@auth_test
def test_creating_new_user_on_db(add_users):
    from neurostore.tests.request_utils import Client

    token_info = add_users
    user_name = "user1"  # user1 was not entered into database

    client = Client(
        token=token_info[user_name]["token"],
        username=token_info[user_name]["external_id"],
    )

    client.post("/api/studies/", data={"name": "my study"})


def test_studysets_no_auth_returns_cors_headers(app):
    client = Client(token=None)
    origin = "https://client.example"

    try:
        response = client.post(
            "/api/studysets/",
            data={},
            headers={"Origin": origin},
        )
    finally:
        client.close()

    assert response.status_code == 401
    assert response.headers.get("Access-Control-Allow-Origin") == origin
    assert response.headers.get("Access-Control-Allow-Credentials") == "true"
    assert response.headers.get("Vary") == "Origin"


def test_studysets_bad_token_returns_cors_headers(app):
    client = Client(token="not-a-real-token")
    origin = "https://client.example"

    try:
        response = client.post(
            "/api/studysets/",
            data={},
            headers={"Origin": origin},
        )
    finally:
        client.close()

    assert response.status_code == 401
    assert response.headers.get("Access-Control-Allow-Origin") == origin
    assert response.headers.get("Access-Control-Allow-Credentials") == "true"
    assert response.headers.get("Vary") == "Origin"
