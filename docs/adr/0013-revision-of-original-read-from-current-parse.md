# 0013. The ingester accepts a revision of the original read from the current parse

Status: accepted, built (reversible while nothing is deployed)

## Context

A source loaded from a pipeline run can carry the pipeline's own revisions of the coordinate parse. neurostore stores those, and the paper's current parse is then the last of them. The review starts from that chain folded into one revision of the original parse (`coordinates.from_chain` in `store/backend/neurostore/review/core/coordinates.py`), because a review holds exactly one revision of the original and each analysis's `derived_from` may name only original keys ([ADR 0004](0004-derived-coordinate-verdicts.md)).

The ingester's `NOT_CURRENT` rule refuses stale work: a revision must revise the paper's current parse. A review's export revises the original, which is no longer current, so the rule refused it, and the export could not round-trip.

## Decision

The export stays a revision of the original parse. Its header inputs name the pipeline's revision as the parse it was read from. The ingester (`_revises_current` in `store/backend/neurostore/ingest/study_schema.py`) accepts a revision when either:

- it revises the current parse; or
- it revises a parse that the current one descends from, and its header inputs name the current parse among the coordinate parses it read.

Anything else is still refused as `NOT_CURRENT`.

## Consequences

- An export from a pipeline-revised source goes back through the ordinary upload path, and each analysis still says which originals it came from.
- "Current" now means "read from the current parse", not only "revises the current parse". Work read from an older parse is still refused, but the check depends on the header's inputs being truthful.
- Other producers of revisions can use the same rule: revise any ancestor of the current parse, as long as the current one is named as read.

## Rejected

- **Rebase the export onto the pipeline's revision.** `derived_from` can name only the originals of the parse revised, so where each analysis came from in the original would be lost.
