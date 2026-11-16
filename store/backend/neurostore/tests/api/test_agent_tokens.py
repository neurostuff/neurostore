"""Agents acting for a user, on tokens for the agents API (AUTH0_AGENT_AUDIENCE) or
carrying an on-behalf-of `act` claim. Tokens are signed with a local RSA key whose
JWKS stands in for the tenant's, so the real JWT path runs."""

import logging
import time

import pytest
from connexion.exceptions import OAuthProblem
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwk, jwt

from neurostore.models import ApiKey, Study, User
from neurostore.resources import auth
from neurostore.settings import load_settings
from neurostore.tests.request_utils import AsyncClient

pytestmark = pytest.mark.anyio


class Signer:
    """Mints tokens the way the tenant would, and counts JWKS fetches."""

    def __init__(self, settings, kid="agent-test-key"):
        private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.pem = private.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
        public = jwk.construct(
            private.public_key().public_bytes(
                serialization.Encoding.PEM,
                serialization.PublicFormat.SubjectPublicKeyInfo,
            ),
            "RS256",
        ).to_dict()
        self.kid = kid
        self.jwks = {"keys": [{**public, "kid": kid, "use": "sig"}]}
        self.settings = settings
        self.fetches = 0

    def fetch(self, base_url):
        assert base_url == self.settings["AUTH0_BASE_URL"]
        self.fetches += 1
        return self.jwks

    def token(self, sub, scope="", aud=None, kid=None, **claims):
        payload = {
            "sub": sub,
            "iss": self.settings["AUTH0_BASE_URL"] + "/",
            "aud": aud or self.settings["AUTH0_AGENT_AUDIENCE"],
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
            "azp": "agent-app-id",
            "scope": scope,
            **claims,
        }
        return jwt.encode(
            payload, self.pem, algorithm="RS256", headers={"kid": kid or self.kid}
        )


@pytest.fixture
def signer(monkeypatch):
    signer = Signer(load_settings())
    monkeypatch.setattr(auth, "_fetch_jwks", signer.fetch)
    monkeypatch.setattr(auth, "_jwks_cache", {})
    return signer


@pytest.fixture
async def agent_client(app, signer):
    clients = []

    def make(sub, scope, **claims):
        client = AsyncClient(
            token=signer.token(sub, scope, **claims), asgi_app=app.asgi_app, username=sub
        )
        clients.append(client)
        return client

    yield make
    for client in clients:
        await client.aclose()


def test_agent_audience_token_is_delegated_with_its_api_scopes(signer):
    token = signer.token("user1-id", "openid profile read write offline_access")

    payload = auth._decode_token(token, signer.settings)

    assert payload["delegated"] is True
    assert payload["scopes"] == ["read", "write"]
    assert payload["agent"] == "agent-app-id"


def test_login_token_for_the_api_audience_is_not_delegated(signer):
    token = signer.token("user1-id", aud=signer.settings["AUTH0_API_AUDIENCE"])

    payload = auth._decode_token(token, signer.settings)

    assert "delegated" not in payload


def test_on_behalf_of_token_is_delegated_on_any_audience(signer):
    token = signer.token(
        "user1-id",
        "read",
        aud=signer.settings["AUTH0_API_AUDIENCE"],
        act={"sub": "mcp-server-id"},
    )

    payload = auth._decode_token(token, signer.settings)

    assert payload["delegated"] is True
    assert payload["actor"] == "mcp-server-id"


@pytest.mark.parametrize("agent_audience", ["", None])
def test_agent_tokens_are_refused_when_the_agent_audience_is_unset(
    signer, agent_audience
):
    token = signer.token("user1-id", "write")
    settings = {**signer.settings, "AUTH0_AGENT_AUDIENCE": agent_audience}

    with pytest.raises(OAuthProblem):
        auth._decode_token(token, settings)


def test_token_for_another_audience_is_refused(signer):
    token = signer.token("user1-id", "write", aud="https://elsewhere.example/api/")

    with pytest.raises(OAuthProblem):
        auth._decode_token(token, signer.settings)


def test_jwks_is_fetched_once_and_again_for_a_rotated_key(signer, monkeypatch):
    for _ in range(3):
        auth._decode_token(signer.token("user1-id", "read"), signer.settings)
    assert signer.fetches == 1

    # a kid it hasn't seen refetches, but not on every request
    with pytest.raises(OAuthProblem):
        auth._decode_token(signer.token("user1-id", kid="rotated"), signer.settings)
    assert signer.fetches == 1
    fetched_at, jwks = auth._jwks_cache[signer.settings["AUTH0_BASE_URL"]]
    auth._jwks_cache[signer.settings["AUTH0_BASE_URL"]] = (fetched_at - 120, jwks)
    signer.jwks = {"keys": [{**signer.jwks["keys"][0], "kid": "rotated"}]}
    auth._decode_token(signer.token("user1-id", kid="rotated"), signer.settings)
    assert signer.fetches == 2


async def test_write_agent_acts_as_its_user_and_is_logged(
    agent_client, mock_add_users, session, caplog
):
    client = agent_client("user1-id", "openid write")

    with caplog.at_level(logging.INFO, logger="neurostore.agents"):
        resp = await client.post("/api/studies/", data={"name": "made by an agent"})

    assert resp.status_code == 200, resp.json()
    assert session.get(Study, resp.json()["id"]).user_id == "user1-id"
    [record] = [r for r in caplog.records if r.name == "neurostore.agents"]
    assert record.getMessage() == (
        "agent write POST /api/studies/ user=user1-id agent=agent-app-id actor=None"
    )


async def test_read_agent_cannot_write(agent_client, mock_add_users):
    client = agent_client("user1-id", "openid read")

    assert (await client.get("/api/studies/")).status_code == 200
    resp = await client.post("/api/studies/", data={"name": "nope"})
    assert resp.status_code == 403


async def test_agent_without_api_scopes_cannot_write(agent_client, mock_add_users):
    client = agent_client("user1-id", "openid profile")

    resp = await client.post("/api/studies/", data={"name": "nope"})

    assert resp.status_code == 403


async def test_agent_of_an_admin_gets_no_admin_power(
    admin_client, agent_client, user_data
):
    study = Study.query.filter_by(user=User.query.filter_by(name="user1").first()).first()
    agent = agent_client("admin-user-id", "write")

    resp = await agent.put(f"/api/studies/{study.id}", data={"name": "by agent"})
    assert resp.status_code == 403
    resp = await admin_client.put(f"/api/studies/{study.id}", data={"name": "by admin"})
    assert resp.status_code == 200


async def test_agent_cannot_mint_an_api_key(agent_client, mock_add_users, session):
    client = agent_client("user1-id", "write")

    resp = await client.post("/api/api-keys/", data={"name": "forever", "scopes": ["write"]})

    assert resp.status_code == 403
    assert session.query(ApiKey).count() == 0
