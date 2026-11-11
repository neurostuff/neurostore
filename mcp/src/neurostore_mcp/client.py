"""HTTP access to the public Neurostore and Compose APIs."""

from __future__ import annotations

import os
from typing import Any

import httpx
from fastmcp.exceptions import ToolError

from neurostore_mcp import __version__

NEUROSTORE_API_URL = os.environ.get("NEUROSTORE_API_URL", "https://neurostore.org/api")
COMPOSE_API_URL = os.environ.get("COMPOSE_API_URL", "https://compose.neurosynth.org/api")
TIMEOUT = httpx.Timeout(float(os.environ.get("NEUROSTORE_MCP_TIMEOUT", "60")), connect=10.0)
HEADERS = {"User-Agent": f"neurostore-mcp/{__version__}", "Accept": "application/json"}


def _params(params: dict[str, Any] | None) -> dict[str, Any]:
    """Drop unset parameters and spell booleans the way the APIs read them."""
    out: dict[str, Any] = {}
    for key, value in (params or {}).items():
        if value is None or value == [] or value == "":
            continue
        out[key] = ("true" if value else "false") if isinstance(value, bool) else value
    return out


async def request(
    api: str,
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    json: Any = None,
) -> Any:
    """Call `api` ("neurostore" or "compose") and return the decoded JSON body.

    Errors become a ToolError carrying the status and the API's own message, so
    the agent can correct its arguments.
    """
    base = NEUROSTORE_API_URL if api == "neurostore" else COMPOSE_API_URL
    async with httpx.AsyncClient(base_url=base, headers=HEADERS, timeout=TIMEOUT) as client:
        try:
            response = await client.request(method, path, params=_params(params), json=json)
        except httpx.TimeoutException as exc:
            raise ToolError(
                f"{api} API timed out on {method} {path}; narrow the request."
            ) from exc
        except httpx.HTTPError as exc:
            raise ToolError(f"Could not reach the {api} API: {exc}") from exc
    if response.status_code == 404:
        raise ToolError(f"Not found: {method} {path}")
    if response.status_code >= 400:
        try:
            body = response.json()
            detail = {k: body[k] for k in ("detail", "message", "errors") if body.get(k)} or body
        except ValueError:
            detail = response.text[:500]
        raise ToolError(f"{api} API returned {response.status_code} for {method} {path}: {detail}")
    return response.json()
