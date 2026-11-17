import hashlib
import json
import logging
import time
from collections.abc import Mapping
from datetime import timedelta
from urllib.request import urlopen

import anyio
import requests
from connexion.exceptions import OAuthProblem, OAuthScopeProblem, ProblemException
from connexion.lifecycle import ConnexionResponse
from connexion.security import NO_VALUE
from jose import jwt
from sqlalchemy import select

from neurosynth_compose.database import db

# Neurostore issues and stores API keys; Compose asks it about each one.
API_KEY_PREFIX = "nsk_"
READ_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
# how long a revoked key may keep working here
INTROSPECTION_TTL_SECONDS = 60
_introspected: dict[str, tuple[float, dict]] = {}
JWKS_TTL = timedelta(minutes=10)
JWKS_REFETCH = timedelta(minutes=1)
_jwks_cache: dict[str, tuple[float, dict]] = {}
# what an agent's token may be granted on the agents API; write includes read
AGENT_SCOPES = frozenset({"read", "write"})
# the user's display name, which the tenant's "Neurostore user name" Action adds to agents
# tokens: an on-behalf-of token can't be used at /userinfo
NAME_CLAIM = "https://neurostore.org/name"
audit_log = logging.getLogger("neurosynth_compose.agents")


def _oauth_problem(detail):
    return OAuthProblem(detail=detail)


async def asgi_oauth_problem_handler(request, exc):
    status_code = getattr(exc, "status_code", 401)
    return ConnexionResponse(
        body=json.dumps(
            {
                "type": "about:blank",
                "title": "Unauthorized" if status_code == 401 else "Error",
                "detail": getattr(exc, "detail", str(exc)),
                "status": status_code,
            }
        ),
        status_code=status_code,
        mimetype="application/json",
    )


def _fetch_jwks(base_url):
    with urlopen(base_url + "/.well-known/jwks.json", timeout=10) as response:
        return json.loads(response.read())


def _find_key(jwks, kid):
    for key in jwks["keys"]:
        if key["kid"] == kid:
            return {name: key[name] for name in ("kty", "kid", "use", "n", "e")}
    return None


def _signing_key(base_url, kid):
    """The tenant's signing key ``kid``, from a JWKS cached for JWKS_TTL; an unknown
    ``kid`` (Auth0 rotated its keys) refetches it, at most once per JWKS_REFETCH."""
    now = time.monotonic()
    fetched_at, jwks = _jwks_cache.get(base_url, (None, None))
    stale = fetched_at is None or now - fetched_at > JWKS_TTL.total_seconds()
    key = None if stale else _find_key(jwks, kid)
    if key is None and (stale or now - fetched_at > JWKS_REFETCH.total_seconds()):
        jwks = _fetch_jwks(base_url)
        _jwks_cache[base_url] = (now, jwks)
        key = _find_key(jwks, kid)
    return key


def _audiences(payload):
    aud = payload.get("aud", [])
    return [aud] if isinstance(aud, str) else list(aud)


def _as_delegated(payload):
    """An agent acting for ``sub``: only its granted scopes, and who it is for the audit."""
    granted = set(str(payload.get("scope", "")).split())
    return {
        **payload,
        "delegated": True,
        "scopes": sorted(AGENT_SCOPES & granted),
        "agent": payload.get("azp") or payload.get("client_id"),
        "actor": (payload.get("act") or {}).get("sub"),
    }


def _decode_token(token, settings: Mapping[str, object]):
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.JWTError:
        raise _oauth_problem("Unable to parse authentication token.")

    base_url = str(settings["AUTH0_BASE_URL"])
    rsa_key = _signing_key(base_url, unverified_header.get("kid"))
    if not rsa_key:
        raise _oauth_problem("Unable to find appropriate key")

    try:
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            issuer=base_url + "/",
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise _oauth_problem("token is expired")
    except jwt.JWTClaimsError:
        raise _oauth_problem("incorrect claims,please check the audience and issuer")
    except Exception:
        raise _oauth_problem("Unable to parse authentication token.")

    audiences = _audiences(payload)
    agent_audience = settings.get("AUTH0_AGENT_AUDIENCE")
    accepted = {settings["AUTH0_API_AUDIENCE"], agent_audience} - {None, ""}
    if not accepted.intersection(audiences):
        raise _oauth_problem("incorrect claims,please check the audience and issuer")
    # `act` is set by Auth0's on-behalf-of exchange, e.g. for the MCP server
    if (agent_audience and agent_audience in audiences) or "act" in payload:
        return _as_delegated(payload)
    return payload


def required_scope(method):
    return "read" if method.upper() in READ_METHODS else "write"


def scopes_allow(scopes, method):
    """A key may make a request when it holds the method's scope; write includes read."""
    scope = required_scope(method)
    return scope in scopes or (scope == "read" and "write" in scopes)


def _fetch_introspection(key, settings):
    """Ask Neurostore who owns ``key``; returns (status code, JSON body or None)."""
    try:
        response = requests.get(
            str(settings["NEUROSTORE_API_URL"]).rstrip("/") + "/api-keys/introspect",
            headers={"Authorization": f"Bearer {key}"},
            timeout=10,
        )
    except requests.RequestException:
        return None, None
    body = response.json() if response.ok else None
    return response.status_code, body


def _introspect_api_key(key, settings):
    digest = hashlib.sha256(key.encode()).hexdigest()
    now = time.monotonic()
    cached = _introspected.get(digest)
    if cached is not None and cached[0] > now:
        return cached[1]

    status, body = _fetch_introspection(key, settings)
    if status in (401, 403):
        raise _oauth_problem("Invalid or revoked API key.")
    if status != 200:
        raise ProblemException(
            status=503, title="Service Unavailable", detail="Could not verify API key."
        )

    payload = {
        "sub": body["user"],
        "name": body.get("name"),
        "scopes": body["scopes"],
        "api_key": True,
    }
    for stale in [d for d, (expires, _) in _introspected.items() if expires <= now]:
        del _introspected[stale]
    _introspected[digest] = (now + INTROSPECTION_TTL_SECONDS, payload)
    return payload


async def verify_api_key(key, method, settings):
    """Resolve an API key to its owner, refusing a method its scopes don't allow."""
    payload = await anyio.to_thread.run_sync(_introspect_api_key, key, settings)
    if not scopes_allow(payload["scopes"], method):
        raise OAuthScopeProblem(
            token_scopes=payload["scopes"], required_scopes=[required_scope(method)]
        )
    return payload


def authorize_delegated(payload, request):
    """Refuse a method the agent's scopes don't allow; log each write it makes."""
    if not scopes_allow(payload["scopes"], request.method):
        raise OAuthScopeProblem(
            token_scopes=payload["scopes"], required_scopes=[required_scope(request.method)]
        )
    if required_scope(request.method) == "write":
        audit_log.info(
            "agent write %s %s user=%s agent=%s actor=%s",
            request.method,
            request.url.path,
            payload.get("sub"),
            payload.get("agent"),
            payload.get("actor"),
        )


async def decode_token(
    token, request=None, *, settings: Mapping[str, object] | None = None
):
    """Decode a bearer token without blocking Connexion's ASGI event loop."""
    if settings is None:
        if request is None:
            raise RuntimeError("decode_token requires a request or settings")
        settings = request.state.settings
    if token.startswith(API_KEY_PREFIX):
        if request is None:
            raise RuntimeError("API keys are checked against a request's method")
        return await verify_api_key(token, request.method, settings)
    payload = await anyio.to_thread.run_sync(_decode_token, token, settings)
    if payload.get("delegated"):
        if request is None:
            raise RuntimeError("Agent tokens are checked against a request's method")
        authorize_delegated(payload, request)
    return payload


def _lookup_upload_key(run_key):
    from neurosynth_compose.models import MetaAnalysis

    with db.engine.connect() as connection:
        return connection.execute(
            select(MetaAnalysis.user_id, MetaAnalysis.id).where(
                MetaAnalysis.run_key == run_key
            )
        ).one_or_none()


async def verify_key(run_key, request=None, required_scopes=None):
    # Accept optional `request` and `required_scopes` kwargs so Connexion's
    # ApiKeySecurityHandler can invoke this function with different signatures.
    if not run_key:
        return NO_VALUE

    del request, required_scopes
    meta_analysis = await anyio.to_thread.run_sync(_lookup_upload_key, run_key)

    if meta_analysis is None:
        raise _oauth_problem("Unable to find appropriate key")

    # Map the token `sub` to the meta-analysis owner's external_id so that
    # upload-key requests are attributed to the correct user.
    sub = meta_analysis.user_id
    if not sub:
        raise _oauth_problem("meta-analysis owner missing external id")

    return {"sub": sub, "meta_analysis_id": meta_analysis.id}
