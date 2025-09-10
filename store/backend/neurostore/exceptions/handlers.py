import logging
import traceback
import anyio
from typing import Tuple, Dict, Any

from starlette.requests import Request
from starlette.responses import JSONResponse

from .base import NeuroStoreException, InternalServerError
from .utils.errors import ErrorResponse, ErrorDetail

logger = logging.getLogger(__name__)


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
    response = JSONResponse(body, status_code=err.status, media_type="application/json")
    return response


async def general_exception_handler(request: Request, exc: Exception):
    """
    Starlette exception handler for unexpected exceptions -> 500.
    Re-raise anyio.EndOfStream so ASGI server can handle stream closes.
    """
    if isinstance(exc, anyio.EndOfStream):
        raise

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
    response = JSONResponse(body, status_code=err.status, media_type="application/json")
    return response


# Helper functions for WSGI/Flask handlers:
# Return serializable body dict and status so core.py can construct a Flask Response
def flask_neurostore_body_and_status(
    exc: NeuroStoreException,
) -> Tuple[Dict[str, Any], int]:
    payload = exc.to_payload()
    err = _build_error_response_from_payload(payload, default_exc=exc)
    return err.to_dict(), err.status


def flask_general_body_and_status(exc: Exception) -> Tuple[Dict[str, Any], int]:
    if isinstance(exc, anyio.EndOfStream):
        # Shouldn't normally occur in WSGI, but keep parity with ASGI behavior:
        raise
    logger.exception("Unhandled WSGI exception: %s", exc)
    internal = InternalServerError()
    payload = internal.to_payload()
    payload["detail"] = (
        str(exc) if logger.isEnabledFor(logging.DEBUG) else internal.detail
    )
    err = _build_error_response_from_payload(payload, default_exc=internal)
    return err.to_dict(), err.status
