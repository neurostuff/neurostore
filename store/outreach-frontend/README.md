# Neurostore outreach admin panel

The admin panel for SPAM, the NeuroVault outreach pilot, served under `/outreach/`. It
calls the outreach API at `/api/outreach` (`store/backend/neurostore/outreach/`), which is
mounted in the store backend outside the OpenAPI spec.

Admins are the Auth0 users whose subs are listed in the backend's `OUTREACH_ADMINS`. In
development the panel can instead sign in with the backend's `OUTREACH_DEV_PASSWORD`,
which the backend honours only when `ENV` is `development` or `testing`.

## Running in development

1. Copy `.env.example` to `.env.development.local` (it signs in with the dev password).
2. Set `OUTREACH_DEV_PASSWORD` for the store backend and make it reachable, then start the
   panel (port 3002), naming the backend if it is not on `localhost:8000`:
   `OUTREACH_API_PROXY=http://localhost:8000 npm start`
3. Open http://localhost:3002/outreach/

The build needs Node 22. Without it locally, use a throwaway container from the repo root:

    docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/repo" -w /repo/store/outreach-frontend node:22 sh -c "npm ci && npm run build"

## Scripts

- `npm run test`: unit tests (Vitest)
- `npm run typecheck`: TypeScript without emit
- `npm run lint`: ESLint
- `npm run build`: typecheck and production build into `dist/`, which the store's nginx
  serves at `/outreach/`
