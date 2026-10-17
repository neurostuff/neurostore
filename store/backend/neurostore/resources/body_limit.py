"""Refuse a review request body over the cap before any route reads it."""

from starlette.requests import ClientDisconnect, Request
from starlette.responses import Response

from neurostore.exceptions.handlers import error_response
from neurostore.paths import UPLOAD_URL_PREFIX, is_review_path

MAX_REVIEW_BODY_BYTES = 8 * 1024 * 1024
#: client_max_body_size of location /api/review/imports/ in store/nginx/nginx.conf.
MAX_IMPORT_BYTES = 200 * 1024 * 1024
CAPPED_METHODS = {"POST", "PUT", "PATCH"}


def _is_review_write(scope):
    return (
        scope["type"] == "http"
        and scope.get("method") in CAPPED_METHODS
        and is_review_path(scope.get("path") or "")
    )


def _is_import(scope):
    return (scope.get("path") or "").startswith(UPLOAD_URL_PREFIX)


def _declared_length(scope):
    for name, value in scope.get("headers") or ():
        if name == b"content-length":
            try:
                return int(value)
            except ValueError:
                return None
    return None


class _Counter:
    """The size of the request body so far, against a limit."""

    def __init__(self, limit):
        self.limit = limit
        self.size = 0

    def add(self, message):
        """Counts the message; False once the body is over the limit."""
        if message["type"] == "http.request":
            self.size += len(message.get("body", b""))
        return self.size <= self.limit


async def _read_capped(receive, limit):
    """The messages up to the end of the body, or None as soon as the body passes ``limit``."""
    messages, counter = [], _Counter(limit)
    while True:
        message = await receive()
        messages.append(message)
        if not counter.add(message):
            return None
        if message["type"] != "http.request" or not message.get("more_body", False):
            return messages


def _replay(messages, receive):
    queue = list(messages)

    async def replayed():
        if queue:
            return queue.pop(0)
        return await receive()

    return replayed


async def _too_large(scope, receive, send, limit):
    response = error_response(
        Request(scope),
        413,
        "Payload Too Large",
        f"The request body is over {limit} bytes.",
    )
    refusal = Response(
        content=response.body,
        status_code=response.status_code,
        headers=response.headers,
        media_type="application/json",
    )
    await refusal(scope, receive, send)


class _CountedReceive:
    """Passes the body on as it arrives; past the limit, answers 413 and reports a disconnect."""

    def __init__(self, scope, receive, send, limit):
        self.scope = scope
        self.receive = receive
        self.send = send
        self.counter = _Counter(limit)
        self.refused = False
        self.started = False

    async def __call__(self):
        if self.refused:
            return {"type": "http.disconnect"}
        message = await self.receive()
        if self.counter.add(message):
            return message
        self.refused = True
        # Once the route has started its response, a 413 can no longer be sent.
        if not self.started:
            await _too_large(self.scope, self.receive, self.send, self.counter.limit)
        return {"type": "http.disconnect"}

    async def sending(self, message):
        # Whatever the route sends after a refusal is dropped: the 413 already answered.
        if not self.refused:
            self.started = True
            await self.send(message)


class ReviewBodyLimitMiddleware:
    """Refuses a review request body over the cap.

    A review body is read to the end first, then handed to the route as the same messages.
    An import is not read ahead: the route reads it as it arrives, and is told the client
    disconnected once it passes the import cap.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if not _is_review_write(scope):
            await self.app(scope, receive, send)
            return
        is_import = _is_import(scope)
        limit = MAX_IMPORT_BYTES if is_import else MAX_REVIEW_BODY_BYTES
        declared = _declared_length(scope)
        if declared is not None and declared > limit:
            await _too_large(scope, receive, send, limit)
        elif is_import:
            await self._count_as_you_go(scope, receive, send, limit)
        else:
            await self._buffer_then_replay(scope, receive, send, limit)

    async def _buffer_then_replay(self, scope, receive, send, limit):
        messages = await _read_capped(receive, limit)
        if messages is None:
            await _too_large(scope, receive, send, limit)
            return
        await self.app(scope, _replay(messages, receive), send)

    async def _count_as_you_go(self, scope, receive, send, limit):
        counted = _CountedReceive(scope, receive, send, limit)
        try:
            await self.app(scope, counted, counted.sending)
        except ClientDisconnect:
            if not counted.refused:
                raise
