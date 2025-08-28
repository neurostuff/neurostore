import os
from pathlib import Path

from connexion.middleware import MiddlewarePosition
from starlette.middleware.cors import CORSMiddleware
from authlib.integrations.flask_client import OAuth
import connexion

# from connexion.json_schema import default_handlers as json_schema_handlers
from connexion.resolver import MethodResolver
from flask_caching import Cache
from flask_orjson import OrjsonProvider

from .database import init_db

# from datetime import datetime

# import sqltap.wsgi
# import sqltap

# import yappi


# class SQLTapMiddleware:
#     def __init__(self, app):
#         self.app = app

#     async def __call__(self, scope, receive, send):
#         profiler = sqltap.start()
#         await self.app(scope, receive, send)
#         statistics = profiler.collect()
#         sqltap.report(statistics, "report.txt", report_format="text")


# class LineProfilerMiddleware:
#     def __init__(self, app):
#         self.app = app

#     async def __call__(self, scope, receive, send):
#         yappi.start()
#         await self.app(scope, receive, send)
#         yappi.stop()
#         filename = (
#             scope["path"].lstrip("/").rstrip("/").replace("/", "-")
#             + "-"
#             + scope["method"].lower()
#             + str(datetime.now())
#             + ".prof"
#         )
#         stats = yappi.get_func_stats()
#         stats.save(filename, type="pstat")


connexion_app = connexion.FlaskApp(__name__, specification_dir="openapi/")

app = connexion_app.app

app.config.from_object(os.environ["APP_SETTINGS"])

oauth = OAuth(app)

db = init_db(app)

# enable caching
cache = Cache(app)

app.secret_key = app.config["JWT_SECRET_KEY"]

options = {"swagger_ui": True}

openapi_file = Path(os.path.dirname(__file__) + "/openapi/neurostore-openapi.yml")

# Enable CORS for both ASGI and WSGI
connexion_app.add_middleware(
    CORSMiddleware,
    position=MiddlewarePosition.BEFORE_ROUTING,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# add sqltap
# connexion_app.add_middleware(
#    SQLTapMiddleware,
# )

# add profiling
# connexion_app.add_middleware(
#    LineProfilerMiddleware
# )

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


# Add Flask error handlers
@app.errorhandler(400)
@app.errorhandler(401)
@app.errorhandler(403)
@app.errorhandler(404)
@app.errorhandler(422)
@app.errorhandler(500)
def handle_error(error):
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    }

    # Handle case where error.description is a dict with message/errors structure
    if isinstance(error.description, dict) and "message" in error.description:
        if "detail" not in error.description:
            error.description = {"detail": error.description}
        return error.description, error.code, headers

    # Handle errors with detail structure (like JSON query errors)
    if hasattr(error, "detail"):
        return error.detail, error.code, headers

    # Handle errors with separate description and errors fields
    if hasattr(error, "errors"):
        detail = {
            "detail": {
                "message": error.description,
                "errors": [{"error": str(error.errors)}],
            }
        }
        return detail, error.code, headers

    # Handle simple description errors (fallback)
    response = {
        "detail": {
            "message": error.description,
            "errors": [{"error": error.description}],
        }
    }
    return response, error.code, headers


json_provider = OrjsonProvider(app)
app.json = json_provider
