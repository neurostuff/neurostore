from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from starlette.requests import Request
import logging
import traceback
import anyio

from ..exceptions.utils.errors import ErrorResponse, ErrorDetail
from ..exceptions.base import NeuroStoreException, InternalServerError

logger = logging.getLogger(__name__)


class NeuroStoreErrorMiddleware(BaseHTTPMiddleware):
    """
    Starlette middleware that converts application exceptions into
    RFC 7807-style json responses (using ErrorResponse).
    Cannot use problem+json because of connexion limitations.
    """

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except NeuroStoreException as exc:
            # Convert NeuroStoreException -> ErrorResponse
            payload = exc.to_payload()
            errors = None
            if payload.get("errors"):
                # payload['errors'] may be dicts from earlier code paths
                errors = [
                    ErrorDetail(**e) if not isinstance(e, ErrorDetail) else e
                    for e in payload.get("errors")
                ]

            err = ErrorResponse(
                status=payload.get("status", exc.status_code),
                title=payload.get("title", exc.title),
                detail=payload.get("detail", exc.detail),
                type=payload.get("type", exc.type),
                instance=payload.get("instance", None),
                errors=errors,
            )
            body = err.to_dict()
            response = JSONResponse(
                body, status_code=err.status, media_type="application/json"
            )
            # Ensure CORS headers are present on error responses
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response
        except Exception as exc:  # unexpected errors -> 500
            # If the exception indicates stream/connection closure from ASGI/WGI bridging,
            # re-raise to allow the underlying framework to handle it instead of
            # converting it to an internal server error response.
            if isinstance(exc, anyio.EndOfStream):
                raise

            logger.exception(
                "Unhandled exception in request: %s %s",
                request.method,
                request.url.path,
            )
            logger.debug(traceback.format_exc())

            # Create minimal internal server error response
            internal = InternalServerError()
            err = ErrorResponse(
                status=internal.status_code,
                title=internal.title,
                detail=(
                    str(exc) if logger.isEnabledFor(logging.DEBUG) else internal.detail
                ),
                type=internal.type,
            )
            body = err.to_dict()
            response = JSONResponse(
                body, status_code=err.status, media_type="application/json"
            )
            # Ensure CORS headers are present on error responses
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response
