# 0006. JSON Schema 2020-12 contracts beside an OpenAPI 3.0 spec

Status: accepted

## Context

The review API's routes belong in neurostore-spec, the OpenAPI document that generates the SDKs. The op and bundle bodies are rich: recursive, with discriminators and conditional rules that OpenAPI 3.0's schema dialect cannot express. The spec must also stay general-purpose and name no implementation.

## Decision

Routes are in the spec. The body contracts are JSON Schema 2020-12 files in `store/backend/neurostore/review/schema/` (`review-ops.schema.json`, `review-bundle.schema.json`, `record-provenance.schema.json`). The spec names them as opaque objects, pointing at the URL that serves each contract (`GET /api/review/schemas/{name}`), never at a repo path ([ADR 0014](0014-spec-generates-every-api-type.md)). The backend validates ops against the schema at runtime, tests check bundles against theirs, and both generate the front end's types.

The spec carries no `operationId`. neurostore maps each operation to its handler with `ReviewResolver` and the `REVIEW_HANDLERS` table in `store/backend/neurostore/resolver.py`, and a test checks that every spec operation resolves at startup. Review handlers return plain dicts, as `StudySchemaUploadsView` does.

## Consequences

- One source for the body rules, usable by validator and type generator alike.
- The spec cannot describe the bodies, so the SDK types them loosely, and required fields repeated in the spec can drift from the schemas.
- A new route needs two edits: the spec path, and a line in `REVIEW_HANDLERS`.
- Moving the spec to OpenAPI 3.1 would let it reference the schemas directly. That is deferred to the next spec-wide change.

## Rejected

- **Express the bodies in OpenAPI 3.0.** Not possible without losing rules.
- **Move the whole spec to 3.1 now.** Out of proportion to this feature.
- **Explicit `operationId` naming neurostore classes.** It ties a general-purpose spec to one codebase.
