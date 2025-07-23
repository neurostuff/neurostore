import pytest


@pytest.fixture
def mock_add_users_pure():
    # No DB or JWT logic, just mock tokens and IDs
    tokens = {
        "user1": {
            "token": "mock_token_1",
            "external_id": "mocked-user-id",
            "id": "mock_id_1",
        },
        "user2": {
            "token": "mock_token_2",
            "external_id": "mocked-user-id",
            "id": "mock_id_2",
        },
    }
    yield tokens


def test_decode_token(monkeypatch, mock_add_users_pure):
    import types
    import json
    from neurosynth_compose.resources import auth

    # Patch urlopen to return a fake JWKS
    class FakeResponse:
        def read(self):
            # Minimal JWKS with one key
            return json.dumps(
                {
                    "keys": [
                        {
                            "kty": "RSA",
                            "kid": "test_kid",
                            "use": "sig",
                            "n": "test_n",
                            "e": "test_e",
                        }
                    ]
                }
            ).encode("utf-8")

    monkeypatch.setattr(auth, "urlopen", lambda url: FakeResponse())

    # Patch jwt.get_unverified_header to return a header with kid
    monkeypatch.setattr(
        auth.jwt, "get_unverified_header", lambda token: {"kid": "test_kid"}
    )

    # Patch jwt.decode to return a payload for valid tokens, raise for invalid
    def fake_jwt_decode(token, rsa_key, algorithms, audience, issuer):
        if token == "improper_token":
            raise auth.jwt.ExpiredSignatureError("Token expired")
        return {"sub": "mocked-user-id"}

    monkeypatch.setattr(auth.jwt, "decode", fake_jwt_decode)

    # Patch app.config
    fake_config = {
        "AUTH0_BASE_URL": "https://fake-auth0.com",
        "AUTH0_API_AUDIENCE": "fake-audience",
    }
    monkeypatch.setattr(auth, "app", types.SimpleNamespace(config=fake_config))

    # Test invalid token raises AuthError
    with pytest.raises(auth.AuthError):
        auth.decode_token("improper_token")

    # Test valid tokens
    for user in mock_add_users_pure.values():
        result = auth.decode_token(user["token"])
        assert result["sub"] == "mocked-user-id"


def test_creating_new_user_on_db(session, mock_add_users):
    from ..request_utils import Client

    token_info = mock_add_users
    user_name = "user1"  # user1 was not entered into database

    client = Client(
        token=token_info[user_name]["token"],
        username=token_info[user_name]["external_id"],
    )

    resp = client.post("/api/projects", data={"name": "my project"})

    assert resp.status_code == 200
