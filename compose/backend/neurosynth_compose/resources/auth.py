import json
from contextlib import contextmanager
from urllib.request import urlopen

from connexion.exceptions import OAuthProblem
from flask import current_app, has_app_context
from jose import jwt
from starlette.responses import JSONResponse
from werkzeug.local import LocalProxy
from connexion.security import NO_VALUE
from ..database import db
from sqlalchemy import select


def _oauth_problem(detail):
    return OAuthProblem(detail=detail)


def _apply_cors_headers(response, origin=None):
    response.headers["Access-Control-Allow-Origin"] = origin or "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    if origin:
        response.headers["Vary"] = "Origin"
    return response


async def asgi_oauth_problem_handler(request, exc):
    status_code = getattr(exc, "status_code", 401)
    response = JSONResponse(
        {
            "type": "about:blank",
            "title": "Unauthorized" if status_code == 401 else "Error",
            "detail": getattr(exc, "detail", str(exc)),
            "status": status_code,
        },
        status_code=status_code,
        media_type="application/problem+json",
    )
    return _apply_cors_headers(response, request.headers.get("origin"))


_flask_app = None


def init_app(app):
    """Record the Flask application so security helpers can push a context."""

    global _flask_app
    _flask_app = app


def _get_current_app():
    if has_app_context():
        return current_app._get_current_object()
    if _flask_app is not None:  # pragma: no cover - defensive
        return _flask_app
    raise RuntimeError("No Flask application is configured for authentication helpers.")


@contextmanager
def _ensure_app_context():
    if has_app_context():
        yield current_app._get_current_object()
        return

    if _flask_app is None:  # pragma: no cover - defensive
        raise RuntimeError(
            "No Flask application is configured for authentication helpers."
        )

    with _flask_app.app_context():
        yield _flask_app


app = LocalProxy(_get_current_app)


def decode_token(token):
    with _ensure_app_context() as app:
        jsonurl = urlopen(app.config["AUTH0_BASE_URL"] + "/.well-known/jwks.json")
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
                    audience=app.config["AUTH0_API_AUDIENCE"],
                    # needs slash at end
                    issuer=app.config["AUTH0_BASE_URL"] + "/",
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


def verify_key(run_key):
    if not run_key:
        return NO_VALUE

    with _ensure_app_context():
        from ..models import MetaAnalysis

        meta_analysis = db.session.execute(
            select(MetaAnalysis).where(MetaAnalysis.run_key == run_key)
        ).scalar_one_or_none()

        if meta_analysis is None:
            raise _oauth_problem("Unable to find appropriate key")

        return {"sub": "neurosynth_compose", "meta_analysis_id": meta_analysis.id}
