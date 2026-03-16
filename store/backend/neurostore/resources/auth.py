import json
from contextlib import contextmanager
from urllib.request import urlopen

from flask import current_app, has_app_context, jsonify, request
from jose import jwt
from werkzeug.local import LocalProxy


# Error handler
class AuthError(Exception):
    def __init__(self, error, status_code):
        self.error = error
        self.status_code = status_code


def handle_auth_error(ex):
    response = jsonify(ex.error)
    response.status_code = ex.status_code
    return response


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


def get_token_auth_header():
    """Obtains the Access Token from the Authorization Header"""
    auth = request.headers.get("Authorization", None)
    if not auth:
        raise AuthError(
            {
                "code": "authorization_header_missing",
                "description": "Authorization header is expected",
            },
            401,
        )

    parts = auth.split()

    if parts[0].lower() != "bearer":
        raise AuthError(
            {
                "code": "invalid_header",
                "description": "Authorization header must start with" " Bearer",
            },
            401,
        )
    elif len(parts) == 1:
        raise AuthError(
            {"code": "invalid_header", "description": "Token not found"}, 401
        )
    elif len(parts) > 2:
        raise AuthError(
            {
                "code": "invalid_header",
                "description": "Authorization header must be" " Bearer token",
            },
            401,
        )

    token = parts[1]
    return token


def decode_token(token):
    with _ensure_app_context() as app:
        try:
            unverified_header = jwt.get_unverified_header(token)
        except jwt.JWTError:
            raise AuthError(
                {
                    "code": "invalid_header",
                    "description": "Unable to parse authentication" " token.",
                },
                401,
            )

        if app.config.get("TESTING") and "kid" not in unverified_header:
            try:
                return jwt.get_unverified_claims(token)
            except jwt.JWTError:
                raise AuthError(
                    {
                        "code": "invalid_header",
                        "description": "Unable to parse authentication" " token.",
                    },
                    401,
                )

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
                raise AuthError(
                    {"code": "token_expired", "description": "token is expired"}, 401
                )
            except jwt.JWTClaimsError:
                raise AuthError(
                    {
                        "code": "invalid_claims",
                        "description": "incorrect claims,"
                        "please check the audience and issuer",
                    },
                    401,
                )
            except Exception:
                raise AuthError(
                    {
                        "code": "invalid_header",
                        "description": "Unable to parse authentication" " token.",
                    },
                    401,
                )

            return payload

    raise AuthError(
        {"code": "invalid_header", "description": "Unable to find appropriate key"}, 401
    )
