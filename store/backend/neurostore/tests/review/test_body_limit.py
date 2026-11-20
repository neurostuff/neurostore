"""The review body cap, at the ASGI layer: a capped request is refused before a route reads it."""

import json

import pytest
from starlette.requests import ClientDisconnect

from neurostore.resources import body_limit

pytestmark = pytest.mark.anyio

REVIEW_OPS = "/api/review/reviews/1/ops"


class Recorder:
    """The app behind the cap: records what it reads, then answers 200."""

    def __init__(self):
        self.calls = 0
        self.read = []

    async def __call__(self, scope, receive, send):
        self.calls += 1
        while True:
            message = await receive()
            self.read.append(message)
            if message["type"] != "http.request" or not message.get("more_body"):
                break
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    def body(self):
        return b"".join(m.get("body", b"") for m in self.read if m["type"] == "http.request")


def scope_for(path=REVIEW_OPS, method="POST", headers=(), request_id=None):
    scope = {
        "type": "http",
        "method": method,
        "path": path,
        "headers": list(headers),
        "query_string": b"",
        "scheme": "http",
        "server": ("testserver", 80),
        "root_path": "",
    }
    if request_id is not None:
        scope["state"] = {"request_id": request_id}
    return scope


def declared(length):
    return [(b"content-length", str(length).encode("ascii"))]


def messages(chunks):
    last = len(chunks) - 1
    return [
        {"type": "http.request", "body": chunk, "more_body": index < last}
        for index, chunk in enumerate(chunks)
    ]


def receiver(queue):
    async def receive():
        return queue.pop(0)

    return receive


async def forbidden_receive():
    raise AssertionError("the body was read before the cap was applied")


async def run(monkeypatch, *, limit, app=None, scope=None, receive=None, chunks=()):
    monkeypatch.setattr(body_limit, "MAX_REVIEW_BODY_BYTES", limit)
    app = app or Recorder()
    sent = []

    async def send(message):
        sent.append(message)

    if receive is None:
        receive = receiver(messages(chunks))
    await body_limit.ReviewBodyLimitMiddleware(app)(scope or scope_for(), receive, send)
    return sent, app


def status(sent):
    return sent[0]["status"]


def json_body(sent):
    body = b"".join(m.get("body", b"") for m in sent if m["type"] == "http.response.body")
    return json.loads(body)


async def test_the_review_body_limit_is_8_mib():
    assert body_limit.MAX_REVIEW_BODY_BYTES == 8 * 1024 * 1024


async def test_a_declared_body_over_the_cap_is_refused_without_being_read(monkeypatch):
    sent, app = await run(
        monkeypatch,
        limit=100,
        scope=scope_for(headers=declared(101)),
        receive=forbidden_receive,
    )

    assert status(sent) == 413
    assert app.calls == 0


async def test_a_declared_body_exactly_at_the_cap_reaches_the_route(monkeypatch):
    body = b"x" * 100

    sent, app = await run(
        monkeypatch, limit=100, scope=scope_for(headers=declared(100)), chunks=[body]
    )

    assert status(sent) == 200
    assert app.body() == body


async def test_a_declared_body_one_byte_over_the_cap_is_refused(monkeypatch):
    sent, app = await run(
        monkeypatch, limit=100, scope=scope_for(headers=declared(101)), chunks=[b"x" * 101]
    )

    assert status(sent) == 413
    assert app.calls == 0


async def test_a_streamed_body_exactly_at_the_cap_reaches_the_route(monkeypatch):
    sent, app = await run(monkeypatch, limit=100, chunks=[b"x" * 60, b"x" * 40])

    assert status(sent) == 200
    assert app.body() == b"x" * 100


async def test_a_streamed_body_one_byte_over_the_cap_is_refused_in_one_chunk(monkeypatch):
    sent, app = await run(monkeypatch, limit=100, chunks=[b"x" * 101])

    assert status(sent) == 413
    assert app.calls == 0


async def test_a_streamed_body_one_byte_over_the_cap_is_refused_across_chunks(monkeypatch):
    sent, app = await run(monkeypatch, limit=100, chunks=[b"x" * 100, b"x"])

    assert status(sent) == 413
    assert app.calls == 0


async def test_a_malformed_content_length_counts_as_undeclared_and_the_cap_still_applies(
    monkeypatch,
):
    headers = [(b"content-length", b"lots")]

    sent, app = await run(
        monkeypatch, limit=100, scope=scope_for(headers=headers), chunks=[b"x" * 101]
    )

    assert status(sent) == 413
    assert app.calls == 0


async def test_a_malformed_content_length_under_the_cap_reaches_the_route(monkeypatch):
    headers = [(b"content-length", b"lots")]

    sent, app = await run(
        monkeypatch, limit=100, scope=scope_for(headers=headers), chunks=[b"x" * 10]
    )

    assert status(sent) == 200
    assert app.body() == b"x" * 10


async def test_a_client_disconnect_is_passed_on_after_the_bytes_read(monkeypatch):
    chunks = [
        {"type": "http.request", "body": b"abc", "more_body": True},
        {"type": "http.disconnect"},
    ]

    sent, app = await run(monkeypatch, limit=100, receive=receiver(chunks))

    assert app.read == [
        {"type": "http.request", "body": b"abc", "more_body": True},
        {"type": "http.disconnect"},
    ]


async def test_a_refusal_is_an_error_response_carrying_the_request_id(monkeypatch):
    sent, _ = await run(
        monkeypatch,
        limit=100,
        scope=scope_for(headers=declared(101), request_id="req-413"),
        receive=forbidden_receive,
    )

    assert status(sent) == 413
    headers = dict(sent[0]["headers"])
    assert headers[b"content-type"] == b"application/json"
    assert headers[b"x-request-id"] == b"req-413"
    body = json_body(sent)
    assert body["status"] == 413
    assert body["title"] == "Payload Too Large"
    assert body["request_id"] == "req-413"
    assert body["timestamp"]


async def test_the_import_route_is_not_held_to_the_review_cap(monkeypatch):
    sent, app = await run(
        monkeypatch,
        limit=100,
        scope=scope_for(path="/api/review/imports/", headers=declared(101)),
        chunks=[b"x" * 101],
    )

    assert status(sent) == 200
    assert app.calls == 1


async def test_a_post_outside_the_review_routes_is_not_capped(monkeypatch):
    sent, app = await run(
        monkeypatch,
        limit=100,
        scope=scope_for(path="/api/studies/", headers=declared(101)),
        chunks=[b"x" * 101],
    )

    assert status(sent) == 200
    assert app.calls == 1


IMPORTS = "/api/review/imports/"
MAX_REVIEW_BODY = body_limit.MAX_REVIEW_BODY_BYTES


async def run_import(monkeypatch, *, limit, headers=(), receive=None, chunks=(), app=None):
    monkeypatch.setattr(body_limit, "MAX_IMPORT_BYTES", limit)
    return await run(
        monkeypatch,
        limit=MAX_REVIEW_BODY,
        app=app,
        scope=scope_for(path=IMPORTS, headers=headers),
        receive=receive,
        chunks=chunks,
    )


async def test_the_import_cap_is_200_mib():
    assert body_limit.MAX_IMPORT_BYTES == 200 * 1024 * 1024


async def test_a_declared_import_over_the_import_cap_is_refused_without_being_read(monkeypatch):
    sent, app = await run_import(
        monkeypatch, limit=100, headers=declared(101), receive=forbidden_receive
    )

    assert status(sent) == 413
    assert json_body(sent)["title"] == "Payload Too Large"
    assert app.calls == 0


async def test_a_declared_import_at_the_import_cap_reaches_the_route(monkeypatch):
    sent, app = await run_import(
        monkeypatch, limit=100, headers=declared(100), chunks=[b"x" * 60, b"x" * 40]
    )

    assert status(sent) == 200
    assert app.body() == b"x" * 100


async def test_an_undeclared_import_over_the_cap_is_refused_as_it_streams_in(monkeypatch):
    sent, app = await run_import(monkeypatch, limit=100, chunks=[b"x" * 60, b"x" * 41])

    assert [m["status"] for m in sent if m["type"] == "http.response.start"] == [413]
    assert json_body(sent)["title"] == "Payload Too Large"
    assert app.body() == b"x" * 60
    assert app.read[-1] == {"type": "http.disconnect"}


async def test_an_import_whose_content_length_lies_is_refused_past_the_cap(monkeypatch):
    sent, app = await run_import(
        monkeypatch, limit=100, headers=declared(50), chunks=[b"x" * 100, b"x"]
    )

    assert [m["status"] for m in sent if m["type"] == "http.response.start"] == [413]
    assert app.body() == b"x" * 100


async def test_an_import_reaches_the_route_as_it_streams_in(monkeypatch):
    arrived = []
    queue = messages([b"a" * 10, b"b" * 10, b"c" * 10])

    async def receive():
        arrived.append(queue[0])
        return queue.pop(0)

    class FirstChunk(Recorder):
        async def __call__(self, scope, receive, send):
            first = await receive()
            self.arrived_with_first = len(arrived)
            self.read.append(first)
            await super().__call__(scope, receive, send)

    app = FirstChunk()
    sent, _ = await run_import(monkeypatch, limit=100, receive=receive, app=app)

    assert status(sent) == 200
    assert app.arrived_with_first == 1
    assert app.body() == b"a" * 10 + b"b" * 10 + b"c" * 10


async def test_an_import_that_passes_the_cap_after_its_response_started_gets_no_413(monkeypatch):
    class Answers(Recorder):
        async def __call__(self, scope, receive, send):
            self.read.append(await receive())
            await send({"type": "http.response.start", "status": 200, "headers": []})
            self.read.append(await receive())
            await send({"type": "http.response.body", "body": b"late"})

    app = Answers()

    sent, _ = await run_import(monkeypatch, limit=100, chunks=[b"x" * 60, b"x" * 41], app=app)

    assert sent == [{"type": "http.response.start", "status": 200, "headers": []}]
    assert app.read[-1] == {"type": "http.disconnect"}


async def test_a_client_disconnect_the_route_raises_with_nothing_refused_is_re_raised(
    monkeypatch,
):
    class Disconnected(Recorder):
        async def __call__(self, scope, receive, send):
            raise ClientDisconnect()

    with pytest.raises(ClientDisconnect):
        await run_import(monkeypatch, limit=100, chunks=[b"x" * 10], app=Disconnected())


async def test_a_client_disconnect_the_route_raises_after_a_refusal_is_swallowed(monkeypatch):
    class ReadsThenDisconnects(Recorder):
        async def __call__(self, scope, receive, send):
            await receive()
            await receive()
            raise ClientDisconnect()

    sent, _ = await run_import(
        monkeypatch, limit=100, chunks=[b"x" * 60, b"x" * 41], app=ReadsThenDisconnects()
    )

    assert status(sent) == 413
