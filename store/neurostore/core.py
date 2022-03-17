import os
import orjson
from flask_cors import CORS

from authlib.integrations.flask_client import OAuth
import connexion

from .resolver import MethodListViewResolver
from .database import init_db


connexion_app = connexion.FlaskApp(__name__, specification_dir="openapi/", debug=True)
app = connexion_app.app

app.config.from_object(os.environ["APP_SETTINGS"])

oauth = OAuth(app)

db = init_db(app)

# setup authentication
# jwt = JWTManager(app)
app.secret_key = app.config["JWT_SECRET_KEY"]

options = {"swagger_ui": True}
connexion_app.add_api(
    "neurostore-openapi.yml",
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


class ORJSONDecoder:

    def __init__(self, **kwargs):
        # eventually take into consideration when deserializing
        self.options = kwargs

    def decode(self, obj):
        return orjson.loads(obj)


class ORJSONEncoder:

    def __init__(self, **kwargs):
        # eventually take into consideration when serializing
        self.options = kwargs

    def encode(self, obj):
        # decode back to str, as orjson returns bytes
        return orjson.dumps(obj).decode('utf-8')


app.json_encoder = ORJSONEncoder
app.json_decoder = ORJSONDecoder
