import json
from urllib.request import urlopen

from connexion import request as connexion_request
from connexion.exceptions import OAuthProblem
from connexion.lifecycle import ConnexionResponse
from jose import jwt


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


def decode_token(token):
    config = connexion_request.state.settings
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.JWTError:
        raise _oauth_problem("Unable to parse authentication token.")

    jsonurl = urlopen(str(config["AUTH0_BASE_URL"]) + "/.well-known/jwks.json")
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
                audience=config["AUTH0_API_AUDIENCE"],
                issuer=str(config["AUTH0_BASE_URL"]) + "/",
            )
        except jwt.ExpiredSignatureError:
            raise _oauth_problem("token is expired")
        except jwt.JWTClaimsError:
            raise _oauth_problem("incorrect claims,please check the audience and issuer")
        except Exception:
            raise _oauth_problem("Unable to parse authentication token.")

        return payload

    raise _oauth_problem("Unable to find appropriate key")
