import os
from flask_cors import CORS
from pathlib import Path
from typing import Any, Dict

from authlib.integrations.flask_client import OAuth
import connexion
import prance

from .or_json import ORJSONDecoder, ORJSONEncoder
from .resolver import MethodListViewResolver
from .database import init_db


def custom_resolver(*args, **kwargs):
    pass


def get_bundled_specs(main_file: Path) -> Dict[str, Any]:
    parser = prance._TranslatingParser(str(main_file.absolute()),
                                       lazy=True, backend='openapi-spec-validator',
                                       recursion_limit=50)
    parser.parse()
    return parser.specification


connexion_app = connexion.FlaskApp(__name__, specification_dir="openapi/", debug=True)
app = connexion_app.app

app.config.from_object(os.environ["APP_SETTINGS"])

oauth = OAuth(app)

db = init_db(app)


app.secret_key = app.config["JWT_SECRET_KEY"]

options = {"swagger_ui": True}
connexion_app.add_api(
    get_bundled_specs(Path(os.path.dirname(__file__) + "/openapi/neurostore-openapi.yml")),
    base_path="/api",
    options=options,
    arguments={"title": "NeuroStore API"},
    resolver=MethodListViewResolver("neurostore.resources"),
    strict_validation=os.getenv("DEBUG", False) == "True",
    validate_responses=os.getenv("DEBUG", False) == "True",
)

# Enable CORS
cors = CORS(app)

auth0 = oauth.register(
    'auth0',
    client_id=os.environ['AUTH0_CLIENT_ID'],
    client_secret=os.environ['AUTH0_CLIENT_SECRET'],
    api_base_url=app.config['AUTH0_BASE_URL'],
    access_token_url=app.config['AUTH0_ACCESS_TOKEN_URL'],
    authorize_url=app.config['AUTH0_AUTH_URL'],
    client_kwargs={
        'scope': 'openid profile email',
    },
)


app.json_encoder = ORJSONEncoder
app.json_decoder = ORJSONDecoder
