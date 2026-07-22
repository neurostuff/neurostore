import logging
import os
from pathlib import Path
from typing import Mapping

import connexion
import orjson
from connexion.exceptions import OAuthProblem
from connexion.exceptions import ProblemException
from connexion.jsonifier import Jsonifier
from connexion.resolver import MethodResolver
from starlette.applications import Starlette
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.cors import CORSMiddleware

from neurosynth_compose.admin import init_admin
from neurosynth_compose.database import init_db
from neurosynth_compose.resources.auth import (
    asgi_oauth_problem_handler,
)
from neurosynth_compose.resources.auth import init_app as init_auth
from neurosynth_compose.resources.errors import (
    general_exception_handler,
    http_exception_handler,
    problem_exception_handler,
)
from neurosynth_compose.settings import load_settings
from neurosynth_compose.validation import ReplayableMultiPartFormDataValidator


def _env_flag(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _should_validate_responses(config):
    return config.get("ENV") == "development" and config.get("DEBUG", False)


class _DatabaseSessionMiddleware:
    """Create and dispose one synchronous SQLAlchemy session per ASGI request."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        from neurosynth_compose.database import db

        with db.request_scope():
            await self.app(scope, receive, send)


class _OrjsonModule:
    @staticmethod
    def dumps(value, **kwargs):
        del kwargs
        return orjson.dumps(value).decode()

    @staticmethod
    def loads(value):
        return orjson.loads(value)


def initialize_runtime(settings: Mapping[str, object] | None = None):
    """Configure Compose's shared database, auth, and runtime settings."""
    settings = load_settings() if settings is None else settings
    logger = logging.getLogger("neurosynth_compose")

    init_db(settings)
    init_auth(settings, logger)
    os.environ["BEARERINFO_FUNC"] = str(settings["BEARERINFO_FUNC"])
    os.environ["APIKEYINFO_FUNC"] = str(settings["APIKEYINFO_FUNC"])
    return settings, logger


def create_asgi_app(settings: Mapping[str, object] | None = None):
    """Create the framework-neutral Connexion ASGI Compose application."""
    settings, _logger = initialize_runtime(settings)
    disable_response_validation = _env_flag("CONNEXION_DISABLE_RESPONSE_VALIDATION")

    from neurosynth_compose.database import db

    connexion_app = connexion.AsyncApp(
        __name__, specification_dir=Path(__file__).parent / "openapi"
    )
    cors_kwargs = dict(
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    connexion_app.add_error_handler(OAuthProblem, asgi_oauth_problem_handler)
    connexion_app.add_error_handler(ProblemException, problem_exception_handler)
    connexion_app.add_error_handler(StarletteHTTPException, http_exception_handler)
    connexion_app.add_error_handler(Exception, general_exception_handler)

    validate_mode = bool(settings.get("DEBUG") or settings.get("TESTING", False))
    connexion_app.add_api(
        "neurosynth-compose-openapi.yml",
        base_path="/api",
        options={"swagger_ui": True},
        arguments={"title": "NeuroSynth API"},
        resolver=MethodResolver("neurosynth_compose.resources"),
        jsonifier=Jsonifier(_OrjsonModule),
        strict_validation=validate_mode,
        validate_responses=(
            False if disable_response_validation else _should_validate_responses(settings)
        ),
        validator_map={
            "body": {"multipart/form-data": ReplayableMultiPartFormDataValidator}
        },
    )

    app = Starlette()
    init_admin(app, db, settings)
    app.mount("/", connexion_app)
    return _DatabaseSessionMiddleware(CORSMiddleware(app, **cors_kwargs))


def create_app(settings: Mapping[str, object] | None = None):
    """Compatibility alias returning the ASGI application."""
    return create_asgi_app(settings)
