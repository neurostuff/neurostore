# Neurostore outreach: the admin panel and the author's page

Two apps for SPAM, the NeuroVault outreach pilot, built as separate bundles:

- the **admin panel** (`src/`, `index.html`), served under `/outreach/`, calling the
  outreach API at `/api/outreach`;
- the **author's page** (`src/share/`, `share/`), served under `/share/`, where an author
  opens their link, uploads their maps and submits, calling `/api/share`.

Both APIs are in `store/backend/neurostore/outreach/`, mounted in the store backend outside
the OpenAPI spec. The public bundle ships none of the admin panel's code.

Admins are the Auth0 users whose subs are listed in the backend's `OUTREACH_ADMINS`. In
development the panel can instead sign in with the backend's `OUTREACH_DEV_PASSWORD`,
which the backend honours only when `ENV` is `development` or `testing`.

Deploying it is in [docs/outreach/DEPLOY.md](../../docs/outreach/DEPLOY.md).

## Running in development

1. Copy `.env.example` to `.env.development.local` (it signs in with the dev password).
2. Set `OUTREACH_DEV_PASSWORD` for the store backend and make it reachable, then start the
   panel (port 3002), naming the backend if it is not on `localhost:8000`:
   `OUTREACH_API_PROXY=http://localhost:8000 npm start`
3. Open http://localhost:3002/outreach/
4. For the author's page, start its dev server too (port 3003): `npm run start:share`, and
   set the backend's `OUTREACH_SHARE_URL=http://localhost:3003/share/#` so the links the
   panel makes open it. "Preview author page" on a draft opens it without recording anything.

The build needs Node 22. Without it locally, use a throwaway container from the repo root:

    docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/repo" -w /repo/store/outreach-frontend node:22 sh -c "npm ci && npm run build"

## Scripts

- `npm run test`: unit tests (Vitest)
- `npm run typecheck`: TypeScript without emit
- `npm run lint`: ESLint
- `npm run build`: typecheck and production builds into `dist/` (the panel) and
  `dist-share/` (the author's page), which the store's nginx serves at `/outreach/` and
  `/share/`
