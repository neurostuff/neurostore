# Neurostore review front end

The review app is served under `/review/`. It reuses the main site's Auth0 session, so in development it is opened through the main app's dev server.

## Running in development

The main app's first-time setup (`npm install`, `.env.dev`) is in `.github/copilot-instructions.md`.

1. Start the review dev server (port 3001): `npm start`
2. In `compose/neurosynth-frontend`, start the main app dev server (port 3000): `npm run start:dev`
3. Open http://localhost:3000/review/

The main dev server proxies `/review/` to port 3001, including the HMR websocket. Port 3001 also serves `/review/` on its own, but Auth0 does not allow sign-in from `localhost:3001`, so use port 3000 for anything that needs a session.

## Scripts

- `npm run test`: unit tests (Vitest), without the timing tests
- `npm run test:perf`: the timing tests (`src/**/*.perf.test.tsx`), on their own (`vitest run --mode perf`); CI does not run them
- `npm run typecheck`: TypeScript without emit
- `npm run lint`: ESLint
- `npm run build`: typecheck and production build
- `npm run gen:types`: regenerate `src/contract/generated` from the OpenAPI spec and the review JSON Schemas
- `npm run check:types`: regenerate them and fail if `src/contract/generated` differs from what git holds, an untracked file included

The backend's timing tests are skipped by default; run them with `python -m pytest --performance neurostore/tests/review/test_coordinate_batch_speed.py`.

## Golden files

The golden files under `src/test/golden` (and `src/contract/references.fixture.json`) are shared with the backend's tests. Regenerate them all this way, from the monorepo root:

1. The backend's goldens: the store test command from AGENTS.md, with `UPDATE_GOLDEN=1`:
   `cd store && docker compose run -e "APP_ENV=docker_test" -e "UPDATE_GOLDEN=1" --rm neurostore bash -c "python -m pytest neurostore/tests/review"`
   The container writes the files as root; `chown` them back to yourself afterwards.
2. `ops.json`, which the front end writes from `bundle.json`: `cd store/review-frontend && UPDATE_GOLDEN=1 npm run test`
3. Run step 1 again without `UPDATE_GOLDEN`, so the backend replays the new `ops.json`.
