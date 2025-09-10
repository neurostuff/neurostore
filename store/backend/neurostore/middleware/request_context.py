from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import uuid
from typing import Callable


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Populate request.state with request_id and instance path to be used by error middleware.
    """

    async def dispatch(self, request: Request, call_next: Callable):
        # Short unique request id
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        # Instance is the request path (can be extended to include method/params)
        request.state.instance = str(request.url.path)
        return await call_next(request)
