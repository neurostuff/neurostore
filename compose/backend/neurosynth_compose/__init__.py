import os
from pathlib import Path

import connexion
from authlib.integrations.flask_client import OAuth
from connexion.middleware import MiddlewarePosition
from connexion.resolver import MethodResolver
from flask_cors import CORS
from starlette.middleware.cors import CORSMiddleware

from .database import init_db
from .resources.auth import handle_auth_error, AuthError


def create_app():
    """Create and configure the Neurosynth Compose Flask application."""

    connexion_app = connexion.FlaskApp(__name__, specification_dir="openapi/")
    app = connexion_app.app

    app.config.from_object(os.environ["APP_SETTINGS"])

    connexion_app.add_middleware(
        CORSMiddleware,
        position=MiddlewarePosition.BEFORE_ROUTING,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    openapi_path = Path(app.root_path) / "openapi" / "neurosynth-compose-openapi.yml"
    swagger_options = {"swagger_ui": True}

    debug_flag = app.config.get("DEBUG", False)
    if isinstance(debug_flag, str):
        debug_flag = debug_flag.lower() == "true"
    else:
        debug_flag = bool(debug_flag)

    env_debug = os.getenv("DEBUG")
    if env_debug is not None:
        debug_flag = debug_flag or env_debug.lower() == "true"

    with app.app_context():
        connexion_app.add_api(
            openapi_path,
            base_path="/api",
            options=swagger_options,
            arguments={"title": "NeuroSynth API"},
            resolver=MethodResolver("neurosynth_compose.resources"),
            strict_validation=debug_flag,
            validate_responses=debug_flag,
        )

    oauth = OAuth(app)
    oauth.register(
        "auth0",
        client_id=os.environ["AUTH0_CLIENT_ID"],
        client_secret=os.environ["AUTH0_CLIENT_SECRET"],
        api_base_url=app.config["AUTH0_BASE_URL"],
        access_token_url=app.config["AUTH0_ACCESS_TOKEN_URL"],
        authorize_url=app.config["AUTH0_AUTH_URL"],
        client_kwargs={"scope": "openid profile email"},
    )

    init_db(app)

    app.secret_key = app.config["JWT_SECRET_KEY"]
    CORS(app)

    app.register_error_handler(AuthError, handle_auth_error)

    app.extensions["connexion_app"] = connexion_app

    return app
