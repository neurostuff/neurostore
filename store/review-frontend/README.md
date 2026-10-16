# Neurostore review front end

The review app is served under `/review/`. It reuses the main site's Auth0 session, so in development it is opened through the main app's dev server.

## Running in development

1. Start the review dev server (port 3001): `npm start`
2. In `compose/neurosynth-frontend`, start the main app dev server (port 3000): `npm run start:dev`
3. Open http://localhost:3000/review/

The main dev server proxies `/review/` to port 3001, including the HMR websocket. Port 3001 also serves `/review/` on its own, but Auth0 does not allow sign-in from `localhost:3001`, so use port 3000 for anything that needs a session.

## Scripts

- `npm run test`: unit tests (Vitest)
- `npm run typecheck`: TypeScript without emit
- `npm run lint`: ESLint
- `npm run build`: typecheck and production build
