import os
from pathlib import Path

from flask_cors import CORS
from authlib.integrations.flask_client import OAuth
import connexion
from connexion.resolver import MethodViewResolver


def create_app():
    connexion_app = connexion.FlaskApp(__name__, specification_dir="openapi/")

    app = connexion_app.app
    app.config.from_object(os.environ["APP_SETTINGS"])

    # Enable CORS the traditional way
    cors = CORS(app)

    options = {"swagger_ui": True}
    
    openapi_file = Path(__file__).parent / "openapi/neurosynth-compose-openapi.yml"
    
    connexion_app.add_api(
        openapi_file,
        base_path="/api",
        options=options,
        arguments={"title": "NeuroSynth API"},
        resolver=MethodViewResolver("neurosynth_compose.resources"),
        strict_validation=os.getenv("DEBUG", False) == "True",
        validate_responses=os.getenv("DEBUG", False) == "True",
    )

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

    # initialize db (ensure models register against the app-bound registry)
    from .database import init_db

    init_db(app)

    # setup authentication
    # jwt = JWTManager(app)
    app.secret_key = app.config["JWT_SECRET_KEY"]

    return app
