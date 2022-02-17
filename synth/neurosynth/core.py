import os
from flask_cors import CORS

from authlib.integrations.flask_client import OAuth
import connexion

from .database import init_db


connexion_app = connexion.FlaskApp(__name__, specification_dir="../neurostore/openapi/", debug=True)
app = connexion_app.app

app.config.from_object(os.environ["APP_SETTINGS"])

oauth = OAuth(app)

db = init_db(app)

# setup authentication
# jwt = JWTManager(app)
app.secret_key = app.config["JWT_SECRET_KEY"]

options = {"swagger_ui": True}
connexion_app.add_api(
    "analysis-specification.yml",
    base_path="/api",
    options=options,
    arguments={"title": "NeuroSynth API"},
    strict_validation=True,
    validate_responses=True,
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
