import os
from pathlib import Path

import connexion
from authlib.integrations.flask_client import OAuth
from connexion.resolver import MethodResolver
from starlette.middleware.cors import CORSMiddleware
from flask_admin import Admin, AdminIndexView
from flask_admin.contrib.sqla import ModelView
from flask import Response, request

from .database import init_db
from .resources.auth import AuthError, handle_auth_error, init_app as init_auth


def create_app():
    """Create and configure the Neurosynth Compose Flask application."""

    connexion_app = connexion.FlaskApp(__name__, specification_dir="openapi/")
    app = connexion_app.app

    app.config.from_object(os.environ["APP_SETTINGS"])

    # Ensure security handler functions are available, while allowing tests or
    # deployments to override them via environment variables or config objects.
    default_bearer = "neurosynth_compose.resources.auth.decode_token"
    default_apikey = "neurosynth_compose.resources.auth.verify_key"

    app.config["BEARERINFO_FUNC"] = os.getenv(
        "BEARERINFO_FUNC", app.config.get("BEARERINFO_FUNC", default_bearer)
    )
    app.config["APIKEYINFO_FUNC"] = os.getenv(
        "APIKEYINFO_FUNC", app.config.get("APIKEYINFO_FUNC", default_apikey)
    )

    cors_kwargs = dict(
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

    db = init_db(app)
    init_auth(app)

    # Initialize Flask-Admin
    from neurosynth_compose.models import (
        User, Specification, Studyset, StudysetReference, Annotation,
        AnnotationReference, MetaAnalysis, MetaAnalysisResult,
        NeurovaultCollection, NeurovaultFile, NeurostoreStudy,
        NeurostoreAnalysis, Project
    )
    from neurosynth_compose.models.auth import Role
    from neurosynth_compose.models.analysis import Condition, SpecificationCondition

    def _get_admin_credentials():
        username = app.config.get("FLASK_ADMIN_USERNAME") or os.getenv("FLASK_ADMIN_USERNAME")
        password = app.config.get("FLASK_ADMIN_PASSWORD") or os.getenv("FLASK_ADMIN_PASSWORD")
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
        template_mode="bootstrap4",
        url="/admin",
        index_view=SecureAdminIndexView(),
    )

    # Add model views for all major models
    admin.add_view(SecureModelView(User, db.session, category="Auth"))
    admin.add_view(SecureModelView(Role, db.session, category="Auth"))
    admin.add_view(SecureModelView(Project, db.session, category="Projects"))
    admin.add_view(SecureModelView(MetaAnalysis, db.session, category="Meta-Analysis"))
    admin.add_view(SecureModelView(MetaAnalysisResult, db.session, category="Meta-Analysis"))
    admin.add_view(SecureModelView(Specification, db.session, category="Specifications"))
    admin.add_view(
        SecureModelView(SpecificationCondition, db.session, category="Specifications")
    )
    admin.add_view(SecureModelView(Condition, db.session, category="Specifications"))
    admin.add_view(SecureModelView(Studyset, db.session, category="Data"))
    admin.add_view(SecureModelView(StudysetReference, db.session, category="Data"))
    admin.add_view(SecureModelView(Annotation, db.session, category="Data"))
    admin.add_view(SecureModelView(AnnotationReference, db.session, category="Data"))
    admin.add_view(SecureModelView(NeurovaultCollection, db.session, category="Neurovault"))
    admin.add_view(SecureModelView(NeurovaultFile, db.session, category="Neurovault"))
    admin.add_view(SecureModelView(NeurostoreStudy, db.session, category="Neurostore"))
    admin.add_view(SecureModelView(NeurostoreAnalysis, db.session, category="Neurostore"))

    app.secret_key = app.config["JWT_SECRET_KEY"]

    app.register_error_handler(AuthError, handle_auth_error)

    cors_asgi_app = CORSMiddleware(connexion_app, **cors_kwargs)

    app.extensions["connexion_app"] = connexion_app
    app.extensions["connexion_asgi"] = cors_asgi_app

    return app
