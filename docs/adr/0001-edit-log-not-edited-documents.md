# 0001. A review is an edit log, not a set of edited documents

Status: accepted

## Context

A reviewer corrects a paper's extraction record and coordinate parse. Three things must hold: each reviewer's work stays their own, every change is attributable with its reason (who, when, from what to what, why), and reviews can be compared with the original and with each other. The public truth layer (`FieldClaim` and related tables) must not change until a separate promotion step.

## Decision

A review is an append-only log of typed ops (`review_ops`: `seq`, `client_op_id`, op, before, after) on one source. The materialized record, coordinate revision, provenance and annotations on `reviews` are a cache rebuilt from the source plus the log. The log is the truth. `ops.apply_batch` in `store/backend/neurostore/review/core/ops.py` is the only writer of both. Undo appends an inverse op; the log is never rewritten.

## Consequences

- Notes, rejections and ordering survive. A rejected value stays in the log, and export writes the log as `review/<id>.ops.jsonl` so rejections become training data.
- Compare lines up ops by entity and slot rather than diffing JSON trees.
- Retries are safe: `(review_id, client_op_id)` is unique, and `expected_last_seq` plus a row lock on the review serialize concurrent writers.
- Cost: every save writes the log and the cache. The record, provenance and annotations are rewritten whole on each batch, and the op result returns them. Cache and log can drift if a bug skips one of them, so the log wins.
- Cost: every edit kind needs an op type with a defined inverse.

## Rejected

- **Save each reviewer's edited documents whole.** Direct export, but the reason and order of edits are lost, and comparing means diffing JSON trees, which is noisy on list reorders.
- **Write reviewer claims straight into `FieldClaim` with `origin='user'`.** It changes the public tables (breaks the isolation requirement) and has no place for notes, rejections or entity and link edits. It is kept as the design for promotion.
