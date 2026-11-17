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

from neurosynth_compose.models import MetaAnalysis, Role, Specification, User
from neurosynth_compose.resources import auth
from neurosynth_compose.settings import load_settings
from neurosynth_compose.tests.request_utils import Client

SPEC = {
    "estimator": {"type": "ALE"},
    "type": "cbma",
    "conditions": [True],
    "weights": [1],
    "corrector": {"type": "FDRCorrector"},
    "filter": "eyes",
}


class Signer:
    """Mints tokens the way the tenant would."""

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

    def token(self, sub, scope="", aud=None, **claims):
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
        return jwt.encode(payload, self.pem, algorithm="RS256", headers={"kid": self.kid})


@pytest.fixture
def signer(monkeypatch):
    signer = Signer(load_settings())
    monkeypatch.setattr(auth, "_fetch_jwks", lambda base_url: signer.jwks)
    monkeypatch.setattr(auth, "_jwks_cache", {})
    return signer


@pytest.fixture
def agent_client(app, signer):
    def make(sub, scope, **claims):
        return Client(
            token=signer.token(sub, scope, **claims), asgi_app=app.asgi_app, username=sub
        )

    return make


def test_on_behalf_of_token_is_delegated(signer):
    token = signer.token(
        "user1-id",
        "openid read",
        aud=signer.settings["AUTH0_API_AUDIENCE"],
        act={"sub": "mcp-server-id"},
    )

    payload = auth._decode_token(token, signer.settings)

    assert payload["delegated"] is True
    assert payload["scopes"] == ["read"]
    assert payload["actor"] == "mcp-server-id"


def test_agent_tokens_are_refused_when_the_agent_audience_is_unset(signer):
    settings = {**signer.settings, "AUTH0_AGENT_AUDIENCE": ""}

    with pytest.raises(OAuthProblem):
        auth._decode_token(signer.token("user1-id", "write"), settings)


def test_write_agent_acts_as_its_user_and_is_logged(
    agent_client, mock_add_users, session, caplog
):
    client = agent_client("user1-id", "openid write")

    with caplog.at_level(logging.INFO, logger="neurosynth_compose.agents"):
        resp = client.post("/api/specifications", data=SPEC)

    assert resp.status_code == 200, resp.json()
    assert session.get(Specification, resp.json()["id"]).user_id == "user1-id"
    [record] = [r for r in caplog.records if r.name == "neurosynth_compose.agents"]
    assert record.getMessage() == (
        "agent write POST /api/specifications user=user1-id agent=agent-app-id actor=None"
    )


def test_a_new_user_is_named_from_the_tokens_name_claim(agent_client, session):
    # the user's first request is an agent's: its token can't be used at /userinfo
    client = agent_client("new-agent-user", "write", **{auth.NAME_CLAIM: "Ada Lovelace"})

    resp = client.post("/api/specifications", data=SPEC)

    assert resp.status_code == 200, resp.json()
    assert User.query.filter_by(external_id="new-agent-user").one().name == "Ada Lovelace"


def test_read_agent_cannot_write(agent_client, mock_add_users):
    client = agent_client("user1-id", "openid read")

    assert client.get("/api/specifications").status_code == 200
    assert client.post("/api/specifications", data=SPEC).status_code == 403


def test_agent_of_an_admin_gets_no_admin_power(agent_client, user_data, session):
    meta_analysis = MetaAnalysis.query.filter_by(
        user=User.query.filter_by(name="user1").first()
    ).first()
    admin_role = Role.query.filter_by(name="admin").first() or Role(
        id="admin", name="admin", description="Admin role"
    )
    admin_user = User(name="admin_user", external_id="admin-user-id")
    admin_user.roles.append(admin_role)
    session.add(admin_user)
    session.commit()

    resp = agent_client("admin-user-id", "write").put(
        f"/api/meta-analyses/{meta_analysis.id}", data={"name": "by agent"}
    )

    assert resp.status_code == 403
