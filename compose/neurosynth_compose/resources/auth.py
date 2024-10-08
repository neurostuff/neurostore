import json
from urllib.request import urlopen

from flask import jsonify, request
from jose import jwt

from flask import current_app as app


# Error handler
class AuthError(Exception):
    def __init__(self, error, status_code):
        self.error = error
        self.status_code = status_code


@app.errorhandler(AuthError)
def handle_auth_error(ex):
    response = jsonify(ex.error)
    response.status_code = ex.status_code
    return response


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
    jsonurl = urlopen(app.config["AUTH0_BASE_URL"] + "/.well-known/jwks.json")
    jwks = json.loads(jsonurl.read())
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


def verify_key(*args, **kwargs):
    if request.method == "POST":
        from ..models import MetaAnalysis

        meta_analysis = MetaAnalysis.query.filter_by(
            id=request.json["meta_analysis_id"]
        ).one()
    elif request.method == "PUT":
        from ..models import MetaAnalysisResult

        result_id = request.view_args["id"]
        meta_analysis = (
            MetaAnalysisResult.query.filter_by(id=result_id).one().meta_analysis
        )
    run_key = args[0]

    if meta_analysis.run_key != run_key:
        raise AuthError(
            {"code": "invalid_key", "description": "Unable to find appropriate key"},
            401,
        )
    return {"sub": "neurosynth_compose"}
