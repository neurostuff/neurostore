import os

from connexion.middleware import MiddlewarePosition
from starlette.middleware.cors import CORSMiddleware
from authlib.integrations.flask_client import OAuth
import connexion
from connexion.resolver import MethodResolver


def create_app():
    connexion_app = connexion.FlaskApp(__name__, specification_dir="openapi/")

    app = connexion_app.app
    app.config.from_object(os.environ["APP_SETTINGS"])

    options = {"swagger_ui": True}
    
    # Enable CORS for both ASGI and WSGI
    connexion_app.add_middleware(
        CORSMiddleware,
        position=MiddlewarePosition.BEFORE_ROUTING,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # use application context for connexion to work with app variables
    with app.app_context():
        connexion_app.add_api(
            "neurosynth-compose-openapi.yml",
            base_path="/api",
            options=options,
            arguments={"title": "NeuroSynth API"},
            resolver=MethodResolver("neurosynth_compose.resources"),
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
