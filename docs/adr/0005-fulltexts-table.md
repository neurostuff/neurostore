# 0005. Full texts live in a shared `fulltexts` table

Status: accepted (the backfill from the old columns is not yet built: neurostuff/neurostore#1844)

## Context

Evidence offsets index one exact rendering of a paper's text. neurostore kept no text apart from `BaseStudy.pubget_fulltext` and `ace_fulltext`, which are different renderings with different offsets, and the ingester kept only `text_sha256`. Duplicate base studies of one paper must each be able to hold the text. Putting text on `base_studies` would widen a table that is listed and searched constantly.

## Decision

`fulltexts` (`store/backend/neurostore/models/fulltext.py`) holds one row per rendering, unique per `(base_study_id, sha256)`, with `source` and `source_version` from the ingestion workflow. A review source points at the row whose sha256 its record carries, and reaches its base study only through that row, so two paths cannot disagree.

`BaseStudy.fulltext_id` points at the preferred row for everyone else. Its key, `(fulltext_id, id) → fulltexts(id, base_study_id)`, makes that row one of the base study's own; it is checked at commit, so a full text can move to another base study and both pointers be refreshed in one transaction, and deleting the row clears only `fulltext_id`. The preference lives in code (`FULLTEXT_SOURCE_PREFERENCE`): publisher XML, then ace, then pdf, newest first, then the smaller id. Mapper listeners (`models/fulltext_listeners.py`) recompute the pointer only when a row is added, removed or moved to another base study. The relationship is `lazy="raise"` and view-only, so listing or serializing base studies cannot load text.

## Consequences

- Reviews are stable: a better rendering arriving later does not move any offset.
- Text is served only through `/api/review`, to `admin-reviewer`.
- The ORM listeners keep the pointer and hash correct; a bulk or Core insert skips them and must recompute pointers explicitly.
- Cost: the old columns remain and are still read until a backfill and reader switch is done. Two stores of text coexist until then.

## Rejected

- **Store a tier per row.** It only mirrored a fixed source-to-tier map, and every new source needed a lookup entry. The preference in code replaces it.
- **Text on `base_studies`.** It widens a hot table and reintroduces the offset ambiguity.
