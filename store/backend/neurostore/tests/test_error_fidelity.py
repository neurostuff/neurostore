"""Tests for production error fidelity (issue #1569)."""

import json
import logging
import logging.handlers
import re

import connexion
import httpx
import pytest
from connexion.exceptions import ProblemException
from starlette.exceptions import HTTPException
from starlette.requests import Request

from neurostore.exceptions.base import NeuroStoreException
from neurostore.exceptions.handlers import (
    general_exception_handler,
    http_exception_handler,
    neurostore_exception_handler,
    problem_exception_handler,
)
from neurostore.observability import logging_config
from neurostore.observability.request_id import (
    RequestIdMiddleware,
    current_request_id,
    get_request_id,
    sanitize_request_id,
)

GENERATED_ID = re.compile(r"^[0-9a-f]{16}$")


@pytest.fixture(autouse=True)
def _clean_logging():
    """Leave the process's logging exactly as this module found it."""
    root = logging.getLogger()
    root_level = root.level
    levels = {
        name: logger.level
        for name, logger in logging.Logger.manager.loggerDict.items()
        if isinstance(logger, logging.Logger)
    }

    logging_config.reset_logging_for_tests()
    yield
    logging_config.reset_logging_for_tests()

    root.setLevel(root_level)
    for name, level in levels.items():
        logging.getLogger(name).setLevel(level)


def _flush_handlers():
    """Flush what this module configured.

    Not ``logging.shutdown()``: that closes every handler in the process,
    pytest's own capture handlers included.
    """
    for handler in logging.getLogger().handlers:
        handler.flush()


def test_errors_are_written_to_the_configured_file(tmp_path):
    error_log = tmp_path / "logs" / "errors.log"

    written = logging_config.configure_logging({"ERROR_LOG_FILE": str(error_log)})

    assert written == error_log
    logging.getLogger("test").error("kaboom", extra={"request_id": "abc123"})
    _flush_handlers()

    contents = error_log.read_text()
    assert "kaboom" in contents
    # the request id is what ties the log line to the client's error body
    assert "abc123" in contents


def test_info_is_not_written_to_the_error_file(tmp_path):
    error_log = tmp_path / "errors.log"
    logging_config.configure_logging(
        {"ERROR_LOG_FILE": str(error_log), "LOG_LEVEL": "INFO"},
        app_loggers=("test_app",),
    )

    logging.getLogger("test_app").info("routine")
    _flush_handlers()

    # the record reaches the handlers; the error file is the one that drops it
    assert "routine" not in error_log.read_text()


def test_app_loggers_follow_log_level_and_libraries_do_not():
    logging_config.configure_logging(
        {"LOG_LEVEL": "DEBUG", "ROOT_LOG_LEVEL": "WARNING"},
        app_loggers=("test_app",),
    )

    assert logging.getLogger("test_app").isEnabledFor(logging.DEBUG)
    assert not logging.getLogger("noisy_library").isEnabledFor(logging.INFO)


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
    assert (
        logging_config.configure_logging({"ERROR_LOG_FILE": str(blocker / "e.log")})
        is None
    )


@pytest.mark.parametrize(
    "settings",
    [
        {"ERROR_LOG_MAX_BYTES": "ten megabytes"},
        {"ERROR_LOG_BACKUP_COUNT": "several"},
        {"ERROR_LOG_ROTATION": "hourly"},
        {"LOG_LEVEL": "CHATTY"},
        {"WEB_CONCURRENCY": "lots"},
    ],
)
def test_unparseable_settings_do_not_stop_startup(tmp_path, settings):
    """A typo in one env var must not cost us the whole API."""
    error_log = tmp_path / "errors.log"

    written = logging_config.configure_logging(
        {"ERROR_LOG_FILE": str(error_log), **settings}
    )

    assert written == error_log
    logging.getLogger("test").error("still logging")
    _flush_handlers()
    assert "still logging" in error_log.read_text()


def test_external_rotation_uses_a_reopening_handler(tmp_path):
    """Several processes can share one path only if nothing rotates in-process."""
    error_log = tmp_path / "errors.log"
    logging_config.configure_logging(
        {"ERROR_LOG_FILE": str(error_log), "ERROR_LOG_ROTATION": "external"}
    )

    handlers = [
        h
        for h in logging.getLogger().handlers
        if isinstance(h, logging.FileHandler) and getattr(h, "_neuro_managed", False)
    ]
    assert [type(h) for h in handlers] == [logging.handlers.WatchedFileHandler]


def test_size_rotation_warns_when_several_workers_share_the_file(tmp_path, capsys):
    error_log = tmp_path / "errors.log"
    logging_config.configure_logging(
        {
            "ERROR_LOG_FILE": str(error_log),
            "ERROR_LOG_ROTATION": "size",
            "WEB_CONCURRENCY": "4",
        }
    )

    assert "not safe across 4 workers" in capsys.readouterr().err


def test_records_without_a_request_id_still_format(tmp_path):
    error_log = tmp_path / "errors.log"
    logging_config.configure_logging({"ERROR_LOG_FILE": str(error_log)})

    logging.getLogger("test").error("no id here")
    _flush_handlers()

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
        ("héader", None),
        (b"\xff\xfe", None),
    ],
)
def test_sanitize_request_id(value, expected):
    assert sanitize_request_id(value) == expected


def test_get_request_id_reads_scope_state():
    class Request:
        scope = {"state": {"request_id": "from-scope"}}

    assert get_request_id(Request()) == "from-scope"
    # nothing to read and no request being served
    assert get_request_id(None) is None
    assert get_request_id() is None


@pytest.mark.anyio
async def test_middleware_generates_and_echoes_an_id():
    seen = {}
    sent = []

    async def app(scope, receive, send):
        seen["scope"] = scope["state"]["request_id"]
        # code that never sees the request still finds the id
        seen["context"] = current_request_id()
        await send({"type": "http.response.start", "status": 200, "headers": []})

    async def send(message):
        sent.append(message)

    async def receive():
        return {"type": "http.request"}

    await RequestIdMiddleware(app)({"type": "http", "headers": []}, receive, send)

    headers = dict(sent[0]["headers"])
    assert headers[b"x-request-id"].decode() == seen["scope"]
    assert seen["context"] == seen["scope"]
    assert GENERATED_ID.match(seen["scope"])
    # and the id does not outlive the request
    assert current_request_id() is None


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
        {"type": "http", "headers": [(b"x-request-id", b"bad\nheader")]},
        receive,
        send,
    )

    # not sanitized into something else odd: replaced with a generated id
    assert GENERATED_ID.match(seen["request_id"])
    assert dict(sent[0]["headers"])[b"x-request-id"] == seen["request_id"].encode()


async def _receive():
    return {"type": "http.request"}


async def _raise_runtime_error(request):
    raise RuntimeError("asgi runtime failure")


@pytest.mark.anyio
async def test_a_500_is_traceable_from_the_client_to_the_error_file(tmp_path):
    """The whole chain: header, body and the traceback on disk agree."""
    error_log = tmp_path / "errors.log"
    logging_config.configure_logging({"ERROR_LOG_FILE": str(error_log)})

    connexion_app = connexion.AsyncApp(__name__)
    connexion_app.add_url_rule("/runtime", "runtime", _raise_runtime_error)
    connexion_app.add_error_handler(NeuroStoreException, neurostore_exception_handler)
    connexion_app.add_error_handler(ProblemException, problem_exception_handler)
    connexion_app.add_error_handler(HTTPException, http_exception_handler)
    connexion_app.add_error_handler(Exception, general_exception_handler)
    app = RequestIdMiddleware(connexion_app)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://testserver",
    ) as client:
        response = await client.get("/runtime")

    assert response.status_code == 500
    request_id = response.headers["X-Request-ID"]
    assert GENERATED_ID.match(request_id)
    assert response.json()["request_id"] == request_id
    # this is not a development deployment, so the client is told nothing
    # about what actually failed -- that stays in the log
    assert "asgi runtime failure" not in response.text

    _flush_handlers()
    logged = error_log.read_text()
    assert f"[{request_id}]" in logged
    assert "Traceback (most recent call last)" in logged
    assert "RuntimeError: asgi runtime failure" in logged


@pytest.mark.anyio
@pytest.mark.parametrize(
    "env, leaked",
    [("development", True), ("production", False), ("testing", False)],
)
async def test_internal_error_text_reaches_clients_only_in_development(env, leaked):
    """Turning logging up must not turn on error disclosure."""
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/boom",
        "headers": [],
        "state": {"settings": {"ENV": env}},
    }
    request = Request(scope, receive=_receive)
    logging.getLogger("neurostore").setLevel(logging.DEBUG)

    response = await general_exception_handler(request, ValueError("table wheels"))

    body = json.loads(response.body)
    assert ("table wheels" in body["detail"]) is leaked
