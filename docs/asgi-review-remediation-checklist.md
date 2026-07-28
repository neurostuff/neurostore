# ASGI Review Remediation Checklist

This checklist records the accepted follow-up work from PR #1627 review.

## Decisions

- [x] Use one `manage` executable for Store and Compose operational commands.
- [x] Keep synchronous SQLAlchemy and psycopg2. Do not introduce async SQLAlchemy
  or asyncpg in this migration.
- [x] Keep Uvicorn reload for development and Gunicorn with `uvicorn-worker` for
  production.

## Work

- [ ] Replace Flask-shaped runtime, request, and test-client global state with
  explicit ASGI dependencies and request-scoped state.
- [ ] Consolidate CLI entry points and update Docker, documentation, and CI to
  use `manage`.
- [ ] Keep database isolation fixture-owned: request-visible setup may commit,
  while cleanup, expiry, and rollback remain centralized.
- [ ] Move real migration upgrade/current/downgrade/upgrade coverage into backend
  tests and let CI invoke those tests.
- [ ] Remove compatibility-only abstractions, dead mixins, repeated local imports,
  and unnecessary configuration knobs.
- [ ] Require p95 in benchmark comparison inputs; do not substitute median latency.
- [ ] Verify CORS headers across successful, empty, validation, authentication,
  not-found, and rate-limit responses.
- [ ] Preserve the existing JSON database type for `Specification.filter` and add
  a regression test for its mapping and round trip.
- [ ] Run Store and Compose backend suites, lint, migration tests, and benchmark
  comparison tests.
