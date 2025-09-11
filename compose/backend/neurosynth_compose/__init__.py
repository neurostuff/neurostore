import os
from pathlib import Path

from connexion.middleware import MiddlewarePosition
from starlette.middleware.cors import CORSMiddleware
from authlib.integrations.flask_client import OAuth
import connexion
from connexion.resolver import MethodResolver


connexion_app = connexion.FlaskApp(__name__, specification_dir="openapi/")
app = connexion_app.app

# Configuration
app.config.from_object(os.environ["APP_SETTINGS"])
app.secret_key = app.config["JWT_SECRET_KEY"]

# Setup OAuth
oauth = OAuth(app)
auth0 = oauth.register(  # noqa: F841
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

# Initialize database
from .database import init_db
init_db(app)

# CORS middleware
connexion_app.add_middleware(
    CORSMiddleware,
    position=MiddlewarePosition.BEFORE_ROUTING,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API configuration
_openapi_file = Path(os.path.dirname(__file__) + "/openapi/neurosynth-compose-openapi.yml")
_options = {"swagger_ui": True}

connexion_app.add_api(
    _openapi_file,
    base_path="/api",
    options=_options,
    arguments={"title": "NeuroSynth API"},
    resolver=MethodResolver("neurosynth_compose.resources"),
    strict_validation=os.getenv("DEBUG", False) == "True",
    validate_responses=os.getenv("DEBUG", False) == "True",
)


def create_app():
    """Return the Flask app - for testing compatibility"""
    return app
