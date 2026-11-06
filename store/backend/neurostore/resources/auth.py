import hashlib
import json
import secrets
from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from urllib.request import urlopen

import anyio
from connexion.exceptions import OAuthProblem, OAuthScopeProblem
from connexion.lifecycle import ConnexionResponse
from jose import jwt
from sqlalchemy import select, update

from neurostore.database import db
from neurostore.exceptions.handlers import error_response
from neurostore.paths import is_review_path

API_KEY_PREFIX = "nsk_"
READ_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
# last_used_at is a hint for the owner, not an audit log; don't write it per request
LAST_USED_RESOLUTION = timedelta(minutes=5)


def _oauth_problem(detail):
    return OAuthProblem(detail=detail)


async def asgi_oauth_problem_handler(request, exc):
    if is_review_path(request.url.path):
        return error_response(request, exc.status_code, "Unauthorized", exc.detail, exc=exc)
    return ConnexionResponse(
        body=json.dumps(
            {
                "type": "about:blank",
                "title": "Unauthorized",
                "detail": exc.detail,
                "status": exc.status_code,
            }
        ),
        status_code=exc.status_code,
        mimetype="application/json",
    )


def _decode_token(token, settings: Mapping[str, object]):
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.JWTError:
        raise _oauth_problem("Unable to parse authentication token.")

    jsonurl = urlopen(str(settings["AUTH0_BASE_URL"]) + "/.well-known/jwks.json")
    jwks = json.loads(jsonurl.read())

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


def generate_api_key():
    """Return a new key's plaintext, which is shown once, and its display prefix."""
    key = API_KEY_PREFIX + secrets.token_urlsafe(32)
    return key, key[: len(API_KEY_PREFIX) + 8]


def hash_api_key(key):
    # keys carry 256 random bits, so a fast unsalted hash is not brute-forceable
    return hashlib.sha256(key.encode()).hexdigest()


def required_scope(method):
    return "read" if method.upper() in READ_METHODS else "write"


def scopes_allow(scopes, method):
    """A key may make a request when it holds the method's scope; write includes read."""
    scope = required_scope(method)
    return scope in scopes or (scope == "read" and "write" in scopes)


def _verify_api_key(key):
    from neurostore.models import ApiKey, User

    now = datetime.now(timezone.utc)
    with db.engine.begin() as connection:
        row = connection.execute(
            select(
                ApiKey.id, ApiKey.user_id, ApiKey.scopes, ApiKey.last_used_at, User.name
            )
            .join(User, User.external_id == ApiKey.user_id)
            .where(ApiKey.key_hash == hash_api_key(key), ApiKey.revoked_at.is_(None))
        ).one_or_none()
        if row is None:
            raise _oauth_problem("Invalid or revoked API key.")
        if row.last_used_at is None or now - row.last_used_at > LAST_USED_RESOLUTION:
            connection.execute(
                update(ApiKey).where(ApiKey.id == row.id).values(last_used_at=now)
            )
    return {
        "sub": row.user_id,
        "name": row.name,
        "scopes": list(row.scopes),
        "api_key_id": row.id,
    }


async def verify_api_key(key, method):
    """Resolve an API key to its owner, refusing a method its scopes don't allow."""
    payload = await anyio.to_thread.run_sync(_verify_api_key, key)
    if not scopes_allow(payload["scopes"], method):
        raise OAuthScopeProblem(
            token_scopes=payload["scopes"], required_scopes=[required_scope(method)]
        )
    return payload


async def decode_token(
    token, request=None, *, settings: Mapping[str, object] | None = None
):
    """Decode a bearer token without blocking Connexion's ASGI event loop."""
    if token.startswith(API_KEY_PREFIX):
        if request is None:
            raise RuntimeError("API keys are checked against a request's method")
        return await verify_api_key(token, request.method)
    if settings is None:
        if request is None:
            raise RuntimeError("decode_token requires a request or settings")
        settings = request.state.settings
    return await anyio.to_thread.run_sync(_decode_token, token, settings)
