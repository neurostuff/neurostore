"""Per-request correlation ids.

The API already returns a ``request_id`` on error responses, but it was minted
inside the error handler and appeared nowhere else, so it could not be used to
find the failing request in a log. One id is now assigned per request, echoed as
``X-Request-ID``, attached to every log record emitted while handling that
request, and reused in the error body (issue #1569).

The id lives in two places on purpose. ``scope["state"]`` is what handlers read
when they already hold the request; the context variable is what the logging
filter reads, because most code that logs during a request -- resource methods,
SQLAlchemy, third-party libraries -- has no request object to consult.
"""

import contextvars
import uuid

REQUEST_ID_HEADER = b"x-request-id"
REQUEST_ID_HEADER_NAME = "X-Request-ID"
MAX_REQUEST_ID_LENGTH = 64
ALLOWED_PUNCTUATION = "-_."

_request_id_var = contextvars.ContextVar("neuro_request_id", default=None)


def new_request_id():
    return uuid.uuid4().hex[:16]


def current_request_id():
    """The id of the request being handled on this task, or None."""
    return _request_id_var.get()


def bind_request_id(request_id):
    """Make ``request_id`` current. Returns a token for ``reset_request_id``."""
    return _request_id_var.set(request_id)


def reset_request_id(token):
    _request_id_var.reset(token)


def sanitize_request_id(value):
    """Accept a caller-supplied id only if it is short and header-safe.

    Header-safe here means ASCII alphanumerics plus ``-``, ``_`` and ``.``: the
    value is echoed back in a response header, so anything that could carry a
    newline, a control character or a quote is rejected and replaced with a
    generated id.
    """
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
    if not all(_is_header_safe(char) for char in value):
        return None
    return value


def _is_header_safe(char):
    # ``isalnum`` alone also accepts non-ASCII letters, which cannot be encoded
    # into a header later on.
    return char.isascii() and (char.isalnum() or char in ALLOWED_PUNCTUATION)


def get_request_id(request=None):
    """The id assigned to this request, falling back to the current task's."""
    if request is not None:
        state = getattr(request, "state", None)
        request_id = getattr(state, "request_id", None)
        if request_id:
            return request_id

        scope = getattr(request, "scope", None)
        if isinstance(scope, dict):
            scope_state = scope.get("state")
            if isinstance(scope_state, dict) and scope_state.get("request_id"):
                return scope_state["request_id"]
    return current_request_id()


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

        token = bind_request_id(request_id)
        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            reset_request_id(token)
