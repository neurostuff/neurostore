# 0004. Coordinate verdicts are derived from the reviewer's analyses

Status: accepted

## Context

study_schema expresses a coordinate edit as a revision of the coordinate parse: a new parse naming the one it revises, with a verdict for every original analysis (accept, relabel, split, merge, omit, add). The ingester checks the verdicts. Analyses are keyed by content, so editing a point changes the analysis's key. A reviewer can split, move points, edit a point and merge in any order.

## Decision

The review stores the reviewer's current set of analyses, each with `derived_from` naming the original analyses it comes from. It never stores verdicts. A verdict is computed when needed: no replacement means omit; one replacement with the original's own key means accept (or relabel if its role changed); one replacement shared with other originals means merge; otherwise split. There is one revision, of the original parse, so chained edits collapse: a split part edited again still splits the original. Export derives each analysis's verdict and reason from provenance and notes at write time (`coordinates.judged` in `store/backend/neurostore/review/core/coordinates.py`).

The extraction record follows the revision inside the same op: adding an analysis creates its Analysis entity, a key change re-points `source_table_analysis`, and a merge deletes the merged entities and reports the links left dangling.

## Consequences

- Any sequence of edits yields a revision the ingester accepts.
- Verdict wording can change without migrating stored data.
- Cost: a point edit that changes a key is a one-replacement split until study_schema has an `edit` verdict, and the derivation must be tested against every combination of operations.
- Coordinate ops move the record as well, so their inverses are server-given `restore` ops rather than computed by the client (ADR 0002).

## Rejected

- **Store a verdict per original analysis and update it per edit.** Each edit must be reconciled with earlier verdicts, and the combinations break the ingester's checks.
