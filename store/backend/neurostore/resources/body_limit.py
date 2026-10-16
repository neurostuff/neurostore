"""Refuse a review request body over the cap before any route reads it."""

from starlette.requests import Request
from starlette.responses import Response

from neurostore.exceptions.handlers import error_response
from neurostore.paths import UPLOAD_URL_PREFIX, is_review_path

MAX_REVIEW_BODY_BYTES = 8 * 1024 * 1024
CAPPED_METHODS = {"POST", "PUT", "PATCH"}


def _is_capped(scope):
    path = scope.get("path") or ""
    return (
        scope["type"] == "http"
        and scope.get("method") in CAPPED_METHODS
        and is_review_path(path)
        and not path.startswith(UPLOAD_URL_PREFIX)
    )


def _declared_length(scope):
    for name, value in scope.get("headers") or ():
        if name == b"content-length":
            try:
                return int(value)
            except ValueError:
                return None
    return None


async def _read_capped(receive, limit):
    """The messages up to the end of the body, or None as soon as the body passes ``limit``."""
    messages, size = [], 0
    while True:
        message = await receive()
        messages.append(message)
        if message["type"] != "http.request":
            return messages
        size += len(message.get("body", b""))
        if size > limit:
            return None
        if not message.get("more_body", False):
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


class ReviewBodyLimitMiddleware:
    """Reads a capped review request up to the cap, then hands the route the same messages."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if not _is_capped(scope):
            await self.app(scope, receive, send)
            return
        limit = MAX_REVIEW_BODY_BYTES
        declared = _declared_length(scope)
        if declared is not None and declared > limit:
            await _too_large(scope, receive, send, limit)
            return
        messages = await _read_capped(receive, limit)
        if messages is None:
            await _too_large(scope, receive, send, limit)
            return
        await self.app(scope, _replay(messages, receive), send)
