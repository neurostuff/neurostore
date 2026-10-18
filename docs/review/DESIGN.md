# /review: current design

This describes /review as it is built, for a maintainer new to the code. The reasons behind the decisions that are hard to reverse are in the ADRs ([../adr/README.md](../adr/README.md)). The words used here (paper, source, bundle, record, revision, verdict, provenance and so on) are defined in the glossary ([CONTEXT.md](CONTEXT.md)).

A reviewer walks a paper in six steps: Coordinates, Analyses, Entities, Leftovers, Relationships and Submit (`src/model/steps.ts`). Each step has a one-line hint, a count of what it asks the reviewer to judge, and a way on to the next step once that count is complete.

## What it is and who uses it

neurostore.org/review is a separate reviewer app. People holding the `admin-reviewer` role use it to correct what the extraction pipeline read from each paper. The paper's full text is shown beside the record, with each claim's evidence highlighted in it.

A paper under review is three study_schema documents: the parsed paper (text, sections, tables), the coordinate parse (points grouped into analyses keyed by content), and the extraction record (entities, slot values, evidence spans, references between entities). A reviewer can accept, reject or edit slot values, entities, references, evidence spans, and the coordinates and how they are grouped. Every change is attributed to the reviewer and can carry a note.

| Who | Can |
| --- | --- |
| Reviewer (`admin-reviewer`) | open any loaded paper; write their own review; assign themselves a paper; read other reviewers' reviews; export |
| Lead (`admin-reviewer` and `admin`) | everything above, plus load papers and pipeline runs, assign papers to anyone, and mark a review as the reference |
| Anyone else | nothing: the API answers 403, and nothing a reviewer writes reaches the public API |

The role check is `user_has_role(user, "admin-reviewer")` in `store/backend/neurostore/resources/review.py` (`_reviewer`, `_lead_reviewer`). Reviews never change the public truth layer (`FieldClaim` and related tables). Promotion of a reviewed record into it is designed but not built.

## Where the code is

| Part | Path |
| --- | --- |
| Pure review core (no database, no HTTP) | `store/backend/neurostore/review/core/` |
| App layer (session, models) | `store/backend/neurostore/review/app/` (`service.py`, `imports.py`, `exports.py`, `zip_stream.py`) |
| Typed errors | `store/backend/neurostore/review/errors.py` |
| Body contracts (JSON Schema 2020-12) | `store/backend/neurostore/review/schema/` |
| HTTP views | `store/backend/neurostore/resources/review.py` |
| Route table | `store/backend/neurostore/resolver.py` (`REVIEW_HANDLERS`) |
| Path constants | `store/backend/neurostore/paths.py` |
| Models | `store/backend/neurostore/models/review.py`, `models/fulltext.py`, `models/fulltext_listeners.py` |
| Migrations | `store/backend/migrations/versions/c5d8e2f4a6b1_add_review_tables_and_fulltexts.py`, `d4b7e1f9a3c2_index_base_studies_fulltext_id.py`, `f2b4d6e8a0c3_add_study_entity_stable_id.py` |
| CLI | `store/backend/neurostore/cli.py` (`review-import`, `review-import-run`, `review-export`) |
| Front end | `store/review-frontend/` (Vite, React 19, MUI, zustand), served under `/review/` |
| Shared theme | `packages/neurosynth-theme/` |
| Shared coordinate grid | `packages/coordinate-table/` (`README.md` there) |

## Data model

All tables live in neurostore's database. None is read by the public API.

| Table | One row per | Main columns |
| --- | --- | --- |
| `fulltexts` | rendering of a paper's text | `base_study_id`, `source`, `source_version`, `sha256`, `text`; unique `(base_study_id, sha256)`; `ck_fulltexts_source` |
| `review_sources` | extraction of a paper loaded for review | `fulltext_id` (RESTRICT), `parsed_paper`, `coordinate_parse`, `coordinate_revision` (a pipeline's, or null), `record`, `judgeable_keys`, `pipeline_config_id`, `run_id`, `record_sha256`, `loaded_by_id`; unique `(fulltext_id, record_sha256)` |
| `reviews` | reviewer and source | `source_id`, `user_id`, `state`, `record`, `coordinate_revision`, `provenance`, `annotations`, `last_seq`, `last_edit_at`, `set_aside_reason`, `set_aside_note` |
| `review_ops` | stored op | `review_id` (CASCADE), `seq`, `client_op_id`, `op`, `before`, `after`; unique `(review_id, seq)` and `(review_id, client_op_id)` |
| `review_assignments` | reviewer assigned to a paper | `base_study_id` (CASCADE), `user_id`, `assigned_by_id` |

**Full texts** (`models/fulltext.py`, [ADR 0005](../adr/0005-fulltexts-table.md)). Evidence offsets index one exact rendering of a paper's text, so a source points at the `fulltexts` row whose sha256 its record carries, and reaches its base study only through that row. `BaseStudy.fulltext_id` (`models/data.py`) points at the preferred row for everything else, ranked by `FULLTEXT_SOURCE_PREFERENCE` (publisher XML, then ace, then pdf), then newest, then smaller id. Mapper listeners in `models/fulltext_listeners.py` recompute the pointer when a row is inserted, deleted or moved to another base study. `BaseStudy.fulltext` is `lazy="raise"` and view-only, so listing base studies cannot load text. The legacy `pubget_fulltext` and `ace_fulltext` columns are still there and still read elsewhere; the backfill is not built (see the follow-ups).

**Sources.** A source is immutable once loaded. Its origin is derived, not stored: `ReviewSource.origin` is `pipeline_run` when both `pipeline_config_id` and `run_id` are set, otherwise `upload`. `judgeable_keys` is written at import: one key per extracted slot and one per coordinate analysis. The paper list reads it to compute percent reviewed without loading the record.

**Reviews.** A review belongs to one user and one source (`uq_reviews_source_user`). Its states are `in_progress`, `submitted`, `reference` and `set_aside` (`REVIEW_STATES`, `ck_reviews_state`). The owner moves between in_progress and submitted, and between in_progress and set_aside (`OWNER_TRANSITIONS` in `review/app/service.py`). Only in_progress takes ops. A lead marks the reference, from in_progress or submitted. The reference state is terminal, and a partial unique index allows one per source ([ADR 0010](../adr/0010-one-reference-review.md)). A set-aside review carries a reason (`SET_ASIDE_REASONS`), and `ck_reviews_set_aside` ties the reason to the state.

**Delete protection** ([ADR 0007](../adr/0007-restrict-delete.md)). `review_sources.fulltext_id` is `ON DELETE RESTRICT`, so a base study with a source cannot be deleted. `DELETE /base-studies/{id}` answers 409 instead, with `under_review` as a detail field of the 409 body.

**Assignments** are per paper (base study), not per source. A reviewer assigns or releases themselves, and a lead may assign anyone who holds the role (`service.assign`, `service.release`).

**Stable entity ids** ([ADR 0009](../adr/0009-stable-entity-ids.md)). `study_entities.stable_id` (`StudyEntity.stable_id` in `models/data.py`, unique, backfilled by migration `f2b4d6e8a0c3`) is a UUID that every record entity carries as study_schema's `stable_id`. It lets the ingester link an entity across renames and re-runs.

## The op engine and the edit log

A review is an append-only log of typed ops, with the edited documents kept beside it as a cache ([ADR 0001](../adr/0001-edit-log-not-edited-documents.md)). The op types are in `review/schema/review-ops.schema.json`:

| Op | Targets | Applied by |
| --- | --- | --- |
| `verdict` | slot, entity, relationship or coordinate analysis: accept or reject, with a reason | client and server |
| `set_value` | slot: value, extraction status, value source, unreported reason | client and server |
| `set_evidence` | slot: the whole evidence record after the change | client and server |
| `note` | anything, or the paper | client and server |
| `create_entity`, `delete_entity` | an entity in a list | server only |
| `link`, `unlink` | a reference slot | server only |
| `coordinate` | `relabel`, `edit_points`, `split`, `merge`, `add`, and the server-given `restore` | server only |

The client-applied set is `LOCAL_TYPES` in `store/review-frontend/src/model/applyOp.ts` ([ADR 0002](../adr/0002-server-applies-structural-and-coordinate-ops.md)).

**Layering** ([ADR 0011](../adr/0011-core-app-layering.md)). `review/core/` takes documents and returns documents. `review/app/` reads and writes them through the session. Both raise the `ReviewError` subclasses of `review/errors.py` (`NotFound`, `Conflict`, `Refused`, `Unprocessable`; `LayoutError` in `core/layout.py` is an `Unprocessable`). `review_http_error` in `exceptions/handlers.py` maps them to the ErrorResponse shape, and `cli.py` catches them for the CLI. `tests/review/test_layering.py` fails if anything under `core/` reaches flask, connexion, starlette, sqlalchemy, `neurostore.models`, `neurostore.exceptions`, `neurostore.database` or `review.app`.

**`apply_batch`** (`review/core/ops.py`):

```python
apply_batch(state, batch, *, text, user_id, at, stable_ids, validate=incremental_problems)
```

It copies `state` once, applies the ops in order, and returns the new state with the stored ops, each with its `before` and `after`. The input is never changed. If any op fails, or the result does not validate, it raises an `OpError` naming each failing op. Only when validation fails does it replay the ops to find the first one that leaves an invalid document. The 422 then carries `op_index` and `client_op_id` in each error's context.

**Incremental validation** (`review/core/validation.py`). `incremental_problems` validates only what a batch changed: the parts of changed entities, created entities, list membership, and the coordinate revision diffed against the one it replaced. It relies on the starting documents being valid. `start_review` checks that once, by validating the source in full and refusing with 409 `source_invalid` (`service._check_source`). `full_problems` validates whole documents. It is the oracle that `tests/review/test_incremental_validation.py` compares against.

**Writing a batch** (`service.post_ops`):

1. It locks the review row (`FOR UPDATE`).
2. If every `client_op_id` is already stored, it replays the stored result with no change. If only some are, it answers 409.
3. It refuses a review not in in_progress, and an `expected_last_seq` other than `last_seq` (409 with the current `last_seq`).
4. It calls `apply_batch`, stores the ops with the next `seq` values, rewrites `record`, `coordinate_revision`, `provenance` and `annotations`, and sets `last_seq` and `last_edit_at`.

The op result (`_op_result`) returns the stored ops, each with its inverse ops (`inverse_ops`; a note has none), the record, the revision, provenance, annotations, the hidden set and the entity index. The client never has to refetch the bundle to stay right.

**Batch bounds.** A batch has 1 to 500 ops, and only `review-ops.schema.json` says so. The core refuses an empty or oversized batch with a 422 ([ADR 0014](../adr/0014-spec-generates-every-api-type.md)). Review request bodies are capped at 8 MiB, and imports at 200 MiB, by `resources/body_limit.py` before the route reads the body. nginx's `location /api/review/imports/` matches the import cap, and `tests/review/test_nginx.py` checks it.

**Provenance** (`reviews.provenance`) records, per target key, whether a person verified, edited, added or removed it. An accept never downgrades edited or added to verified. Evidence on an entity or relationship (which study_schema cannot hold) goes to `reviews.annotations`.

**Entity ids in ops.** An op addresses a slot by its entity's `local_id` plus a field path (`review/core/paths.py`). The client sends positional selectors (`groups[#0].n`), and the server also accepts key selectors. A `create_entity` without a `local_id` gets `rv_` plus 12 hex characters of sha256(client_op_id). The server always mints a new entity's `stable_id` (`review/core/stable_ids.py`, `Guard`). An op that sets or restores a stable_id the review has never held is refused, and so is an op that edits `stable_id` as a slot.

**Hidden set** (`review/core/bundle.py`, `hidden`). An analysis is non-coordinate when its `source_table_analysis` is missing, not reported, absent from the current revision, or rejected. Such analyses, and every entity only they reach, are hidden by default. The set is recomputed for every bundle and every op result.

## Coordinates

All of this is in `review/core/coordinates.py` and `review/core/record_follow.py`.

**One revision of the original parse** ([ADR 0004](../adr/0004-derived-coordinate-verdicts.md)). The review keeps the reviewer's current analyses, each with `derived_from` naming the original analyses it comes from. Coordinate ops target an analysis by its key in that revision. The server computes every key with study_schema's key rule, and the client never does.

**Verdicts are derived, never stored.** For each original analysis: no replacement means omit; one replacement with the original's own key means accept, or relabel if its role changed; one replacement shared with other originals means merge; anything else is a split. Accepting and rejecting go through the `verdict` op only, never the `coordinate` op. `coordinates.judged` builds the exported revision. It takes each verdict and reason from provenance and notes, writes a rejected original as omit, and gives an unchecked original accept with "not judged by the reviewer". A key-changing point edit with one replacement is exported as `edit`.

**The record follows the revision** inside the same op (`record_follow.py`). Adding a result analysis creates its Analysis entity. A key change re-points `source_table_analysis`. A split copies the entity for each extra part, and a merge deletes the merged entities and reports the links left dangling. The inverse of a coordinate op is a server-given `restore`, which is refused if anything it would overwrite has changed since.

**Pipeline chains.** A source loaded from a pipeline run can carry the pipeline's own revisions of the parse. `coordinates.from_chain(parse, revisions)` folds that chain into one revision of the original parse, read from the last one. Each original takes the reason of the last revision that changed it. The fold is stored as `review_sources.coordinate_revision`, and a review starts from it. Authorship (original, model or reviewer) is derived for display in `store/review-frontend/src/model/authorship.ts`.

## Import, export and the ingest round trip

Both directions use study_schema's layout (`review/core/layout.py`):

| Path | Contents |
| --- | --- |
| `corpus/<id>/parse/parsed_paper.json`, plus the text at its `text_path` | the parsed paper and text, unchanged |
| `corpus/<id>/parse/coordinate_parse.json` | the original parse, unchanged |
| `run/revisions/<id>.coordinate_parse.json` | the revision, only when coordinates changed or were judged |
| `run/records/<id>.extraction.json` | the record as edited |
| `run/provenance/<id>.json` | the provenance wrapper ([ADR 0008](../adr/0008-provenance-wrapper.md), `review/schema/record-provenance.schema.json`) |
| `review/<id>.ops.jsonl` | the op log in seq order, rejections included |

`<id>` is the parsed paper's `header.article_id`, and an export without one fails. A second source of the same paper in one tree is written as `<article_id>~<source_id>`.

**Import from files** (`imports.import_layout`; `neurostore review-import PATH --user-id`, or `POST /review/imports/` for leads). Each paper is checked on its own by `layout.check_paper`: schemas, text hash, span texts, and content keys (positional keys are refused). A paper that fails is reported with its reasons, and the others still load, each in its own SAVEPOINT. A paper is matched to an existing base study by `find_base_study` (`neurostore/base_studies.py`), and import never creates one. A text already stored for the base study with the same sha256 is reused. Sources deduplicate on a digest of the record without its stable_ids, or, for a review's exported wrapper, of the record plus the wrapper, so an unedited review keeps its reviewer (`imports._build_source`).

**Import from a pipeline run** (`imports.import_pipeline_run`; `review-import-run --config-id --run-id --user-id`, or `POST /review/imports/pipeline`). neurostore holds a run's records and parses (`PipelineStudyResult`) but not the parsed papers or texts, so those come as an uploaded layout, and a text whose hash differs from the run's is refused. Stored-parse lookups are in `neurostore/stored_parses.py`.

**Stable ids at import** (`imports._with_stable_ids`). An entity keeps the stable_id it carries. Otherwise it takes the id of the StudyEntity that the run's `ExtractionEntityLink` points to, or else a new UUID.

**Export** (`exports.export_review` for one review, `exports.export_bulk` for a filter; `review-export`, `GET /review/reviews/{id}/export`, `POST /review/exports/`). Bulk export writes one tree per reviewer under `<user_id>/`, and unreviewed sources under `unreviewed/` when asked. The HTTP response streams the zip (`review/app/zip_stream.py`). An unedited export gives back the imported documents as equal JSON and the text byte for byte.

**The ingest round trip.** An exported record and revision go back into neurostore through the ordinary ingester (`neurostore/ingest/study_schema.py`):

- **Stable ids.** The ingester links an entity carrying `stable_id` to that StudyEntity before it tries the identity hash (`_match_level` in `ingest/study_entities.py`), and refuses repeated ids (`STABLE_ID_REPEATED`) or ids belonging to another paper or class (`STABLE_ID_MISMATCH`). An entity linked this way keeps its old identity hash, so a rename does not split its claims.
- **Revisions of a pipeline-revised source** ([ADR 0013](../adr/0013-revision-of-original-read-from-current-parse.md)). The exported revision revises the original parse, and its header inputs name the pipeline's revision as the parse it was read from. `_revises_current` accepts it when the paper's current parse descends from the one revised and is named among the inputs. Otherwise it is refused as `NOT_CURRENT`.

## Front end

`store/review-frontend/`, served under `/review/` (`vite.config.ts` `base`). It reuses the main site's Auth0 session. In development the main app's dev server on port 3000 proxies `/review/` to this one on port 3001 (`store/review-frontend/README.md`).

**Two stores per paper** (`src/store/reviewStores.ts`):

- `sessionStore.ts` holds what the server and saving see: the bundle, record, provenance, annotations, entity index, stored ops, pending ops with their groups and evidence intents, the save and device states, the blocked-save state and the undo stacks. Its mutators (`emit`, `emitBatch`, `addEvidence`, `moveEvidence`, `removeEvidence`, `confirm`, `rebase`, `restore`, `undo`, `redo`) all pass one edit guard, so a read-only tab cannot edit.
- `viewStore.ts` holds one reviewer's view: focus, the guided step, panels, the outline, palette and help, the coordinate focus, and toggles (show all evidence, non-coordinate analyses, the diff). Derived values come from `viewSelectors.ts` and `diffSelectors.ts`.

Pure logic lives in `src/model/`, with no React and no stores. `src/layering.test.ts` checks the direction of imports between `store/`, `model/` and `api/`.

**opClient** (`src/store/opClient.ts`). It saves pending ops about a second after an edit (`DEBOUNCE_MS`), in leading whole groups of at most `BATCH_MAX_OPS` ops, and a group from one `emitBatch` is never split. It retries network errors, 5xx and 429 with backoff up to 30 s. A 401, 403 or 404 stops saving with the ops kept. A stale 409 makes the session rebase onto a fresh bundle. The replay in `keptOps.ts` rebuilds each evidence edit from its intent, so evidence another tab added survives. A 422 naming ops marks those ops refused. A 422 naming none blocks saving, and a banner offers to undo, discard or download (`src/review/BlockedSave.tsx`). When the page is hidden it flushes with keepalive, in batches under 60 KiB.

**The offline queue and its tab lock** ([ADR 0012](../adr/0012-offline-queue-one-tab-per-review.md)). `src/store/reviewSession.ts` takes a Web Lock named `neurostore-review:<review id>`. A second tab that cannot take it opens read-only, still browsable. The tab holding the lock keeps its pending ops, groups and intents in IndexedDB (`src/store/deviceQueue.ts`, database `neurostore-review`, `QUEUE_VERSION`). It writes at most every 250 ms, and at once on hide or close. On load the kept ops are restored through the same replay the 409 rebase uses. A queue from another version is dropped with a notice. Where IndexedDB fails, the tab edits in memory and says so.

**Code points at one seam** ([ADR 0003](../adr/0003-offsets-are-code-points.md)). `src/model/offsets.ts` converts offsets: `spansToUtf16` when a bundle is read (`sessionStore.ts`), and `spansToCodePoints` when ops are sent (`opClient.ts`). The stored op history (`ops`) stays in code points.

**Generated types.** `npm run gen:types` (`scripts/gen-types.mjs`) writes `src/contract/generated/`. `review-api.ts` comes from the OpenAPI spec's review components, and `review-bundle.ts` and `review-ops.ts` (with `BATCH_MIN_OPS` and `BATCH_MAX_OPS`) from the JSON Schemas. Nothing in the generated files is edited by hand, and `npm run check:types` fails if they are stale or untracked. At run time the app fetches study_schema's extraction-record and coordinate-parse schemas from `GET /api/review/schemas/{name}`. It builds the slot editors and point editors from them, and reads reference slots from their `x-reference` annotations (`src/contract/references.ts`).

**Slot order.** An entity's slots are listed in the order its class declares its properties in the served extraction-record schema (`slotRank` in `src/model/schema.ts`, applied by `inSchemaOrder` in `src/model/record.ts`); inside a list, item by item, each item's slots in its own class's order. Declared slots the record leaves out are listed in their place, unset. Doubt (evidence not found, a value generated, a not-reported value that is ambiguous) is a marker on the slot (`StatusLabel`), never a sort key. The served order is alphabetical until study_schema keeps its LinkML order; `src/test/golden/schemaOrder.test.ts` is skipped until the golden schema copy is in that order, then runs without an edit.

**Slot and item names.** A slot is named by its property's name in words, a list item's slot by the item then the property (`labelOf` in `src/model/labels.ts`). An item is named by its own name, label, caption or source label (`nameIn` in `src/model/record.ts`, the one rule for every name slot), else by the entities it refers to through another slot, else by its list and place (`Cell 3`). Where two items of one list would get the same name, each takes its place after it (`diagnosis · cell 1`, `diagnosis · cell 2`).

**The text pane and highlights** (`src/text/`). `model/layout.ts` splits the text into blocks: section headings from `#` markers, and tables found as a line equal to the table's label followed by tab-separated rows. `TextBody.tsx` renders the text once. Highlights are CSS Custom Highlight API ranges (`text/highlights.ts`, `useHighlights.ts`), so changing focus changes only which ranges are registered, never the DOM. The focused item's spans are filled, other evidence is underlined, and the original's spans are dashed in the diff. A focused reference field fills every span of the entities it references that are not hidden, in reading order (`selectFocusedSpans`, worked out once per index and field), and `]` and `[` step through them; the handles, remove control and span keys still act only on a value field's own spans. `TextIndex.ts` maps offsets to DOM ranges and skips the cards set beside blocks. `SpanTicks.tsx` marks focused spans on the scrollbar. `SpanHandles.tsx` and `snap.ts` move a span by its handles, snapping to word edges. A move or removal is one `set_evidence` built from a replace intent. Selected text is added with one action, the selection bar's "Add as evidence for <field>" or `e` (`text/addSelection.ts`, D103): a field's evidence is one passage the reviewer adds sentences to, so the span goes to the set holding the evidence cursor's span when the cursor is on that field, else to the field's first set, and a field with no evidence gets its first. Records an extractor gave several sets still load, show every span and step through them with `]` and `[`; the UI never names a set. A plain click on highlighted text focuses the one field it supports, or lists them in `SupportMenu.tsx`, grouped by entity with the focused field first and capped in height; a click that ends a selection does neither, and a selection closes the menu, so it never covers the selection bar.

**The coordinates step** (`src/coordinates/`). Each analysis has a card beside the table or paragraph it is read from (`CoordinateAside.tsx`), and the focused one is in the inspector (`CoordinatesInspector.tsx`). Whether a toolbar action, its key and its panel apply to the focus is read from one table, `COORDINATE_UNAVAILABLE` in `coordinates/availability.ts`, which also gives the disabled button's tooltip. The add-analysis bar under the inspector (`AddAnalysisChooser.tsx`) adds an analysis to a table, or from the selected text, which the selection bar also offers. A text analysis is added with the selection as its span and the x, y and z printed there as its first point, or with no points as a null result, whose record Analysis then gets its outcome and spatial scope once the server has made it. Renaming an analysis from its card, the inspector, the Edit analysis form or its record Analysis's name slot sends one batch, `renamePair` in `coordinates/actions.ts`: the record names' `set_value`s and the analysis's `edit_points`, so one undo restores both.

**The point grid** (`coordinates/PointsTable.tsx`, over `packages/coordinate-table`). The focused analysis's points are a Handsontable 18 spreadsheet of compose's CBMA columns, mapped to the coordinate-parse schema's point fields (`coordinates/pointRows.ts`). A focused analysis's points first show as a plain read-only table laid out as the grid is (`StaticTable`, from `@neurosynth/coordinate-table/static`, which loads no Handsontable), so moving the focus draws no grid. A click, Enter, a typed character, a paste or the table's add and delete buttons mount the grid in its place (`coordinates/PointsView.tsx`), and the grid carries on what began there: the cell selected, the character in its editor, the paste, the row added. Once mounted the grid stays, hidden while another analysis's table shows, and an edit still open is committed when it is hidden; the view store's `gridEngagement` says whether it is shown, and an op result that replaces the focused analysis keeps it shown. The grid and Handsontable are a chunk of their own, fetched as soon as the review loads. Each committed change (a cell edit on Enter or blur, a paste, a fill, a row added or deleted) is one `edit_points` carrying the whole point list. Nothing is sent while a cell is invalid. Coordinate ops are applied by the server only, so until the result lands the grid shows what was sent and takes no edits, and a refusal brings the analysis's points back.

**Where a coordinate focus is in the text** (`model/coordinateFocus.ts`, `coordinateSpans`). The focused point, or every point of the focused analysis, is found by the first of three steps that finds anything: the spans the analysis carries (each point's text span or table row, and the analysis's own spans); then where the record reports it (the evidence of its `coordinate_sets` entry, keyed by its key or an original's, else the spans of the record Analysis naming it); then, for a text analysis only, the text printing the point's x, y and z. A card with no span says that its source sentence is unknown and how to add it.

**Step counts** (`src/review/stepCount.ts`, `selectStepProgress`). One selector gives a step's `done`, `total`, `text` (`1 of 3`, empty for Submit) and `complete`; the step bar, a step's card list heading and the Next prompt all read it, and it returns the same object while the index, bundle and provenance are the same. A step counts what it asks the reviewer to judge and never a hidden analysis, whether or not the view shows them: Coordinates, the analyses with points; Analyses, Entities and Leftovers, their cards; Relationships, the links the audit shows. Submit has no count and is never complete.

**The relationships step** (`model/guided.ts` `auditMatrix`, `review/RelationshipAudit.tsx`). Rows are the analyses; the columns are grouped by the class that the analyses' own reference slots (`acquisitions`, `tasks`, `measure` and so on) link to. A cell links or unlinks through the analysis's slot for that class, and a row's Accept judges the links it holds. Two kinds of pair are left out: links inside a list item (`groups[#].group`, `effect.cells[#].term`), because a cell can set a slot but not add or remove the item that holds it, and analysis-to-analysis links (`mirror_of`), which relate analyses to each other rather than to something one uses. Every analysis declares a slot for every column, so a cell is never without one.

**Hints.** A control mounted once has its hover hint in a MUI tooltip (`review/Hint.tsx`), which describes the control and never names it; a control mounted at each focus (the buttons beside the focused field and on the card head) and plain text use the native `title`, because a tooltip on each costs a few milliseconds per focus. An action's hint names its key, or, while it is disabled, says why it does not apply (the two availability tables, `inspector/availability.ts` and `coordinates/availability.ts`, share the `Reason` type of `review/reason.ts`).

**Screens.** `src/pages/PaperListPage.tsx` is the paper list, with assignees, each reviewer's progress and an "assigned to me" filter. `src/pages/ReviewPage.tsx` holds the review screen (`src/review/`): guided steps 1 to 6 (`GuidedSteps.tsx`, `model/guided.ts`), the coordinates step (`src/coordinates/`), the inspector (`src/inspector/`), the outline rail, the Ctrl+K palette, the diff against the original (D) and the submit summary. `?` shows the keyboard shortcuts (`review/shortcuts.ts`). The text pane and the inspector sit either side of a divider (`review/SplitPanes.tsx`), a separator whose value is the text pane's share of the width, 60% at first: dragging it writes the `--text-share` CSS variable on their container once an animation frame and sets the share when the drag ends, so neither pane renders again as it moves; the arrow keys move it 2% (Shift 10%), Home and End to the limits, and a double click back to 60%. The text keeps at least 30% and the inspector 320 pixels, the text's floor winning where both cannot hold, and a ResizeObserver on their container applies the limits again to the share kept when it is resized. The shortcuts leave a separator its arrows, Home and End (`SEPARATOR` in `review/shortcuts.ts`). Each reviewer's share is kept in localStorage on the device (`review/paneShare.ts`, through `review/kept.ts`, which also keeps the dismissed step hints). The span ticks and handles measure again on a resize through their ResizeObserver, and the highlights are DOM ranges that reflow with the text.

## API routes

Every route is under `/api/review/` (`REVIEW_PATH_PREFIX` and `REVIEW_URL_PREFIX` in `neurostore/paths.py`) and needs `admin-reviewer`. The spec carries no operationId. `ReviewResolver` maps each path to its view through this table in `resolver.py`, and a test checks that every spec operation resolves.

| Method and path | Handler | Does |
| --- | --- | --- |
| `GET /review/sources/` | `ReviewSourcesView.search` | page of sources with each reviewer's progress and the assignees; `mine`, `assigned`, `base_study_id` |
| `GET /review/sources/{id}/bundle` | `ReviewBundlesView.get` | one paper's bundle for the caller |
| `PUT /review/sources/{id}/review` | `SourceReviewsView.put` | starts the caller's review (201, or 200 if it exists) |
| `GET /review/reviews/{id}` | `ReviewsView.get` | reads any review |
| `PATCH /review/reviews/{id}` | `ReviewsView.patch` | changes its state (set aside with a reason) |
| `POST /review/reviews/{id}/ops` | `ReviewOpsView.post` | applies a batch of the owner's ops |
| `GET /review/reviews/{id}/export` | `ReviewExportView.get` | one review as a layout zip |
| `POST /review/exports/` | `ReviewExportsView.post` | bulk export for a filter, streamed |
| `POST /review/imports/` | `ReviewImportsView.post` | loads papers from a layout zip (leads) |
| `POST /review/imports/pipeline` | `ReviewPipelineImportsView.post` | loads a pipeline run, with its papers as a layout zip (leads) |
| `GET /review/schemas/{name}` | `ReviewSchemasView.get` | extraction-record, coordinate-parse, review-bundle or review-ops, with an ETag |
| `GET /review/base-studies/{id}/assignments` | `ReviewAssignmentsView.get` | a paper's assignees |
| `PUT /review/base-studies/{id}/assignments/{user_id}` | `ReviewAssignmentsView.put` | assigns a reviewer |
| `DELETE /review/base-studies/{id}/assignments/{user_id}` | `ReviewAssignmentsView.delete` | releases a reviewer |
| `GET /review/reviewers/` | `ReviewersView.get` | lists reviewers |
| `GET /review/me` | `ReviewMeView.get` | the caller and whether they are a lead |

The bundle and op bodies are opaque objects in the spec. Their contracts are the JSON Schemas served by `/review/schemas/{name}` ([ADR 0006](../adr/0006-json-schema-beside-openapi.md)). Review errors use neurostore's ErrorResponse body, connexion's 400s for review paths included.

## Testing

Backend tests are under `store/backend/neurostore/tests/review/`. Run them with the store test command in AGENTS.md. Front-end tests use Vitest (`npm run test` in `store/review-frontend`).

**Golden parity files.** The rules that exist on both sides are pinned by files the backend writes and the front end replays, all under `store/review-frontend/src/test/golden/`, written by `tests/review/golden.py`:

- `bundle.json` and `ops.json`: the four client-applied ops;
- `op-scenarios.json`: request and response pairs from the real op endpoint;
- `slot-classes.json`: every slot's schema class;
- `diff-bundle.json` and `diff-verdicts.json`: the diff against the original;
- the schemas copy under `schemas/`.

The one documented way to regenerate them is in `store/review-frontend/README.md` ("Golden files"):

1. Run the backend review tests with `UPDATE_GOLDEN=1`.
2. Run `UPDATE_GOLDEN=1 npm run test` for `ops.json`.
3. Run the backend tests again without the flag.

**The memory backend** (`src/test/memoryBackend.ts`, `memoryCoordinates.ts`). Front-end integration tests run against an in-memory review server with the real one's `last_seq`, replay and 409 rules (`src/test/fakeServer.ts` puts the HTTP routes over it). It applies `edit_points` and `restore` as the server does, with a stand-in for study_schema's key rule, and gives each a `restore` inverse, so undo works in those tests.

**The grid in tests.** Handsontable does not lay out in jsdom. A test file that renders the point grid mocks `@handsontable/react-wrapper` with the package's stand-in (`@neurosynth/coordinate-table/testing`), which edits rows in place and runs the hooks the grid uses as Handsontable does. The end-to-end suite (`store/review-frontend/e2e/`, `npm run test:e2e`, Playwright) checks those hooks against the real grid in Chromium: it serves `e2e/index.html`, which mounts the app over the HTTP API, and answers the API with the memory backend over a synthetic paper (`e2e/fixtures/P1.bundle.json`, the unit tests' coordinate paper), recording the op batches the app posts.

**Timing tests run apart.** The backend's (`test_coordinate_batch_speed.py`) are skipped unless pytest gets `--performance`. The front end's (`*.perf.test.tsx`) run only under `npm run test:perf`. Their functional checks stay in the default suites.

**CI.** The `review_frontend` job in `.github/workflows/workflow.yml` runs `npm ci`, `check:types`, `typecheck`, `lint`, `test`, the end-to-end suite (after `npx playwright install --with-deps chromium`) and `build` in `store/review-frontend`. The backend review tests run in the existing store job.

## Not built yet / follow-ups

- **Fulltexts backfill** from `pubget_fulltext` and `ace_fulltext`, switching their readers to `BaseStudy.fulltext_id` and dropping the columns: neurostuff/neurostore#1844. A bulk insert skips the ORM listeners, so the backfill must recompute pointers itself.
- **Authorship export.** An analysis's authorship (model or reviewer) is shown but not exported, because study_schema has no slot for it (`TODO:` in `review/app/exports.py`).
- **Note editing.** `;` adds a note, a noted slot or entity shows a mark with its notes on hover, and the Submit step lists the open notes, but an existing note cannot be edited or removed.
- **Undo across a reload.** The undo stacks live in memory and are not kept with the offline queue.
- **Alias table** for renamed entities, so a later run naming the old name and a reviewer's new name both match the entity.
- **Two-column diff in the coordinates inspector.** The record inspector has one, but the coordinates step does not.
- **Compose's switch to the coordinate grid package.** Compose's CBMA points table is still its own; `packages/coordinate-table/README.md` says how it would use the package.
- **Compose's switch to the shared theme.** `compose/neurosynth-frontend/src/index.tsx` still holds its own copy of the palette that `packages/neurosynth-theme` holds.
- **Deployment.** `store/nginx/nginx.conf` has no location serving the built front end at `/review/`.
- Also designed but not built: promotion of a reference review into the truth layer, comparison with another reviewer or another extraction, and audit mode.
