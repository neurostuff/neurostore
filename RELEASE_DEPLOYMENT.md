# Release and Production Deployment Runbook

This repo currently has automated deploy tracks for `dev` and `staging`, but not
for production. Use this runbook when preparing a GitHub release and when
manually deploying the released code to production.

## Current Automation

- Pushing to `dev` runs `.github/workflows/deploy-dev.yml`.
- Pushing to `master` runs `.github/workflows/deploy-staging.yml`.
- Both workflows SSH to the deploy host and run
  `scripts/deploy/deploy_environment.sh`.
- `scripts/deploy/deploy_environment.sh` only accepts `--track dev` or
  `--track staging`; it is not a production deploy command.
- `.github/workflows/release-sync.yml` keeps release metadata and package
  versions synced with a release tag.
- `.github/workflows/release-drafter.yml` updates the draft GitHub release from
  merged PRs on `master`.
- `.github/workflows/production-benchmark.yml` runs on GitHub release events and
  compares the release against the previous tag.

## Release Tag and Version Sync

The release tag is the source of truth for package versions. The synced files
are:

- `codemeta.json`
- `.zenodo.json`
- `store/backend/pyproject.toml`
- `compose/backend/pyproject.toml`
- `compose/neurosynth-frontend/package.json`

Recommended release flow:

```bash
git fetch upstream --tags --prune
git checkout master
git pull --ff-only upstream master
git submodule update --init --recursive
```

Choose the next tag, for example:

```bash
export TAG=v0.19.0
```

Run the GitHub Actions workflow `Release Metadata Sync` with `tag=$TAG`. That
workflow commits the metadata/version updates first, then creates and pushes the
annotated tag on the resulting commit.

Do not manually create the tag before syncing versions unless this check already
passes:

```bash
python3 scripts/release/sync_release_metadata.py --tag "$TAG" --check
```

If a tag already exists and the check fails, the tag points at a commit whose
release metadata does not match the tag. Do not move a published release tag
casually. If the release has not been published yet, coordinate deleting and
recreating the tag; otherwise create a new patch tag.

Local equivalent of the workflow, if needed:

```bash
python3 scripts/release/sync_release_metadata.py --tag "$TAG"
git diff -- codemeta.json .zenodo.json store/backend/pyproject.toml compose/backend/pyproject.toml compose/neurosynth-frontend/package.json
git add codemeta.json .zenodo.json store/backend/pyproject.toml compose/backend/pyproject.toml compose/neurosynth-frontend/package.json
git commit -m "Sync release metadata for $TAG"
git tag -a "$TAG" -m "$TAG"
git push upstream master "$TAG"
```

After the tag exists:

```bash
git fetch upstream --tags --prune
git checkout "$TAG"
python3 scripts/release/sync_release_metadata.py --tag "$TAG" --check
```

Then publish the GitHub release from the release draft using the same tag.

## Pre-Production Checks

Set the previous and new tags:

```bash
export TAG=v0.19.0
export PREVIOUS_TAG="$(git describe --tags --abbrev=0 "$TAG^")"
```

Review what will change:

```bash
git log --oneline "$PREVIOUS_TAG..$TAG"
git diff --name-status "$PREVIOUS_TAG..$TAG"
```

Check deploy and service definition changes:

```bash
git diff --name-status "$PREVIOUS_TAG..$TAG" -- \
  .github/workflows \
  scripts/deploy \
  store/docker-compose.yml \
  store/docker-compose.deploy.yml \
  compose/docker-compose.yml \
  compose/docker-compose.deploy.yml
```

Check database migrations:

```bash
git diff --name-status "$PREVIOUS_TAG..$TAG" -- \
  store/backend/migrations/versions \
  compose/backend/migrations/versions
```

Check OpenAPI changes:

```bash
git diff --name-status "$PREVIOUS_TAG..$TAG" -- \
  store/backend/neurostore/openapi \
  compose/backend/neurosynth_compose/openapi
```

Check environment variable changes. Run this from the repo root and compare the
example files with the production env files on the production host:

```bash
env_keys() {
  sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' "$1" | sort -u
}

comm -23 <(env_keys store/.env.example) <(env_keys store/.env.production)
comm -23 <(env_keys compose/.env.example) <(env_keys compose/.env.production)
comm -23 <(env_keys compose/neurosynth-frontend/.env.example) <(env_keys compose/neurosynth-frontend/.env.production)
```

If production uses `store/.env`, `compose/.env`, or another host-managed name,
substitute those paths. Any output is a key that exists in the example file but
is missing from production.

Environment details to verify before production:

- `APP_ENV=production` for both backend env files.
- `POSTGRES_HOST=store-pgsql17` for Store and `POSTGRES_HOST=compose-pgsql17`
  for Compose.
- Store has `CACHE_REDIS_URL=redis://store_redis:6379/0`.
- Compose has `CELERY_BROKER_URL=redis://compose_redis:6379/0` and
  `CELERY_RESULT_BACKEND=redis://compose_redis:6379/0`.
- Compose has `NEUROSTORE_API_URL` pointed at the production Store API.
- `V_HOST` and `LETSENCRYPT_HOST` values resolve to the production hostnames.
- Frontend env files use `VITE_` keys, not stale `REACT_APP_` keys.
- `VITE_APP_ENV=PROD`, production Auth0 audience/domain/client id, production
  API URLs, `VITE_APP_SITE_URL`, and SEO/Sentry settings are correct.
- `FILE_DIR`, Store `ACE_DIR`, and Compose `CELERY_LOG_DIR` exist on the host
  and are writable by Docker.
- AWS credentials and `S3_PATH` are still correct for production backups.
- Store OpenAI, PubMed, Semantic Scholar, and Auth0 secrets are present if the
  release touches those paths.

The staging/dev deploy script now creates host bind directories for staging/dev
worktrees, but a raw production `docker compose` deploy does not. Create missing
production bind directories manually:

```bash
mkdir -p "$STORE_FILE_DIR" "$STORE_ACE_DIR" "$COMPOSE_FILE_DIR" "$COMPOSE_CELERY_LOG_DIR"
```

## Production Deployment

Production deployment is manual unless a production workflow is added later. Run
the commands on the production host from the production checkout.

Prepare the checkout:

```bash
git fetch upstream --tags --prune
git checkout "$TAG"
git submodule sync --recursive
git submodule update --init --recursive
```

Take database backups before changing containers or running migrations:

```bash
cd store
docker compose exec -T store-pgsql17 pg_dump -U postgres -d neurostore -Fc > "../neurostore-${TAG}-$(date +%Y%m%d%H%M%S).dump"

cd ../compose
docker compose exec -T compose-pgsql17 pg_dump -U postgres -d compose -Fc > "../compose-${TAG}-$(date +%Y%m%d%H%M%S).dump"
```

Build or pull images. The current CI publishes content-hash image tags plus
moving `dev` and `staging` tags; it does not publish `vX.Y.Z` image tags. For
production, either build locally from the checked-out tag or explicitly set
immutable image tags that you know exist.

Local build:

```bash
cd store
docker compose build

cd ../compose
docker compose build
```

Start Store in order:

```bash
cd store
docker compose stop store_nginx neurostore store_outbox_worker store_metadata_outbox_worker store_release_worker store-pghero store-grafana || true
docker compose up -d store-pgsql17 store_redis
docker compose run --rm --no-deps neurostore flask db upgrade heads
docker compose up -d --no-build neurostore store_outbox_worker store_metadata_outbox_worker store-pghero store-grafana
docker compose exec -T store_redis redis-cli FLUSHDB
docker compose up -d --no-build store_release_worker
docker compose up -d --no-build store_nginx
```

Start Compose in order:

```bash
cd ../compose
docker compose stop compose_nginx compose compose_worker compose-pghero compose-grafana || true
docker compose up -d compose-pgsql17 compose_redis
docker compose run --rm --no-deps compose flask db upgrade heads
docker compose up -d --no-build compose_worker compose compose-pghero compose-grafana
docker compose exec -T compose bash -lc "cd /compose/neurosynth-frontend && npm install && npm run build:prod"
docker compose up -d --no-build compose_nginx
```

Service ordering notes:

- Keep Postgres and Redis up while replacing app containers.
- Run migrations before starting queue/release workers against new code.
- Start `store_release_worker` after Store migrations and normal Store workers.
  It builds nightly/monthly studyset release artifacts and should not run during
  schema changes.
- Start nginx last for each stack so public traffic returns only after the app
  and frontend assets are ready.
- Compose needs Redis before `compose_worker`; the API container depends on the
  worker in `compose/docker-compose.yml`.

## Post-Deploy Verification

Check container state:

```bash
cd store
docker compose ps
docker compose logs --tail=100 neurostore store_outbox_worker store_metadata_outbox_worker store_release_worker

cd ../compose
docker compose ps
docker compose logs --tail=100 compose compose_worker
```

Check database migration heads:

```bash
cd store
docker compose exec -T neurostore flask db current

cd ../compose
docker compose exec -T compose flask db current
```

Smoke check APIs. Replace the hostnames with the production hostnames:

```bash
curl -fsS "https://<production-store-host>/api/studies?per_page=1" >/tmp/neurostore-smoke.json
curl -fsS "https://<production-compose-host>/api/meta-analyses/?per_page=1" >/tmp/compose-smoke.json
```

Check the frontend in a browser:

- Home/search loads without stale JS chunks.
- Auth0 login redirects to the production tenant and returns to the site.
- Store-backed study search works.
- A Compose project page loads.
- A small analysis job can be submitted or an existing job status can be read.

Check release artifacts:

- Store release files are still being written under the expected `FILE_DIR`.
- If `FILE_DIR` or release subdirectories changed, confirm nginx can serve the
  files and the mounted directory contains the expected nightly/monthly outputs.
- `store_release_worker` logs show successful
  `build-neurostore-studyset-release --nightly --monthly-if-due` cycles.

If smoke checks fail, leave Postgres volumes intact. Stop public nginx first,
inspect logs, and either fix forward or roll back by checking out the previous
tag and rebuilding/restarting the app containers against the existing database.
