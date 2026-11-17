# neurostore-mcp

An [MCP](https://modelcontextprotocol.io) server over the
[Neurostore](https://neurostore.org) and [Neurosynth Compose](https://compose.neurosynth.org)
REST APIs, for agents such as Claude Code and claude.ai.

It is a thin layer. Each tool is one REST operation, built at startup from the API's own
OpenAPI spec (`/api/openapi.json`), so a tool's arguments and its result are that
operation's. Anyone can read. Tools that change records ask the user to sign in, then act
as that user.

## Tools

`src/neurostore_mcp/operations.py` lists the operations exposed: 41 of the APIs' 156.

| Area | Read | Write (sign-in) |
| --- | --- | --- |
| Papers and studies | `search_base_studies`, `get_base_study`, `search_studies`, `get_study`, `get_analysis` | `create_study`, `update_study`, `delete_study`, `create_analysis`, `update_analysis`, `delete_analysis` |
| Selecting analyses | `query_analyses`, `list_analysis_terms`, `list_public_datasets`, `run_public_query` | |
| Studysets and annotations | `search_studysets`, `get_studyset`, `list_annotations`, `get_annotation` | `create_studyset`, `update_studyset`, `delete_studyset`, `create_annotation`, `update_annotation`, `delete_annotation` |
| Compose | `search_projects`, `get_project`, `get_specification`, `get_meta_analysis`, `list_meta_analysis_results`, `get_meta_analysis_result`, and with a sign-in `list_meta_analysis_jobs`, `get_meta_analysis_job` | `create_project`, `update_project`, `delete_project`, `create_specification`, `update_specification`, `create_meta_analysis`, `update_meta_analysis`, `run_meta_analysis` |

What the server adds to the raw operations:

- **Hints.** Reads are marked `readOnlyHint`. `PUT` and `DELETE` are marked `destructiveHint`, so clients can run reads freely and ask before changing anything.
- **Smaller schemas.** The specs inline every nested record. Tool schemas drop examples and read-only fields, and stop listing fields two levels down. `query_analyses` lists three, so its nested criteria are spelled out (`acquisitions.modality`, `groups.age_mean`, ...). All 41 come to about 125,000 characters.
- **Capped results.** A result over 60,000 characters is cut, with a note saying how to ask for less. Claude Code's default limit is 25,000 tokens. Override the cap with `NEUROSTORE_MCP_MAX_RESULT_CHARS`.
- **Errors.** The API's own status and message come back as a tool error.

## Run it

You need [uv](https://docs.astral.sh/uv/). On stdio, with only the read tools:

```bash
claude mcp add neurostore -- uvx --from "git+https://github.com/neurostuff/neurostore#subdirectory=mcp" neurostore-mcp
```

To serve Streamable HTTP at `http://127.0.0.1:8000/mcp`, add `--transport http --port 8000`. `--host` and `--path` change the bind address and the endpoint.

`NEUROSTORE_API_URL` (default `https://neurostore.org/api`) and `COMPOSE_API_URL` (default `https://compose.neurosynth.org/api`) point it at another deployment.

## The hosted server and signing in

`store/docker-compose.yml` runs the server as `neurostore-mcp`, in the compose profile `mcp`: start it by name. `store/nginx/nginx.conf` serves it at `https://neurostore.org/mcp`. With no sign-in settings it only reads.

These variables in `store/.env` turn sign-in on. All five are needed:

| Variable | Production |
| --- | --- |
| `NEUROSTORE_MCP_PUBLIC_URL` | `https://neurostore.org` |
| `NEUROSTORE_MCP_AUTH0_DOMAIN` | `neurosynth.us.auth0.com` |
| `NEUROSTORE_MCP_AGENT_AUDIENCE` | `https://neurostore.org/agents/` |
| `NEUROSTORE_MCP_CLIENT_ID`, `NEUROSTORE_MCP_CLIENT_SECRET` | the server's Auth0 Custom API client |

How it works, and the Auth0 setup: [docs/remote-hosting-and-oauth.md](docs/remote-hosting-and-oauth.md).

To connect, claude.ai users go to Settings → Connectors → Add custom connector and enter URL `https://neurostore.org/mcp`. Production Auth0 offers Client ID Metadata Documents, so the client registers itself; on a tenant without them, paste the client id of the Auth0 app "Neurostore agents" under Advanced.

ChatGPT (developer mode): add a connector with URL `https://neurostore.org/mcp` and OAuth. It registers itself through the same metadata documents. Each tool declares `_meta.securitySchemes`, and ChatGPT is asked to sign in with a tool result, since it doesn't act on an HTTP 401.

Claude Code:

```bash
claude mcp add --transport http --client-id <Neurostore agents client id> --callback-port 33418 neurostore https://neurostore.org/mcp
```

## Tests

```bash
git submodule update --init --recursive store/backend/neurostore/openapi compose/backend/neurosynth_compose/openapi
cd mcp
uv venv && uv pip install -e ".[test]"
.venv/bin/python -m pytest --block-network --allowed-hosts=127.0.0.1,localhost
```

The tests build the server from each backend's own pin of the API spec (the `openapi` submodules), with every `$ref` inlined as the backends do when they serve `/api/openapi.json`. The APIs and Auth0 are stubbed.

They cover:
- the tool list with and without sign-in;
- the hints, descriptions and schema size;
- the arguments a call sends, and result cutting;
- the sign-in challenge and the `write` scope check;
- the On-Behalf-Of exchange, its scopes and its cache;
- reading the sign-in settings from the environment.
