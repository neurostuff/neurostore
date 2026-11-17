"""Signing in: OAuth for tools that need a user, and the token the APIs see.

The server is an OAuth resource server for its own Auth0 API (its public URL, e.g.
`https://neurostore.org/mcp`). Reads work without a token. A tool that needs a user
gets HTTP 401 with the RFC 9728 challenge, which makes the client sign in.

The MCP spec forbids forwarding the client's token, so each call trades it with
Auth0's On-Behalf-Of exchange for a token for the agents API (ADR 0021). That token
keeps the user as `sub` and adds `act`, and the backends treat it as an agent.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass

import httpx2
from fastmcp.exceptions import ToolError
from fastmcp.server.auth import RemoteAuthProvider
from fastmcp.server.auth.providers.jwt import JWTVerifier
from fastmcp.server.dependencies import get_access_token
from pydantic import AnyHttpUrl
from starlette.types import ASGIApp, Receive, Scope, Send

SCOPES = ("read", "write")


@dataclass(frozen=True)
class Settings:
    public_url: str  # where clients reach the server, without the MCP path
    issuer: str  # the Auth0 tenant, e.g. https://neurosynth.us.auth0.com/
    agent_audience: str  # the agents API the backends accept
    client_id: str  # the server's Auth0 Custom API client, allowed On-Behalf-Of
    client_secret: str

    @classmethod
    def from_env(cls) -> Settings | None:
        """None unless every variable is set: then the server only reads."""
        names = (
            "NEUROSTORE_MCP_PUBLIC_URL",
            "NEUROSTORE_MCP_AUTH0_DOMAIN",
            "NEUROSTORE_MCP_AGENT_AUDIENCE",
            "NEUROSTORE_MCP_CLIENT_ID",
            "NEUROSTORE_MCP_CLIENT_SECRET",
        )
        values = [os.environ.get(n, "").strip() for n in names]
        if not all(values):
            return None
        url, domain, audience, client_id, secret = values
        return cls(url.rstrip("/"), f"https://{domain}/", audience, client_id, secret)


def provider(settings: Settings, mcp_path: str, verifier: JWTVerifier | None = None):
    """Validate Auth0 tokens issued for this server's URL, and publish its metadata."""
    resource = f"{settings.public_url}{mcp_path}"
    verifier = verifier or JWTVerifier(
        jwks_uri=f"{settings.issuer}.well-known/jwks.json",
        issuer=settings.issuer,
        audience=resource,
    )
    return RemoteAuthProvider(
        token_verifier=verifier,
        authorization_servers=[AnyHttpUrl(settings.issuer)],
        base_url=settings.public_url,
        scopes_supported=[*SCOPES, "offline_access"],
        resource_name="Neurostore and Neurosynth Compose",
    )


class TokenExchange:
    """On-Behalf-Of: the client's token in, an agents-API token out, cached until expiry."""

    def __init__(self, settings: Settings, http: httpx2.AsyncClient | None = None):
        self.settings = settings
        self.http = http
        self._cache: dict[str, tuple[str, float]] = {}

    async def __call__(self, subject_token: str, scopes: list[str]) -> str:
        key = hashlib.sha256(subject_token.encode()).hexdigest()
        now = time.time()
        hit = self._cache.get(key)
        if hit and hit[1] > now + 30:
            return hit[0]
        body = {
            "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
            "client_id": self.settings.client_id,
            "client_secret": self.settings.client_secret,
            "subject_token": subject_token,
            "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
            "requested_token_type": "urn:ietf:params:oauth:token-type:access_token",
            "audience": self.settings.agent_audience,
        }
        wanted = sorted(set(scopes) & set(SCOPES))
        if wanted:
            body["scope"] = " ".join(wanted)
        url = f"{self.settings.issuer}oauth/token"
        try:
            if self.http is not None:
                response = await self.http.post(url, json=body)
            else:
                async with httpx2.AsyncClient(timeout=15) as http:
                    response = await http.post(url, json=body)
        except httpx2.HTTPError as exc:
            raise ToolError(f"Could not reach Auth0 to act as you: {exc}") from exc
        if response.status_code != 200:
            try:
                detail = response.json().get("error_description") or response.text[:200]
            except ValueError:
                detail = response.text[:200]
            raise ToolError(f"Auth0 refused to act as you ({response.status_code}): {detail}")
        token = response.json()
        self._cache = {k: v for k, v in self._cache.items() if v[1] > now}
        self._cache[key] = (token["access_token"], now + float(token.get("expires_in", 300)))
        return token["access_token"]


def as_user(exchange: TokenExchange):
    """An httpx request hook: calls made for a signed-in user carry their agents token."""

    async def hook(request: httpx2.Request) -> None:
        token = get_access_token()
        if token is not None:
            request.headers["Authorization"] = "Bearer " + await exchange(
                token.token, list(token.scopes)
            )

    return hook


class LazyAuth:
    """Ask for a sign-in only when a call needs one.

    Wraps FastMCP's RequireAuthMiddleware, which would refuse every request without a
    token. Requests with a token, and calls of `sign_in` tools, still go through it;
    anything else reaches the MCP app anonymously. A signed-in call of a `write` tool
    without the `write` scope gets the RFC 6750 `insufficient_scope` challenge.
    """

    def __init__(
        self,
        guarded: ASGIApp,
        sign_in: set[str],
        write: set[str],
        resource_metadata_url: str,
    ):
        self.guarded = guarded
        self.app = guarded.app
        self.sign_in = sign_in
        self.write = write
        self.resource_metadata_url = resource_metadata_url

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        body = await _read_body(receive) if scope.get("method") == "POST" else b""
        replay = _replay(body, receive)
        tools = _called_tools(body)
        has_token = any(name.lower() == b"authorization" for name, _ in scope.get("headers", []))
        if has_token:
            signed_in = getattr(scope.get("user"), "is_authenticated", False)
            granted = set(getattr(scope.get("auth"), "scopes", None) or [])
            if signed_in and tools & self.write and "write" not in granted:
                await self._insufficient_scope(send)
                return
            await self.guarded(scope, replay, send)
        elif tools & self.sign_in:
            await self.guarded(scope, replay, send)
        else:
            await self.app(scope, replay, send)

    async def _insufficient_scope(self, send: Send) -> None:
        challenge = (
            'Bearer error="insufficient_scope", scope="write", '
            f'resource_metadata="{self.resource_metadata_url}"'
        )
        payload = json.dumps(
            {
                "error": "insufficient_scope",
                "error_description": "This tool changes records: sign in again and allow 'write'.",
            }
        ).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 403,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"www-authenticate", challenge.encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": payload})


async def _read_body(receive: Receive) -> bytes:
    chunks = []
    while True:
        message = await receive()
        chunks.append(message.get("body", b""))
        if not message.get("more_body"):
            return b"".join(chunks)


def _replay(body: bytes, receive: Receive) -> Receive:
    sent = False

    async def replay():
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        return await receive()

    return replay


def _called_tools(body: bytes) -> set[str]:
    """The tools a JSON-RPC request calls."""
    try:
        message = json.loads(body) if body else None
    except ValueError:
        return set()
    messages = message if isinstance(message, list) else [message]
    return {
        m["params"]["name"]
        for m in messages
        if isinstance(m, dict)
        and m.get("method") == "tools/call"
        and isinstance(m.get("params"), dict)
        and isinstance(m["params"].get("name"), str)
    }
