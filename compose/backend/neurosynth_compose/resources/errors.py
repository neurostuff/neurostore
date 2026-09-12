import json
import logging
from datetime import datetime, timezone

import anyio
from connexion.exceptions import ProblemException
from connexion.lifecycle import ConnexionResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from neurosynth_compose.observability.request_id import (
    REQUEST_ID_HEADER_NAME,
    get_request_id,
)
from neurosynth_compose.observability.sentry import capture_exception

logger = logging.getLogger(__name__)


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


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


def _json_response(
    body: dict, status_code: int, headers: dict | None = None
) -> ConnexionResponse:
    return ConnexionResponse(
        body=json.dumps(body),
        status_code=status_code,
        mimetype="application/json",
        headers=headers,
    )


async def problem_exception_handler(request, exc: ProblemException):
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


async def http_exception_handler(request, exc: StarletteHTTPException):
    body = {
        "type": "about:blank",
        "title": exc.detail if exc.status_code < 500 else "Internal Server Error",
        "detail": exc.detail,
        "status": exc.status_code,
    }
    request_id = _log_error_response(
        request, exc.status_code, body["title"], exc.detail or "", exc=exc
    )
    body["request_id"] = request_id
    body["timestamp"] = _timestamp()
    return _json_response(
        body, exc.status_code, headers=_with_request_id(exc.headers, request_id)
    )


async def general_exception_handler(request, exc):
    if isinstance(exc, anyio.EndOfStream):
        raise

    request_id = _log_error_response(
        request, 500, "Internal Server Error", str(exc), exc=exc
    )
    # Connexion handles Exception itself, so Sentry's ASGI integration never
    # sees this; report it here instead.
    capture_exception(exc, request=request)
    return _json_response(
        {
            "type": "about:blank",
            "title": "Internal Server Error",
            "detail": "The server encountered an internal error.",
            "status": 500,
            "request_id": request_id,
            "timestamp": _timestamp(),
        },
        500,
        headers=_with_request_id(None, request_id),
    )
