from ..conftest import auth_test
import pytest


@auth_test
def test_decode_token(add_users):
    from ...resources.auth import decode_token, AuthError

    with pytest.raises(AuthError):
        decode_token("improper_token")

    for user in add_users.values():
        decode_token(user["token"])


@auth_test
def test_creating_new_user_on_db(add_users):
    from ..request_utils import Client

    token_info = add_users
    user_name = "user1"  # user1 was not entered into database

    client = Client(
        token=token_info[user_name]["token"],
        username=token_info[user_name]["external_id"],
    )

    resp = client.post("/api/projects", data={"name": "my project"})

    assert resp.status_code == 200
