import os
from typing import Any, List, Optional

import openai
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)


class EmbeddingNotConfigured(RuntimeError):
    """The embedding service has no credentials configured."""


class EmbeddingServiceError(RuntimeError):
    """The embedding service was unreachable, failed, or answered unusably."""


def _is_transient(exc: BaseException) -> bool:
    """Connection errors and timeouts, 429 and 5xx: the failures a retry can fix.

    Anything else (a 4xx, or a bug in our own code) fails the same way every time.
    """
    if isinstance(exc, openai.APIConnectionError):
        return True
    if isinstance(exc, openai.APIStatusError):
        return exc.status_code == 429 or exc.status_code >= 500
    return False


# Retry up to 3 attempts with small backoff: 0.5s then up to 1.0s
@retry(
    reraise=True,
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=1.0),
    retry=retry_if_exception(_is_transient),
)
def _call_openai_create(
    model: str,
    input_text: str,
    dimensions: Optional[int] = None,
    api_key: Optional[str] = None,
    api_gateway: Optional[str] = None,
) -> Any:
    # tenacity above is the only retry layer; the client would otherwise retry inside it.
    client_kwargs = {"max_retries": 0}
    if api_key:
        client_kwargs["api_key"] = api_key
    if api_gateway:
        client_kwargs["base_url"] = api_gateway
    if api_gateway and "portkey.ai" in api_gateway:
        client_kwargs["default_headers"] = {"x-portkey-api-key": api_key}

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
    - Reads OPENAI_API_KEY from environment (raises EmbeddingNotConfigured if missing).
    - Reads OPENAI_API_GATEWAY from environment as an optional OpenAI-compatible
      base URL.
    - Reads OPENAI_EMBEDDING_MODEL from environment as an optional embedding model.
    - Uses the openai Python package to request embeddings. If `dimension` is provided
      it will be passed through to the OpenAI API via the `dimensions` parameter.
    - Retries up to 3 attempts with small backoff via tenacity on connection errors,
      timeouts, 429 and 5xx; other errors are not retried.
    - Validates the response shape and returns a plain list[float].

    Args:
        text: Input text to embed.
        dimension: Optional requested embedding dimension (passed to OpenAI as `dimensions`).

    Returns:
        List[float]: Embedding vector.

    Raises:
        EmbeddingNotConfigured: If OPENAI_API_KEY is not set.
        EmbeddingServiceError: If the request fails or the response is malformed.
        ValueError: If `dimension` is provided but not an int.
    """
    # Validate dimensions first so tests expecting a ValueError for invalid
    # dimension values get that error even when OPENAI_API_KEY is not set.
    if dimensions is not None and not isinstance(dimensions, int):
        raise ValueError("dimensions must be an int when provided")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise EmbeddingNotConfigured("OPENAI_API_KEY not set")
    api_gateway = os.getenv("OPENAI_API_GATEWAY")

    # configure key for the openai client
    openai.api_key = api_key

    model_name = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

    if dimensions is not None and not isinstance(dimensions, int):
        raise ValueError("dimensions must be an int when provided")

    # The reason is the exception's class and status code only: an upstream body or
    # response object could echo the key, and would reach the client in the 502.
    try:
        resp = _call_openai_create(
            model=model_name,
            input_text=text,
            dimensions=dimensions,
            api_key=api_key,
            api_gateway=api_gateway,
        )
        return [float(x) for x in resp.data[0].embedding]
    except Exception as exc:
        status = getattr(exc, "status_code", None)
        reason = type(exc).__name__ if status is None else f"status {status}"
        raise EmbeddingServiceError(f"Failed to get embedding: {reason}") from None
