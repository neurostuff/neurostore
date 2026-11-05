# 0019. Analyses are queried through features resolved at ingest

Status: accepted, built

## Context

A meta-analysis pools analyses, chosen by what their papers' extraction records say: the diagnosis of the groups, the task, the two sides of the contrast, whole brain or not, the study design. A record analysis names those things by local id (`measure: "mea_bold"`, `groups[].group`, `tasks[]`, cells through the model's factor levels to conditions), so no single row answers them. `feature_filter` runs a jsonpath over the whole stored record per filter: it cannot follow the ids, two `analyses[]` filters need not match the same analysis, and it returns studies. Measured on 100 local records (88 KB compressed, 370 KB raw each), one jsonpath took 168 ms, about 100 s at the corpus's 61k records; fetching and decoding the records for a query in Python would take about 13 minutes. Queries have to answer in under a second.

## Decision

The ingester resolves each record analysis once, at upload, into a row of `analysis_features` (`neurostore/ingest/analysis_features.py`): one row per analysis of the paper's current pipeline Study whose key the paper's latest record describes, written from that record; the inverse half of a sign split takes its original's row with the contrast's sides swapped. Every upload rewrites the paper's rows, a merge rewrites the keeper's, and `manage backfill-analysis-features` rewrites them all. Columns are typed (text, arrays of ids and of study_schema enum values, booleans, `n`), NULL where the record says nothing, with B-tree, GIN and trigram (`pg_trgm`) indexes. The record's own wording, for results and annotation columns, is in `analysis_feature_displays`, so scans read only what they filter on.

`POST /analysis-queries/` (`neurostore/analysis_query.py`) compiles a query to one SQL condition over that table: criteria combine with AND, a list or `any` is OR, `all` and `none` are AND and NOT within a field, `or` takes sub-queries, and `when_silent` on each criterion says whether an analysis the record is silent about matches. Text matches whole words with `*` and `?` wildcards and needs three consecutive letters or digits; species and other enum-valued fields match exactly. The response has the counts, every selected study id and the first `limit` analyses; with `funnel`, also each criterion's kept, dropped and silent counts, one indexed count per criterion. `PUT /annotations/{id}` takes `analysis_query` to write the selection (a boolean column, `included` by default) and chosen features into the notes, which Compose's `filter` reads.

## Consequences

- Measured on 950k rows (the resolver's output for 100 real records, copied at random, with zipf-distributed MONDO and task ids), local pg17 with 128 MB shared_buffers, warm: diagnosis, task, contrast, design, silent-inclusive, `none`/`all` and `or` queries in 5–196 ms, a broad one (whole brain, BOLD, human: 275k analyses) in 648 ms. With the funnel, 340–685 ms, except where an early criterion keeps most of the table (2.3 s for the broad query, 2.9 s for `none` over diagnoses), since each step counts what it keeps.
- A resolver change needs the backfill; the rows are derived, never edited.
- Features come from the latest record only. Curators' field claims are not read yet.
- `analysis_features` is served, unlike the truth layer it is read from (`tests/test_truth_layer.py`).

## Rejected

- **Extending `feature_filter`.** No id resolution, filters not bound to one analysis, studies not analyses, ~100 s per filter.
- **A jsonpath over `pipeline_analysis_results`.** Binds criteria to one analysis but cannot reach measures, groups or tasks.
- **One JSONB features document per analysis.** 2x slower on broad queries in the prototype, larger, and its keys would not be the query's vocabulary.
- **The display values in the features table.** It was 1085 MB against 382 MB without them, and broad counts read every page.
- **The funnel as one pass with a FILTER per step.** It ran every text pattern on every row (9.5 s); with the patterns as joined match sets it no longer did, but the pass itself read the whole table for every query (1.2–2 s), and joining those sets into the selection defeated its bitmap OR (50 ms to 500 ms).
- **The funnel on every response.** It is most of a broad query's cost; it is there when asked for.
- **Implicit filters** (whole brain only, human only), as pondie's `Selection` defaults: an API that drops ROI analyses unasked surprises; the response echoes the whole canonical query instead.
