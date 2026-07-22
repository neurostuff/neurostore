import json
import logging
import os
import traceback

import anyio
from connexion.exceptions import ProblemException
from connexion.lifecycle import ConnexionResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request

from neurostore.exceptions.base import InternalServerError, NeuroStoreException
from neurostore.exceptions.utils.errors import ErrorDetail, ErrorResponse

logger = logging.getLogger(__name__)


def _json_response(
    body: dict, status_code: int, headers: dict | None = None
) -> ConnexionResponse:
    return ConnexionResponse(
        body=json.dumps(body),
        status_code=status_code,
        mimetype="application/json",
        headers=headers,
    )


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
    )
    return err


async def neurostore_exception_handler(request: Request, exc: NeuroStoreException):
    """
    Starlette exception handler: convert NeuroStoreException into JSONResponse.
    """
    payload = exc.to_payload()
    err = _build_error_response_from_payload(payload, default_exc=exc)
    body = err.to_dict()
    return _json_response(body, err.status)


async def problem_exception_handler(request: Request, exc: ProblemException):
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
    return _json_response(body, exc.status, headers=exc.headers)


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    status_code = int(exc.status_code)
    body = {
        "type": "about:blank",
        "title": exc.detail if status_code < 500 else "Internal Server Error",
        "detail": exc.detail,
        "status": status_code,
    }
    return _json_response(body, status_code, headers=exc.headers)


async def general_exception_handler(request: Request, exc: Exception):
    """
    Starlette exception handler for unexpected exceptions -> 500.
    Re-raise anyio.EndOfStream so ASGI server can handle stream closes.
    """
    if isinstance(exc, anyio.EndOfStream):
        raise
    if os.getenv("NEUROSTORE_RERAISE_EXCEPTIONS") == "1":
        raise exc

    logger.exception(
        "Unhandled exception in request: %s %s",
        getattr(request, "method", None),
        getattr(request, "url", None),
    )
    logger.debug(traceback.format_exc())

    internal = InternalServerError()
    payload = internal.to_payload()
    payload["detail"] = (
        str(exc) if logger.isEnabledFor(logging.DEBUG) else internal.detail
    )
    err = _build_error_response_from_payload(payload, default_exc=internal)
    body = err.to_dict()
    return _json_response(body, err.status)
