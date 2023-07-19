import pytest


def test_decode_token(add_users):
    from ..resources.auth import decode_token, AuthError

    with pytest.raises(AuthError):
        decode_token("improper_token")

    for user in add_users.values():
        decode_token(user["token"])


def test_creating_new_user_on_db(add_users):
    from .request_utils import Client

    token_info = add_users
    user_name = "user1"  # user1 was not entered into database

    client = Client(
        token=token_info[user_name]["token"],
        username=token_info[user_name]["external_id"]
    )

    client.post("/api/studies/", data={"name": "my study"})
