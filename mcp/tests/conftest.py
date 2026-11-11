import re

import pytest
from fastmcp import Client

from neurostore_mcp.server import mcp

RUN_KEY = re.compile(rb'("run_key"\s*:\s*)"[^"]*"')


def scrub_response(response):
    """Compose returns each meta-analysis's run (upload) key; never record it."""
    body = response["body"]["string"]
    if isinstance(body, str):
        body = body.encode()
    response["body"]["string"] = RUN_KEY.sub(rb'\1"REDACTED"', body)
    return response


@pytest.fixture(scope="module")
def vcr_config():
    return {
        "decode_compressed_response": True,
        "before_record_response": scrub_response,
        "match_on": ["method", "scheme", "host", "path", "query", "body"],
        "filter_headers": ["authorization", "cookie", "set-cookie"],
    }


@pytest.fixture
async def client():
    async with Client(mcp) as c:
        yield c


async def call(client, tool, **args):
    """Call a tool and return its structured result."""
    result = await client.call_tool(tool, args)
    return result.data
