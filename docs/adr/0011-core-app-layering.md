# 0011. The review package is split into a pure core and an app layer

Status: accepted, built

## Context

`neurostore/review/` holds both the op engine and the code that talks to the database and HTTP. With the two mixed, the part that should be pure (ops, coordinates, validation) could raise HTTP errors, the CLI could trigger `abort_not_found`, and importing the engine pulled in the application.

## Decision

`store/backend/neurostore/review/` has two layers, plus the errors both share.

- `core/` is pure. It takes documents, returns documents, and touches no database or HTTP: ops, coordinates, entities, paths, validation, references, lists, defs, targets, record_follow, bundle, layout, schemas and stable_ids.
- `app/` holds service, imports, exports and zip_stream. It uses the session and the models.
- `review/errors.py` sits beside both and holds `ReviewError` with its subclasses `NotFound`, `Conflict`, `Refused` and `Unprocessable`. The core raises them as well as the app; `LayoutError` (in `core/layout.py`) is an `Unprocessable`. `review_http_error` in `neurostore/exceptions/handlers.py` maps every one of them to the ErrorResponse shape, and `cli.py` catches them for the CLI.
- `neurostore/paths.py` is a leaf module holding the path constants (`API_BASE_PATH`, `REVIEW_PATH_PREFIX`, `REVIEW_URL_PREFIX`, `UPLOAD_URL_PREFIX`, `is_review_path`). The resolver, the error handlers, auth and the body-limit middleware all read it, so the prefix is defined once.
- `core/stable_ids.py` holds the stable-id rules. The app layer gives `apply_batch` a `StableIds` (a mint function and the ids an op may put back), so the core mints ids without touching the database.
- The validator is an argument of `apply_batch` (`validate=incremental_problems`, or `full_problems` as the oracle), not a module global that tests flip.

`tests/review/test_layering.py` guards the direction of imports. It resolves relative imports and parent packages, and fails if `core/` reaches flask, connexion, starlette, sqlalchemy, `neurostore.database`, `neurostore.exceptions`, `neurostore.models` or `review.app`. `review/schema/` stays where it is, because the front end's type generator (`store/review-frontend/scripts/gen-types.mjs`) reads it by path.

## Consequences

- The CLI and the HTTP views share the app layer, and neither raises the other's errors.
- The core can be tested and reasoned about with plain dicts.
- Cost: a request crosses an extra seam, and every new error needs a type and a mapping.
- Cost: a helper used by both layers must live in `core/`, in `review/errors.py` or in a leaf such as `neurostore/paths.py` or `neurostore/study_schema_tools.py`, so shared code has to be placed deliberately.

## Rejected

- **Keep one flat package.** The errors and imports stay entangled.
- **Let the core raise `abort_*` helpers.** Faster to write, but then the engine cannot run outside a request.
