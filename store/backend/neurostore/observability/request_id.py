"""Per-request correlation ids.

The API already returns a ``request_id`` on error responses, but it was minted
inside the error handler and appeared nowhere else, so it could not be used to
find the failing request in a log. One id is now assigned per request, echoed as
``X-Request-ID``, attached to error log records and reused in the error body
(issue #1569).
"""

import uuid

REQUEST_ID_HEADER = b"x-request-id"
REQUEST_ID_HEADER_NAME = "X-Request-ID"
MAX_REQUEST_ID_LENGTH = 64


def new_request_id():
    return uuid.uuid4().hex[:16]


def sanitize_request_id(value):
    """Accept a caller-supplied id only if it is short and printable ASCII."""
    if not value:
        return None
    if isinstance(value, bytes):
        try:
            value = value.decode("ascii")
        except UnicodeDecodeError:
            return None
    value = value.strip()
    if not value or len(value) > MAX_REQUEST_ID_LENGTH:
        return None
    if not all(char.isalnum() or char in "-_." for char in value):
        return None
    return value


def get_request_id(request):
    """The id assigned to this request, or None outside a request."""
    if request is None:
        return None

    state = getattr(request, "state", None)
    request_id = getattr(state, "request_id", None)
    if request_id:
        return request_id

    scope = getattr(request, "scope", None)
    if isinstance(scope, dict):
        scope_state = scope.get("state")
        if isinstance(scope_state, dict):
            return scope_state.get("request_id")
    return None


class RequestIdMiddleware:
    """Assign a request id and echo it back on every response."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        inbound = None
        for name, value in scope.get("headers") or ():
            if name.lower() == REQUEST_ID_HEADER:
                inbound = sanitize_request_id(value)
                break

        request_id = inbound or new_request_id()
        state = scope.setdefault("state", {})
        state["request_id"] = request_id

        async def send_with_request_id(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers") or [])
                if not any(name.lower() == REQUEST_ID_HEADER for name, _ in headers):
                    headers.append((REQUEST_ID_HEADER, request_id.encode("ascii")))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_request_id)
