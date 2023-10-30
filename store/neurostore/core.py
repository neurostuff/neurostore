import os
from pathlib import Path
from werkzeug.middleware.profiler import ProfilerMiddleware

from authlib.integrations.flask_client import OAuth
import connexion
# from connexion.json_schema import default_handlers as json_schema_handlers
from connexion.resolver import MethodResolver
from flask_caching import Cache
from flask_cors import CORS
import sqltap.wsgi

from .or_json import ORJSONDecoder, ORJSONEncoder
from .database import init_db


connexion_app = connexion.FlaskApp(
    __name__, specification_dir="openapi/"
)

app = connexion_app.app

app.config.from_object(os.environ["APP_SETTINGS"])

oauth = OAuth(app)

db = init_db(app)

# enable caching
cache = Cache(app)

app.secret_key = app.config["JWT_SECRET_KEY"]

options = {"swagger_ui": True}

openapi_file = Path(os.path.dirname(__file__) + "/openapi/neurostore-openapi.yml")

connexion_app.add_api(
    openapi_file,
    base_path="/api",
    options=options,
    arguments={"title": "NeuroStore API"},
    resolver=MethodResolver("neurostore.resources"),
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

if app.debug:
    app.wsgi_app = sqltap.wsgi.SQLTapMiddleware(app.wsgi_app, path="/api/__sqltap__")
    app = ProfilerMiddleware(app)

app.json_encoder = ORJSONEncoder
app.json_decoder = ORJSONDecoder
