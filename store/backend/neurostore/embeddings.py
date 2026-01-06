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
    model: str,
    input_text: str,
    dimensions: Optional[int] = None,
    api_key: Optional[str] = None,
) -> Any:
    """
    Internal call wrapped with tenacity to perform the OpenAI embeddings request.

    This prefers the modern SDK client (openai.OpenAI().embeddings.create) when available,
    and falls back to legacy surfaces (openai.Embedding.create or openai.embeddings.create).
    The `dimensions` argument is forwarded to the OpenAI API when provided.
    The optional `api_key` is used to construct the modern OpenAI client if supplied.
    """
    # Try modern OpenAI client (openai>=1.x)
    try:
        if hasattr(openai, "OpenAI"):
            client = openai.OpenAI(api_key=api_key) if api_key else openai.OpenAI()
            if dimensions is None:
                return client.embeddings.create(model=model, input=input_text)
            return client.embeddings.create(
                model=model, input=input_text, dimensions=dimensions
            )
    except Exception:
        # If the modern client fails for any reason, fall through to legacy surfaces.
        pass

    # Fallback: older SDK surfaces
    if hasattr(openai, "Embedding") and hasattr(openai.Embedding, "create"):
        if dimensions is None:
            return openai.Embedding.create(model=model, input=input_text)
        return openai.Embedding.create(
            model=model, input=input_text, dimensions=dimensions
        )

    if hasattr(openai, "embeddings") and hasattr(openai.embeddings, "create"):
        if dimensions is None:
            return openai.embeddings.create(model=model, input=input_text)
        return openai.embeddings.create(
            model=model, input=input_text, dimensions=dimensions
        )

    raise AttributeError("No supported OpenAI embeddings API found on openai package")


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
    # Validate dimensions first so tests expecting a ValueError for invalid
    # dimension values get that error even when OPENAI_API_KEY is not set.
    if dimensions is not None and not isinstance(dimensions, int):
        raise ValueError("dimensions must be an int when provided")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")

    # configure key for the openai client
    openai.api_key = api_key

    model_name = "text-embedding-3-small"

    if dimensions is not None and not isinstance(dimensions, int):
        raise ValueError("dimensions must be an int when provided")

    try:
        # Use unified caller that handles both modern and legacy SDKs.
        resp = _call_openai_create(
            model=model_name, input_text=text, dimensions=dimensions, api_key=api_key
        )

        # Handle both legacy dict responses and modern OpenAI response objects.
        data = None
        if isinstance(resp, dict):
            data = resp.get("data")
        elif hasattr(resp, "data"):
            data = resp.data
        else:
            raise RuntimeError(f"Unexpected response type from OpenAI: {type(resp)}")

        if not isinstance(data, list) or not data:
            raise RuntimeError(f"Invalid response shape from OpenAI: {resp}")

        first = data[0]
        # extract embedding whether first is a dict or an object with .embedding
        embedding = None
        if isinstance(first, dict):
            embedding = first.get("embedding")
        elif hasattr(first, "embedding"):
            embedding = first.embedding
        else:
            raise RuntimeError(f"Invalid embedding in OpenAI response: {resp}")

        if not hasattr(embedding, "__iter__"):
            raise RuntimeError("Embedding returned by OpenAI is not iterable")

        # normalize to plain list of floats
        embedding_list = list(embedding)
        return [float(x) for x in embedding_list]

    except Exception as exc:
        # Surface a clear runtime error for callers/tests
        raise RuntimeError(f"Failed to get embedding: {exc}") from exc
