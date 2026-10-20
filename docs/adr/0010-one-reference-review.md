# 0010. At most one reference review per source

Status: accepted

## Context

A source can have several reviews, one per reviewer (`uq_reviews_source_user`). A lead reviewer marks one as the reference: the one promotion will use and compare treats as the answer. Two references for one source would make "the answer" ambiguous and promotion nondeterministic. Marking is a write that two leads can race.

## Decision

The database enforces it with a partial unique index, `uq_reviews_one_reference_per_source` on `reviews(source_id) WHERE state = 'reference'`, defined in `store/backend/neurostore/models/review.py` and the migration. The state machine (`in_progress`, `submitted`, `reference`, `set_aside`) is also checked by `ck_reviews_state`. Marking a reference still takes a row lock on the source first, so a lost race answers a clean 409 rather than an IntegrityError. The lock is the polite path; the index is the guard.

## Consequences

- No application bug can leave two references.
- A second mark is refused with 409 while another review of the source is the reference. The reference state is terminal: no owner transition leaves it (`OWNER_TRANSITIONS` in `review/app/service.py`) and there is no unmark, so a reference, once marked, cannot be changed through the API. A set-aside review cannot be the reference.
- Only leads (`admin` plus `admin-reviewer`) may mark it. Reviewers may read anyone's review but write only their own.
- The rule is per source, not per paper, so a paper with several extractions can have one reference for each.

## Rejected

- **Check in application code only.** Removing the lock in testing let two concurrent marks both succeed.
- **A `reference_review_id` column on the source.** It adds a circular reference between two tables for what an index can state.
