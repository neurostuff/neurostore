# Public aggregate queries: design (draft 2)

Branch `claude/public-query-design-b303cf`, at neurostuff/neurostore master 96b5cd94. Measured on
2026-11-06 against a local restore of that day's production backup
(`11-06-2026-at-00-00-01_neurostore.dump`, database `ns_1106`, in a throwaway pg17 container built
from the store's image, 1 GB shared_buffers, 16 MB work_mem). No deployed database was read. Nothing is
built. James answered questions 2, 3, 5, 6 and 7 on 2026-11-06 (see [Questions for
James](#questions-for-james)); 1 and 4 are open.

## The question

Through which grammar, compiled how, and over which allow-listed relations can anyone run aggregate
queries over Neurostore's public data, so that the first six use cases answer in well under a second,
and no query can read a private row or column or take the database down?

The six use cases, each measured below:
1. articles per year, by year;
2. articles per journal, most first;
3. articles per author, ranked by the author's articles with coordinates or images;
4. articles per institution, most first;
5. the users with the most studies, by username only: the public studies each user owns (James,
   2026-11-06);
6. meta-analyses published over a time period.

An **article** is a base study: a row of `base_studies` with `is_active` and `public`.

## What exists (verified in code and on the restore)

### Which table each use case reads

| Use case | Reads | Normalized? |
|---|---|---|
| 1. per year | `base_studies.year` | yes (an integer) |
| 2. per journal | `base_studies.journal_id` → `journals` (#1916, #1921) | yes, on master; production predates it (below) |
| 3. per author | `base_study_authors.author_id` → `authors`; `base_studies.has_coordinates`, `has_images` | yes: entities |
| 4. per institution | `base_study_author_affiliations.university_id` → `universities` | yes: entities |
| 5. per user | `studies.user_id` → `users.external_id`, shown as `users.name` | yes; "username" is `users.name` |
| 6. meta-analyses | `studies.level = 'meta'`, and their `analyses` | a label on the study, not the analysis (below) |

**Authors and institutions are already entities**, not only strings (`models/data.py:729-827`):
- `authors`: one row per ORCID iD, else per OpenAlex author id, else one per paper.
- `universities`: one row per ROR id, with `name` and `country`.
- `base_study_authors`: an author's place on a paper, with the printed name and `corresponding`.
- `base_study_author_affiliations`: each affiliation as printed, with the ROR university it names.
- The legacy `base_studies.authors` string remains beside them.

How much production has them filled: measured on the restore,
- 146,608 authors: 87,604 with an ORCID iD (60%), 129,072 with an OpenAlex id (88%), and 16,864 with
  neither, each of which is one paper's author only;
- 449,672 authorships covering 66,203 of the 76,303 articles (86.8%), all written between 2026-10-30
  and 2026-11-03 by the parsed-paper uploads (`neurostore/authors.py`);
- 1,087,128 affiliations, 1,045,223 of them (96%) naming a ROR institution; 65,870 articles (86.3%)
  have at least one;
- the legacy `base_studies.authors` string is set on 76,108 articles (99.7%).

**Journals.** `journals` and `base_studies.journal_id` landed in #1916; #1921 made `publication` the
journal's title, with `journal_abbreviation` beside it, kept by a trigger. Production's schema predates
both (its dump has no `journals` table), and the backfill `manage journals match` has not run there. To
measure use case 2, I simulated the entity on the restore: one `journals_sim` row per case-folded
`publication` string (3,569 rows), and `base_studies.journal_id` with a B-tree index. The
real table has about 2,700 titles for 76k papers (docs/journals/DESIGN.md), so the simulation has more
groups than the real one and its timing is an upper bound.

**The meta label.** There is no "meta" label on analyses. What exists:
- `studies.level` (and `base_studies.level`, `entities.level`) is checked to be `group` or `meta`
  (`models/data.py:349, 945, 1286`).
- Compose writes it. Creating a **project** POSTs a neurostore study with `level: "meta"` and the
  project's name and description (`compose/.../resource_services.py:368-408`, called from
  `projects_view.py:701`). It does this when the project is created, before any meta-analysis runs.
- Uploading a meta-analysis **result** creates or updates one neurostore **analysis** in that study,
  named after the meta-analysis, with the cluster table's peaks as points
  (`compose/.../tasks.py:95-170`, `meta_analyses_view.py:880-925`). One analysis per Compose
  meta-analysis; a re-run updates it.
- So "a meta-analysis was run" is "an analysis exists in a `level = 'meta'` study", dated by the
  analysis's `created_at`. "A project was made" is the study alone.
- Compose does not pass the project's `public` or `draft` flag. The neurostore study takes neurostore's
  default, `public = true`, so a private or draft Compose project's name is already public in
  neurostore. Counting is safe; listing names is not, until Compose sends the flag.
- Production: measured on the restore, `level = 'meta'` means two different things:
  - **Compose's studies:** 4,827 meta studies with no base study, created 2023-06-30 to 2026-11-05;
    1,030 of them have result analyses. Analyses in them, by year: 14 (2023), 590 (2024), 440 (2025),
    673 (2026 so far).
  - **Papers that are meta-analyses:** 1,898 base studies have `level = 'meta'`, and their 4,457
    versions (neurosynth, pubget, llm, nuextract, users' copies) inherit it.
  - So use case 6 must also require "no base study". That is a heuristic: nothing marks a study as
    Compose's own.

**Users.** `users` holds `id`, `external_id` (the Auth0 subject), `name` and `active`. The REST API
serves `name` as `username`, and also serves the owner's `external_id` as `user`
(`resources/data_views/serialization.py:182`). The public query must serve neither `external_id` nor
`users.id`. Production: 2,342 users; 2,258 distinct names own public studies. 1 name contains `@` (an
email address used as a name), 2 are null, and 1,859 contain a space, so most are people's real names
from their identity provider.

**"Updated" is loose.** `updated_at` is set by any ORM write, including the app's own (flag and count
listeners), not only a user's edit. Of 86,375 public studies with an owner, 72,803 have `updated_at`, and
19,113 were updated more than a minute after creation. Outside the review app there is no per-user edit
log, so use case 5 counts the public studies a user owns (question 7).

**Visibility.** `studies`, `studysets`, `annotations` and `base_studies` carry `public`; the REST lists
filter with `visibility_filters` (`resources/utils.py:94`: public, or the caller's own). A history study
is `public = false` (`ingest/study_schema.py:829`, `services/base_study_metadata_enrichment.py:954`).
Compose projects live in Compose's database, so nothing about them is reachable from here except the
meta studies above.

### The codebase's analogue: `analysis_query.py` and `/analysis-terms/`

`neurostore/analysis_query.py` already compiles a public, structured query to SQL over one table:
- **An allow-list registry.** `FIELDS` maps each public name to a `Field(kind, column, ids, values)`.
  Only names in it compile; an unknown name is a 422 listing the allowed ones (`_unknown`,
  `make_field_error`).
- **Compiled with SQLAlchemy Core**, never string-built: each criterion becomes a `Criterion` holding
  its SQL condition, and the query is one `select` over `analysis_features`.
- **Bounded:** `DEFAULT_LIMIT = 100`, `MAX_LIMIT = 1000`; text patterns need three literal characters so
  the trigram index can serve them (ADR 0019 measured what happens without: 4.6 s).
- **Echoes a canonical query** in the response, so the caller sees what their input meant.
- **`list_terms` (`GET /analysis-terms/`) is already a group-by-count endpoint**: one allow-listed field,
  `count()` and `count(distinct base_study_id)`, ordered by count, limited. It is use case 2's shape for
  one fixed field.

The public query generalizes exactly this: a registry per dataset instead of one `FIELDS`, a grammar
instead of a JSON body, and aggregates in the select list. The analysis features themselves become a
dataset later (analyses per diagnosis, per task).

Other pieces to reuse:
- **Caching:** flask-caching on Redis with version tokens (`cache_versioning.py`), used by the REST
  lists (`resources/base.py:561`).
- **ETag / 304:** the review schema route (`resources/review.py:54-66`).
- **API keys** with a `read` scope (`models/auth.py`, `resources/auth.py:100-150`), on master, not yet
  in production.
- **Text search:** `bm25_clause` (`resources/text_search.py:334`, ADR 0016) for `$q` on articles.
- **A nightly job:** `store_release_worker` runs `manage build-neurostore-studyset-release --nightly`,
  the natural place to refresh anything precomputed.
- **Nothing rate-limits** today: nginx has no `limit_req`, and the app has no limiter.

## Prior art

Read from each system's documentation on 2026-11-06.

| | How "count by year" is written | Limits | What aligning would cost us |
|---|---|---|---|
| **Socrata SoQL** (SODA 2) | `/resource/ID.json?$select=year, count(*) AS n&$group=year&$order=year` | `$limit` default 1,000 (max 50,000 on 2.0); app tokens, 429 on abuse; SODA3 timeout default 600 s | Nothing to reuse: the reference parser is Scala (socrata-platform/soql-reference), its BNF dates from 2014, and there is no Python parser. Socrata's live docs now POST a SQL body (SODA3). We would write a parser for a subset; the parameter names and function names (`date_trunc_y`, `count(*)`) carry over. |
| **PostgREST** | `/t?select=year,count()&order=year` (group-by implied) | aggregates off by default (`db-aggregates-enabled`), and its docs warn they enable denial of service; `db-max-rows`; per-role `statement_timeout`; `pg_plan_filter` for EXPLAIN-cost limits | No HAVING, no ordering by an aggregate, no functions in `select` (a derived year needs a view). Use case 3's ranking and use case 6's month are not expressible without views. A Haskell server beside Flask; its URL grammar is prose, not a spec. |
| **Datasette** | `?sql=select year, count(*) …` | 1 s time limit, 1,000 rows, read-only connection, a SELECT-only regex | SQLite-specific: the time limit is a progress handler and safety is SQLite's read-only mode. Postgres needs a role, timeouts and more (see the experiment). |
| **GraphQL** (Hasura) | `t_aggregate { aggregate { count } }` | rate, depth and time limits are paid tiers; GitHub's API prices each query from its connection sizes before running it | No group-by in Hasura (views again). A second schema language and server. GitHub's static cost estimate is the useful idea. |
| **OData `$apply`** | `$apply=groupby((Year),aggregate($count as Count))/orderby(Year)` | services advertise `GroupableProperties` and `AggregatableProperties` | A normative ABNF, but no Python `$apply` implementation (gorilla-co/odata-query parses `$filter` only). The per-column groupable/aggregatable flags are a good allow-list shape. |
| **OpenAlex** `group_by` | `/works?group_by=publication_year&sort=key:asc` | ≤ 3 group fields, 200 groups a page; credits | The closest scholarly analogue (works per year, source, institution, author), but a fixed facet API, not a grammar. |

Takeaways:
- No system offers a maintained Python parser for an aggregate grammar. Whatever grammar we pick, we
  write and own a small parser.
- Every system that lets the public aggregate (PostgREST, Datasette, Socrata, OpenAlex) bounds it the
  same way: a per-request time limit, a row cap, a read-only path, and per-client rate limits or tokens.
- SoQL's `$`-parameters are the only grammar that is URL-friendly (cacheable GETs), has HAVING and
  ordering by aggregates, and is known to the open-data audience.

## Candidates

All three run the same SQL for the use cases; they differ in what a caller may write and in how much
the server has to defend.

**(a) A SoQL subset compiled to SQLAlchemy over allow-listed datasets.**
- Caller: `GET /api/query/{dataset}?$select=…&$where=…&$group=…&$having=…&$order=…&$limit=…&$offset=…&$q=…`.
- Server: a Lark LALR grammar parses each parameter; a transformer maps every name through the dataset's
  registry and every function through a fixed table, building SQLAlchemy Core. Anything else is a 422.
- Reserves: the `/query/` path, the dataset names, the `$` parameter names.

**(b) A read-only SQL endpoint behind a dedicated Postgres role, views and limits.**
- Caller: `GET /api/sql?sql=select …` over views in a `public_api` schema.
- Server: a role with `SELECT` on those views only, `default_transaction_read_only`, a role
  `statement_timeout`, and a wrapping `LIMIT`.

**(c) Precomputed aggregates for the common shapes, with (a) or (b) for the rest.**
- Caller: the same as (a); the server answers a known shape from a table rebuilt nightly.
- Server: rollup tables (per year, per journal, per author, per institution) refreshed by the release
  worker.

## Experiment

Everything ran on the restore, in a role that can read only the datasets, with
`PGOPTIONS=-cstatement_timeout=60000`. Times are EXPLAIN ANALYZE execution times from the second
(warm) run; the first runs were within 1.5x. The scripts are in [experiment/](experiment/).

### 1. The use cases on four substrates

| Use case | Live views, `security_barrier`, JIT on | Live plain views, JIT off | Materialized flat datasets | Rollup columns |
|---|---:|---:|---:|---:|
| 1. per year | 81 ms | 57 ms | **12 ms** | — |
| 2. per journal (simulated entity) | 118 ms | 134 ms | 42 ms | **0.2 ms** |
| 3. per author, by articles with data | 3,757 ms | 1,019 ms | 382 ms | **1.0 ms** |
| 4. per institution | 5,515 ms | 3,887 ms | 121 ms | **0.2 ms** |
| 5. users by studies (with an `updated_at` filter) | 79 ms | 74 ms | **49 ms** | — |
| 6. Compose meta-analyses per month | — | 35 ms | **15 ms** | — |

- **Live views** are what (a) or (b) would run with no precomputation. The two slow cases are joins of
  the wide `base_studies` heap (255 MB, because of abstracts) to 450k authorships and 1.09M
  affiliations, with a `count(distinct)` over the latter that sorted 1M rows to disk.
- **`security_barrier`** (needed only by (b), see below) blinded the planner's estimates (52 billion
  rows for a 450k-row join), which switched on JIT: 2.0 s of UC3's 3.7 s was compilation.
- **Materialized flat datasets** are narrow, public-only, pre-joined copies: `articles` 27 MB,
  `authorships` 96 MB, `affiliations` 47 MB (243,412 distinct article and institution pairs),
  `studies` 59 MB, `analyses` 149 MB. UC3 is still 382 ms because grouping 450k rows into 146,599
  authors is a 270 ms hash however the rows are stored.
- **Rollup columns** are `articles` and `articles_with_data` on the `authors`, `institutions` and
  `journals` datasets, each with a descending index, so "most first" is an index scan of 100 rows.
- **Building all of it** from scratch took about 12 s (5 s of it indexes); `REFRESH MATERIALIZED
  VIEW CONCURRENTLY` of everything took about 30 s, without blocking readers. Together they are
  about 400 MB.
- **`$q`** composes: `working memory` through the existing BM25 index (14,722 articles), then counted
  per year over materialized `articles`, took 81 ms.

### 2. What raw SQL lets an anonymous caller do (candidate b)

As a role with `SELECT` on the views only, `default_transaction_read_only`, and a 5 s
`statement_timeout`:

| Test | Result |
|---|---|
| T1 read `users` | refused: permission denied |
| T2 `CREATE TABLE` | refused: read-only transaction |
| T3 `pg_sleep(30)` | cancelled at 5.0 s |
| T4 `set_config('statement_timeout','0')` and a sleep, one statement | cancelled at 5.0 s: a statement cannot lift its own timer |
| T5 `set_config(…, false)`, then a 7 s statement on the same connection | **completed in 7.0 s**: the setting outlives the statement, so on a pooled connection it reaches the next caller |
| T5b the same two statements in one query string (simple protocol, as `text()` over psycopg2 sends them) | **completed in 7.0 s** |
| T5c `SET LOCAL` in a transaction | undone at commit |
| T6 `count(*)` of `points × points` | EXPLAIN cost 1.1 × 10¹¹; failed at once asking for 900 MB of shared memory for a parallel hash |
| T7 `length(repeat('x', 500000000))` | **completed in 3.9 s, after allocating 500 MB** for one row: a timeout bounds time, not memory |
| T8 other sessions' query text | hidden (`<insufficient privilege>`) |
| T9 `pg_views.definition` | readable: the base tables and filters behind each view |
| T10 `pg_roles` | readable: 18 roles |
| T11 `pg_read_file` | refused |
| T12 `count(distinct name)` over authorships | 1.3 s |

So a role, a timeout and views are not enough. Making (b) safe needs a SQL parser that rejects a
second statement, and an allow-list of functions (`set_config`, `repeat`, `generate_series`,
`pg_sleep` and the rest of about 3,000 built-ins), plus `security_barrier` views, so that an
error-raising expression (`1/0` on a filtered-out row) cannot reveal a row the view hides. At that
point it is (a) with a much larger grammar to secure.

### 3. The grammar's own cost and its worst cases

- **Parse and compile:** the throwaway SoQL compiler (Lark LALR plus SQLAlchemy Core, about 250
  lines) took 1.8–3.4 ms per use case. It rejected `pg_sleep(10)`, a column outside the registry
  (`user_id`, `external_id`), `year = 1; drop table x`, an aggregate in `$where`, a subquery, and
  `$limit=100000`, each with a message naming what is allowed.
- **EXPLAIN as a gate** (single-threaded, JIT off, as the role would run):

| Query | Planner cost | Time |
|---|---:|---:|
| UC3 rollup (authors by articles with data) | 7 | 0.4 ms |
| UC1 per year | 1,906 | 8.5 ms |
| `lower(title) like '%memory%'` | 4,089 | 98 ms |
| UC2 per journal | 4,645 | 38 ms |
| group by title (76k groups) | 7,728 | 76 ms |
| UC4 flat | 9,722 | 101 ms |
| UC6 | 14,310 | 4 ms |
| group by printed author name | 18,637 | 252 ms |
| UC3 flat | 21,611 | 371 ms |
| UC5 | 44,753 | 146 ms |
| a page at offset 10,000 of 450k sorted rows | 46,109 | 324 ms |
| studies grouped by name | 47,946 | 251 ms |
| `count(distinct printed_name)` | 65,803 | 1,266 ms |
| analyses grouped by name (831k rows) | 154,012 | 1,178 ms |
| average points per article (a dataset that joins) | 202,093 | 1,424 ms |
| `count(distinct name)` per study over analyses | 261,592 | 3,059 ms |

  Every query under 50,000 ran in at most 371 ms; every one over took at least 1.2 s. Planning
  cost 0.3–3 ms. The estimates are off by up to 10x either way (UC6 is overestimated, the
  `count(distinct)` cases under), which is why the gate sits on top of the timeout, not in its place.

## Decision

**(a) over (c): a SoQL subset compiled to SQLAlchemy, over materialized datasets.**

- **Grammar:** SoQL's `$` parameters, a subset (below), parsed with Lark and compiled through a
  registry per dataset, the way `analysis_query.FIELDS` compiles analysis criteria.
- **Substrate:** every dataset is a narrow, public-only, pre-joined materialized view in
  `public_query`. `journals`, `authors` and `institutions` carry count columns, so the common "most
  first" shapes are index scans.
- **Refresh:** the release worker refreshes them concurrently each night (about 30 s, readers never
  blocked), and after a backfill that changes them (journals, authors). The refresh time is the data
  version that cache keys and ETags carry.
- **Limits:** the cost gate, the role, its own pool, rate limits and the cache, as below.

Why:
- **It is the only candidate that meets the target on every use case:** 0.2–49 ms against 1–5.5 s
  for live views. The arbitrary queries tried stayed under 0.4 s when they passed the gate.
- **The grammar is the safety boundary we can enumerate.** (b)'s experiment shows a role and a
  timeout leave memory, settings and multi-statement strings open, and closing them needs a parser
  and a function allow-list anyway. A grammar that cannot name `set_config`, a second statement, a
  join or a cast has nothing of those to defend.
- **It is the codebase's own pattern.** A registry of public names, compiled with SQLAlchemy, 422s
  that list what is allowed, bounded limits and a canonical echo, as in `analysis_query.py`.
- **Materializing makes the allow-list physical.** A dataset holds only its listed columns and public
  rows, so even a compiler bug can reach nothing else. It also stops the public load from touching the
  hot tables the site writes to.
- **SoQL's names are worth keeping.** Open-data users know them, GETs cache, and they express HAVING
  and ordering by an aggregate, which PostgREST cannot (UC3).

The cost: answers are up to a day old. Use cases 1–6 are statistics, where that is acceptable; a
caller who needs the current state of one paper has the REST API.

## The grammar

**Endpoints** (paths to confirm in neurostore-spec):
- `GET /api/query/` lists the datasets, each with its columns, their types, and whether each may be
  grouped and aggregated (OData's `GroupableProperties`/`AggregatableProperties` idea). This listing is
  the allow-list, served.
- `GET /api/query/{dataset}?…` runs one query and returns
  `{"dataset", "query": <canonical form>, "columns": [{name, type}], "rows": [[…]], "limit", "offset"}`.
  Rows are arrays, not objects, to keep large group lists small.

**Parameters**, SoQL's names and meanings (dev.socrata.com/docs/queries), every one optional:

| Parameter | Takes | Default |
|---|---|---|
| `$select` | expressions, each optionally `AS alias`; `*` for every column | every column |
| `$where` | a boolean expression over columns; no aggregates | none |
| `$group` | columns, scalar expressions, or `$select` aliases | none |
| `$having` | a boolean expression over aggregates and aliases | none |
| `$order` | expressions or aliases, each `ASC` or `DESC` | the group keys, else the dataset's key |
| `$limit` | 0 to 1,000 | 100 |
| `$offset` | 0 to 10,000 | 0 |
| `$q` | words, as the base-study search parses them (BM25, ADR 0016); `articles` only | none |

Any other `$` parameter is a 422. SoQL's `col=value` shorthand is not offered, so every query has one
spelling.

**Expressions:**
- literals: numbers, `'strings'` (`''` escapes a quote), `true`, `false`, `null`;
- columns of the dataset, by name;
- `=`, `!=`, `<`, `<=`, `>`, `>=`, `+`, `-`; `AND`, `OR`, `NOT`; `IS [NOT] NULL`; `[NOT] IN (…)`
  (at most 100 values); `BETWEEN … AND …`; `LIKE 'pattern'` and `starts_with(col, 'x')`, with the
  same three-literal-character rule as the analysis query, on text columns only;
- aggregates: `count(*)`, `count(col)`, `count(distinct col)`, `sum`, `avg`, `min`, `max`;
- scalars, with SoQL's names: `date_trunc_y`, `date_trunc_ym`, `date_extract_y`, `lower`, `upper`,
  `case(cond, value, …)`, `coalesce`.

Types are checked from the registry: comparing `year` to `'2020'` or summing a text column is a 422,
before any SQL runs. There are no subqueries, joins, casts, window functions or set operations: a
dataset is already the join a question needs, as in Socrata.

**Ordering is total.** When `$offset` is given, the compiler appends the group keys (or the dataset's
key) to `$order`, so pages never overlap.

## The use cases, written in it

Unencoded for reading; a client URL-encodes each value.

1. Articles per year:
   `GET /api/query/articles?$select=year, count(*) AS articles&$group=year&$order=year`
2. Articles per journal, most first:
   `GET /api/query/journals?$select=id, title, articles&$order=articles DESC`
   (or, with filters on the articles, `GET /api/query/articles?$select=journal_id, journal, count(*) AS
   articles&$where=year >= 2015&$group=journal_id, journal&$order=articles DESC`)
3. Articles per author, ranked by those with coordinates or images:
   `GET /api/query/authors?$select=id, name, orcid, articles_with_data, articles&$order=articles_with_data DESC, articles DESC`
   (with filters: `GET /api/query/authorships?$select=author_id, author_name, sum(case(has_coordinates OR has_images, 1, true, 0)) AS with_data, count(*) AS articles&$where=year >= 2020&$group=author_id, author_name&$order=with_data DESC`)
4. Articles per institution, most first:
   `GET /api/query/institutions?$select=id, name, country, articles&$order=articles DESC`
   (with filters: `GET /api/query/affiliations?$select=institution_id, institution, count(*) AS articles&$where=country = 'DE'&$group=institution_id, institution&$order=articles DESC`)
5. Users with the most studies they own:
   `GET /api/query/studies?$select=username, count(*) AS studies&$where=username IS NOT NULL&$group=username&$order=studies DESC`
   (measured with `AND updated_at IS NOT NULL` as well, 49 ms; without it the same 59 MB dataset is
   scanned, not re-measured.)
6. Meta-analyses run per month in a period:
   `GET /api/query/analyses?$select=date_trunc_ym(created_at) AS month, count(*) AS meta_analyses&$where=level = 'meta' AND source = 'neurosynth-compose' AND created_at BETWEEN '2024-01-01' AND '2024-12-31'&$group=month&$order=month`
   (this needs Compose's marker, "Needed first" item 3; until then the condition is `article_id IS NULL`,
   a heuristic.)

Full text: `GET /api/query/articles?$select=year, count(*)&$q=working memory&$group=year&$order=year`.

## The public allow-list

Every dataset is a materialized view in its own schema, `public_query`, owned by a NOLOGIN role that
can read the base tables; the query role can read only the datasets. Their definitions carry the row
filter, so no grammar bug can reach a private row. The registry in Python lists the same columns, so no
grammar bug can name a column outside them. Columns not listed are out, and a new column is out until it is added to both.

| Dataset | Rows | Columns | Key |
|---|---|---|---|
| `articles` | `base_studies` with `is_active` and `public` | `id`, `title` (`name`), `year`, `doi`, `pmid`, `pmcid`, `journal_id`, `journal` (`publication`, the journal's title), `journal_abbreviation`, `is_oa`, `publication_status`, `is_retracted`, `license`, `level`, `has_coordinates`, `has_images`, `has_z_maps`, `has_t_maps`, `has_beta_and_variance_maps`, `created_at`, `updated_at` | `id` |
| `journals` | `journals` | `id`, `openalex_id`, `kind`, `title`, `abbreviation`, `issn_l`, `nlm_id`, `wikidata_id`, `articles`, `articles_with_data` (counts) | `id` |
| `authorships` | `base_study_authors` of articles, with `authors` | `article_id`, `author_id`, `author_name` (`authors.name`), `printed_name` (`base_study_authors.name`), `orcid`, `openalex_id`, `position`, `corresponding`, and the article's `year`, `journal_id`, `has_coordinates`, `has_images` | `article_id, position` |
| `affiliations` | distinct (article, institution) pairs of articles, with `universities` | `article_id`, `institution_id`, `institution` (`universities.name`), `ror`, `country`, and the article's `year`, `journal_id` | `article_id, institution_id` |
| `authors` | authors with at least one authorship | `id`, `name`, `orcid`, `openalex_id`, `articles`, `articles_with_data` (counts) | `id` |
| `institutions` | universities named by at least one affiliation | `id`, `ror`, `name`, `country`, `articles` (count) | `id` |
| `studies` | `studies` with `public` | `id`, `article_id` (`base_study_id`), `name`, `year`, `level`, `source`, `username` (`users.name`), `created_at`, `updated_at`, `has_coordinates`, `has_images` | `id` |
| `analyses` | `analyses` of public studies | `id`, `study_id`, `article_id`, `name`, `level` and `source` (the study's), `point_count`, `image_count`, `has_coordinates`, `has_images`, `role`, `outcome`, `created_at`, `updated_at` | `id` |

Left out, column by column, and why:
- **Identity:** `users.id`, `users.external_id` (Auth0 subject), `users.active`, every `user_id` column
  (they hold `external_id`), `roles`, `roles_users`, `api_keys`. A user appears only as `username`, and
  only on `studies`.
- **Contact data:** `corresponding_author_emails` entirely (encrypted, and never served by any route).
- **Free-form JSON:** every `metadata_`, `base_studies.retraction_notice`, `entities.data`,
  `images.data`. Their keys are not an allow-list, so nothing inside them is.
- **Text under copyright, or large:** `fulltexts`, `ace_fulltext`, `pubget_fulltext`, `description`
  (abstracts). `$q` searches titles and abstracts without returning them.
- **Internal bookkeeping:** `is_active`, `public` (always true in a view), `superseded_by`,
  `fulltext_id`, `publication_source`, `journal_match`, `source_id`, `merged_from`, `relabelled_by`,
  outboxes, merge candidates, `alembic_version`.
- **Whole tables:** the review app (`reviews`, `review_*`), the truth layer (`pipeline_*`,
  `field_claim*`, `study_entities`, `extraction_entity_links`; `tests/test_truth_layer.py` keeps them
  out of the API), embeddings, `annotations` and `annotation_analyses` (users' notes; public annotations
  can be a later dataset), `studysets` (a later dataset, public ones only), `base_study_links`
  (served nowhere yet, ADR 0017), `points` and `images` (later; see the cost limits).
- **The legacy `base_studies.authors` string:** `authorships` replaces it.

`username` is `users.name`, which Auth0 fills from the identity provider. The dataset nulls any name
containing `@` (one in production), so an email address used as a name is never served. Most names are people's real names (question 4).

## Safety and cost limits

Arbitrary public queries are a denial-of-service surface. Each layer below bounds something the
others do not.

1. **Grammar and registry (what can be said).** Only allow-listed datasets, columns and functions
   compile; no subqueries, joins or casts; `IN` lists ≤ 100 values; text patterns need three literal
   characters; at most 5 group keys and 10 select expressions. This is the only layer that bounds
   memory per query (see T7 in the experiment: `repeat()` allocates before any timeout).
2. **A cost gate before running (what it will cost).** The compiled statement is planned
   (`EXPLAIN (FORMAT JSON)`, 0.3–3 ms) and refused with a 422 naming the limit when its total cost
   exceeds 50,000 for anonymous callers. On the restore, every one of 16 queries costing under 50,000
   ran in at most 371 ms, and every one costing more took at least 1.2 s (the table in the experiment).
   The planner's cost is a guess, so the gate is a first filter and the timeout remains the bound.
   Queries the gate refuses can be offered to API-key holders with a higher limit (question 3).
3. **The database role (what it can touch).** `neurostore_public_query`: LOGIN, member of nothing,
   `SELECT` on the `public_query` datasets only, `default_transaction_read_only = on`,
   `statement_timeout = 5s`, `idle_in_transaction_session_timeout = 10s`, `work_mem = 16MB`,
   `temp_file_limit = 256MB`, `max_parallel_workers_per_gather = 0` (a parallel hash in T6 asked for
   900 MB of shared memory), `jit = off` (JIT was 2.0 s of UC3's 3.7 s), `search_path = public_query`,
   and `CONNECTION LIMIT 4`. Each request runs in its own transaction with `SET LOCAL` of the same
   values (T5c), so nothing a request sets survives into the next one on a pooled connection.
4. **Its own connection pool (what it can starve).** A second SQLAlchemy engine for this role, pool
   size 2 per worker, no overflow, a 1 s checkout timeout returning 503 with `Retry-After`. The REST API's
   pool is never shared, so a burst of public queries cannot take the connections the site needs.
5. **Rate limits (how often).** nginx `limit_req` on `/api/query/` per client IP, e.g. 1 request per
   second with a burst of 20, `limit_conn` 2 per IP; 429 beyond. An API key with `read` scope gets its own
   higher bucket keyed by key id (in the app, Redis counters, since nginx cannot see which key is valid).
6. **Caching (how often it actually runs).**
   - The key is a hash of the canonical compiled SQL and its parameters, so `$select=year,count(*)` and
     `$select= year , COUNT(*)` share one entry.
   - The data version is part of the key: the time the datasets were last refreshed, read from a
     one-row table (an index probe of `max(updated_at)` measured 0.06–0.3 ms, for comparison). A refresh
     is a new key; nothing needs invalidating, and between refreshes every answer is cacheable.
   - Responses carry `ETag` (that hash) and `Cache-Control: public, max-age=300`, and answer
     `If-None-Match` with 304 without touching Postgres beyond the version probe.
   - Redis holds results for an hour (flask-caching, as the REST lists do).
7. **Read replica: not now.** There is none today, and adding one is an infrastructure change. With the
   role's connection limit, parallelism off and its timeout, public queries hold at most four of the
   primary's cores, for at most 5 s per query. Revisit when the pool's 503s or the primary's load say
   so; the separate engine makes pointing it at a replica a configuration change.

## Needed first

In order:
1. **Deploy the journal entity and run its backfill** (#1916, #1921, then `manage journals match` in
   production). Until then, use case 2 groups by the source's strings: 3,569 case-folded strings for
   76k articles on the restore, against about 2,700 journals once matched.
2. **Authors and institutions: nothing to build for the use cases**, they are entities already.
   The gap is coverage, not modelling: 10,100 articles (13%) have no authorships, because they never came through a parsed-paper upload. Use cases 3 and 4 work today
   over the 87% that do, and the response should say so (`articles` with no authorship are simply not
   counted). Closing the gap is an upload of those papers' bibliographies through ns-pond, not a schema
   change. Authors with neither ORCID nor OpenAlex id (16,864) count one paper each, which slightly
   undercounts prolific authors without ids; that is the entity's rule, and the query inherits it.
3. **The meta label.** `level = 'meta'` exists, but it also marks papers that are meta-analyses, and
   it ignores the project's privacy. James, 2026-11-06: the neurostore study reflects the project's
   privacy, kept in sync with it. Changes, all in Compose:
   - `create_or_update_neurostore_study` sends `public = project.public`, and marks the study as
     Compose's: `source = 'neurosynth-compose'`, `source_id = <project id>` (both existing columns).
   - `PUT /projects/{id}` calls it whenever `public`, `name` or `description` changes. Today only
     creation and cloning call it (`projects_view.py:701`, `project_cloning.py:127`), and the `put`
     syncs `public` only to the project's own meta-analyses (`sync_meta_analyses_public`).
   - A one-off sets all three on the 4,827 existing meta studies with no base study, after matching
     each to Compose's `neurostore_studies` table.
   - Until it ships, the datasets serve meta studies' counts but not their names.
   - No label on the analysis itself: "a meta-analysis was run" is an analysis in such a study, and its
     `created_at` dates the first uploaded result. A label on the analysis would duplicate the study's.
4. **The query role and the `public_query` schema**, created by a migration (the role's password from
   the environment, as the app's own is).
5. **neurostore-spec:** the two paths and the response schema; the `$` parameters as query parameters.

## Questions for James

James answered 2, 3, 5, 6 and 7 on 2026-11-06. 1 and 4 are open; the design assumes their
recommendations.

1. **Scope of the first release.** The datasets above (`articles`, `journals`, `authors`,
   `authorships`, `institutions`, `affiliations`, `studies`, `analyses`) and nothing more? Coordinates
   (`points`, 5.1M rows) and analysis features (analyses per condition or task) are the obvious next
   ones, each with its own cost check; public studysets and annotations after that.
   *Recommendation: these eight now; analysis features next.*
2. **Which grammar to align with.** *Answered:* SoQL's `$` parameters.
3. **Auth for heavy queries.** Anonymous up to the cost gate (50,000) with per-IP rate limits, and an
   API key with `read` scope (already on master) raising the gate to 500,000 and giving its own rate
   bucket? *Answered:* yes.
4. **Usernames.** Most `users.name` values are people's real names from their identity provider
   (1,859 of 2,342 contain a space); the REST API already serves them as `username`. Serve them as
   REST does? One user's name is an email address (it contains `@`): their `username` would be null,
   so their studies are counted but under no name, and use case 5 (`username IS NOT NULL`) leaves them
   out. Or only serve names of users who have opted in?
   *Recommendation: as REST does, with a name containing `@` served as null.*
5. **Freshness.** Datasets refreshed nightly, so answers are up to a day old? *Answered:* yes.
6. **The meta label.** *Answered:* the neurostore study reflects the project's privacy, as an
   attribute of the project kept in sync (Needed first, item 3).
7. **What "updated studies" counts.** *Answered:* the public studies a user owns.

## Rejected

- **(b) A read-only SQL endpoint.** The experiment shows a role, views and a timeout leave the
  timeout itself, memory and multi-statement strings open (T5, T5b, T7), and the catalog readable
  (T9, T10). Closing them takes a SQL parser and a function allow-list, which is (a) with a far larger
  surface.
- **Live views as the datasets.** UC3 and UC4 took 1.0–5.5 s, every public query would read the tables
  the site writes to, and a compiler bug could reach every column of a view's base tables.
- **Fixed rollup endpoints alone** (`/stats/articles-per-year`, …). They answer the six use cases
  in under a millisecond but not the next question. Here they are columns of datasets, inside the
  grammar.
- **`security_barrier` views.** They are needed only where a caller can write an expression that raises
  an error on a filtered row. The grammar has no division or cast, and the materialized datasets hold
  no hidden rows. They cost UC3 2.7 s through bad estimates and JIT.
- **Running PostgREST, Hasura or an OData server beside Flask.** A second server, auth and
  deployment for a grammar that cannot express UC3 (PostgREST) or lacks group-by (Hasura). OData's
  `$apply` has no Python implementation.
- **SoQL's `col=value` shorthand, `$query`, and SODA3's SQL body.** Each is a second spelling of the
  same query; `$query` and the body are SQL text, with (b)'s problems.
- **A read replica now.** None exists; the role's connection limit, parallelism off and the timeout
  bound the load to four cores for 5 s, and the separate engine can point at a replica later.
- **A `meta` label on analyses.** It would duplicate the study's `level`.
