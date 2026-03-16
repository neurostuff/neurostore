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

## Quick path check
- If you are not sure where the file is, run:
  - `test -f .github/copilot-instructions.md && echo found`
