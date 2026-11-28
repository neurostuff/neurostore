# 0023. A Compose project's curation is stored as rows, with citation fields shared per Neurostore id

Status: accepted, backend built; frontend designed, not built

## Context

A Compose project kept its curation board, tags, imports, PRISMA settings and extraction statuses in one JSON
document, `projects.provenance`, which the frontend read and wrote whole. The largest production project
(43,343 stubs) reached nginx's 100 MiB request limit, and every later save failed with 413. Most of a document
is stub citation text (abstracts are 67%) copied from Neurostore: 1.2M stubs name only 49,916 distinct
Neurostore ids.

## Decision

- Each column, stub, stub tag, project tag, identification source, import and extraction status is a row
  (`neurosynth_compose/models/curation.py`). `curation/codec.py` maps the document to rows and back exactly:
  values that do not fit a typed column go to the row's `extra`, absent keys to `missing`.
- A stub's citation fields are NULL when they equal the shared `curation_citations` row for its
  `neurostoreId`. Citation rows are written once, from the most common value (migration) or the first stub
  (later saves), and never changed.
- `projects.provenance` is replaced by `provenance_extra`, the document with its row-backed lists emptied.
- The whole-document GET and PUT keep their shape, assembled and split on the server. The PUT writes only rows
  whose content hash or position changed. `POST /projects/{id}/curation-stubs` changes stubs by changeset,
  `GET` reads them in pages, and `GET /projects/{id}/curation-summary` counts them.

## Consequences

- One stub change can be saved in a few hundred bytes once the frontend uses the changeset endpoint. Until
  then the old frontend still sends whole documents, and neurostuff/neurostore#1973's gzip is what lets the
  largest project save.
- Stub ids must be unique within a project to be addressable. A repeated id is stored, but only the
  whole-document PUT can change it.
- A Neurostore correction to a base study does not reach curation boards. Refreshing citations is a separate
  decision, because every stub inheriting a field would change.

## Rejected

- **A JSON Patch on the blob.** Saves get small, but each one still rewrites the whole 100 MB value, and
  reads cannot be paged.
- **Per-stub citation text.** 3.0 GB where shared citations take 590 MB.
- **Citations read live from Neurostore.** Authors differ from Neurostore's current rows for 94% of linked
  stubs and journals for 76%, so it would change what curators see. It would also put a cross-service read of
  up to 43k base studies in every GET.
