# 0008. Provenance travels in a wrapper beside the record

Status: accepted

## Context

Exported records must go back into pondie, the ingester and training jobs. study_schema records are immutable by rule: a correction is a new version, never an annotation. Yet the receiver needs to know where a record came from: a pipeline run, or a named reviewer's review. We first considered stamping this into the record.

## Decision

An exported record stays exactly as extracted or as edited. A separate document, `run/provenance/<id>.json`, sits beside it and is defined by `store/backend/neurostore/review/schema/record-provenance.schema.json`. It holds the record's path, its source (`{kind: review, review_id, user_id, state}` or `{kind: source, source_id, origin, run_id}`), the source record it derives from by sha256, `reviewed` and `edited` as separate facts, the last edit time and the producer. Evidence sets a reviewer adds leave `EvidenceSet.source` empty; the wrapper and the op log say who added what. It is written by `exports.py`, for every paper exported, reviewed or not.

On re-import, a review wrapper's dedupe digest covers record and wrapper, so an unedited review loads as a source of its own and keeps its reviewer. A pipeline or unreviewed wrapper's digest covers the record alone.

## Consequences

- Records stay byte-compatible with consumers that know nothing about review.
- Consumers that want provenance must read a second file and keep the pair together.
- `reviewed` (a person checked it) and `edited` (the record changed) differ: accepting everything unchanged gives `reviewed: true, edited: false`.
- The wrapper schema may later belong in study_schema.

## Rejected

- **A reviewer field in the record's `extraction_metadata`, or a new `EvidenceSet.source` value.** Each alters a schema owned elsewhere and breaks the immutability rule.
