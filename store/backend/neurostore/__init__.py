import json
import os
from pathlib import Path

import connexion
from authlib.integrations.flask_client import OAuth
from connexion.middleware import MiddlewarePosition
from connexion.resolver import MethodResolver
from flask import Response, request
from flask_admin import Admin, AdminIndexView
from flask_admin.contrib.sqla import ModelView
from flask_admin.theme import Bootstrap4Theme
from flask_orjson import OrjsonProvider
from starlette.middleware.cors import CORSMiddleware

from .config import resolve_config_object
from .database import init_db
from .exceptions.base import NeuroStoreException
from .exceptions.handlers import (
    flask_general_body_and_status,
    flask_neurostore_body_and_status,
    general_exception_handler,
    neurostore_exception_handler,
)
from .extensions import cache
from .resources.auth import AuthError, handle_auth_error, init_app as init_auth


def _env_flag(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def create_app():
    connexion_app = connexion.FlaskApp(__name__, specification_dir="openapi/")
    app = connexion_app.app

    app.config.from_object(resolve_config_object())
    app.config["DEBUG"] = _env_flag("DEBUG")
    app.secret_key = app.config["JWT_SECRET_KEY"]

    db = init_db(app)
    cache.init_app(app)
    init_auth(app)

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

    from neurostore.models import (
        Analysis,
        AnalysisConditions,
        Annotation,
        AnnotationAnalysis,
        BaseStudy,
        BaseStudyFlagOutbox,
        BaseStudyMetadataOutbox,
        Condition,
        Entity,
        Image,
        Point,
        PointValue,
        Role,
        Study,
        Studyset,
        StudysetStudy,
        Table,
        User,
    )

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
        name="NeuroStore Admin",
        theme=Bootstrap4Theme(),
        url="/admin",
        index_view=SecureAdminIndexView(),
    )
    admin.add_view(SecureModelView(User, db.session, category="Auth"))
    admin.add_view(SecureModelView(Role, db.session, category="Auth"))
    admin.add_view(SecureModelView(Studyset, db.session, category="Data"))
    admin.add_view(SecureModelView(StudysetStudy, db.session, category="Data"))
    admin.add_view(SecureModelView(Annotation, db.session, category="Data"))
    admin.add_view(SecureModelView(BaseStudy, db.session, category="Studies"))
    admin.add_view(SecureModelView(BaseStudyFlagOutbox, db.session, category="Studies"))
    admin.add_view(
        SecureModelView(BaseStudyMetadataOutbox, db.session, category="Studies")
    )
    admin.add_view(SecureModelView(Study, db.session, category="Studies"))
    admin.add_view(SecureModelView(Analysis, db.session, category="Studies"))
    admin.add_view(SecureModelView(Table, db.session, category="Studies"))
    admin.add_view(SecureModelView(Condition, db.session, category="Studies"))
    admin.add_view(SecureModelView(Point, db.session, category="Studies"))
    admin.add_view(SecureModelView(Image, db.session, category="Studies"))
    admin.add_view(SecureModelView(Entity, db.session, category="Studies"))
    admin.add_view(SecureModelView(AnnotationAnalysis, db.session, category="Analysis"))
    admin.add_view(SecureModelView(PointValue, db.session, category="Analysis"))
    admin.add_view(SecureModelView(AnalysisConditions, db.session, category="Analysis"))

    connexion_app.add_middleware(
        CORSMiddleware,
        position=MiddlewarePosition.BEFORE_ROUTING,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    connexion_app.exception_handlers = {
        NeuroStoreException: neurostore_exception_handler,
        Exception: general_exception_handler,
    }

    def _flask_neurostore_handler(exc):
        body, status = flask_neurostore_body_and_status(exc)
        resp = app.response_class(
            json.dumps(body), status=status, mimetype="application/json"
        )
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "*"
        resp.headers["Access-Control-Allow-Headers"] = "*"
        resp.headers["Access-Control-Allow-Credentials"] = "true"
        return resp

    def _flask_general_handler(exc):
        body, status = flask_general_body_and_status(exc)
        resp = app.response_class(
            json.dumps(body), status=status, mimetype="application/json"
        )
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "*"
        resp.headers["Access-Control-Allow-Headers"] = "*"
        resp.headers["Access-Control-Allow-Credentials"] = "true"
        return resp

    app.register_error_handler(NeuroStoreException, _flask_neurostore_handler)
    app.register_error_handler(Exception, _flask_general_handler)
    app.register_error_handler(AuthError, handle_auth_error)

    os.environ["BEARERINFO_FUNC"] = app.config["BEARERINFO_FUNC"]

    openapi_file = Path(app.root_path) / "openapi" / "neurostore-openapi.yml"
    connexion_app.add_api(
        openapi_file,
        base_path="/api",
        options={"swagger_ui": True},
        arguments={"title": "NeuroStore API"},
        resolver=MethodResolver("neurostore.resources"),
        strict_validation=app.config["DEBUG"],
        validate_responses=app.config["DEBUG"],
    )

    app.json = OrjsonProvider(app)
    app.extensions["connexion_app"] = connexion_app
    app.extensions["connexion_asgi"] = connexion_app
    return app
