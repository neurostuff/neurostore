# 0007. A reviewed paper cannot be deleted

Status: accepted

## Context

A review is human work: hours of a reviewer's decisions, notes and ops. neurostore deletes base studies freely, and the existing foreign keys cascade from a base study to what hangs off it. A cascade through to review data would let a routine cleanup erase that work without a trace.

## Decision

`review_sources.fulltext_id` references `fulltexts` with `ON DELETE RESTRICT`. A base study's fulltexts cascade from the base study, so deleting a base study that has a review source fails at the database. `DELETE /base-studies/{id}` checks first and answers 409 with `under_review` (the number of review sources reading its text) instead of raising an IntegrityError. There is no admin force.

Below that point work is protected by the structure, not by checks: reviews belong to a source, ops cascade only from a review, and assignments cascade from a base study because they are bookkeeping, not work.

## Consequences

- Deleting or merging a reviewed paper requires removing its reviews deliberately first, which has no endpoint. This is the intent.
- Tools that delete base studies in bulk (dedup, cleanup scripts) must handle the 409 or the IntegrityError.
- Without the index on `base_studies.fulltext_id`, a fulltext delete (which sets the pointer to NULL) scans `base_studies`.

## Rejected

- **Cascade the delete.** Reviewers lose work silently.
- **An admin force flag.** Same loss, one click away.
- **Soft-delete the paper.** It changes behaviour across neurostore, for the sake of one feature.
