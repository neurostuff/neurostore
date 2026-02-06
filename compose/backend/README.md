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

## Initializing backend
Create the network, build the containers, and start services using the development configuration:

    docker network create nginx-proxy  # if this does not already exist
    docker-compose build
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

The server should now be running at http://localhost:81

Create the database for compose:

    docker-compose exec compose_pgsql17 psql -U postgres -c "create database compose"

Next, apply the existing migrations (they are the canonical schema definition):

    docker-compose exec compose flask db upgrade


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
docker-compose stop compose
docker-compose exec compose_pgsql17 psql -U postgres -c "DROP DATABASE IF EXISTS compose;"
docker-compose exec compose_pgsql17 psql -U postgres -c "CREATE DATABASE compose;"
docker-compose start compose
docker-compose exec compose flask db upgrade
```

If you're using the legacy Postgres container, replace `compose_pgsql17` with `compose-pgsql` in the commands above.


## Running tests
To run tests, after starting services, create a test database:

    docker-compose exec compose_pgsql17 psql -U postgres -c "create database test_db"

**NOTE**: This command will ask you for the postgres password which is defined
in the `.env` file.

and execute:

    docker-compose run -e "APP_SETTINGS=neurosynth_compose.config.DockerTestConfig" --rm -w /compose compose python -m pytest backend/neurosynth_compose/tests

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
docker-compose exec compose_pgsql17 psql -U postgres -d compose \
  -c "SELECT id, external_id FROM users WHERE external_id = 'user-external-id';"

# Assign admin role
docker-compose exec compose_pgsql17 psql -U postgres -d compose \
  -c "INSERT INTO roles_users (user_id, role_id) VALUES ('user-id', 'admin');"
```
