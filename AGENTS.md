# Local Agent Instructions (Neurostore Monorepo)

## First step in every session
1. Confirm repo root: `pwd` should be `/home/jdkent/projects/neurostore`.
2. Open and follow `.github/copilot-instructions.md` before running builds/tests.
3. If anything is unclear, fallback to `.github/workflows/workflow.yml`.

## Test execution source of truth
- Use the commands in `.github/copilot-instructions.md` under `## Testing - Set Long Timeouts`.
- Do not invent alternate test commands unless the documented ones fail.

## Canonical backend test commands
- Store:
  - `cd store`
  - `docker compose exec -T store-pgsql17 bash -lc "psql -U postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = 'store_test_db'\" | grep -q 1 || psql -U postgres -c \"create database store_test_db\""`
  - `docker compose run -e "APP_ENV=docker_test" --rm neurostore bash -c "python -m pytest neurostore/tests"`
- Compose:
  - `cd compose`
  - `docker compose exec -T compose-pgsql17 bash -lc "psql -U postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = 'compose_test_db'\" | grep -q 1 || psql -U postgres -c \"create database compose_test_db\""`
  - `docker compose run -e "APP_ENV=docker_test" --rm compose bash -c "python -m pytest neurosynth_compose/tests"`

## Neurosynth frontend (`compose/neurosynth-frontend`)

From monorepo root, `cd compose/neurosynth-frontend` first. First-time setup (`.env.dev`, `npm install`) is documented in `.github/copilot-instructions.md` § **Frontend Development**.

- **Dev server**: `npm run start:dev` — Vite at http://localhost:3000
- **Unit tests (Vitest)**: `npm run test`
- **Cypress E2E (headless)**: `npm run cy:e2e-headless` — expects the app at `baseUrl` in `cypress.config.ts` (http://localhost:3000); full flows need backend services as described in copilot-instructions. Use `npm run cy:e2e-headless-dev` to load `.env.dev` via `env-cmd`.
- **Embedded terminals / agents**: If Cypress fails during binary verification with `bad option: --smoke-test` (or similar), Electron was started with Node-mode env; prefix the command with `env -u ELECTRON_RUN_AS_NODE` (e.g. `env -u ELECTRON_RUN_AS_NODE npm run cy:e2e-headless`).

## Quick path check
- If you are not sure where the file is, run:
  - `test -f .github/copilot-instructions.md && echo found`
