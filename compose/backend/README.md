## Directory Structure

- [`compose/backend/`](compose/backend): Contains all neurosynth_compose backend code and configuration.
  - [`neurosynth_compose/`](compose/backend/neurosynth_compose): Python package source code
  - [`manage.py`](compose/backend/manage.py), [`pyproject.toml`](compose/backend/pyproject.toml), [`setup.cfg`](compose/backend/setup.cfg), [`MANIFEST.in`](compose/backend/MANIFEST.in), [`README.md`](compose/backend/README.md): Backend config and docs

Other unrelated files (neurosynth-frontend, nginx, postgres, scripts, docker-compose files) remain at the top level of `compose/`.
# neurosynth-compose

Requirements: Docker and docker-compose.

## Configuration
First, set up the main environment variables in `.env` (see: `.env.example`).

    cp .env.example .env

Edit the `.env` template to set the correct variables

`APP_ENV` is the environment selector. Supported values are `development`,
`staging`, `production`, `testing`, and `docker_test`. The stack resolves the
matching Flask config and database name automatically.

## Initializing backend
Create the network, build the containers, and start services using the development configuration:

  docker network create ${SHARED_PROXY_NETWORK:-nginx-proxy}  # if this does not already exist
    docker-compose build
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

The server should now be running at http://localhost:81

The shared cross-stack network name is controlled by `SHARED_PROXY_NETWORK` in `.env`.
Keep the default `nginx-proxy` for normal local development, or use a track-specific
value when running multiple environments on the same host.

With `APP_ENV=development`, a fresh Postgres volume initializes `compose_test_db`
automatically. If you are reusing an older volume created under a different
environment, recreate the volume or create `compose_test_db` manually before migrating.

Next, apply the existing migrations (they are the canonical schema definition):

    docker-compose exec compose flask db upgrade

Note: the stack now resolves the database from `APP_ENV` automatically.
Development, testing, and `docker_test` use `compose_test_db`; staging and
production use `compose` by default.

Note: `compose-pghero` now follows the same environment-based database
resolution as the rest of the stack.


## Maintaining docker image and db
If you make a change to compose, you should be able to simply restart the server.

    docker-compose restart compose

If you change any models, generate a new Alembic migration and migrate the database (commit the generated revision file so it becomes the new source of truth):

    docker-compose exec compose flask db migrate
    docker-compose exec compose flask db upgrade


## Database migrations

The migrations stored in `backend/migrations` are the **only** source of truth for the schema—avoid merging heads, stamping, or manually altering the history. Always move the database forward (or rebuild from scratch) by applying the tracked revisions.

### Applying migrations after pulling a branch

Any time you start the backend or pull the latest changes, bring the database to the expected state with:

```sh
docker-compose exec compose flask db upgrade
```

`upgrade` is idempotent, so rerunning it is harmless; it only applies migrations that have not been run yet.

### Resetting the database when switching branches

Because each branch might change the schema independently, recreate the database before starting work on a different branch so that Alembic can replay only the migrations that exist on that branch.

```sh
docker compose stop compose compose_worker compose_nginx compose-pghero compose-grafana
docker compose exec compose-pgsql17 psql -U postgres -c "DROP DATABASE IF EXISTS compose_test_db;"
docker compose exec compose-pgsql17 psql -U postgres -c "CREATE DATABASE compose_test_db;"
docker compose up -d
docker compose exec compose flask db upgrade
```

If you're using the legacy Postgres container, replace `compose-pgsql17` with `compose_pgsql` in the commands above.


## Running tests
To run tests after starting services, ensure `compose_test_db` exists.

and execute:

    docker compose exec compose-pgsql17 psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'compose_test_db'" | grep -q 1 || docker compose exec compose-pgsql17 psql -U postgres -c "CREATE DATABASE compose_test_db;"
    docker compose run -e "APP_ENV=docker_test" --rm compose bash -c "python -m pytest neurosynth_compose/tests"

## Admin interface
The Flask-Admin UI is served at `/admin` once the stack is running.

Access:
- Dev: http://localhost:81/admin
- Prod: https://compose.neurosynth.org/admin

Auth:
- Set `FLASK_ADMIN_USERNAME` and `FLASK_ADMIN_PASSWORD` in the environment.
- The browser will prompt for HTTP Basic auth when you visit `/admin`.

Grant admin access (recommended for any admin UI access):
```sh
# Find the user ID
docker compose exec compose-pgsql17 psql -U postgres -d compose_test_db \
  -c "SELECT id, external_id FROM users WHERE external_id = 'user-external-id';"

# Assign admin role
docker compose exec compose-pgsql17 psql -U postgres -d compose_test_db \
  -c "INSERT INTO roles_users (user_id, role_id) VALUES ('user-id', 'admin');"
```
