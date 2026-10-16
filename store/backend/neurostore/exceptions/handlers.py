import json
import logging
import os
from datetime import datetime, timezone

import anyio
from connexion.exceptions import ProblemException
from connexion.lifecycle import ConnexionResponse
from jsonschema import ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request

from neurostore.exceptions.base import InternalServerError, NeuroStoreException
from neurostore.exceptions.utils.errors import ErrorDetail, ErrorResponse
from neurostore.observability.request_id import (
    REQUEST_ID_HEADER_NAME,
    get_request_id,
    new_request_id,
)
from neurostore.observability.sentry import capture_exception

logger = logging.getLogger(__name__)

REVIEW_PATH_PREFIX = "/api/review/"
UPLOAD_PATH_PREFIX = "/api/review/imports/"


def is_review_path(path: str) -> bool:
    return path.startswith(REVIEW_PATH_PREFIX)


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _json_response(
    body: dict, status_code: int, headers: dict | None = None
) -> ConnexionResponse:
    return ConnexionResponse(
        body=json.dumps(body),
        status_code=status_code,
        mimetype="application/json",
        headers=headers,
    )


def _setting(request, name, default=None):
    """Read a process setting off the request, if one was attached to it."""
    settings = getattr(getattr(request, "state", None), "settings", None)
    if settings is None:
        scope = getattr(request, "scope", None)
        scope_state = scope.get("state") if isinstance(scope, dict) else None
        if isinstance(scope_state, dict):
            settings = scope_state.get("settings")
    if settings is None:
        return default
    return settings.get(name, default)


def _log_error_response(request, status: int, title: str, detail: str, exc=None):
    """Record every request that ends in an error, keyed by its request id.

    Server errors carry the traceback; client errors are a single warning line
    so a 4xx storm stays readable. The id returned is the one the client is
    handed, so it is never a placeholder: outside a request -- a direct handler
    call in a test, say -- a fresh one is minted and logged with this line, and
    the record stays self-consistent.
    """
    request_id = get_request_id(request) or new_request_id()
    url = getattr(request, "url", None)
    logger.log(
        logging.ERROR if status >= 500 else logging.WARNING,
        "%s %s -> %s %s: %s",
        getattr(request, "method", None) or "-",
        str(url) if url is not None else "-",
        status,
        title,
        detail,
        exc_info=exc if status >= 500 else None,
        extra={"request_id": request_id},
    )
    return request_id


def _with_request_id(headers: dict | None, request_id: str | None) -> dict | None:
    if not request_id:
        return headers
    headers = dict(headers or {})
    headers.setdefault(REQUEST_ID_HEADER_NAME, request_id)
    return headers


def _build_error_response_from_payload(
    payload: dict, default_exc=None
) -> ErrorResponse:
    errors = None
    if payload.get("errors"):
        errors = [
            ErrorDetail(**e) if not isinstance(e, ErrorDetail) else e
            for e in payload.get("errors")
        ]
    err = ErrorResponse(
        status=payload.get("status", getattr(default_exc, "status_code", 500)),
        title=payload.get("title", getattr(default_exc, "title", "Error")),
        detail=payload.get("detail", getattr(default_exc, "detail", "")),
        type=payload.get("type", getattr(default_exc, "type", "about:blank")),
        instance=payload.get("instance", None),
        errors=errors,
        request_id=payload.get("request_id") or "",
    )
    return err


async def neurostore_exception_handler(request: Request, exc: NeuroStoreException):
    """
    Starlette exception handler: convert NeuroStoreException into JSONResponse.
    """
    payload = exc.to_payload()
    payload["request_id"] = _log_error_response(
        request,
        payload.get("status", 500),
        payload.get("title", "Error"),
        payload.get("detail", ""),
        exc=exc,
    )
    err = _build_error_response_from_payload(payload, default_exc=exc)
    body = {**err.to_dict(), **getattr(exc, "extra", {})}
    return _json_response(
        body, err.status, headers=_with_request_id(None, err.request_id)
    )


def error_response(
    request,
    status: int,
    title: str,
    detail: str,
    *,
    errors: list[ErrorDetail] | None = None,
    exc=None,
) -> ConnexionResponse:
    """An ErrorResponse for a failure that no NeuroStoreException carries."""
    request_id = _log_error_response(request, status, title, detail, exc=exc)
    err = ErrorResponse(
        status=status, title=title, detail=detail, errors=errors, request_id=request_id
    )
    return _json_response(
        err.to_dict(), status, headers=_with_request_id(None, request_id)
    )


def _review_bad_request(request, exc: ProblemException) -> ConnexionResponse:
    """One error per refused review body, naming its rule and field, never its value.

    Connexion raises its 400 while it handles the jsonschema error, so that error is the
    exception's context.
    """
    cause = exc.__context__
    if isinstance(cause, ValidationError):
        field = ".".join(str(part) for part in cause.absolute_path) or None
        error = ErrorDetail(
            field=field, code=cause.validator, message=f"failed the {cause.validator} rule"
        )
        return error_response(
            request,
            400,
            "Bad Request",
            "The request body is not valid.",
            errors=[error],
            exc=exc,
        )
    error = ErrorDetail(code="invalid_request", message=exc.detail or "The request is not valid.")
    return error_response(request, 400, "Bad Request", error.message, errors=[error], exc=exc)


async def problem_exception_handler(request: Request, exc: ProblemException):
    if exc.status == 400 and is_review_path(request.url.path):
        return _review_bad_request(request, exc)
    body = {
        "type": exc.type or "about:blank",
        "title": exc.title,
        "detail": exc.detail,
        "status": exc.status,
    }
    if exc.instance is not None:
        body["instance"] = exc.instance
    if exc.ext:
        body.update(exc.ext)
    request_id = _log_error_response(
        request, exc.status, exc.title or "Error", exc.detail or "", exc=exc
    )
    body["request_id"] = request_id
    body["timestamp"] = _timestamp()
    return _json_response(
        body, exc.status, headers=_with_request_id(exc.headers, request_id)
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    status_code = int(exc.status_code)
    body = {
        "type": "about:blank",
        "title": exc.detail if status_code < 500 else "Internal Server Error",
        "detail": exc.detail,
        "status": status_code,
    }
    request_id = _log_error_response(
        request, status_code, body["title"], exc.detail or "", exc=exc
    )
    body["request_id"] = request_id
    body["timestamp"] = _timestamp()
    return _json_response(
        body, status_code, headers=_with_request_id(exc.headers, request_id)
    )


async def general_exception_handler(request: Request, exc: Exception):
    """
    Starlette exception handler for unexpected exceptions -> 500.
    Re-raise anyio.EndOfStream so ASGI server can handle stream closes.
    """
    if isinstance(exc, anyio.EndOfStream):
        raise
    if os.getenv("NEUROSTORE_RERAISE_EXCEPTIONS") == "1":
        raise exc

    internal = InternalServerError()
    payload = internal.to_payload()
    # What went wrong goes to the log for everyone and to the client only on a
    # development deployment. Gating this on the log level, as it used to be,
    # would mean that raising verbosity to debug a production incident also
    # started returning internal exception text -- table names, paths,
    # unpublished identifiers -- to callers. (The gate is ENV rather than
    # DEBUG because no config class defines DEBUG; it is only ever read with a
    # False default.)
    payload["detail"] = (
        str(exc) if _setting(request, "ENV") == "development" else internal.detail
    )
    payload["request_id"] = _log_error_response(
        request, internal.status_code, internal.title, str(exc), exc=exc
    )
    # Connexion handles Exception itself, so Sentry's ASGI integration never
    # sees this; report it here instead.
    capture_exception(exc, request=request)

    err = _build_error_response_from_payload(payload, default_exc=internal)
    body = err.to_dict()
    return _json_response(
        body, err.status, headers=_with_request_id(None, err.request_id)
    )
