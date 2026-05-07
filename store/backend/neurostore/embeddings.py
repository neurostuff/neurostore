import os
from typing import Any, List, Optional

import openai
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
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
    api_gateway: Optional[str] = None,
) -> Any:
    client_kwargs = {}
    if api_key:
        client_kwargs["api_key"] = api_key
    if api_gateway:
        client_kwargs["base_url"] = api_gateway

    client = openai.OpenAI(**client_kwargs)
    if dimensions is None:
        return client.embeddings.create(model=model, input=input_text)
    return client.embeddings.create(
        model=model, input=input_text, dimensions=dimensions
    )


def get_embedding(text: str, dimensions: Optional[int] = None) -> List[float]:
    """
    Obtain an embedding vector for the provided text using the OpenAI embeddings API.

    Behavior:
    - Reads OPENAI_API_KEY from environment (raises RuntimeError if missing).
    - Reads OPENAI_API_GATEWAY from environment as an optional OpenAI-compatible
      base URL.
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
    api_gateway = os.getenv("OPENAI_API_GATEWAY")

    # configure key for the openai client
    openai.api_key = api_key

    model_name = "text-embedding-3-small"

    if dimensions is not None and not isinstance(dimensions, int):
        raise ValueError("dimensions must be an int when provided")

    try:
        # Use unified caller that handles both modern and legacy SDKs.
        resp = _call_openai_create(
            model=model_name,
            input_text=text,
            dimensions=dimensions,
            api_key=api_key,
            api_gateway=api_gateway,
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
