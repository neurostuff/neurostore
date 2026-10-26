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


def _status_error(code):
    request = httpx.Request("POST", "https://api.openai.com/v1/embeddings")
    response = httpx.Response(code, request=request)
    return APIStatusError("boom", response=response, body=None)


@pytest.mark.parametrize("code", [429, 500, 502, 503, 504])
def test_rate_limits_and_server_errors_are_transient(code):
    assert _is_transient(_status_error(code))


@pytest.mark.parametrize("code", [400, 401, 403, 404, 422])
def test_client_errors_are_not_transient(code):
    assert not _is_transient(_status_error(code))


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
    assert vcr.play_count == 9


@pytest.mark.vcr("test_a_rejected_embedding_request_is_not_retried.yaml")
def test_a_rejected_embedding_request_is_not_retried(configured, vcr):
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
