"""The tool catalogue and both transports (no API calls)."""

import socket
import subprocess
import sys
import time

import pytest
from fastmcp import Client
from fastmcp.client.transports import StdioTransport

from neurostore_mcp.client import _params

EXPECTED_TOOLS = {
    "search_base_studies",
    "get_base_study",
    "search_studies",
    "get_study",
    "query_analyses",
    "list_analysis_terms",
    "list_public_datasets",
    "run_public_query",
    "get_studyset",
    "list_annotations",
    "get_annotation",
    "search_projects",
    "get_project",
    "get_meta_analysis",
    "get_meta_analysis_result",
}


def test_params_drop_unset_and_spell_booleans():
    assert _params({"a": None, "b": [], "c": "", "d": True, "e": False, "f": 0, "g": ["x"]}) == {
        "d": "true",
        "e": "false",
        "f": 0,
        "g": ["x"],
    }


async def test_catalogue_is_curated_and_read_only(client):
    tools = await client.list_tools()
    assert {t.name for t in tools} == EXPECTED_TOOLS
    for tool in tools:
        assert tool.description and len(tool.description) > 40
        assert tool.annotations.read_only_hint is True
        assert tool.annotations.destructive_hint is False


async def test_stdio_transport():
    transport = StdioTransport(command=sys.executable, args=["-m", "neurostore_mcp"])
    async with Client(transport) as c:
        assert {t.name for t in await c.list_tools()} == EXPECTED_TOOLS


@pytest.fixture
def http_server():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    proc = subprocess.Popen(
        [sys.executable, "-m", "neurostore_mcp", "--transport", "http", "--port", str(port)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        try:
            socket.create_connection(("127.0.0.1", port), timeout=0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    yield f"http://127.0.0.1:{port}/mcp"
    proc.terminate()
    proc.wait(timeout=10)


async def test_streamable_http_transport(http_server):
    async with Client(http_server) as c:
        assert {t.name for t in await c.list_tools()} == EXPECTED_TOOLS
