"""MCP server over the Neurostore and Neurosynth Compose REST APIs.

Each tool is one REST operation from `operations.OPERATIONS`, built by FastMCP from the
API's own OpenAPI spec, so its arguments and the response are the API's. Reads work
anonymously; writes need a sign-in (`auth.py`) and act as that user.
"""

from __future__ import annotations

import argparse
import copy
import logging
import os
import time
from typing import Any

import httpx2
from fastmcp import FastMCP
from fastmcp.server.middleware import Middleware, MiddlewareContext
from fastmcp.server.providers.openapi import MCPType, OpenAPIProvider
from fastmcp.tools import ToolResult
from mcp.types import TextContent

from neurostore_mcp import __version__
from neurostore_mcp.auth import LazyAuth, Settings, TokenExchange, as_user, provider
from neurostore_mcp.operations import OPERATIONS, annotations, reads
from neurostore_mcp.schema import compact

logger = logging.getLogger(__name__)

API_URLS = {
    "store": os.environ.get("NEUROSTORE_API_URL", "https://neurostore.org/api"),
    "compose": os.environ.get("COMPOSE_API_URL", "https://compose.neurosynth.org/api"),
}
TIMEOUT = httpx2.Timeout(float(os.environ.get("NEUROSTORE_MCP_TIMEOUT", "60")), connect=10.0)
HEADERS = {"User-Agent": f"neurostore-mcp/{__version__}", "Accept": "application/json"}
# Claude Code caps a tool result at 25,000 tokens by default, claude.ai near 150,000 characters.
MAX_RESULT_CHARS = int(os.environ.get("NEUROSTORE_MCP_MAX_RESULT_CHARS", "60000"))

INSTRUCTIONS = """\
Neurostore (neurostore.org) is a database of neuroimaging papers with their reported
coordinates, analyses and extracted study features. Neurosynth Compose
(compose.neurosynth.org) runs meta-analyses over Neurostore studysets.

Vocabulary: a base study is one paper; it has study versions (the neurostore copy, imports,
user clones). A study has analyses (contrasts), each with points (peak coordinates) and/or
images. A studyset is a list of studies; an annotation labels each analysis in a studyset. A
Compose project holds meta-analyses, each a specification run over a studyset and
annotation, producing results (maps on NeuroVault).

Each tool is one REST call and returns the API's JSON. Lists take page and page_size; keep
page_size small, and pass nested=true only when you need the children. Start with
search_base_studies or query_analyses, then get_study for coordinates. Reads need no
sign-in. Tools that change records sign you in and act as you: you can change only your own
records. To build a meta-analysis: create_studyset, create_annotation, create_project,
create_specification, create_meta_analysis, then run_meta_analysis.
"""


def fetch_spec(service: str, attempts: int = 20) -> dict[str, Any]:
    """The API's spec, waiting for an API that is still starting."""
    url = f"{API_URLS[service]}/openapi.json"
    for attempt in range(attempts):
        try:
            response = httpx2.get(url, headers=HEADERS, timeout=TIMEOUT)
            response.raise_for_status()
            return response.json()
        except httpx2.HTTPError as exc:
            if attempt == attempts - 1:
                raise
            logger.warning("Waiting for %s: %s", url, exc)
            time.sleep(3)
    raise AssertionError("unreachable")


def needs_sign_in(spec: dict[str, Any], operation: dict[str, Any]) -> bool:
    """The spec's own word: a JWT is required unless an empty requirement is allowed."""
    security = operation.get("security", spec.get("security"))
    return bool(security) and {} not in security


class CapResults(Middleware):
    """Cut a result too large for the client, and say how to ask for less."""

    async def on_call_tool(self, context: MiddlewareContext, call_next) -> ToolResult:
        result = await call_next(context)
        text = "".join(c.text for c in result.content if isinstance(c, TextContent))
        if len(text) <= MAX_RESULT_CHARS:
            return result
        note = (
            f"\n\n[Cut at {MAX_RESULT_CHARS} of {len(text)} characters. Ask for less: a smaller "
            "page_size, nested=false, or one record at a time.]"
        )
        return ToolResult(content=[TextContent(type="text", text=text[:MAX_RESULT_CHARS] + note)])


def _provider(
    service: str,
    spec: dict[str, Any],
    exchange: TokenExchange | None,
    sign_in: set[str],
    write: set[str],
    transport: httpx2.AsyncBaseTransport | None,
) -> OpenAPIProvider:
    spec = copy.deepcopy(spec)
    keep: dict[tuple[str, str], str] = {}
    for (svc, method, path), (name, description) in OPERATIONS.items():
        if svc != service:
            continue
        operation = spec.get("paths", {}).get(path, {}).get(method.lower())
        if operation is None:
            logger.warning("%s %s %s is not in its spec; %s left out", service, method, path, name)
            continue
        if needs_sign_in(spec, operation) or not reads(svc, method, path):
            if exchange is None:
                continue  # no sign-in configured: read-only
            sign_in.add(name)
        if not reads(svc, method, path):
            write.add(name)
        operation["operationId"] = name
        operation["x-mcp-description"] = description
        keep[(method, path)] = name

    def route_map(route, mcp_type):
        return MCPType.TOOL if (route.method, route.path) in keep else MCPType.EXCLUDE

    def customize(route, tool):
        lead = route.extensions.get("x-mcp-description", "")
        rest = route.description or ""
        tool.description = f"{lead}\n\n{rest}".strip() if rest and rest != lead else lead
        tool.annotations = annotations(service, route.method, route.path)
        tool.parameters = compact(tool.parameters, max_depth=2)
        tool.output_schema = None  # results are the API's JSON, possibly cut by CapResults

    client = httpx2.AsyncClient(
        base_url=API_URLS[service],
        headers=HEADERS,
        timeout=TIMEOUT,
        event_hooks={"request": [as_user(exchange)]} if exchange else None,
        transport=transport,
    )
    return OpenAPIProvider(
        openapi_spec=spec,
        client=client,
        route_map_fn=route_map,
        mcp_component_fn=customize,
        validate_output=False,
    )


def build(
    specs: dict[str, dict[str, Any]] | None = None,
    settings: Settings | None = None,
    exchange: TokenExchange | None = None,
    verifier=None,
    mcp_path: str = "/mcp",
    transport: httpx2.AsyncBaseTransport | None = None,
) -> FastMCP:
    """The server. Without `settings` it only reads, anonymously.

    `exchange`, `verifier` and `transport` (for the API calls) are for tests.
    """
    specs = specs or {service: fetch_spec(service) for service in API_URLS}
    if settings is not None and exchange is None:
        exchange = TokenExchange(settings)
    sign_in: set[str] = set()
    write: set[str] = set()
    providers = [
        _provider(service, specs[service], exchange, sign_in, write, transport)
        for service in API_URLS
    ]
    mcp = FastMCP(
        "neurostore",
        instructions=INSTRUCTIONS,
        version=__version__,
        providers=providers,
        middleware=[CapResults()],
        auth=provider(settings, mcp_path, verifier) if settings else None,
    )
    mcp.sign_in_tools = sign_in
    mcp.write_tools = write
    mcp.settings_ = settings
    return mcp


def http_app(mcp: FastMCP, path: str = "/mcp"):
    """Streamable HTTP, asking for a sign-in only on tools that need one."""
    app = mcp.http_app(path=path, stateless_http=True, json_response=True)
    if mcp.settings_ is None:
        return app
    metadata = f"{mcp.settings_.public_url}/.well-known/oauth-protected-resource{path}"
    for route in app.routes:
        if getattr(route, "path", None) == path:
            route.app = LazyAuth(route.app, mcp.sign_in_tools, mcp.write_tools, metadata)
            return app
    raise RuntimeError(f"No route at {path} to guard")


def main() -> None:
    parser = argparse.ArgumentParser(prog="neurostore-mcp", description=__doc__)
    parser.add_argument("--transport", choices=["stdio", "http"], default="stdio")
    parser.add_argument("--host", default="127.0.0.1", help="HTTP bind address.")
    parser.add_argument("--port", type=int, default=8000, help="HTTP port.")
    parser.add_argument("--path", default="/mcp", help="HTTP endpoint path.")
    args = parser.parse_args()
    if args.transport == "stdio":
        build().run("stdio", show_banner=False)
        return
    import uvicorn

    mcp = build(settings=Settings.from_env(), mcp_path=args.path)
    uvicorn.run(
        http_app(mcp, args.path),
        host=args.host,
        port=args.port,
        proxy_headers=True,
        forwarded_allow_ips="*",
    )


if __name__ == "__main__":
    main()
