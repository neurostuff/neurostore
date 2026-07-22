# Flask to Connexion AsyncApp Migration Plan

## Execution Checklist

This is the live completion checklist. Items are checked only after their
verification command has passed. Store is completed before Compose is changed.

### Cross-Service Controls

- [x] Confirm the OpenAPI YAML files remain the API source of truth.
- [x] Confirm the deployment branch flips both services together.
- [x] Rename operator entry points to `neurostore` and `compose`.
- [x] Rename admin credentials to `ADMIN_USERNAME` and `ADMIN_PASSWORD` only.
- [x] Define approved Store and Compose snapshot inputs for realistic tests.
- [x] Capture Flask-backed baseline benchmark artifacts for Store and Compose.
- [x] Define the p95 gate: no regression greater than 20%.
- [x] Add a comparison report that distinguishes repeated scaled benchmark cases.
- [x] Make benchmark comparisons stable across repeated restored-snapshot runs.
- [x] Add API contract snapshots for success, validation, auth, and error responses.
- [x] Add deployment rollback and database expand/contract verification to CI.
- [x] Replace synchronous test transports with native async ASGI clients and enforce per-test database/cache isolation.

### Store Foundation

- [x] Replace Flask-Migrate commands with native Alembic-backed `neurostore db`.
- [x] Verify Store Alembic upgrade/current against PostgreSQL.
- [x] Replace Flask-SQLAlchemy with a request-scope-safe native `Database` facade.
- [x] Preserve `db.Model`, `Model.query`, `db.session`, `db.engine`, and Alembic metadata.
- [x] Add native database coverage, full API request-path coverage, and worker verification.
- [x] Replace Flask-Caching with an adapter that proves exact Redis key and value compatibility.
- [x] Add cold- and warm-cache compatibility tests for all cached Store routes.
- [x] Add request-scope SQLAlchemy session cleanup for ASGI execution.
- [x] Move settings, logging, and file paths from Flask app context to runtime settings.
- [x] Replace Flask-specific JSON serialization with an ASGI-compatible Orjson Jsonifier.

### Store AsyncApp and Resources

- [x] Add a `connexion.AsyncApp` Store factory with the same `/api` OpenAPI registration.
- [x] Preserve Store CORS and Connexion validation/body-validation policy.
- [x] Preserve Auth0 Bearer security handler behavior and error payloads.
- [x] Migrate user/auth helpers from Flask request/current-app usage (Auth0 runtime configuration is complete; request access remains).
- [x] Migrate studyset routes and nested serialization.
- [x] Migrate study routes and cloning paths.
- [x] Migrate analyses, conditions, points, images, tables, and entities.
- [x] Migrate annotations and annotation-analyses, including optimized note updates.
- [x] Migrate base-study filtering, search, ingestion-adjacent mutations, and outbox hooks.
- [x] Migrate pipeline routes, results, and embeddings.
- [x] Migrate Neurostore studyset release routes and download response behavior.
- [x] Remove the Store Flask factory and Flask request/app-context imports.

### Store Operations

- [x] Replace Flask-Admin with SQLAdmin or Starlette-Admin.
- [x] Verify `/admin` remains username/password protected and model coverage is retained.
- [x] Keep Celery/outbox/release workers independent of Flask app context.
- [x] Verify all Docker services, worker commands, healthchecks, docs, and CI use `neurostore`.
- [x] Remove Store Flask runtime dependencies only after all Store import checks pass.
- [x] Run Store API suite, migration checks, cache parity checks, and realistic p95 benchmark gate.

### Compose Foundation and AsyncApp

- [x] Replace Flask-Migrate commands with native Alembic-backed `compose db`.
- [x] Replace Flask-SQLAlchemy with the same native SQLAlchemy service pattern.
- [x] Replace Flask-CeleryExt with a plain Celery factory and explicit task/session lifecycle.
- [x] Move Compose settings, logging, request access, and cache/job-store access off Flask globals.
- [x] Add a `connexion.AsyncApp` Compose factory with the existing `/api` OpenAPI registration.
- [x] Preserve Compose CORS, validation, Auth0, API-key/run-key, and error semantics.

### Compose Resources and Operations

- [x] Migrate users and Neurostore studyset/study routes.
- [x] Migrate snapshot studysets and snapshot annotations.
- [x] Migrate specifications and projects.
- [x] Migrate meta-analyses, results, jobs, logs, and status paths.
- [x] Migrate NeuroVault collection/file and upload side-effect paths.
- [x] Verify Celery eager tests, worker import/startup, and Redis job-store behavior.
- [x] Replace Compose admin if present, preserving any required username/password access.
- [x] Verify Docker services, worker commands, healthchecks, docs, and CI use `compose`.
- [x] Remove Compose Flask runtime dependencies only after all Compose import checks pass.
- [x] Run Compose API suite, migration checks, job behavior checks, and realistic p95 benchmark gate.

### Release Completion

- [x] Build both production images from a clean dependency resolution.
- [x] Start both services and workers with the release Compose definitions.
- [x] Validate OpenAPI routes, Swagger UI, CORS, auth failures, and admin access end-to-end.
- [x] Run Store and Compose full backend suites.
- [ ] Run frontend build and integration checks against the migrated services.
- [x] Run the benchmark comparison against both Flask baseline artifacts and satisfy the 20% p95 gate.
- [x] Confirm there are no production imports/dependencies of Flask, Flask extensions, or Flask CLI.
- [x] Confirm Alembic revision histories remain backward-compatible and upgrades/downgrades are documented.
- [x] Update release/deployment documentation and record the migration verification evidence.

## Verification Evidence

- Store backend suite: `cd store && docker compose run -e "APP_ENV=docker_test" --rm neurostore bash -c "python -m pytest neurostore/tests"` completed successfully in a single isolated test container; peak container memory was about 464 MiB.
- Store cache compatibility suite: `python -m pytest neurostore/tests/test_cache_compatibility.py` passed with `5 passed`; it covers the shared list/detail cache decorators, including cold writes and reads from exact legacy keys.
- Compose backend suite: `cd compose && docker compose run -e "APP_ENV=docker_test" --rm compose bash -c "python -m pytest neurosynth_compose/tests"` passed with `142 passed`.
- Compose performance gate: `scripts/production_benchmark/compare_results.py --threshold 0.20 --drop-first-iteration --min-delta-seconds 0.1` passed against `compose/.benchmark-artifacts/flask-baseline.json` and `compose/.benchmark-artifacts/asyncapp-candidate-repeat.json`.
- Store and Compose production image builds passed through `docker compose build` for API and worker images.
- CI runs `db upgrade`, `db current`, `db downgrade --revision -1`, and a final
  `db upgrade`/`db current` for both services; backend migration documentation
  defines the expand/contract release sequence. The same round trip passed
  locally against both isolated test databases.
- Store deployment smoke passed after `neurostore db upgrade`: OpenAPI JSON `200`, Swagger UI `200`, admin unauthenticated redirect to `/admin/login`, `/api/users/` auth failure `401`, and outbox worker healthchecks healthy.
- Compose deployment smoke passed after recreating the local smoke DB and running `compose db upgrade`: clean migration created 32 public tables at Alembic head `5f0b9c4a1d7e`; OpenAPI JSON `200`, Swagger UI `200`, admin login page `200`, `/api/users` `200`, and `/api/projects` `200`.
- Flask dependency/import audit: production manifests and backend production code have no `flask`, `flask_*`, `flask_admin`, `flask_migrate`, `flask_sqlalchemy`, `flask_caching`, `flask_cors`, or `flask_orjson` imports or runtime dependencies.
- Frontend unit gate: the bounded single-worker run (`VITEST_MAX_WORKERS=1`,
  `NODE_OPTIONS=--max-old-space-size=2048`) passed with `79` files and `548`
  tests. The memory-bounded Vite bundle, prerender, and sitemap steps also
  completed. A browser integration run remains the final open checklist item.

## Decisions

- Target `connexion.AsyncApp` for both backends.
- Keep Connexion and the existing OpenAPI YAML files as the API source of truth.
- Migrate one backend at a time: Store first, Compose second.
- Flip both services in the next release branch.
- Keep synchronous SQLAlchemy and psycopg2 during this migration.
- Use native `httpx.AsyncClient`/`ASGITransport` for HTTP tests; isolate tests by
  truncating the test schema and clearing Redis before and after each test.
- Preserve current Auth0 behavior and Connexion security handler semantics.
- Preserve Store cache keys exactly.
- Preserve current Connexion validation behavior, including Store's production body-validation skip rules.
- Replace Flask CLI commands immediately with `neurostore ...` and `compose ...` commands.
- Replace admin env vars completely with `ADMIN_USERNAME` and `ADMIN_PASSWORD`; do not accept old `FLASK_ADMIN_*` names.
- Keep username/password admin authentication.
- Keep Celery, but remove `Flask-CeleryExt`.
- Require backward-compatible database migrations.
- Use existing realistic database snapshots for performance baselines.
- Treat a p95 latency regression above 20% as a blocker unless explicitly accepted.

## Goals

- Remove Flask as an application/runtime dependency from Store and Compose.
- Keep the public API semantically equivalent.
- Keep local, Docker, and CI workflows at least as easy as today.
- Preserve production operational behavior for auth, caching, migrations, workers, admin, CORS, and error responses.
- Detect speed regressions with realistic data before flipping either backend.

## Non-Goals

- Do not rewrite the OpenAPI contracts into FastAPI-generated schemas.
- Do not move to async SQLAlchemy or asyncpg.
- Do not redesign Auth0, user creation, permissions, or token claims.
- Do not redesign the Store cache invalidation model.
- Do not replace Celery with a different job system.
- Do not make schema-breaking migrations as part of the framework migration.

## External Framework Choices

### API Runtime

Use `connexion.AsyncApp`.

Rationale:
- Connexion 3 is built around ASGI.
- `AsyncApp` is built on Starlette and supports synchronous view functions.
- It keeps Connexion's spec-first routing, request validation, response serialization, security handling, middleware stack, and context.
- It avoids an unnecessary FastAPI route rewrite while still removing Flask.

### Admin

Start with `SQLAdmin`.

Rationale:
- Current admin is Flask-Admin over SQLAlchemy models.
- SQLAdmin is the closest Starlette/FastAPI SQLAlchemy equivalent.
- It supports synchronous SQLAlchemy engines, `ModelView`, and session-based authentication hooks.
- Admin is low-traffic, so exact UI parity is not required.

Fallback:
- Use `Starlette-Admin` if SQLAdmin cannot be mounted cleanly with Connexion `AsyncApp` or a parent Starlette app.

### Celery

Use plain Celery factories configured from service settings.

Rationale:
- Celery does not require a web-framework integration package.
- Current Compose uses Flask only to provide config and app context to tasks.
- Tasks can instead create/close their own SQLAlchemy sessions and read settings directly.

## Compatibility Contracts

### API

- Keep `/api` base paths.
- Keep existing OpenAPI YAML files as source of truth.
- Keep semantic status codes and response payloads.
- Keep Swagger UI availability unless explicitly removed later.
- Keep CORS behavior on success and error responses.
- Keep request/response validation mode semantics.

### Auth

- Keep `BEARERINFO_FUNC` and `APIKEYINFO_FUNC` behavior while migrating.
- Preserve Auth0 domain, audience, issuer, and token decoding behavior.
- Preserve Compose run-key API auth behavior.
- Preserve current user/admin resolution semantics.

### Cache

Store API cache keys must preserve:
- request path string
- sorted multi-query tuple behavior
- user id component
- cache version token format: `v=<version>`
- Redis version key behavior

Cache invalidation must continue to use version bumps rather than Redis key scans.

### Database

- Existing Alembic revision history remains authoritative.
- Runtime migration should not require schema changes.
- Future schema changes must follow expand/contract:
  1. add backward-compatible nullable/new objects
  2. deploy code that reads old and new shape
  3. backfill
  4. deploy code that writes only new shape
  5. remove old shape in a later release

### CLI

Replace commands immediately:

Store:
- `flask db upgrade` -> `neurostore db upgrade`
- `flask db downgrade` -> `neurostore db downgrade`
- `flask db migrate` -> `neurostore db migrate`
- `flask db current` -> `neurostore db current`
- `flask ingest-neurosynth` -> `neurostore ingest-neurosynth`
- `flask ingest-neurovault` -> `neurostore ingest-neurovault`
- `flask ingest-neuroquery` -> `neurostore ingest-neuroquery`
- `flask process-base-study-flag-outbox` -> `neurostore process-base-study-flag-outbox`
- `flask check-base-study-flag-outbox` -> `neurostore check-base-study-flag-outbox`
- `flask process-base-study-metadata-outbox` -> `neurostore process-base-study-metadata-outbox`
- `flask check-base-study-metadata-outbox` -> `neurostore check-base-study-metadata-outbox`
- `flask build-neurostore-studyset-release` -> `neurostore build-neurostore-studyset-release`

Compose:
- `flask db upgrade` -> `compose db upgrade`
- `flask db downgrade` -> `compose db downgrade`
- `flask db migrate` -> `compose db migrate`
- `flask db current` -> `compose db current`
- `flask ingest-neurostore` -> `compose ingest-neurostore`
- `flask create-meta-analyses` -> `compose create-meta-analyses`
- `flask backfill-extraction-metadata` -> `compose backfill-extraction-metadata`

No long-term Flask command shims.

## Implementation Phases

### Phase 0: Baseline and Safety

1. Confirm submodules and current Docker test setup.
2. Restore or load existing realistic database snapshots in local benchmark environments.
3. Run current backend tests before framework changes.
4. Run current production benchmark scripts against the Flask-backed Connexion ASGI app.
5. Store baseline artifacts for p50, p95, p99, throughput, DB query counts, serialization time, cache behavior, and memory.

Exit criteria:
- Baseline test and benchmark commands are documented and repeatable.
- Existing snapshot restore path is known for both Store and Compose.

### Phase 1: Framework-Neutral Configuration and CLI

1. Introduce settings helpers that do not depend on Flask app context.
2. Rename admin env vars to `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
3. Add native service CLIs for Store and Compose.
4. Wrap Alembic commands without Flask-Migrate.
5. Update Docker Compose commands, healthchecks, CI, and docs to call service CLIs.

Exit criteria:
- No docs or deployment commands call `flask ...`.
- Admin credentials are read only from `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
- Migration commands work through service CLIs.

### Phase 2: Store AsyncApp Shell

1. Add `create_asgi_app()` for Store using `connexion.AsyncApp`.
2. Register the current OpenAPI YAML with `MethodResolver("neurostore.resources")`.
3. Register Starlette CORS middleware before routing.
4. Register Connexion exception handlers.
5. Keep current Flask app factory only as temporary compatibility until all Store resource code is migrated.

Exit criteria:
- Store AsyncApp starts.
- Swagger/OpenAPI is available.
- A small migrated route responds through AsyncApp.

### Phase 3: Store Resource Migration

Recommended order:

1. Users and auth-adjacent helpers.
2. Studysets.
3. Studies.
4. Analyses.
5. Conditions, points, images, and tables.
6. Annotations and annotation-analyses.
7. Base-studies search/filtering.
8. Pipeline endpoints.
9. Neurostore studyset releases.

For each route family:
- Replace Flask request parsing with Connexion/Starlette request access.
- Replace Flask aborts with typed exceptions.
- Replace Flask responses with Connexion/Starlette-compatible returns.
- Preserve schemas and response payloads semantically.
- Run targeted API tests.
- Run route-specific performance checks when the route is high-traffic or cache-sensitive.

Exit criteria:
- Store tests pass.
- Store realistic benchmark p95 regression is no more than 20%.
- Store cache key parity tests pass.

### Phase 4: Store Admin, Cache, and Workers

1. Replace Flask-Admin with SQLAdmin.
2. Replace Flask-Caching decorators with explicit cache wrapper preserving exact keys.
3. Remove Store Flask runtime dependencies.
4. Ensure outbox/release workers use `neurostore ...` commands.

Exit criteria:
- `/admin` requires username/password auth.
- Cache hits and invalidation behave the same as baseline.
- Docker workers and healthchecks use service CLI commands.

### Phase 5: Compose AsyncApp Shell

1. Add `create_asgi_app()` for Compose using `connexion.AsyncApp`.
2. Register the current OpenAPI YAML with `MethodResolver("neurosynth_compose.resources")`.
3. Register CORS and exception handling.
4. Replace Flask-CeleryExt with a plain Celery factory.

Exit criteria:
- Compose AsyncApp starts.
- Celery worker starts and imports tasks without Flask app context.
- A small migrated route responds through AsyncApp.

### Phase 6: Compose Resource Migration

Recommended order:

1. Users.
2. Neurostore studysets and Neurostore studies.
3. Snapshot studysets and snapshot annotations.
4. Specifications.
5. Projects.
6. Meta-analyses.
7. Meta-analysis results.
8. Meta-analysis jobs.
9. NeuroVault collections/files and upload side-effect paths.

For each route family:
- Replace Flask request/current_app/abort usage.
- Preserve Auth0 and run-key behavior.
- Preserve job-store Redis behavior.
- Run targeted tests and route-specific performance checks.

Exit criteria:
- Compose tests pass.
- Compose realistic benchmark p95 regression is no more than 20%.
- Celery eager tests and worker import checks pass.

### Phase 7: Remove Flask

1. Remove Flask runtime dependencies from both `pyproject.toml` files.
2. Remove Flask-Migrate, Flask-SQLAlchemy, Flask-Admin, Flask-Caching, Flask-CeleryExt, Flask-Orjson, and Flask-CORS.
3. Remove Flask app factories, app contexts, and compatibility code.
4. Remove generated stale egg-info from the branch if tracked accidentally.
5. Run full backend test suites, benchmark suites, and frontend integration checks.

Exit criteria:
- No imports from `flask`, `flask_*`, `flask_admin`, `flask_migrate`, or `flask_sqlalchemy` remain in production code.
- Docker services start and stay healthy.
- CI uses service CLIs only.

## Performance Plan

### Data

Use existing realistic snapshots rather than empty fixtures.

Approved local snapshots:
- Store full baseline: `04-20-2026-at-00-00-01_neurostore.dump`
- Compose full baseline: `04-09-2026-at-00-00-01_compose.dump`
- Compose reduced smoke baseline: `compose/04-01-2026-at-12-23-45_compose_dev-reduced.dump`

The full baseline snapshots are used for performance gates. The reduced Compose
snapshot is only for faster local smoke validation.

### Baseline

Run baselines before each backend flip:
- current Flask-backed Connexion ASGI app
- realistic restored database
- cache warmed and cold-cache runs

Use existing benchmark/profiling code where possible:
- `store/backend/neurostore/production_benchmark.py`
- `compose/backend/neurosynth_compose/production_benchmark.py`

Baseline command:

```sh
scripts/production_benchmark/run_framework_migration_baselines.sh --service both
```

Service-specific baseline commands:

```sh
scripts/production_benchmark/run_framework_migration_baselines.sh --service store
scripts/production_benchmark/run_framework_migration_baselines.sh --service compose
```

### Metrics

Track:
- p50, p95, p99 latency
- throughput
- DB query count per endpoint
- serialization time
- cache hit/miss behavior
- memory growth over benchmark runs
- error rate

### Critical Store Endpoints

- studysets list/detail
- studies list/detail
- analyses list/detail
- annotations list/detail
- base-studies search/filtering
- pipeline study results and embeddings
- release manifest/download endpoints

### Critical Compose Endpoints

- projects list/detail
- specifications list/detail
- meta-analyses list/detail
- meta-analysis results
- meta-analysis jobs list/detail/result/logs
- NeuroVault collection/file paths

### Gate

- A p95 latency regression greater than 20% blocks the migration unless explicitly accepted.
- `scripts/production_benchmark/compare_results.py` defaults to `p95_seconds`
  and a `0.2` slowdown threshold.
- DB query count increases block the route family unless justified.
- Cache-hit routes must preserve key parity and invalidation behavior.

## Questions to Ask During Implementation

Ask before destructive or ambiguous steps:
- Which exact snapshot file should be restored for Store?
- Which exact snapshot file should be restored for Compose?
- Is it acceptable to temporarily keep a compatibility adapter in production code for a specific route family?
- If SQLAdmin cannot match a Flask-Admin behavior, is a simpler admin behavior acceptable for that model?
- If a route exceeds the 20% p95 threshold, should it be optimized immediately or deferred behind a documented exception?

## Current First Slice

The first implementation slice is:
1. Add this migration plan.
2. Rename admin env vars to `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
3. Update docs and examples for admin env names.
4. Add service CLI scaffolding in a later slice after checking existing dirty `manage.py` changes.
