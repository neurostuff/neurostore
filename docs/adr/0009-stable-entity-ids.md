# 0009. Entities get a stable id minted by neurostore

Status: accepted, built

## Context

An entity's `local_id` is unique only within one extraction record. A pipeline re-run, or a reviewer renaming a group, changes how the truth layer would identify it. The ingester linked entities by an identity hash built from names, so a rename split an entity's claims in two, and reviewed edits sat beside claims the extraction never mentioned. Promotion needs an identity that survives both.

## Decision

An entity's stable id is a UUID minted by neurostore, never a hash of its content. It is kept on the StudyEntity (`study_entities.stable_id`, unique, in `store/backend/neurostore/models/data.py`; migration `f2b4d6e8a0c3` backfilled every existing row). study_schema has `stable_id` as an optional, extraction-only slot on every entity: a lowercase UUID, declared in `extraction-deviations.yaml` so that pondie's generator keeps it. Storage `id` stays the store's own key.

- **Import** (`review/app/imports.py`, `_with_stable_ids`). An entity keeps the stable_id it carries. Otherwise it takes the id of the StudyEntity its run's `ExtractionEntityLink` points to, or else a new UUID.
- **Review.** The server mints the stable_id of every entity an op adds (`review/core/stable_ids.py`). It refuses an op that carries a stable_id the review has never held, gives one to two entities, or edits it as a slot.
- **Export** carries the ids in the record.
- **Ingest** (`neurostore/ingest/study_entities.py`, `_match_level`). An entity carrying a stable_id is linked to that StudyEntity before the identity hash is tried. Repeated ids are refused (`STABLE_ID_REPEATED`), and so are ids of another paper's or class's entity (`STABLE_ID_MISMATCH`). Dedupe digests leave stable_ids out.

## Consequences

- A rename or re-run keeps an entity's claims together, provided the record carries the id.
- An entity linked by stable_id is not re-hashed: it keeps the identity hash of its old name. So a later pipeline run that still uses the old name, with no stable_id, still matches it by hash. If a reviewer then gives the old name to a different entity, that entity's hash finds the linked one, and it is held as a duplicate (a rename candidate) rather than taking over its claims. An alias table that matches both names is a possible follow-up.
- Records with no stable_id are linked by identity hash, as before. Matching a new extraction's entities to existing ones the way compare pairs them (class, name, evidence overlap, confirmed by a reviewer) is not built.
- Promotion, when built, maps review edits to claims through the stable id, not through names.
- Open: study_schema's storage map makes some storage ids deterministic hashes and others minted UUIDs. Either every class moves to minted UUIDs, or `stable_id` stays extraction-only.

## Rejected

- **Match by name.** Fails on renames, on duplicates, and on reviewer-created entities that share a name.
- **A content hash as the id.** It changes whenever the content does, which is the failure to avoid.
- **Re-hash an entity under its new name on every rename.** Later pipeline runs that still use the old name would then miss it and create a second entity.
