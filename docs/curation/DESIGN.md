# Compose curation in tables: design

Branch `claude/project-curation-tables-db8867`, on neurostuff/neurostore master 17b71b82 (v0.26.0).
Measured on 2026-11-27 and 28 against a restore of `s3://neurosynth-backup/11-28-2026-at-00-00-01_compose.dump`
(all tables but snapshot data) and the `base_studies` and `studies` tables of the same day's Neurostore dump,
in a throwaway local Postgres 17. The decision is recorded in [ADR 0023](../adr/0023-curation-stubs-as-rows.md).

## The question

Where does each piece of a project's curation and extraction state live, so that one change is saved by
sending and writing only that change, a 40k-stub board can be read in pages, the frontend's whole-document
GET and PUT keep working unchanged, and no project loses anything in the move?

## What provenance holds today

`projects.provenance` (a `JSON` column) is the frontend's whole `IProvenance` document
(`compose/neurosynth-frontend/src/hooks/projects/Project.types.ts`). neurostore-spec types it as an open
`object`. `ProjectStore.updateProjectInDBDebounced` GETs the whole project to compare `updated_at`, then PUTs
the whole document, 2.5 s after the last edit.

Across the 4,921 production projects (3.53 GB of JSON in all):

| Piece | Where in the document | Production size |
|---|---|---|
| Curation stubs (title, authors, abstract, ids, exclusion, tags, source) | `curationMetadata.columns[].stubStudies[]` | 1,477,716 stubs, 3.46 GB; abstracts alone 2.33 GB |
| Columns | `curationMetadata.columns[]` (`id`, `name`) | 11,422 |
| Tags | `infoTags`, `exclusionTags`, `prismaConfig.{identification,screening,eligibility}.exclusionTags` | 35,628 |
| Stub tags | `stubStudies[].tags[]`, full copies of project tags | 584,527 |
| Identification sources | `identificationSources[]`; each stub holds a copy | 22,147 |
| Imports | `imports[]` | 3,731 |
| PRISMA | `prismaConfig.isPrisma`; counts are computed in the frontend, never stored | one flag per project |
| Extraction | `extractionMetadata.studyStatusList[]`, `studysetId`, `annotationId` | 412,031 statuses (largest list 6,954) |
| Meta-analysis step | `metaAnalysisMetadata.canEditMetaAnalyses` | one flag |
| Older keys | `type`, `algorithmMetadata`, `selectionMetadata`, `filtrationMetadata`, `provenance` | 343, 230, 223, 7, 1 projects |

The biggest project, `T6NDWRDR4Xq4`, has 43,343 stubs in one column: 104,856,802 bytes, 800 bytes under
nginx's 100 MiB `client_max_body_size`. Its later saves are the 413s in neurostuff/neurostore#1973. Twelve
projects have more than 10,000 stubs.

What the data holds besides the frontend's types, all of which the move keeps:

- 543 stubs are JSON `null`; 45 are `{"exclusionTag": null}` with no id.
- 25 stubs hold the whole exclusion tag object instead of its id (left by
  `compose/postgres/scripts/deduplicate_project_exclusions.sh`).
- 238 years are numbers; 7 abstracts and 169 article links are lists.
- 546,179 stubs carry `searchTerm`, which the TypeScript type does not declare.
- 2,779 stub tags name a tag the project no longer lists.
- 2,025 projects list the duplicate tag under both `exclusionTags` and PRISMA identification.
- 1,414 status entries repeat a study id; 69 say `COMPLETE` instead of `completed`.
- No stub id repeats within a project. 552 repeat across projects, because cloning copies stubs.

Stub ids must survive unchanged: Neurostore's `studyset_studies.curation_stub_uuid` points at them.

### Stubs and Neurostore

82% of stubs (1,204,837) have a `neurostoreId`, naming only **49,916** distinct ids. Of those stubs, 99.1%
name a base study, 0.7% (8,819, from sleuth imports) a study version, and 1,789 an id Neurostore no longer has.
Against Neurostore's current rows, titles match 99.6%, abstracts 96%, PMIDs 99.7%, DOIs 97.6% and years 97.5%.
But authors match only 5.7% and journals 24%: Neurostore normalized them after these stubs were imported.
Reading those fields live from Neurostore would change what every curator sees, and every compatibility GET
would need a cross-service read of up to 43k base studies.

## Candidates

**A. Keep the blob, patch it.** A JSON Patch endpoint on `projects.provenance`. Saves get small, but every save
still rewrites the whole TOASTed value (about 100 MB for the largest project), every read still returns it,
nothing can be paged or queried, and it is not normalized. Rejected.

**B. Rows, each stub with its own text.** Tables for columns, stubs, stub tags, tags, sources, imports and
statuses. It is simpler, but stores 3.0 GB of citation text, mostly the same 49,916 papers copied once per
project.

**C. Rows, citations shared per Neurostore id (chosen).** As B, plus one `curation_citations` row per
Neurostore id holding the citation fields (title, authors, abstract, journal, year, DOI, PMID, PMCID). A stub
stores a field only when it differs from its citation. The migration fills each citation with the most common
value among the stubs that name that id, so a linked stub overrides a field only when a curator's text really
differs (1,807 titles and 40,173 abstracts across production). Stub text goes from 3.46 GB to 506 MB of stub
values plus 86 MB of citations. Most of the 506 MB is unlinked stubs (PubMed and file imports), which have no
citation to share.

The experiment that separated B and C was the codec run over every production project: both round-trip all
4,921 projects exactly, and C stores 590 MB of text where B stores 3.0 GB.

## The tables

All in Compose's database. `neurosynth_compose/models/curation.py` holds the models and
`neurosynth_compose/curation/codec.py` the mapping. Every item table has `extra jsonb`, holding keys whose
value did not fit the typed column plus keys the codec does not know, and `missing text[]`, listing known keys
the item lacked. Both are NULL for a well-formed item, which 1,477,277 of 1,477,716 stubs are.

| Table | Key | Holds |
|---|---|---|
| `curation_citations` | `neurostore_id` | the shared citation fields; written once, never changed |
| `curation_columns` | (`project_id`, `id`) | `name`, `position` |
| `curation_stubs` | `pk` (identity); unique (`project_id`, `id`) | `column_id`, `position` (float), `neurostore_id` (FK to citations), citation overrides, `keywords`, `article_link`, `exclusion_tag_id`, `identification_source_id`, `import_id`, `search_term`, `raw`, `content_hash` |
| `curation_stub_tags` | (`stub_pk`, `position`) | `tag_id`, or the whole `tag` when the stub's copy differs from the project's tag of that id |
| `curation_tags` | (`project_id`, `tag_list`, `position`) | `id`, `label`, `is_exclusion_tag`, `is_assignable`; `tag_list` is `info`, `exclusion`, or a PRISMA phase |
| `curation_sources` | (`project_id`, `position`) | `id`, `label` |
| `curation_imports` | (`project_id`, `position`) | `id`, `name`, `date`, `import_mode`, `num_imported`, `neurostore_search_params`, `file_name` |
| `extraction_study_statuses` | (`project_id`, `position`) | `study_id`, `status` |

Small lists are keyed by position, because their ids repeat or go missing in real data. A stub that is not an
object is kept whole as `raw = [value]`, and a stub that repeats an earlier stub's id keeps that id in `extra`.
Neither can be named by the changeset endpoint. Every table but citations cascades from `projects`.

**What stays on the project row.** `projects.provenance` is dropped. `projects.provenance_extra jsonb` holds the
document with each list that became rows replaced by `[]`. What is left is the PRISMA flag,
`canEditMetaAnalyses`, `extractionMetadata.studysetId` and `annotationId`, `type`, and the older keys: about
380 bytes a project (1.9 MB in all). The `studysetId` and `annotationId` copies stay as the frontend wrote them.
The row's `neurostore_studyset_id` and `neurostore_annotation_id` columns remain the reference the backend
uses.

**Ordering.** A stub's place in its column is a float `position`. `curation/ordering.py` keeps the longest run
of stubs that are already in order and spaces the others between their kept neighbours, renumbering a column
only when a gap runs out. Moving a stub, or adding 1,000 stubs above 40,000, rewrites only the stubs that moved
or are new.

## Endpoints

| Route | Does |
|---|---|
| `GET /projects/{id}` | as today: `provenance` is assembled from the tables. `include_stubs=false` leaves each column's `stubStudies` out |
| `PUT /projects/{id}` | as today: the document is split into rows and only rows that differ are written. `keep_stubs=true` ignores `stubStudies` and keeps the stored stubs |
| `GET /projects` | as today: the card summary (exclusion and tag ids per stub) is read from the tables without citation text |
| `GET /projects/{id}/curation-stubs` | stubs in board order, paged (`page`, `page_size` ≤ 1000, `column_id`), each `{column_id, stub}` |
| `POST /projects/{id}/curation-stubs` | a changeset `{updated_at?, remove[], add[], update[], move[]}` applied in one transaction, in that order; returns the new `updated_at` and counts. A stale `updated_at` is 409 |
| `GET /projects/{id}/curation-summary` | per column: stub count, and counts per exclusion id and per tag id |

**How a compatibility PUT touches only what changed.** Each stub's `content_hash` is the MD5 of its JSON with
sorted keys. A save hashes each incoming stub and re-encodes only stubs whose hash changed, new stubs, and stubs
whose project tag or source changed under them. Positions come from `ordering.assign_positions`. Small lists
are replaced only when they differ. Every save, through either route, sets `projects.updated_at`, which the
frontend's out-of-sync check reads.

**What changed for scripts.** Cloning assembles the source's document and saves it into the clone.
`merge-base-studies` finds candidate projects with an indexed query on the tables, then applies its existing
checks to the assembled document. `backfill-extraction-metadata` edits `provenance_extra`. The dev-reduced seed
(`build_compose_seed_by_copy.sql`) copies the new tables, and Neurostore's
`store/scripts/backfill_curation_stub_uuid_crossdb.py` reads stub identifiers from them.

## Migration

`migrations/versions/c4e1a7b9d2f3_curation_tables.py`, after `b8d2e6f0a4c1`, a no-op revision that merges the
two current heads. Its work is in `curation/migration.py`:

1. Create the tables and `projects.provenance_extra`.
2. Read every project's document once to vote each Neurostore id's citation fields, then insert the citations.
3. Read each project again, split it with the codec, and insert its rows (stubs in batches of 20,000). Then
   index and drop `projects.provenance`.

The downgrade adds `provenance` back, writes each project's assembled document into it, and drops the tables.
One project is in memory at a time.

**Measured on the production copy** (laptop, Postgres 17 in Docker):

- **Upgrade:** 615 s for all 4,921 projects, 1,485 MB peak memory in the app process. It wrote 1,477,716
  stubs, 584,527 stub tags, 412,031 statuses and 49,916 citations.
- **Round trip:** every project assembled from the tables equals its original document (4,921 of 4,921,
  242 s to check), and so does every `projects.provenance` the downgrade writes back.
- **Storage:** about the same on disk. The new tables take 1,500 MB (curation_stubs 1,229 MB, of which
  308 MB is indexes); the old `projects` table took 1,531 MB, because Postgres compresses the JSON. The win is
  in what a save writes and reads, not in disk.

### Saves before and after

`T6NDWRDR4Xq4`, 43,343 stubs, one stub's `exclusionTag` flipped per save. Requests went in process through the
ASGI app (no nginx, no network), median of 3. Before is master 17b71b82 on an unmigrated copy; after is this
branch on the migrated copy.

| Request | Before | After |
|---|---|---|
| `GET /projects/{id}` (104.9 MB response) | 2.11 s | 1.55 s |
| `PUT /projects/{id}`, one stub changed (104.9 MB request, 31.8 MB gzipped) | 15.14 s | 2.08 s |
| `PUT /projects/{id}`, nothing changed | | 2.02 s |
| `GET /projects?user_id=…` (owner's 4 projects, 105k stubs, 4.8 MB) | 4.77 s | 1.35 s |
| `POST /projects/{id}/curation-stubs`, one stub changed (78-byte request) | | 0.015 s |
| `POST …/curation-stubs`, move one stub to the top of the 43k column (117 bytes) | | 0.16 s |
| `GET /projects/{id}?include_stubs=false` (81 KB) | | 0.014 s |
| `GET /projects/{id}/curation-summary` (485 bytes) | | 0.10 s |
| `GET …/curation-stubs?page=200&page_size=100` (228 KB) | | 0.20 s |

How the whole-document routes got there:

- **GET.** It reads stubs through the DBAPI cursor and resolves citation fields in the same SQL query; the
  query runs in 40 ms in Postgres. It decodes stubs without copying shared tag and source objects, and sends
  the JSON bytes without decoding them to a string first.
- **PUT.** It hashes each stub once (MD5 of its sorted-key JSON, which also refuses NUL), copies only the
  objects the codec rewrites, and answers with the document it was sent. The tables hold that document
  exactly, as the round trip over all 4,921 projects shows, so it is not read back.
- **The project list.** It decodes only each stub's `exclusionTag` and tags. The card summary it builds equals
  master's on all 4,921 projects.

The whole-document routes stay over a second for this project because each carries 105 MB (or, for the list,
an entry per stub). Moving 183 MB of rows out of Postgres takes about 0.5 s of the GET. Of the PUT, parsing the
105 MB request body with the standard library's `json` takes 0.97 s and `store.save` 0.82 s. The routes the frontend design uses all answer in under 0.25 s.

## Keeping today's frontend working

The frontend does not change with this PR. Its GET and PUT carry the same document, and the PUT response still
carries it, because `useUpdateProject` puts the response into the query cache. The project list still returns
the card summary.

What the backend alone does not fix: today's frontend still sends the whole document on every save, so
`T6NDWRDR4Xq4` stays over nginx's limit. **neurostuff/neurostore#1973 (gzip on project saves) stays as the
stopgap**, and is needed until the frontend moves to the changeset endpoint. With #1973 the same save is about
32 MB on the wire (31.8 MB gzipped, measured above). This PR does not touch #1973, and the two do not conflict: #1973 decompresses the body
before the view this PR changes.

## Frontend design (not built)

### Stores and hooks

- **`stores/projects/ProjectStore.ts`.** `provenance` keeps everything but stubs: load it with
  `GET /projects/{id}?include_stubs=false`. Stubs move to a react-query cache, one infinite query per column
  (`['projects', id, 'curation-stubs', columnId]`), paged with `page_size=200`.
  - `useProjectCurationColumns` and `useProjectCurationColumn` return columns without stubs.
  - New hooks: `useCurationColumnStubs(columnId)` (infinite), `useCurationSummary()`
    (`/curation-summary`), and `useCurationStub(stubId)`.
- **The helpers in `ProjectStore.helpers.ts`** (`handleDragEndHelper`, `promoteStubHelper`, `demoteStubHelper`,
  `promoteAllUncategorizedHelper`, `addTagToStubHelper`, `removeTagFromStubHelper`, `setExclusionForStubHelper`,
  `updateStubFieldHelper`, `addNewStubsHelper`) stop rewriting whole column arrays. Each emits a changeset op
  and applies it optimistically to the cached pages:
  - a drag, promote or demote is a `move` with the destination index;
  - "promote all uncategorized" is one `move` per stub with `index: -1`;
  - tag, exclusion and field edits are an `update` carrying only the changed keys (`tags` as the whole new list);
  - imports are `add`s.
- **`useGetCurationSummary`, `Prisma.helpers.ts` and `ProjectsPageCard`** read counts from
  `/curation-summary` instead of counting stubs.
- **`CurationDownloadSummary`, bibtex export and `useCuratorTableState`** need every stub. They page through
  `/curation-stubs` (44 requests of 1,000 for the largest project), or use a server-side export, a follow-up.

### Save model

Batched diffs.

- An outbox of ops is coalesced per stub (an update merges its keys; consecutive moves keep the last) and
  flushed 2.5 s after the last edit, as one changeset.
- The changeset carries the `updated_at` the client holds. A 409 shows today's out-of-sync message.
- One flush is in flight at a time, and each response's `updated_at` replaces the held one.

This removes today's pre-save full GET. Settings changes go through `PUT ?keep_stubs=true` with the stub-less
document, and their out-of-sync check uses `GET ?include_provenance=false`.

### A 40k-stub board

- Each column renders its first page and fetches the next as the virtualized list
  (`CurationStubListItemVirtualizedContainer`) nears its end.
- Column headers and PRISMA counts come from `/curation-summary`.
- Dragging within loaded pages works as now. Dropping past the loaded range sends the index the user sees.
- The table view's filtering and sorting move to the server as `/curation-stubs` query parameters (text,
  exclusion, tag, sort), a follow-up.
- Large imports send `add` in chunks of 2,000 stubs (about 5 MB each).

### Ship order

1. **This PR**, with neurostuff/neurostore-spec's matching PR merged first and its merge commit pinned. Old
   frontend, new backend. The migration runs about 10 minutes in one transaction and locks `projects`
   exclusively, so deploy it in a quiet window. The app and the migration ship together, because the old app
   reads `projects.provenance`.
2. **#1973**, deployed with or before this PR, so the stuck project can save again.
3. **The frontend PR:** stub-less load, paged columns, summary counts and changeset saves. It needs the
   regenerated Compose TypeScript SDK for the new routes.
4. After the frontend has shipped and no full-document saves arrive, decide whether `GET /projects/{id}` should
   leave stubs out by default.

## Notes

- **Dropped: reading citations live from Neurostore.** It changes what curators see (authors and journals
  differ for 94% and 76% of linked stubs) and puts a cross-service read in every GET.
- **Dropped: a refresh of `curation_citations` from Neurostore.** Refreshing would change every stub that
  inherits a field. It is James's call whether Neurostore corrections should reach curation boards; rows are
  write-once until then.
- The Alembic revision imports `neurosynth_compose.curation.codec`. A later change to how the codec stores rows
  needs its own migration, not an edit of this one.
- `compose/postgres/scripts/deduplicate_project_exclusions.sh` rewrites `projects.provenance` and is removed.
  Its 25 leftovers are kept verbatim in `curation_stubs.extra`.
