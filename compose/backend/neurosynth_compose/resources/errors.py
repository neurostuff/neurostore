import json
import logging

import anyio
from connexion.exceptions import ProblemException
from connexion.lifecycle import ConnexionResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

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
    return _json_response(body, exc.status, headers=exc.headers)


async def http_exception_handler(request, exc: StarletteHTTPException):
    body = {
        "type": "about:blank",
        "title": exc.detail if exc.status_code < 500 else "Internal Server Error",
        "detail": exc.detail,
        "status": exc.status_code,
    }
    return _json_response(body, exc.status_code, headers=exc.headers)


async def general_exception_handler(request, exc):
    if isinstance(exc, anyio.EndOfStream):
        raise

    logger.exception(
        "Unhandled exception in request: %s %s",
        getattr(request, "method", None),
        getattr(request, "url", None),
    )
    return _json_response(
        {
            "type": "about:blank",
            "title": "Internal Server Error",
            "detail": "The server encountered an internal error.",
            "status": 500,
        },
        500,
    )
