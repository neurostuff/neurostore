import os
from typing import List, Any, Optional

import openai
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)


# Retry up to 3 attempts with small backoff: 0.5s then up to 1.0s
@retry(
    reraise=True,
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=1.0),
    retry=retry_if_exception_type(Exception),
)
def _call_openai_create(
    model: str, input_text: str, dimensions: Optional[int] = None
) -> Any:
    """
    Internal call wrapped with tenacity to perform the OpenAI embeddings request.

    This tries the common SDK surface openai.Embedding.create(...). If that attribute is
    missing (different client versions), the caller will attempt other fallbacks.

    The `dimensions` argument is forwarded to the OpenAI API when provided.
    """
    if dimensions is None:
        return openai.Embedding.create(model=model, input=input_text)
    return openai.Embedding.create(model=model, input=input_text, dimensions=dimensions)


def get_embedding(text: str, dimensions: Optional[int] = None) -> List[float]:
    """
    Obtain an embedding vector for the provided text using the OpenAI embeddings API.

    Behavior:
    - Reads OPENAI_API_KEY from environment (raises RuntimeError if missing).
    - Uses the openai Python package to request embeddings. If `dimension` is provided
      it will be passed through to the OpenAI API via the `dimensions` parameter.
    - Retries up to 3 attempts with small backoff via tenacity on transient/network errors.
    - Validates the response shape and returns a plain list[float].

    Args:
        text: Input text to embed.
        dimension: Optional requested embedding dimension (passed to OpenAI as `dimensions`).

    Returns:
        List[float]: Embedding vector.

    Raises:
        RuntimeError: If OPENAI_API_KEY is not set, request fails after retries,
                      or the response is malformed.
        ValueError: If `dimension` is provided but not an int.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")

    # configure key for the openai client
    openai.api_key = api_key

    model_name = "text-embedding-3-small"

    if dimensions is not None and not isinstance(dimensions, int):
        raise ValueError("dimensions must be an int when provided")

    try:
        # Primary path: openai.Embedding.create (older/newer SDKs)
        try:
            resp = _call_openai_create(
                model=model_name, input_text=text, dimensions=dimensions
            )
        except AttributeError:
            # Fallback: some SDK versions expose a lower-level embeddings API
            # e.g., openai.embeddings.create(...)
            if hasattr(openai, "embeddings") and hasattr(openai.embeddings, "create"):
                # wrap this call with tenacity as well
                @retry(
                    reraise=True,
                    stop=stop_after_attempt(3),
                    wait=wait_exponential(multiplier=0.5, max=1.0),
                    retry=retry_if_exception_type(Exception),
                )
                def _call_fallback(m: str, i: str, d: Optional[int] = None) -> Any:
                    if d is None:
                        return openai.embeddings.create(model=m, input=i)
                    return openai.embeddings.create(model=m, input=i, dimensions=d)

                resp = _call_fallback(model_name, text, dimensions)
            else:
                raise

        # Expected response shape: dict with "data" -> list -> {"embedding": [...]}
        if not isinstance(resp, dict):
            raise RuntimeError(f"Unexpected response type from OpenAI: {type(resp)}")

        data = resp.get("data")
        if not isinstance(data, list) or not data:
            raise RuntimeError(f"Invalid response shape from OpenAI: {resp}")

        first = data[0]
        if not isinstance(first, dict) or "embedding" not in first:
            raise RuntimeError(f"Invalid embedding in OpenAI response: {resp}")

        embedding = first["embedding"]
        if not isinstance(embedding, list):
            raise RuntimeError("Embedding returned by OpenAI is not a list")

        # ensure floats
        return [float(x) for x in embedding]

    except Exception as exc:
        # Surface a clear runtime error for callers/tests
        raise RuntimeError(f"Failed to get embedding: {exc}") from exc
