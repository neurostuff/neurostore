# Architecture decision records

Decisions behind neurostore's /review app and its base studies that are hard to reverse, surprising without context, or real trade-offs. The current design is in [../review/DESIGN.md](../review/DESIGN.md), and the glossary of terms in [../review/CONTEXT.md](../review/CONTEXT.md).

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-edit-log-not-edited-documents.md) | A review is an append-only edit log, with the edited documents as a cache | accepted |
| [0002](0002-server-applies-structural-and-coordinate-ops.md) | Structural and coordinate ops are applied only on the server | accepted |
| [0003](0003-offsets-are-code-points.md) | Character offsets are Unicode code points; the front end converts at the boundary | accepted |
| [0004](0004-derived-coordinate-verdicts.md) | Coordinate verdicts are derived from the reviewer's analyses, never stored | accepted |
| [0005](0005-fulltexts-table.md) | Full texts live in a shared `fulltexts` table with a code-side source preference | accepted, backfill not built (#1844) |
| [0006](0006-json-schema-beside-openapi.md) | JSON Schema 2020-12 body contracts beside an OpenAPI 3.0 spec with no operationIds | accepted |
| [0007](0007-restrict-delete.md) | A paper with a review source cannot be deleted (RESTRICT) | accepted |
| [0008](0008-provenance-wrapper.md) | Provenance travels in a wrapper beside the record, never inside it | accepted |
| [0009](0009-stable-entity-ids.md) | Entities get a neurostore-minted stable id, kept on the StudyEntity; a rename does not re-hash | accepted, built |
| [0010](0010-one-reference-review.md) | At most one reference review per source, enforced by a partial unique index | accepted |
| [0011](0011-core-app-layering.md) | The review package is a pure `core/` and an `app/` layer, sharing typed errors in `review/errors.py` | accepted, built |
| [0012](0012-offline-queue-one-tab-per-review.md) | Unsaved ops are kept in IndexedDB, and a Web Lock lets one tab edit a review | accepted, built |
| [0013](0013-revision-of-original-read-from-current-parse.md) | The ingester accepts a revision of the original parse that names the current parse as read | accepted, built |
| [0014](0014-spec-generates-every-api-type.md) | Every API type is generated from the spec; batch bounds live only in the served contract | accepted, built |
| [0015](0015-base-study-identifiers.md) | Every article id of a base study is one row, unique across active base studies, resolved by one query | accepted, built |
| [0016](0016-base-study-search-bm25.md) | Base-study text search runs on BM25 indexes inside Postgres (ParadeDB's pg_search) | accepted, built |

Each file has Status, Context, Decision and Consequences, and names what was rejected.
