import pytest


def test_decode_token(add_users):
    from ..resources.auth import decode_token, AuthError

    with pytest.raises(AuthError):
        decode_token("improper_token")

    for user in add_users.values():
        decode_token(user["token"])
