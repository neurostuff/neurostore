# Deploying outreach (neurostore.org/outreach)

Outreach asks the corresponding authors of recent papers to deposit their group-level maps on NeuroVault. It has these parts:

- **the admin API:** `/api/outreach/…`, a Starlette app mounted in the neurostore backend outside the OpenAPI spec (`store/backend/neurostore/outreach/api.py`), deployed with neurostore as usual;
- **the author's API:** `/api/share/…`, public, mounted the same way (`outreach/share.py`). An author's link is `https://neurostore.org/share/#<token>`: the token sits after `#`, which browsers never send, and the page trades it for an HttpOnly cookie;
- **two static front ends** from `store/outreach-frontend`, which the store's nginx serves: the admin panel at `/outreach/` (`dist/`) and the author's page at `/share/` (`dist-share/`). `npm run build` builds both, as separate bundles;
- **the tables:** `outreach_*`, from migration `5a7c9e1b3d6f`. They hold no email address. A person is the keyed hash of one, and addresses stay encrypted in `corresponding_author_emails`;
- **the uploaded maps:** files under `OUTREACH_UPLOAD_DIR` (default `FILE_DIR/outreach-uploads`), one folder per draft.

Staging and dev deploys (`scripts/deploy/deploy_environment.sh`) build the panel on their own: `build_store_frontend outreach-frontend` writes its build settings from the main front end's env file and builds `dist/` before store_nginx starts. This page is the extra work a production release with outreach needs, on top of [RELEASE_DEPLOYMENT.md](../../RELEASE_DEPLOYMENT.md) and the review app's [DEPLOY.md](../review/DEPLOY.md), whose steps it mirrors.

## Once, before the first deploy

1. **`CONTACT_EMAIL_KEY` is set.** The panel decrypts authors' addresses to write the invitation emails, so the store needs the key the addresses were stored under (see `.env.example`).

2. **Admins.** Set `OUTREACH_ADMINS` in the store's `.env` to the Auth0 subs of the people allowed in, comma-separated (for example `github|12564882`). No site role lets anyone in: the panel shows authors' addresses, so the list names people. `OUTREACH_DEV_PASSWORD` must stay unset outside development; the backend ignores it unless `APP_ENV` is development or testing, but leave it out anyway.

3. **Links, signature and uploads.** `OUTREACH_SHARE_URL` is where an author's link opens (default `https://neurostore.org/share/#`; the token is appended after the `#`). `OUTREACH_SIGNATURE` signs the emails, with `\n` for new lines. `OUTREACH_UPLOAD_DIR` is where authors' maps are kept; put it on a disk that is backed up, since a submitted map exists nowhere else until it is published.

4. **Auth0.** The panel uses the main site's Auth0 tenant and SPA client, as `/review` does. In that client's settings, add `https://neurostore.org/outreach/` to:
   - Allowed Callback URLs
   - Allowed Logout URLs
   - Allowed Web Origins (as `https://neurostore.org`)

   Add the staging host's `/outreach/` the same way.

5. **The front end's build settings.** Create `store/outreach-frontend/.env.production.local` on the host (git-ignored), with the main site's values. The API root includes `/api`, as the main site's does:

   ```bash
   VITE_APP_AUTH0_DOMAIN=<the main site's Auth0 domain>
   VITE_APP_AUTH0_CLIENT_ID=<the main site's SPA client id>
   VITE_APP_AUTH0_AUDIENCE=<the neurostore API audience>
   VITE_APP_NEUROSTORE_API_DOMAIN=https://neurostore.org/api
   ```

## Each release

1. **Migrate** with the store: `docker compose exec neurostore manage db upgrade`.

2. **Build the panel** with Node 22 in a throwaway container, from the release checkout's root (the app depends on `packages/neurosynth-theme`):

   ```bash
   docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/repo" -w /repo/store/outreach-frontend node:22 \
     sh -c "npm ci --no-audit --no-fund && npm run build"
   ```

   This writes `store/outreach-frontend/dist/` and `dist-share/`, which nginx serves from `/store/outreach-frontend/` through `volumes_from: neurostore`. A new build is live on the next request.

3. **Reload nginx** if `store/nginx/nginx.conf` changed: `docker compose exec store_nginx nginx -s reload`.

## Checking it

- `https://neurostore.org/outreach/` asks you to sign in; signed in as someone not in `OUTREACH_ADMINS`, it says so.
- `curl -s -o /dev/null -w '%{http_code}' https://neurostore.org/api/outreach/me` answers 401.
- Signed in as an admin, the Papers view lists candidates, and a paper's draft page opens.
- On a draft page, "Preview author page" opens `/share/` as the author would see it, recording nothing.
- `curl -s -o /dev/null -w '%{http_code}' https://neurostore.org/api/share/draft` answers 401 (no link's cookie).

## Before emailing anyone

Do a dry run first: approve a draft for a paper of your own, make its link, open it, upload real maps, check the matches and submit. Approving and publishing submissions to NeuroVault come in a later milestone; until then, submitted maps wait in `OUTREACH_UPLOAD_DIR`.
