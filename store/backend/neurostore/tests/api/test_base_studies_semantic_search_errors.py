import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import httpx
import pytest
from openai import APIConnectionError, APIStatusError, APITimeoutError

from neurostore.embeddings import (
    EmbeddingNotConfigured,
    EmbeddingServiceError,
    _is_transient,
    get_embedding,
)

pytestmark = pytest.mark.anyio

SEARCH = "/api/base-studies/?semantic_search=neural developmental disorders"
NOTHING_LISTENS = "http://127.0.0.1:1/v1"


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.delenv("OPENAI_API_GATEWAY", raising=False)
    monkeypatch.delenv("OPENAI_EMBEDDING_MODEL", raising=False)


def _status_error(code, body=None):
    request = httpx.Request("POST", "https://api.openai.com/v1/embeddings")
    response = httpx.Response(code, request=request)
    return APIStatusError("boom", response=response, body=body)


@pytest.mark.parametrize("code", [429, 500, 502, 503, 504])
def test_rate_limits_and_server_errors_are_transient(code):
    assert _is_transient(_status_error(code))


@pytest.mark.parametrize("code", [400, 401, 403, 404, 422])
def test_client_errors_are_not_transient(code):
    assert not _is_transient(_status_error(code))


@pytest.mark.parametrize(
    "body",
    [
        {"type": "insufficient_quota", "code": "credit_balance_exhausted"},
        {"type": "insufficient_quota", "code": "insufficient_quota"},
    ],
)
def test_a_429_for_an_account_out_of_credit_is_not_transient(body):
    assert not _is_transient(_status_error(429, body))


def test_a_429_rate_limit_is_transient():
    body = {"type": "requests", "code": "rate_limit_exceeded"}
    assert _is_transient(_status_error(429, body))


def test_connection_errors_and_timeouts_are_transient():
    request = httpx.Request("POST", "https://api.openai.com/v1/embeddings")
    assert _is_transient(APIConnectionError(request=request))
    assert _is_transient(APITimeoutError(request=request))


@pytest.mark.parametrize("bug", [TypeError("x"), KeyError("x"), AttributeError("x")])
def test_programming_errors_are_not_transient(bug):
    assert not _is_transient(bug)


@pytest.mark.vcr("test_an_embedding_service_outage_is_retried_then_reported.yaml")
def test_an_embedding_service_outage_is_retried_then_reported(configured, vcr):
    with pytest.raises(EmbeddingServiceError):
        get_embedding("neural developmental disorders")
    assert vcr.play_count == 3


@pytest.mark.vcr("test_a_rejected_embedding_request_is_not_retried.yaml")
def test_a_rejected_embedding_request_is_not_retried(configured, vcr):
    with pytest.raises(EmbeddingServiceError):
        get_embedding("neural developmental disorders")
    assert vcr.play_count == 1


@pytest.mark.vcr("test_an_account_out_of_credit_is_not_retried.yaml")
def test_an_account_out_of_credit_is_not_retried(configured, vcr):
    with pytest.raises(EmbeddingServiceError):
        get_embedding("neural developmental disorders")
    assert vcr.play_count == 1


def test_a_missing_key_is_not_configured(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(EmbeddingNotConfigured):
        get_embedding("anything")


async def test_semantic_search_with_an_unreachable_embedding_service_is_a_502(
    auth_client, configured, monkeypatch
):
    monkeypatch.setenv("OPENAI_API_GATEWAY", NOTHING_LISTENS)
    resp = await auth_client.get(SEARCH)
    assert resp.status_code == 502
    assert "embedding service" in resp.json()["detail"]


async def test_semantic_search_without_an_embedding_key_is_a_503(
    auth_client, monkeypatch
):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    resp = await auth_client.get(SEARCH)
    assert resp.status_code == 503
    assert "not configured" in resp.json()["detail"]


SECRET = "sk-the-gateway-echoes-this"
OK_USAGE = {"prompt_tokens": 1, "total_tokens": 1}


def _embedding_answer(embedding):
    return json.dumps(
        {
            "object": "list",
            "model": "m",
            "usage": OK_USAGE,
            "data": [{"object": "embedding", "index": 0, "embedding": embedding}],
        }
    )


UNUSABLE_ANSWERS = {
    "html": (200, "text/html", "<html><body>Maintenance</body></html>"),
    "empty object": (200, "application/json", "{}"),
    "null data": (200, "application/json", '{"data": null}'),
    "empty data": (200, "application/json", '{"data": []}'),
    "null entry": (200, "application/json", '{"data": [null]}'),
    "no embedding": (200, "application/json", '{"data": [{"index": 0}]}'),
    "null embedding": (200, "application/json", _embedding_answer(None)),
    "bad base64": (200, "application/json", _embedding_answer("not*base64!")),
    "non-numeric": (200, "application/json", _embedding_answer(["a", "b"])),
    "echoed key": (400, "application/json", json.dumps({"error": SECRET})),
}


@pytest.fixture
def gateway(monkeypatch):
    """A real local HTTP server standing in for the embedding gateway."""
    answer = {}

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            self.rfile.read(int(self.headers.get("content-length", 0)))
            code, content_type, body = answer["response"]
            payload = body.encode()
            self.send_response(code)
            self.send_header("content-type", content_type)
            self.send_header("content-length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_API_GATEWAY", f"http://127.0.0.1:{server.server_port}/v1")
    monkeypatch.delenv("OPENAI_EMBEDDING_MODEL", raising=False)
    yield answer
    server.shutdown()
    server.server_close()


@pytest.mark.parametrize("kind", UNUSABLE_ANSWERS)
def test_an_unusable_answer_is_an_embedding_service_error(gateway, kind):
    gateway["response"] = UNUSABLE_ANSWERS[kind]
    with pytest.raises(EmbeddingServiceError) as raised:
        get_embedding("neural developmental disorders")
    assert SECRET not in str(raised.value)
    assert raised.value.__cause__ is None


def test_a_usable_answer_is_returned_as_floats(gateway):
    gateway["response"] = (200, "application/json", _embedding_answer([0.5, 1, -2.25]))
    assert get_embedding("anything") == [0.5, 1.0, -2.25]


@pytest.mark.parametrize("kind", ["html", "empty object", "echoed key"])
async def test_semantic_search_with_an_unusable_answer_is_a_502(
    auth_client, gateway, kind
):
    gateway["response"] = UNUSABLE_ANSWERS[kind]
    resp = await auth_client.get(SEARCH)
    assert resp.status_code == 502
    assert SECRET not in resp.text
