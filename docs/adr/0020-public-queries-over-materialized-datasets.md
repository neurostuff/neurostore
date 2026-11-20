# 0020. Public queries compile a SoQL subset over materialized public datasets

Status: accepted, built

## Context

Anyone should be able to ask aggregate questions of Neurostore's public data — base studies per year, per journal, per author, per institution; users by their studies; meta-analyses run per month — without an account and without a new endpoint for each question. Arbitrary public queries are a denial-of-service surface and must never reach a private row or column. On a local restore of the 2026-11-06 production backup, the per-author and per-institution questions took 1.0–5.5 s over live views of the tables, and a read-only SQL endpoint behind a restricted role still let a caller lift its own timeout (`set_config`, two statements in one string) and allocate 500 MB in one row (`repeat`). The measurements and the prior art (SoQL, PostgREST, Datasette, GraphQL, OData) are in the design doc (neurostuff/neurostore#1924).

## Decision

`GET /api/query/{dataset}` takes Socrata's `$select`, `$where`, `$group`, `$having`, `$order`, `$limit`, `$offset` and `$q`; `GET /api/query/` lists the datasets and their columns. `neurostore/public_query.py` parses each parameter with one Lark grammar and compiles it to SQLAlchemy Core through `DATASETS` (each dataset's columns and types) and `FUNCTIONS`, as `analysis_query.py` compiles analysis criteria through `FIELDS`: a name outside them, a type mismatch, an aggregate where none may be, or an ungrouped column is a 400 naming what is allowed. There are no joins, subqueries, casts or SQL functions beyond the table.

The datasets are materialized views in schema `public_query` (migrations `e5b7d9f1a3c4` and `b8d0f2a4c6e9`): `base-studies`, `journals`, `authors`, `authorships`, `institutions`, `affiliations`, `studies`, `analyses`, `data-sources` and `data-source-uses`, holding public rows and listed columns only, with count columns on journals, authors, institutions and data sources so "most first" is an index scan. A base study uses a data source when one of its public versions does. The release worker refreshes them concurrently each night (`manage refresh-public-query`), and the refresh time is the version every cached answer carries.

A query runs on its own two-connection pool in a read-only transaction with `statement_timeout` 5 s, `work_mem` 16 MB, `temp_file_limit` 256 MB, no parallel workers and no JIT, as the NOLOGIN role `neurostore_public_query` (`SET LOCAL ROLE`), which may read only the datasets. Its `EXPLAIN` cost must be at most 50,000, or 500,000 for a caller with an API key; over it is a 422. A free connection is waited for one second, then 503 with `Retry-After`. Answers are cached in Redis for an hour under the compiled SQL and the refresh time, with an `ETag` and `Cache-Control: public, max-age=300`. nginx limits `/api/query/` to 1 request a second (bursts of 20) and 2 at once per client, keyed on the `X-Real-IP` the proxy in front sets.

## Consequences

- Measured on the production restore over the design's prototype of these datasets (journals simulated from the strings; design doc): the six use cases in 0.2–49 ms; every query costing under 50,000 ran in at most 371 ms, every one over took at least 1.2 s.
- Measured on the same restore migrated to `b8d0f2a4c6e9`, with the 400 seeded data sources linked to public base studies at the per-source counts of ns-pond's 2026-11-04 matcher run (5,502 uses; production has no links yet): data sources most used first, sources since 2015, one source per year and per journal, and every source per year each ran in 3–7 ms through `run` (planned cost 22–184). With every public base study given three sources (220,346 uses) they ran in 3–103 ms (cost at most 7,418), and the two views refreshed in 1.6 s and 6.1 s.
- Answers are up to a day old.
- A migration that drops or retypes a column a dataset reads must drop and recreate that view.
- `$q` searches with the base-study BM25 index as the app's own user before the query switches role, so the role never reads `base_studies`.
- A dataset or column is public only once it is in both the migration and `DATASETS`; a test checks they agree.

## Rejected

- **A read-only SQL endpoint** (Datasette's model): a role, views and a timeout leave the timeout, memory and multi-statement strings open; closing them needs a parser and a function allow-list anyway.
- **Live views over the tables**: 1.0–5.5 s for two of the six questions, and the public load would read the tables the site writes.
- **`security_barrier` views**: needed only where a caller can make an expression fail on a hidden row; they blinded the planner (52 billion estimated rows) and switched on JIT.
- **A per-key rate bucket in the app**: a key-keyed bucket is skipped by sending a bad token, which reads as anonymous; the per-client nginx limit binds everyone, and a key raises the cost limit instead.
- **A second login role with its own password and connection limit**: `SET LOCAL ROLE` gives the same privileges without a credential to manage; the pool bounds concurrency.
- **PostgREST, Hasura or an OData server beside the app**: a second server for grammars that cannot order by an aggregate (PostgREST) or group (Hasura).
