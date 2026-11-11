# neurostore-mcp

A read-only [MCP](https://modelcontextprotocol.io) server for the public
[Neurostore](https://neurostore.org) and [Neurosynth Compose](https://compose.neurosynth.org)
APIs. It lets an agent (Claude Code, claude.ai, or any other MCP client) search papers, read
their analyses and coordinates, select analyses by extracted study features, and inspect
Compose projects, meta-analyses and their results.

It calls the public APIs with no credentials, so it can only read public records. Write tools
through Auth0 OAuth come later: see [docs/remote-hosting-and-oauth.md](docs/remote-hosting-and-oauth.md).

## Tools

| Tool | API call | What it returns |
| --- | --- | --- |
| `search_base_studies` | `GET /base-studies/` | Papers by text, author, journal, year, DOI/PMID, data type, level or an MNI sphere |
| `get_base_study` | `GET /base-studies/{id}` | One paper, its other identifiers and its study versions |
| `search_studies` | `GET /studies/` | Study versions, by source or owner |
| `get_study` | `GET /studies/{id}` | A study's analyses with their coordinates, metadata, conditions and images |
| `query_analyses` | `POST /analysis-queries/` | Analyses selected by extracted features, with `base_study_ids`, `study_ids` and `funnel` (reads only) |
| `list_analysis_terms` | `GET /analysis-terms/` | The values (and ids) a `query_analyses` field takes |
| `list_public_datasets` | `GET /query/` | The public aggregate-query datasets and their columns |
| `run_public_query` | `GET /query/{dataset}` | A SoQL aggregate over one dataset |
| `get_studyset` | `GET /studysets/{id}` | A studyset and a page of its study ids |
| `list_annotations` | `GET /annotations/` | Annotations, optionally of one studyset |
| `get_annotation` | `GET /annotations/{id}` | An annotation's columns and a page of its notes |
| `search_projects` | Compose `GET /projects` | Public Compose projects |
| `get_project` | Compose `GET /projects/{id}` | One project, its meta-analyses, studyset and annotation |
| `get_meta_analysis` | Compose `GET /meta-analyses/{id}` | Its NiMARE specification, inputs and result ids |
| `get_meta_analysis_result` | Compose `GET /meta-analysis-results/{id}` | Its NeuroVault maps, methods text and references |

The tools trim each record to the fields an agent needs. List tools return
`{total, page, page_size, next_page, results}`, with at most 50 results a page.
`get_study` caps coordinates per analysis (`max_points_per_analysis`, default 100), and
`get_annotation` and `get_studyset` page their notes and study ids. Abstracts and diagnostic
tables are cut to a length you choose.

## Run it locally

You need [uv](https://docs.astral.sh/uv/).

```bash
uvx --from "git+https://github.com/neurostuff/neurostore#subdirectory=mcp" neurostore-mcp
```

That starts the server on stdio. From a checkout, use `uvx --from ./mcp neurostore-mcp`.

To serve Streamable HTTP at `http://127.0.0.1:8000/mcp` instead:

```bash
uvx --from "git+https://github.com/neurostuff/neurostore#subdirectory=mcp" neurostore-mcp --transport http --port 8000
```

`--host` and `--path` change the bind address and endpoint path. The environment variables
`NEUROSTORE_API_URL` (default `https://neurostore.org/api`) and `COMPOSE_API_URL` (default
`https://compose.neurosynth.org/api`) point the server at another deployment, such as staging
or a local stack.

### Claude Code

Over stdio, Claude Code starts the server itself:

```bash
claude mcp add neurostore -- uvx --from "git+https://github.com/neurostuff/neurostore#subdirectory=mcp" neurostore-mcp
```

Or connect to a server already running over HTTP:

```bash
claude mcp add --transport http neurostore http://127.0.0.1:8000/mcp
```

Add `--scope user` to make it available in every project. Claude Code caps a tool result
at 25,000 tokens by default (`MAX_MCP_OUTPUT_TOKENS`); the defaults here stay well under that.

### Other clients

Any client that launches stdio servers takes the same command, for example in a
`mcpServers` JSON config:

```json
{
  "mcpServers": {
    "neurostore": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/neurostuff/neurostore#subdirectory=mcp", "neurostore-mcp"]
    }
  }
}
```

claude.ai custom connectors need a public HTTPS URL; see
[docs/remote-hosting-and-oauth.md](docs/remote-hosting-and-oauth.md).

## Tests

The tests call the tools through an in-memory MCP client and replay real production
responses recorded as VCR cassettes in `tests/cassettes/`. CI runs them with the network
blocked:

```bash
cd mcp
uv venv && uv pip install -e ".[test]"
.venv/bin/python -m pytest --record-mode=none --block-network --allowed-hosts=127.0.0.1,localhost
```

`test_server.py` also starts the server over stdio and over HTTP on localhost.

To re-record after an API change, delete the affected cassettes and run
`.venv/bin/python -m pytest --record-mode=once`. The recorder replaces the Compose
`run_key` (a meta-analysis's upload key) with `REDACTED` before writing.
