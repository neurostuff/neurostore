import json
import os
from copy import deepcopy
from pathlib import Path

import connexion
import flask
from authlib.integrations.flask_client import OAuth
from connexion.exceptions import OAuthProblem
from connexion.jsonifier import Jsonifier
from connexion.resolver import MethodResolver
from connexion.validators import VALIDATOR_MAP
from connexion.validators.json import JSONRequestBodyValidator
from flask import Response, request
from flask_admin import Admin, AdminIndexView
from flask_admin.contrib.sqla import ModelView
from flask_admin.theme import Bootstrap4Theme
from flask_orjson import OrjsonProvider
from starlette.middleware.cors import CORSMiddleware

from neurostore.config import resolve_config_object
from neurostore.database import init_db
from neurostore.exceptions.base import NeuroStoreException
from neurostore.exceptions.handlers import (
    flask_general_body_and_status,
    flask_neurostore_body_and_status,
    general_exception_handler,
    neurostore_exception_handler,
)
from neurostore.extensions import cache
from neurostore.resources import iter_request_body_validation_skip_rules
from neurostore.resources.auth import (
    asgi_oauth_problem_handler,
)
from neurostore.resources.auth import init_app as init_auth


def _env_flag(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _should_validate_responses(app):
    return app.config.get("ENV") == "development" and app.config["DEBUG"]


def _normalize_request_path(path):
    if not path:
        return "/"

    normalized = str(path).strip()
    if not normalized.startswith("/"):
        normalized = f"/{normalized}"
    if normalized != "/":
        normalized = normalized.rstrip("/")
    return normalized


_NON_DEBUG_BODY_VALIDATION_SKIP_ROUTES = tuple(
    iter_request_body_validation_skip_rules()
)


def _path_matches_template(path, template):
    normalized_path = _normalize_request_path(path)
    normalized_template = _normalize_request_path(template)
    if "<" not in normalized_template:
        return normalized_path == normalized_template

    path_segments = normalized_path.strip("/").split("/")
    template_segments = normalized_template.strip("/").split("/")
    if len(path_segments) != len(template_segments):
        return False

    for actual, expected in zip(path_segments, template_segments):
        if expected.startswith("<") and expected.endswith(">"):
            if not actual:
                return False
            continue
        if actual != expected:
            return False
    return True


def _should_skip_request_body_validation(scope):
    method = str(scope.get("method") or "").upper()
    path = _normalize_request_path(scope.get("path"))

    for rule_method, rule_path in _NON_DEBUG_BODY_VALIDATION_SKIP_ROUTES:
        if method == str(rule_method).upper() and _path_matches_template(
            path, rule_path
        ):
            return True
    return False


class _NoOpParameterValidator:
    def __init__(self, *args, **kwargs):
        pass

    def validate(self, scope):
        return None


class _NoOpRequestBodyValidator:
    def __init__(self, *args, **kwargs):
        pass

    async def wrap_receive(self, receive, *, scope):
        return receive, scope


class _SelectiveRequestBodyValidator(JSONRequestBodyValidator):
    async def wrap_receive(self, receive, *, scope):
        if _should_skip_request_body_validation(scope):
            return receive, scope
        return await super().wrap_receive(receive, scope=scope)


def create_app():
    connexion_app = connexion.FlaskApp(__name__, specification_dir="openapi/")
    app = connexion_app.app
    disable_connexion_validation = _env_flag("CONNEXION_DISABLE_VALIDATION")
    disable_connexion_body_validation = _env_flag("CONNEXION_DISABLE_BODY_VALIDATION")

    app.config.from_object(resolve_config_object())
    app.config["DEBUG"] = _env_flag("DEBUG")
    app.secret_key = app.config["JWT_SECRET_KEY"]
    app.json = OrjsonProvider(app)

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

    cors_kwargs = dict(
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    connexion_app.exception_handlers = {
        NeuroStoreException: neurostore_exception_handler,
        OAuthProblem: asgi_oauth_problem_handler,
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

    os.environ["BEARERINFO_FUNC"] = app.config["BEARERINFO_FUNC"]

    openapi_file = Path(app.root_path) / "openapi" / "neurostore-openapi.yml"
    connexion_jsonifier = Jsonifier(flask.json)
    validator_map = None
    strict_validation = app.config["DEBUG"]
    validate_responses = _should_validate_responses(app)
    if disable_connexion_validation:
        validator_map = {"parameter": _NoOpParameterValidator, "body": {}}
        strict_validation = False
        validate_responses = False
    elif disable_connexion_body_validation:
        validator_map = deepcopy(VALIDATOR_MAP)
        validator_map["body"]["*/*json"] = _NoOpRequestBodyValidator
    elif not app.config["DEBUG"]:
        validator_map = deepcopy(VALIDATOR_MAP)
        validator_map["body"]["*/*json"] = _SelectiveRequestBodyValidator

    connexion_app.add_api(
        openapi_file,
        base_path="/api",
        options={"swagger_ui": True},
        arguments={"title": "NeuroStore API"},
        resolver=MethodResolver("neurostore.resources"),
        jsonifier=connexion_jsonifier,
        strict_validation=strict_validation,
        validate_responses=validate_responses,
        validator_map=validator_map,
    )

    cors_asgi_app = CORSMiddleware(connexion_app, **cors_kwargs)

    app.extensions["connexion_app"] = connexion_app
    app.extensions["connexion_asgi"] = cors_asgi_app
    return app
