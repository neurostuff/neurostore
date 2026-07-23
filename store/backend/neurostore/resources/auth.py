import json
from contextlib import contextmanager
from urllib.request import urlopen

from connexion.exceptions import OAuthProblem
from connexion.lifecycle import ConnexionResponse
from flask import current_app, has_app_context
from jose import jwt
from werkzeug.local import LocalProxy


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


_flask_app = None


def init_app(app):
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
        try:
            unverified_header = jwt.get_unverified_header(token)
        except jwt.JWTError:
            raise _oauth_problem("Unable to parse authentication token.")

        jsonurl = urlopen(app.config["AUTH0_BASE_URL"] + "/.well-known/jwks.json")
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
                    audience=app.config["AUTH0_API_AUDIENCE"],
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
