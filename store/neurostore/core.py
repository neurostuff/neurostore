import os
from pathlib import Path

from authlib.integrations.flask_client import OAuth
import connexion
from connexion.json_schema import default_handlers as json_schema_handlers
from connexion.resolver import MethodViewResolver
from connexion import spec
from flask_cors import CORS
import prance

from .or_json import ORJSONDecoder, ORJSONEncoder
from .database import init_db


connexion_app = connexion.FlaskApp(
    __name__, specification_dir="openapi/", debug=os.getenv("DEBUG", False) == "True"
)

app = connexion_app.app

app.config.from_object(os.environ["APP_SETTINGS"])

oauth = OAuth(app)

db = init_db(app)


app.secret_key = app.config["JWT_SECRET_KEY"]

options = {"swagger_ui": True}

# https://github.com/spec-first/connexion/issues/254#issuecomment-1133843523
json_schema_handlers[""] = lambda uri: (
    json_schema_handlers["file"](str(connexion_app.specification_dir / uri))
)


# https://github.com/spec-first/connexion/issues/254#issuecomment-504699959
def get_bundled_specs(main_file):
    parser = prance.ResolvingParser(
        str(main_file.absolute()), lazy=True, backend="openapi-spec-validator"
    )
    parser.parse()
    return parser.specification


openapi_file = Path(os.path.dirname(__file__) + "/openapi/neurostore-openapi.yml")

connexion_app.add_api(
    get_bundled_specs(openapi_file),
    base_path="/api",
    options=options,
    arguments={"title": "NeuroStore API"},
    resolver=MethodViewResolver("neurostore.resources"),
    strict_validation=os.getenv("DEBUG", False) == "True",
    validate_responses=os.getenv("DEBUG", False) == "True",
)

# Enable CORS
cors = CORS(app)

auth0 = oauth.register(
    "auth0",
    client_id=os.environ["AUTH0_CLIENT_ID"],
    client_secret=os.environ["AUTH0_CLIENT_SECRET"],
    api_base_url=app.config["AUTH0_BASE_URL"],
    access_token_url=app.config["AUTH0_ACCESS_TOKEN_URL"],
    authorize_url=app.config["AUTH0_AUTH_URL"],
    client_kwargs={
        "scope": "openid profile email",
    },
)


app.json_encoder = ORJSONEncoder
app.json_decoder = ORJSONDecoder
