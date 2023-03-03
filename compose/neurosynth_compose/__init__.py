import os

from flask_cors import CORS


from authlib.integrations.flask_client import OAuth
import connexion
from connexion.resolver import MethodViewResolver

from .database import db


def create_app():
    connexion_app = connexion.FlaskApp(
        __name__, specification_dir="openapi/",
        debug=os.getenv(key="DEBUG", default=False) == "True"
    )

    app = connexion_app.app

    app.config.from_object(os.environ["APP_SETTINGS"])

    # initialize db
    db.init_app(app)

    # 
    with app.app_context():
        connexion_app.add_api(
            "neurosynth-compose-openapi.yml",
            base_path="/api",
            options=options,
            arguments={"title": "NeuroSynth API"},
            resolver=MethodViewResolver("neurosynth_compose.resources"),
            strict_validation=os.getenv(key="DEBUG", default=False) == "True",
            validate_responses=os.getenv(key="DEBUG", default=False) == "True",
        )

    oauth = OAuth(app)

    # setup authentication
    # jwt = JWTManager(app)
    app.secret_key = app.config["JWT_SECRET_KEY"]

    options = {"swagger_ui": True}
    connexion_app.add_api(
        "neurosynth-compose-openapi.yml",
        base_path="/api",
        options=options,
        arguments={"title": "NeuroSynth API"},
        resolver=MethodViewResolver("neurosynth_compose.resources"),
        strict_validation=True,
        validate_responses=True,
    )

    # Enable CORS
    cors = CORS(app)  # noqa: F841

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
    return app
