import os
from pathlib import Path

import connexion
from authlib.integrations.flask_client import OAuth
from connexion.exceptions import OAuthProblem
from connexion.resolver import MethodResolver
from flask import Response, request
from flask_admin import Admin, AdminIndexView
from flask_admin.contrib.sqla import ModelView
from flask_admin.theme import Bootstrap4Theme
from flask_orjson import OrjsonProvider
from starlette.middleware.cors import CORSMiddleware

from neurosynth_compose.config import resolve_config_object
from neurosynth_compose.database import init_db
from neurosynth_compose.resources.auth import asgi_oauth_problem_handler
from neurosynth_compose.resources.auth import init_app as init_auth


def _env_flag(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def create_app():
    """Create and configure the Neurosynth Compose Flask application."""

    connexion_app = connexion.FlaskApp(__name__, specification_dir="openapi/")
    app = connexion_app.app

    app.config.from_object(resolve_config_object())
    app.config["DEBUG"] = _env_flag("DEBUG")
    app.json = OrjsonProvider(app)

    cors_kwargs = dict(
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    openapi_path = Path(app.root_path) / "openapi" / "neurosynth-compose-openapi.yml"
    swagger_options = {"swagger_ui": True}

    # Connexion resolves security handlers from environment variables or
    # x-... entries in the OpenAPI spec, not Flask config. Push the config
    # values into the environment so app config remains the single source of truth.
    os.environ["BEARERINFO_FUNC"] = app.config["BEARERINFO_FUNC"]
    os.environ["APIKEYINFO_FUNC"] = app.config["APIKEYINFO_FUNC"]

    with app.app_context():
        disable_response_validation = _env_flag("CONNEXION_DISABLE_RESPONSE_VALIDATION")
        # Enable strict request/response validation in both DEBUG and TESTING modes
        # so that schema drift between the OpenAPI spec and the actual API is caught
        # during the test suite, not just in local development.
        validate_mode = app.config.get("DEBUG") or app.config.get("TESTING", False)
        connexion_app.add_api(
            openapi_path,
            base_path="/api",
            options=swagger_options,
            arguments={"title": "NeuroSynth API"},
            resolver=MethodResolver("neurosynth_compose.resources"),
            strict_validation=validate_mode,
            validate_responses=(
                False if disable_response_validation else validate_mode
            ),
        )

    oauth = OAuth(app)
    oauth.register(
        "auth0",
        client_id=app.config["AUTH0_CLIENT_ID"],
        client_secret=app.config["AUTH0_CLIENT_SECRET"],
        api_base_url=app.config["AUTH0_BASE_URL"],
        access_token_url=app.config["AUTH0_ACCESS_TOKEN_URL"],
        authorize_url=app.config["AUTH0_AUTH_URL"],
        client_kwargs={"scope": "openid profile email"},
    )

    db = init_db(app)
    init_auth(app)

    # Initialize Flask-Admin
    from neurosynth_compose.models import (
        Annotation,
        AnnotationReference,
        MetaAnalysis,
        MetaAnalysisResult,
        NeurostoreAnalysis,
        NeurostoreStudy,
        NeurovaultCollection,
        NeurovaultFile,
        Project,
        Specification,
        Studyset,
        StudysetReference,
        User,
    )
    from neurosynth_compose.models.analysis import Condition, SpecificationCondition
    from neurosynth_compose.models.auth import Role

    def _get_admin_credentials():
        username = app.config.get("FLASK_ADMIN_USERNAME")
        password = app.config.get("FLASK_ADMIN_PASSWORD")
        return username, password

    def _admin_auth_failed():
        return Response(
            "Authentication required",
            401,
            {"WWW-Authenticate": 'Basic realm="Admin"'},
        )

    def _is_admin_authenticated():
        username, password = _get_admin_credentials()
        if not username or not password:
            return False
        auth = request.authorization
        if not auth:
            return False
        return auth.username == username and auth.password == password

    class SecureAdminIndexView(AdminIndexView):
        def is_accessible(self):
            return _is_admin_authenticated()

        def inaccessible_callback(self, name, **kwargs):
            return _admin_auth_failed()

    class SecureModelView(ModelView):
        def is_accessible(self):
            return _is_admin_authenticated()

        def inaccessible_callback(self, name, **kwargs):
            return _admin_auth_failed()

    admin = Admin(
        app,
        name="Neurosynth Compose Admin",
        theme=Bootstrap4Theme(),
        url="/admin",
        index_view=SecureAdminIndexView(),
    )

    # Add model views for all major models
    admin.add_view(SecureModelView(User, db.session, category="Auth"))
    admin.add_view(SecureModelView(Role, db.session, category="Auth"))
    admin.add_view(SecureModelView(Project, db.session, category="Projects"))
    admin.add_view(SecureModelView(MetaAnalysis, db.session, category="Meta-Analysis"))
    admin.add_view(
        SecureModelView(MetaAnalysisResult, db.session, category="Meta-Analysis")
    )
    admin.add_view(
        SecureModelView(Specification, db.session, category="Specifications")
    )
    admin.add_view(
        SecureModelView(SpecificationCondition, db.session, category="Specifications")
    )
    admin.add_view(SecureModelView(Condition, db.session, category="Specifications"))
    admin.add_view(SecureModelView(Studyset, db.session, category="Data"))
    admin.add_view(SecureModelView(StudysetReference, db.session, category="Data"))
    admin.add_view(SecureModelView(Annotation, db.session, category="Data"))
    admin.add_view(SecureModelView(AnnotationReference, db.session, category="Data"))
    admin.add_view(
        SecureModelView(NeurovaultCollection, db.session, category="Neurovault")
    )
    admin.add_view(SecureModelView(NeurovaultFile, db.session, category="Neurovault"))
    admin.add_view(SecureModelView(NeurostoreStudy, db.session, category="Neurostore"))
    admin.add_view(
        SecureModelView(NeurostoreAnalysis, db.session, category="Neurostore")
    )

    app.secret_key = app.config["JWT_SECRET_KEY"]

    connexion_app.exception_handlers = {
        **getattr(connexion_app, "exception_handlers", {}),
        OAuthProblem: asgi_oauth_problem_handler,
    }

    cors_asgi_app = CORSMiddleware(connexion_app, **cors_kwargs)

    app.extensions["connexion_app"] = connexion_app
    app.extensions["connexion_asgi"] = cors_asgi_app

    return app
