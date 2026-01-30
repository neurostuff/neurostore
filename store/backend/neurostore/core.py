import os
from pathlib import Path
import json


from connexion.middleware import MiddlewarePosition
from starlette.middleware.cors import CORSMiddleware
from authlib.integrations.flask_client import OAuth
import connexion

# from connexion.json_schema import default_handlers as json_schema_handlers
from connexion.resolver import MethodResolver
from flask_caching import Cache
from flask_orjson import OrjsonProvider
from flask_admin import Admin, AdminIndexView
from flask_admin.contrib.sqla import ModelView
from flask import Response, request

# Centralized error handling: replaced middleware with Starlette exception handlers
from neurostore.exceptions.handlers import (
    neurostore_exception_handler,
    general_exception_handler,
    flask_neurostore_body_and_status,
    flask_general_body_and_status,
)

from neurostore.exceptions.base import NeuroStoreException

from .database import init_db
from neurostore.models import (
    User,
    Role,
    Studyset,
    StudysetStudy,
    Annotation,
    BaseStudy,
    Study,
    Analysis,
    Table,
    Condition,
    Point,
    Image,
    Entity,
    AnnotationAnalysis,
    PointValue,
    AnalysisConditions,
)

connexion_app = connexion.FlaskApp(__name__, specification_dir="openapi/")
app = connexion_app.app

app.config.from_object(os.environ["APP_SETTINGS"])

oauth = OAuth(app)

db = init_db(app)

# enable caching
cache = Cache(app)

app.secret_key = app.config["JWT_SECRET_KEY"]


def _get_admin_credentials():
    username = app.config.get("FLASK_ADMIN_USERNAME") or os.getenv(
        "FLASK_ADMIN_USERNAME"
    )
    password = app.config.get("FLASK_ADMIN_PASSWORD") or os.getenv(
        "FLASK_ADMIN_PASSWORD"
    )
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


# Initialize Flask-Admin
admin = Admin(
    app,
    name="NeuroStore Admin",
    template_mode="bootstrap4",
    url="/admin",
    index_view=SecureAdminIndexView(),
)

# Add model views for all major models
admin.add_view(SecureModelView(User, db.session, category="Auth"))
admin.add_view(SecureModelView(Role, db.session, category="Auth"))
admin.add_view(SecureModelView(Studyset, db.session, category="Data"))
admin.add_view(SecureModelView(StudysetStudy, db.session, category="Data"))
admin.add_view(SecureModelView(Annotation, db.session, category="Data"))
admin.add_view(SecureModelView(BaseStudy, db.session, category="Studies"))
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

options = {"swagger_ui": True}

openapi_file = Path(os.path.dirname(__file__) + "/openapi/neurostore-openapi.yml")


# Enable CORS for both ASGI and WSGI (moved before error handling)
connexion_app.add_middleware(
    CORSMiddleware,
    position=MiddlewarePosition.BEFORE_ROUTING,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

exception_handlers = {
    NeuroStoreException: neurostore_exception_handler,
    Exception: general_exception_handler,
}
# Attach exception handlers to the connexion app for use by the underlying ASGI app.
# Connexion/Starlette will pick this up when constructing the ASGI app.
connexion_app.exception_handlers = exception_handlers


# Register equivalent Flask (WSGI) error handlers so WSGI responses produced
# during tests include the same JSON body and CORS headers as the ASGI handlers.
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

connexion_app.add_api(
    openapi_file,
    base_path="/api",
    options=options,
    arguments={"title": "NeuroStore API"},
    resolver=MethodResolver("neurostore.resources"),
    strict_validation=os.getenv("DEBUG", False) == "True",
    validate_responses=os.getenv("DEBUG", False) == "True",
)

auth0 = oauth.register(
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

json_provider = OrjsonProvider(app)
app.json = json_provider
