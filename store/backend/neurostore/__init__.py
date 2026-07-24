import os
import logging
from contextlib import asynccontextmanager
from copy import deepcopy
from pathlib import Path
from typing import AsyncIterator, Mapping

import anyio
import connexion
from connexion.exceptions import OAuthProblem
from connexion.exceptions import ProblemException
from connexion.jsonifier import Jsonifier
from connexion.resolver import MethodResolver
from connexion.validators import VALIDATOR_MAP
from connexion.validators.json import JSONRequestBodyValidator
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware

from neurostore.exceptions.base import NeuroStoreException
from neurostore.exceptions.handlers import (
    general_exception_handler,
    http_exception_handler,
    neurostore_exception_handler,
    problem_exception_handler,
)
from neurostore.extensions import cache
from neurostore.admin import init_admin
from neurostore.settings import load_settings
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


def _should_validate_responses(app_or_config):
    config = getattr(app_or_config, "config", app_or_config)
    return config.get("ENV") == "development" and config.get("DEBUG", False)


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


class _DatabaseSessionMiddleware:
    """Create and dispose one synchronous SQLAlchemy session per ASGI request."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        from neurostore.database import db

        with db.request_scope():
            await self.app(scope, receive, send)


class _OrjsonModule:
    @staticmethod
    def dumps(value, **kwargs):
        del kwargs
        import orjson

        return orjson.dumps(value).decode()

    @staticmethod
    def loads(value):
        import orjson

        return orjson.loads(value)


def initialize_runtime(settings: Mapping[str, object] | None = None):
    """Configure Store's shared database, cache, and auth runtime."""
    settings = load_settings() if settings is None else settings
    logger = logging.getLogger("neurostore")

    from neurostore.database import db

    db.configure(settings)
    cache.init_app(settings)
    init_auth(settings, logger)
    os.environ["BEARERINFO_FUNC"] = str(settings["BEARERINFO_FUNC"])
    return settings, logger


def _asgi_lifespan(settings: Mapping[str, object], database):
    @asynccontextmanager
    async def lifespan(app: Starlette) -> AsyncIterator[None]:
        """Bound sync compatibility work and release pooled resources on shutdown."""
        del app
        thread_limiter = anyio.to_thread.current_default_thread_limiter()
        previous_tokens = thread_limiter.total_tokens
        thread_limiter.total_tokens = int(settings["ASGI_THREAD_TOKENS"])
        try:
            yield
        finally:
            thread_limiter.total_tokens = previous_tokens
            database.dispose()

    return lifespan


def create_asgi_app(settings: Mapping[str, object] | None = None):
    """Create the framework-neutral Connexion ASGI Store application."""
    settings, _logger = initialize_runtime(settings)
    disable_connexion_validation = _env_flag("CONNEXION_DISABLE_VALIDATION")
    disable_connexion_body_validation = _env_flag("CONNEXION_DISABLE_BODY_VALIDATION")
    from neurostore.database import db

    connexion_app = connexion.AsyncApp(
        __name__, specification_dir=Path(__file__).parent / "openapi"
    )
    cors_kwargs = dict(
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    connexion_app.add_error_handler(NeuroStoreException, neurostore_exception_handler)
    connexion_app.add_error_handler(OAuthProblem, asgi_oauth_problem_handler)
    connexion_app.add_error_handler(ProblemException, problem_exception_handler)
    connexion_app.add_error_handler(StarletteHTTPException, http_exception_handler)
    connexion_app.add_error_handler(Exception, general_exception_handler)

    validator_map = None
    strict_validation = bool(settings.get("DEBUG", False))
    validate_responses = _should_validate_responses(settings)
    if disable_connexion_validation:
        validator_map = {"parameter": _NoOpParameterValidator, "body": {}}
        strict_validation = False
        validate_responses = False
    elif disable_connexion_body_validation:
        validator_map = deepcopy(VALIDATOR_MAP)
        validator_map["body"]["*/*json"] = _NoOpRequestBodyValidator
    elif not settings.get("DEBUG", False):
        validator_map = deepcopy(VALIDATOR_MAP)
        validator_map["body"]["*/*json"] = _SelectiveRequestBodyValidator

    connexion_app.add_api(
        "neurostore-openapi.yml",
        base_path="/api",
        options={"swagger_ui": True},
        arguments={"title": "NeuroStore API"},
        resolver=MethodResolver("neurostore.resources"),
        jsonifier=Jsonifier(_OrjsonModule),
        strict_validation=strict_validation,
        validate_responses=validate_responses,
        validator_map=validator_map,
    )
    app = Starlette(lifespan=_asgi_lifespan(settings, db))
    init_admin(app, db, settings)
    app.mount("/", connexion_app)
    return _DatabaseSessionMiddleware(CORSMiddleware(app, **cors_kwargs))
