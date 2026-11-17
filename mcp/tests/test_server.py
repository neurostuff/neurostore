"""The generated tools, the sign-in gate and the token the APIs see."""

import json

import pytest
from fastmcp import Client

from neurostore_mcp import server as server_module
from neurostore_mcp.operations import OPERATIONS
from tests.conftest import RESOURCE, rpc, serve, token

ALL_TOOLS = {name for name, _ in OPERATIONS.values()}
SIGN_IN_READS = {"list_meta_analysis_jobs", "get_meta_analysis_job"}
WRITES = {
    name
    for (service, method, path), (name, _) in OPERATIONS.items()
    if method != "GET" and name != "query_analyses"
}


async def tools(server):
    async with Client(server) as client:
        return {t.name: t for t in await client.list_tools()}


async def test_anonymous_server_lists_only_reads(anonymous_server):
    listed = await tools(anonymous_server)
    assert set(listed) == ALL_TOOLS - WRITES - SIGN_IN_READS
    assert all(t.annotations.read_only_hint for t in listed.values())


async def test_signed_in_server_lists_every_operation(server):
    listed = await tools(server)
    assert set(listed) == ALL_TOOLS
    assert server.write_tools == WRITES
    assert server.sign_in_tools == WRITES | SIGN_IN_READS
    hints = {n: listed[n].annotations for n in ("create_study", "update_study", "delete_study")}
    assert not hints["create_study"].destructive_hint
    assert hints["update_study"].destructive_hint and hints["update_study"].idempotent_hint
    assert hints["delete_study"].destructive_hint
    assert listed["query_analyses"].annotations.read_only_hint


async def test_descriptions_lead_with_ours_then_the_spec(server):
    listed = await tools(server)
    ours = OPERATIONS[("store", "GET", "/studies/{id}")][1]
    assert listed["get_study"].description.startswith(ours)


async def test_schemas_are_compact(server):
    listed = await tools(server)
    text = json.dumps({n: t.input_schema for n, t in listed.items()})
    assert '"example"' not in text
    assert len(text) < 150_000
    study = listed["create_study"].input_schema["properties"]
    assert "name" in study and "analyses" in study
    assert "created_at" not in study  # read-only in the spec


async def test_a_read_calls_its_operation_with_the_arguments(anonymous_server, apis):
    async with Client(anonymous_server) as client:
        await client.call_tool("search_base_studies", {"search": "stroop", "page_size": 2})
    (request,) = apis.requests
    assert request.method == "GET"
    assert request.url.path == "/api/base-studies/"
    assert request.url.params["search"] == "stroop"
    assert request.url.params["page_size"] == "2"
    assert "authorization" not in request.headers


async def test_a_large_result_is_cut_with_a_hint(anonymous_server, apis, monkeypatch):
    monkeypatch.setattr(server_module, "MAX_RESULT_CHARS", 500)
    apis.body = {"results": [{"name": "x" * 1000}]}
    async with Client(anonymous_server) as client:
        result = await client.call_tool("search_studies", {})
    text = result.content[0].text
    assert len(text) < 800
    assert "smaller page_size" in text


async def test_protected_resource_metadata(server):
    async with serve(server) as http:
        response = await http.get("/.well-known/oauth-protected-resource/mcp")
        assert response.status_code == 200
        body = response.json()
        assert body["resource"] == RESOURCE
        assert body["authorization_servers"] == ["https://neurosynth.us.auth0.com/"]
        assert "write" in body["scopes_supported"]


async def test_reads_need_no_sign_in(server, apis):
    async with serve(server) as http:
        listed = await rpc(http, "tools/list")
        assert listed.status_code == 200
        assert "create_studyset" in {t["name"] for t in listed.json()["result"]["tools"]}
        called = await rpc(http, "tools/call", {"name": "get_study", "arguments": {"id": "abc"}})
        assert called.status_code == 200
        assert apis.requests[-1].url.path == "/api/studies/abc"
        assert "authorization" not in apis.requests[-1].headers


@pytest.mark.parametrize("tool", ["create_studyset", "list_meta_analysis_jobs"])
async def test_a_tool_that_needs_a_user_asks_for_a_sign_in(server, apis, tool):
    async with serve(server) as http:
        response = await rpc(http, "tools/call", {"name": tool, "arguments": {}})
        assert response.status_code == 401
        challenge = response.headers["www-authenticate"]
        metadata = "https://neurostore.org/.well-known/oauth-protected-resource/mcp"
        assert f'resource_metadata="{metadata}"' in challenge
        assert apis.requests == []


async def test_a_bad_token_is_refused_even_for_reads(server, keys):
    async with serve(server) as http:
        foreign = token(keys, audience="https://neurostore.org/api/")
        call = {"name": "get_study", "arguments": {"id": "a"}}
        response = await rpc(http, "tools/call", call, foreign)
        assert response.status_code == 401
        assert 'error="invalid_token"' in response.headers["www-authenticate"]


async def test_a_read_only_sign_in_cannot_write(server, keys, apis):
    async with serve(server) as http:
        response = await rpc(
            http,
            "tools/call",
            {"name": "create_studyset", "arguments": {"name": "x"}},
            token(keys, scopes=("read",)),
        )
        assert response.status_code == 403
        assert 'error="insufficient_scope", scope="write"' in response.headers["www-authenticate"]
        assert apis.requests == []


async def test_a_write_carries_the_exchanged_agents_token(server, keys, apis, auth0):
    async with serve(server) as http:
        signed_in = token(keys)
        for name in ("study one", "study two"):
            response = await rpc(
                http,
                "tools/call",
                {"name": "create_studyset", "arguments": {"name": name}},
                signed_in,
            )
            assert response.status_code == 200
            assert not response.json()["result"].get("isError")
        first, second = apis.requests
        assert first.method == "POST" and first.url.path == "/api/studysets/"
        assert json.loads(first.content)["name"] == "study one"
        assert first.headers["authorization"] == "Bearer agents-token-1"
        assert second.headers["authorization"] == "Bearer agents-token-1"  # cached
        (exchange,) = auth0.bodies
        assert exchange == {
            "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
            "client_id": "mcp-client",
            "client_secret": "not-a-secret",
            "subject_token": signed_in,
            "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
            "requested_token_type": "urn:ietf:params:oauth:token-type:access_token",
            "audience": "https://neurostore.org/agents/",
            "scope": "read write",
        }


async def test_a_signed_in_read_acts_as_the_user(server, keys, apis):
    async with serve(server) as http:
        response = await rpc(
            http,
            "tools/call",
            {"name": "list_meta_analysis_jobs", "arguments": {}},
            token(keys, scopes=("read",)),
        )
        assert response.status_code == 200
        assert apis.requests[-1].url.host == "compose.neurosynth.org"
        assert apis.requests[-1].headers["authorization"] == "Bearer agents-token-1"


async def test_a_refused_exchange_is_a_tool_error(server, keys, apis, auth0):
    async with serve(server) as http:
        auth0.status = 403
        response = await rpc(
            http,
            "tools/call",
            {"name": "create_studyset", "arguments": {"name": "x"}},
            token(keys),
        )
        assert response.status_code == 200
        result = response.json()["result"]
        assert result["isError"]
        assert "Auth0 refused to act as you (403): no grant" in result["content"][0]["text"]
        assert apis.requests == []
