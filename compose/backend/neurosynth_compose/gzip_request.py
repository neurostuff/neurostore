"""Decompress request bodies sent with ``Content-Encoding: gzip``.

A project's provenance holds every curation stub, abstracts included, and the
frontend PUTs all of it on each save. Past about 41k stubs that body is over
the 100M ``client_max_body_size`` in compose/nginx/nginx.conf, so the frontend
gzips it (about 3x smaller) and this middleware hands the route plain JSON.
"""

import zlib

from starlette.requests import Request
from starlette.responses import JSONResponse

from neurosynth_compose.resources.errors import (
    _log_error_response,
    _timestamp,
    _with_request_id,
)

#: Largest body accepted once decompressed (about 200k curation stubs).
MAX_DECOMPRESSED_BYTES = 512 * 1024 * 1024
_CHUNK = 1024 * 1024


class _BadBody(Exception):
    def __init__(self, status, detail):
        self.status = status
        self.detail = detail

    async def respond(self, scope, receive, send):
        title = "Payload Too Large" if self.status == 413 else "Bad Request"
        request_id = _log_error_response(
            Request(scope), self.status, title, self.detail
        )
        body = {
            "type": "about:blank",
            "title": title,
            "detail": self.detail,
            "status": self.status,
            "request_id": request_id,
            "timestamp": _timestamp(),
        }
        response = JSONResponse(
            body, status_code=self.status, headers=_with_request_id(None, request_id)
        )
        await response(scope, receive, send)


def _encoding(scope):
    for name, value in scope.get("headers") or ():
        if name == b"content-encoding":
            return value.decode("latin-1").strip().lower()
    return None


async def _decompressed_body(receive, limit):
    decoder = zlib.decompressobj(wbits=16 + zlib.MAX_WBITS)
    out = bytearray()

    def feed(data):
        # Output comes _CHUNK at a time so a gzip bomb stops at the limit; a full chunk
        # may leave output pending in the decoder even once the input is used up.
        while True:
            try:
                chunk = decoder.decompress(data, _CHUNK)
            except zlib.error as exc:
                raise _BadBody(400, f"The gzip request body is invalid: {exc}")
            out.extend(chunk)
            if len(out) > limit:
                raise _BadBody(
                    413, f"The decompressed request body is over {limit} bytes."
                )
            data = decoder.unconsumed_tail
            if not data and len(chunk) < _CHUNK:
                return

    while True:
        message = await receive()
        if message["type"] != "http.request":
            raise _BadBody(400, "The client disconnected before sending the body.")
        feed(message.get("body", b""))
        if not message.get("more_body", False):
            break
    if not decoder.eof:
        raise _BadBody(400, "The gzip request body is truncated.")
    return bytes(out)


class GzipRequestMiddleware:
    """Hands the app a gzip request body decompressed, under a size cap."""

    def __init__(self, app, max_bytes=MAX_DECOMPRESSED_BYTES):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or _encoding(scope) != "gzip":
            await self.app(scope, receive, send)
            return
        try:
            body = await _decompressed_body(receive, self.max_bytes)
        except _BadBody as exc:
            await exc.respond(scope, receive, send)
            return

        headers = [
            (name, value)
            for name, value in scope["headers"]
            if name not in (b"content-encoding", b"content-length")
        ]
        headers.append((b"content-length", str(len(body)).encode()))
        sent = False

        async def replay():
            nonlocal sent
            if sent:
                return await receive()
            sent = True
            return {"type": "http.request", "body": body, "more_body": False}

        await self.app({**scope, "headers": headers}, replay, send)
