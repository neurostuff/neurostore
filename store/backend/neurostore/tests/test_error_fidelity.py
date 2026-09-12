"""Tests for production error fidelity (issue #1569)."""

import logging

import pytest

from neurostore.observability import logging_config
from neurostore.observability.request_id import (
    RequestIdMiddleware,
    get_request_id,
    sanitize_request_id,
)


@pytest.fixture(autouse=True)
def _clean_logging():
    logging_config.reset_logging_for_tests()
    yield
    logging_config.reset_logging_for_tests()


def test_errors_are_written_to_the_configured_file(tmp_path):
    error_log = tmp_path / "logs" / "errors.log"

    written = logging_config.configure_logging({"ERROR_LOG_FILE": str(error_log)})

    assert written == error_log
    logging.getLogger("test").error("kaboom", extra={"request_id": "abc123"})
    logging.shutdown()

    contents = error_log.read_text()
    assert "kaboom" in contents
    # the request id is what ties the log line to the client's error body
    assert "abc123" in contents


def test_info_is_not_written_to_the_error_file(tmp_path):
    error_log = tmp_path / "errors.log"
    logging_config.configure_logging({"ERROR_LOG_FILE": str(error_log)})

    logging.getLogger("test").info("routine")
    logging.shutdown()

    assert "routine" not in error_log.read_text()


def test_no_file_handler_without_a_configured_path():
    assert logging_config.configure_logging({}) is None
    root = logging.getLogger()
    managed = [h for h in root.handlers if getattr(h, "_neuro_managed", False)]
    # stderr only
    assert len(managed) == 1


def test_unwritable_error_log_does_not_stop_startup(tmp_path):
    blocker = tmp_path / "blocker"
    blocker.write_text("not a directory")

    # the parent exists as a file, so mkdir/open must fail
    assert logging_config.configure_logging({"ERROR_LOG_FILE": str(blocker / "e.log")}) is None


def test_records_without_a_request_id_still_format(tmp_path):
    error_log = tmp_path / "errors.log"
    logging_config.configure_logging({"ERROR_LOG_FILE": str(error_log)})

    logging.getLogger("test").error("no id here")
    logging.shutdown()

    assert "[-] no id here" in error_log.read_text()


@pytest.mark.parametrize(
    "value, expected",
    [
        ("abc-123", "abc-123"),
        (b"abc-123", "abc-123"),
        ("", None),
        ("  ", None),
        ("x" * 65, None),
        ("bad value", None),
        ("bad\nvalue", None),
        ("drop;table", None),
    ],
)
def test_sanitize_request_id(value, expected):
    assert sanitize_request_id(value) == expected


def test_get_request_id_reads_scope_state():
    class Request:
        scope = {"state": {"request_id": "from-scope"}}

    assert get_request_id(Request()) == "from-scope"
    assert get_request_id(None) is None


@pytest.mark.anyio
async def test_middleware_generates_and_echoes_an_id():
    seen = {}
    sent = []

    async def app(scope, receive, send):
        seen["request_id"] = scope["state"]["request_id"]
        await send({"type": "http.response.start", "status": 200, "headers": []})

    async def send(message):
        sent.append(message)

    async def receive():
        return {"type": "http.request"}

    await RequestIdMiddleware(app)(
        {"type": "http", "headers": []}, receive, send
    )

    headers = dict(sent[0]["headers"])
    assert headers[b"x-request-id"].decode() == seen["request_id"]
    assert len(seen["request_id"]) == 16


@pytest.mark.anyio
async def test_middleware_honours_an_inbound_id():
    sent = []

    async def app(scope, receive, send):
        assert scope["state"]["request_id"] == "caller-supplied"
        await send({"type": "http.response.start", "status": 500, "headers": []})

    async def send(message):
        sent.append(message)

    async def receive():
        return {"type": "http.request"}

    await RequestIdMiddleware(app)(
        {"type": "http", "headers": [(b"x-request-id", b"caller-supplied")]},
        receive,
        send,
    )

    assert dict(sent[0]["headers"])[b"x-request-id"] == b"caller-supplied"


@pytest.mark.anyio
async def test_middleware_rejects_a_hostile_inbound_id():
    sent = []

    async def app(scope, receive, send):
        assert scope["state"]["request_id"] != "bad\nheader"
        await send({"type": "http.response.start", "status": 200, "headers": []})

    async def send(message):
        sent.append(message)

    async def receive():
        return {"type": "http.request"}

    await RequestIdMiddleware(app)(
        {"type": "http", "headers": [(b"x-request-id", b"bad\nheader")]},
        receive,
        send,
    )

    assert dict(sent[0]["headers"])[b"x-request-id"] != b"bad\nheader"
