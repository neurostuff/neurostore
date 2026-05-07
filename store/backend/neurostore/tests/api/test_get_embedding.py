import os
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from neurostore.embeddings import get_embedding


def _cassette_exists():
    """Return True if any cassette files exist under tests/api/cassettes/."""
    cass_dir = os.path.join(os.path.dirname(__file__), "cassettes")
    if not os.path.isdir(cass_dir):
        return False
    for root, _, files in __import__("os").walk(cass_dir):
        for f in files:
            if f.endswith((".yml", ".yaml")):
                return True
    return False


@pytest.mark.vcr("test_get_embedding.yml")
def test_get_embedding():
    # Skip recording if there's no API key and no cassette to avoid network calls.
    if not os.getenv("OPENAI_API_KEY") and not _cassette_exists():
        pytest.skip(
            "OPENAI_API_KEY not set and no cassette present; set OPENAI_API_KEY to record."
        )
    # Ensure an env var exists so get_embedding does not raise;
    # when a cassette exists VCR will intercept.
    if not os.getenv("OPENAI_API_KEY"):
        os.environ["OPENAI_API_KEY"] = "DUMMY_KEY"

    emb = get_embedding("This is a test")
    assert isinstance(emb, list)
    assert len(emb) > 0
    assert all(isinstance(x, float) for x in emb)


def test_get_embedding_invalid_dimensions():
    with pytest.raises(ValueError):
        get_embedding("text", dimensions="not-an-int")


def _make_mock_openai_response(vector):
    """Build a minimal object that looks like an openai>=1.0 embeddings response."""
    embedding_obj = SimpleNamespace(embedding=vector)
    return SimpleNamespace(data=[embedding_obj])


def test_get_embedding_uses_modern_openai_client(monkeypatch):
    """get_embedding must use openai.OpenAI().embeddings.create,
    not the removed openai.Embedding.create."""
    expected_vector = [0.1, 0.2, 0.3]

    mock_client = MagicMock()
    mock_client.embeddings.create.return_value = _make_mock_openai_response(
        expected_vector
    )

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.delenv("OPENAI_API_GATEWAY", raising=False)

    with patch(
        "neurostore.embeddings.openai.OpenAI", return_value=mock_client
    ) as mock_openai_cls:
        result = get_embedding("hello world")

    mock_openai_cls.assert_called_once_with(api_key="test-key")
    mock_client.embeddings.create.assert_called_once_with(
        model="text-embedding-3-small", input="hello world"
    )
    assert result == [float(x) for x in expected_vector]


def test_get_embedding_uses_openai_api_gateway(monkeypatch):
    expected_vector = [0.1, 0.2, 0.3]

    mock_client = MagicMock()
    mock_client.embeddings.create.return_value = _make_mock_openai_response(
        expected_vector
    )

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_API_GATEWAY", "https://api.portkey.ai/v1")

    with patch(
        "neurostore.embeddings.openai.OpenAI", return_value=mock_client
    ) as mock_openai_cls:
        result = get_embedding("hello world")

    mock_openai_cls.assert_called_once_with(
        api_key="test-key", base_url="https://api.portkey.ai/v1"
    )
    mock_client.embeddings.create.assert_called_once_with(
        model="text-embedding-3-small", input="hello world"
    )
    assert result == [float(x) for x in expected_vector]


def test_get_embedding_passes_dimensions(monkeypatch):
    """dimensions parameter is forwarded to openai>=1.0 client."""
    expected_vector = [0.5, 0.6]

    mock_client = MagicMock()
    mock_client.embeddings.create.return_value = _make_mock_openai_response(
        expected_vector
    )

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.delenv("OPENAI_API_GATEWAY", raising=False)

    with patch("neurostore.embeddings.openai.OpenAI", return_value=mock_client):
        result = get_embedding("hello world", dimensions=512)

    mock_client.embeddings.create.assert_called_once_with(
        model="text-embedding-3-small", input="hello world", dimensions=512
    )
    assert result == [float(x) for x in expected_vector]
