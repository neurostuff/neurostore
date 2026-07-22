import json
from urllib.request import urlopen

from connexion.exceptions import OAuthProblem
from connexion.lifecycle import ConnexionResponse
from connexion.security import NO_VALUE
from jose import jwt
from sqlalchemy import select

from neurosynth_compose.database import db
from neurosynth_compose.runtime import configure_runtime, get_runtime


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


def init_app(app_or_config, logger=None):
    """Configure runtime settings from either a legacy app-like object or a mapping."""
    if hasattr(app_or_config, "config"):
        return configure_runtime(app_or_config.config, app_or_config.logger)
    return configure_runtime(app_or_config, logger)


def decode_token(token):
    config = get_runtime().config
    jsonurl = urlopen(str(config["AUTH0_BASE_URL"]) + "/.well-known/jwks.json")
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
                audience=config["AUTH0_API_AUDIENCE"],
                issuer=str(config["AUTH0_BASE_URL"]) + "/",
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


def verify_key(run_key, request=None, required_scopes=None):
    # Accept optional `request` and `required_scopes` kwargs so Connexion's
    # ApiKeySecurityHandler can invoke this function with different signatures.
    if not run_key:
        return NO_VALUE

    from neurosynth_compose.models import MetaAnalysis

    meta_analysis = db.session.execute(
        select(MetaAnalysis).where(MetaAnalysis.run_key == run_key)
    ).scalar_one_or_none()

    if meta_analysis is None:
        raise _oauth_problem("Unable to find appropriate key")

    # Map the token `sub` to the meta-analysis owner's external_id so that
    # upload-key requests are attributed to the correct user.
    sub = getattr(meta_analysis, "user_id", None)
    if not sub:
        raise _oauth_problem("meta-analysis owner missing external id")

    return {"sub": sub, "meta_analysis_id": meta_analysis.id}
