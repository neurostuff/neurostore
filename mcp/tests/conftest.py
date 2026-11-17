"""Servers built from the repo's own API specs, with the APIs and Auth0 stubbed."""

import gzip
import json
from contextlib import asynccontextmanager
from pathlib import Path

import httpx2
import pytest
from fastmcp.server.auth.providers.jwt import JWTVerifier, RSAKeyPair

from neurostore_mcp.auth import Settings, TokenExchange
from neurostore_mcp.server import build, http_app

SPECS = Path(__file__).parent / "specs"
SETTINGS = Settings(
    public_url="https://neurostore.org",
    issuer="https://neurosynth.us.auth0.com/",
    agent_audience="https://neurostore.org/agents/",
    client_id="mcp-client",
    client_secret="not-a-secret",
)
RESOURCE = "https://neurostore.org/mcp"


@pytest.fixture(scope="session")
def specs():
    """The specs the backends serve at /api/openapi.json (saved 2026-11-17)."""
    return {
        service: json.loads(gzip.decompress((SPECS / f"{name}-openapi.json.gz").read_bytes()))
        for service, name in (("store", "neurostore"), ("compose", "compose"))
    }


class FakeAPIs:
    """Answers every API call with `body`, and remembers each request."""

    def __init__(self):
        self.requests: list[httpx2.Request] = []
        self.body: object = {"metadata": {"total_count": 0}, "results": []}

    def __call__(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(request)
        return httpx2.Response(200, json=self.body)


class FakeAuth0:
    """Auth0's token endpoint for On-Behalf-Of, counting exchanges."""

    def __init__(self):
        self.bodies: list[dict] = []
        self.status = 200

    def __call__(self, request: httpx2.Request) -> httpx2.Response:
        body = json.loads(request.content)
        self.bodies.append(body)
        if self.status != 200:
            return httpx2.Response(self.status, json={"error_description": "no grant"})
        return httpx2.Response(
            200,
            json={"access_token": f"agents-token-{len(self.bodies)}", "expires_in": 3600},
        )


@pytest.fixture
def apis():
    return FakeAPIs()


@pytest.fixture
def auth0():
    return FakeAuth0()


@pytest.fixture(scope="session")
def keys():
    return RSAKeyPair.generate()


def token(keys, scopes=("read", "write"), audience=RESOURCE, issuer=SETTINGS.issuer):
    return keys.create_token(
        subject="auth0|someone", issuer=issuer, audience=audience, scopes=list(scopes)
    )


@pytest.fixture
def anonymous_server(specs, apis):
    return build(specs, transport=httpx2.MockTransport(apis))


@pytest.fixture
def server(specs, apis, auth0, keys):
    exchange = TokenExchange(
        SETTINGS, http=httpx2.AsyncClient(transport=httpx2.MockTransport(auth0))
    )
    verifier = JWTVerifier(public_key=keys.public_key, issuer=SETTINGS.issuer, audience=RESOURCE)
    return build(
        specs,
        settings=SETTINGS,
        exchange=exchange,
        verifier=verifier,
        transport=httpx2.MockTransport(apis),
    )


@asynccontextmanager
async def serve(server):
    """An HTTP client for the server's ASGI app, as claude.ai would reach it.

    A context manager, not a fixture: the app's lifespan must start and stop in one task.
    """
    app = http_app(server)
    async with app.router.lifespan_context(app):
        async with httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=app), base_url="https://neurostore.org"
        ) as client:
            yield client


async def rpc(http, method, params=None, bearer=None):
    headers = {"Accept": "application/json, text/event-stream"}
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    body = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}}
    return await http.post("/mcp", json=body, headers=headers)
