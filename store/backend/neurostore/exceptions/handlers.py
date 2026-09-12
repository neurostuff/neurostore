import json
import logging
import os
import traceback
from datetime import datetime, timezone

import anyio
from connexion.exceptions import ProblemException
from connexion.lifecycle import ConnexionResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request

from neurostore.exceptions.base import InternalServerError, NeuroStoreException
from neurostore.exceptions.utils.errors import ErrorDetail, ErrorResponse
from neurostore.observability.request_id import (
    REQUEST_ID_HEADER_NAME,
    get_request_id,
)
from neurostore.observability.sentry import capture_exception

logger = logging.getLogger(__name__)


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


def _log_error_response(request, status: int, title: str, detail: str, exc=None):
    """Record every request that ends in an error, keyed by its request id.

    Server errors carry the traceback; client errors are a single warning line
    so a 4xx storm stays readable.
    """
    request_id = get_request_id(request) or "-"
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
    body = err.to_dict()
    return _json_response(
        body, err.status, headers=_with_request_id(None, err.request_id)
    )


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
    payload["detail"] = (
        str(exc) if logger.isEnabledFor(logging.DEBUG) else internal.detail
    )
    payload["request_id"] = _log_error_response(
        request, internal.status_code, internal.title, str(exc), exc=exc
    )
    logger.debug(traceback.format_exc())
    # Connexion handles Exception itself, so Sentry's ASGI integration never
    # sees this; report it here instead.
    capture_exception(exc, request=request)

    err = _build_error_response_from_payload(payload, default_exc=internal)
    body = err.to_dict()
    return _json_response(
        body, err.status, headers=_with_request_id(None, err.request_id)
    )
