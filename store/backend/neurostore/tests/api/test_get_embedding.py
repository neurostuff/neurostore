import os
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
