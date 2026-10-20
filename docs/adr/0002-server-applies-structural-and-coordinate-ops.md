# 0002. Structural and coordinate ops are applied only on the server

Status: accepted

## Context

The front end applies edits optimistically so typing never waits on the network. That needs a second implementation of the op rules in TypeScript (`store/review-frontend/src/model/applyOp.ts`) beside the Python core. Two implementations drift. Some rules are large: deleting an entity must find every dangling reference, links use keyed selectors and class resolution, and coordinate edits derive revision verdicts and re-point the record's analyses.

## Decision

The front end applies four ops itself: `set_value`, `set_evidence`, `verdict` and `note`. `create_entity`, `delete_entity`, `link`, `unlink` and every `coordinate` op are applied only by the server. For these the client sends the op at once, shows it as pending, and takes the record, provenance, hidden set and entity index from the op result. The delete dialog previews dangling links from the local record, labelled as a preview; the server's answer is authoritative.

The four client-applied ops stay equal to the core through golden scenarios recorded from the real endpoints (`store/backend/neurostore/tests/review/golden.py`, replayed by backend and front-end tests).

## Consequences

- The hard rules (reference handling, key derivation, verdicts) exist once.
- Structural edits cost a round trip, about a second on a slow link. They are rare enough that this is acceptable.
- Structural edits work offline only as queued ops; the screen does not show their result until the server answers.
- The golden files must be regenerated whenever the four client ops or their provenance rules change, and both sides must pass.

## Rejected

- **Port everything to TypeScript.** Instant edits, but a duplicate of the delete, link and coordinate logic with its own drift.
- **Apply everything on the server.** One implementation, but a network wait on every keystroke-level edit.
