import pytest

from ..resources.auth import decode_token, AuthError


def test_decode_token():
    with pytest.raises(AuthError):
        decode_token("improper_token")
