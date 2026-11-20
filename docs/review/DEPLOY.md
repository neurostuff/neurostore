# Deploying the review app (neurostore.org/review)

The review app has two parts:
- **the API:** `/api/review/…` routes in the neurostore backend, deployed with neurostore as usual;
- **a static front end:** `store/review-frontend`, which the store's nginx serves at `/review/`.

Staging and dev deploys (`scripts/deploy/deploy_environment.sh`) do all of this on their own: `build_review_frontend` writes the build settings from the main front end's env file and builds `dist/` before store_nginx starts, and the store smoke check fetches `/review/`. This page is the extra work a production release with the review app needs. It sits on top of the store steps in [RELEASE_DEPLOYMENT.md](../../RELEASE_DEPLOYMENT.md). Run every command from the release checkout on the neurostore.org host unless it says otherwise.

## Once, before the first deploy

1. **Backups that need authentication (W20).** The review tables hold reviewers' work, and `fulltexts` holds article text. Before either reaches production, the database backups must need credentials to read. Create the credentials with the AWS CLI and put them on the maintainers' machines, the neurostore.org server and the neurostore.xyz server, never in the repos.

2. **Auth0.** The review app uses the main site's Auth0 tenant and SPA client: the same domain, client id and audience as `compose/neurosynth-frontend/.env.production`. In that SPA client's settings, add `https://neurostore.org/review/` to:
   - Allowed Callback URLs
   - Allowed Logout URLs
   - Allowed Web Origins (as `https://neurostore.org`)

   Add the staging host's `/review/` the same way. For development, the client also needs `http://localhost:3000/review/`, since dev opens the app through the main dev server.

   A reviewer already signed in on neurosynth.org gets one silent Auth0 redirect the first time they open `/review/`, with no password, then stays signed in.

3. **The front end's build settings.** Create `store/review-frontend/.env.production.local` on the host. It is git-ignored, like the other `.env` files. Use `.env.example` for the names and fill them in:

   ```bash
   VITE_APP_AUTH0_DOMAIN=<the main site's Auth0 domain>
   VITE_APP_AUTH0_CLIENT_ID=<the main site's SPA client id>
   VITE_APP_AUTH0_AUDIENCE=<the neurostore API audience>
   VITE_APP_NEUROSTORE_API_DOMAIN=https://neurostore.org/api
   ```

   Leave `VITE_APP_REVIEW_FIXTURES` unset in production.

## Each deploy

These steps go into the store sequence of RELEASE_DEPLOYMENT.md.

1. **Back up first,** as RELEASE_DEPLOYMENT.md says. This is the `pg_dump` of `neurostore`.

2. **Images and migrations.** Build or pull the store images, then run `manage db upgrade --revision heads`. The neurostore image installs the study_schema version pinned in `store/backend/pyproject.toml`; the review API reads its schemas from that package. The first deploy's migrations create:
   - the review tables;
   - `fulltexts`;
   - `study_entities.stable_id`;
   - the `admin-reviewer` role.

   No existing rows change.

3. **Build the front end.** Do this before nginx starts. The build needs Node 22, which the neurostore image lacks, so use a throwaway Node container. It mounts the repo root because the app depends on `packages/coordinate-table` and `packages/neurosynth-theme`:

   ```bash
   docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/repo" -w /repo/store/review-frontend node:22 \
     sh -c "npm ci && npm run build"
   ```

   This writes `store/review-frontend/dist/`. nginx serves it from `/store/review-frontend/dist/`, which it sees through `volumes_from: neurostore`, the store checkout mounted at `/store`. A new build is live on the next request, with no nginx restart.

4. **Start nginx last,** as RELEASE_DEPLOYMENT.md says. The `/review/` locations are in `store/nginx/nginx.conf`, which is mounted read-only from the checkout. If nginx is already running, `docker compose exec store_nginx nginx -s reload` picks up the config.

## Giving people access

The API lets in only users holding the `admin-reviewer` role. A user exists in `users` once they have signed in to neurosynth.org or neurostore once. Grant the role by their Auth0 sub (`users.external_id`, for example `github|12564882`):

```bash
cd store
docker compose exec -T store-pgsql17 psql -U postgres -d neurostore -c "
  INSERT INTO roles_users (user_id, role_id)
  SELECT u.id, 'admin-reviewer' FROM users u
  WHERE u.external_id = '<auth0 sub>'
    AND NOT EXISTS (SELECT 1 FROM roles_users ru WHERE ru.user_id = u.id AND ru.role_id = 'admin-reviewer');"
```

Everyone without the role sees the API's 403 message in the app.

## Loading papers to review

Reviewers or leads load papers in one of two ways:
- the import page (`POST /api/review/imports/`, up to 200 MB);
- the CLI.

Each paper must match an existing base study. Import never creates one, and a paper with only preprint ids is refused.

```bash
cd store
# A layout directory (parsed paper, text, coordinate parse, extraction record per paper):
docker compose run --rm --no-deps -v /path/to/layout:/layout:ro neurostore \
  manage review-import /layout --user-id '<auth0 sub of whoever loads them>'
# Or a pipeline run neurostore already holds:
docker compose run --rm --no-deps neurostore \
  manage review-import-run --config-id <config> --run-id <run> --user-id '<auth0 sub>'
```

## Check it works

- `https://neurostore.org/review` redirects to `/review/`, and the page title is "neurostore review".
- Signed in with the role, the paper list loads and shows the imported papers.
- Opening a paper shows its text, and an edit saves: the header shows "saved".
- A deep link such as `/review/papers/<id>`, reloaded, opens the same paper. That is nginx's fallback to `index.html`.
- `https://neurostore.org/` still redirects to neurostuff.github.io.

`store/backend/neurostore/tests/review/test_nginx.py` checks the nginx locations and the `/store` mount in CI.

## Rolling back

- **Front end:** check out the previous release and rebuild `dist/` (step 3 of each deploy), or restore a saved copy of `dist/`.
- **API:** follow RELEASE_DEPLOYMENT.md. The review migrations only add tables and columns, so the previous release runs against them unchanged.
- **Data:** restore the `pg_dump` taken in step 1.
