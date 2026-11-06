# 0014. The spec is the source of every API type; batch bounds live only in the served contract

Status: accepted, built

## Context

The front end's API types had three sources. Some were generated from the OpenAPI spec, some were hand-written (`PaperSummary`, `ReviewerProgress`, `Assignee`, `Me`), and the generator patched in `required` lists that the spec left out. The spec described the review bodies by naming files in the neurostore repo, which ties a general-purpose spec to one codebase ([ADR 0006](0006-json-schema-beside-openapi.md)). It also restated the 500-op batch limit that `review-ops.schema.json` already held. Each copy could drift without any test failing.

## Decision

- **Every API type is generated.** Required fields live in the spec. `store/review-frontend/scripts/gen-types.mjs` generates `src/contract/generated/review-api.ts` from the spec's review components, and `review-bundle.ts` and `review-ops.ts` from the review JSON Schemas, and patches nothing. `npm run check:types` fails if a generated file is stale or untracked, and the `review_frontend` CI job runs it.
- **Bodies are named by their served URL.** The spec describes `review-bundle` and `review-op` as opaque objects whose contracts are served at `GET /api/review/schemas/{name}`, not as repo paths.
- **Batch bounds only in the contract.** `review-ops.schema.json` holds the one statement of the bounds (`minItems: 1`, `maxItems: 500`). The spec's `review-op-batch` refers to the served contract instead of restating them. The core refuses an empty or oversized batch with a 422. The generator emits `BATCH_MIN_OPS` and `BATCH_MAX_OPS` for the op client to cut batches by.

## Consequences

- A field added to the spec reaches the front end's types by regeneration, or CI fails.
- connexion no longer enforces the batch size, so an oversized batch is a 422 from the core, with the ErrorResponse body, rather than a 400 from connexion.
- SDKs generated from the spec do not know the batch bounds. A client outside this repo must read them from the served contract.
- The front end's test server has no model of the core's batch-size 422.

## Rejected

- **Keep hand-written types for the small responses.** Cheaper now, but each is a second statement of a shape the spec already defines.
- **Restate the bounds in the spec.** Two statements of one rule, with nothing to keep them equal.
- **Move the review JSON Schemas into the spec repo.** It needs OpenAPI 3.1 to reference them, and that is deferred (ADR 0006).
