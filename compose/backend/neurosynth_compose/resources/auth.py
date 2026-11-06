import hashlib
import json
import time
from collections.abc import Mapping
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


def _decode_token(token, settings: Mapping[str, object]):
    jsonurl = urlopen(str(settings["AUTH0_BASE_URL"]) + "/.well-known/jwks.json")
    jwks = json.loads(jsonurl.read())
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.JWTError:
        raise _oauth_problem("Unable to parse authentication token.")

    rsa_key = {}
    for key in jwks["keys"]:
        if key["kid"] == unverified_header["kid"]:
            rsa_key = {
                "kty": key["kty"],
                "kid": key["kid"],
                "use": key["use"],
                "n": key["n"],
                "e": key["e"],
            }
    if rsa_key:
        try:
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                audience=settings["AUTH0_API_AUDIENCE"],
                issuer=str(settings["AUTH0_BASE_URL"]) + "/",
            )
        except jwt.ExpiredSignatureError:
            raise _oauth_problem("token is expired")
        except jwt.JWTClaimsError:
            raise _oauth_problem(
                "incorrect claims,please check the audience and issuer"
            )
        except Exception:
            raise _oauth_problem("Unable to parse authentication token.")

        return payload

    raise _oauth_problem("Unable to find appropriate key")


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
    return await anyio.to_thread.run_sync(_decode_token, token, settings)


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
