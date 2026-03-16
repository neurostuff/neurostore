## Directory Structure

- [`store/backend/`](store/backend): Contains all neurostore backend code and configuration.
  - [`neurostore/`](store/backend/neurostore): Python package source code
  - [`manage.py`](store/backend/manage.py), [`pyproject.toml`](store/backend/pyproject.toml), [`setup.cfg`](store/backend/setup.cfg), [`README.md`](store/backend/README.md): Backend config and docs

Other unrelated files (data, cassettes, nginx, postgres, scripts, docker-compose files) remain at the top level of `store/`.
# neurostore

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

    docker network create nginx-proxy
    docker-compose build
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

The server should now be running at http://localhost/

With `APP_ENV=development`, a fresh Postgres volume initializes `test_db`
automatically. If you are reusing an older volume created under a different
environment, recreate the volume or create `test_db` manually before migrating.

Next, apply the existing migrations (they are the canonical definition of the schema).

    docker-compose exec neurostore flask db upgrade

The tracked migrations create the `pgvector` extension automatically. If you are recovering from a partially migrated database, it is also safe to run:

    docker-compose exec store-pgsql17 psql -U postgres -d test_db -c "CREATE EXTENSION IF NOT EXISTS vector;"

Finally ingest data

    docker-compose exec neurostore \
        bash -c "flask ingest-neurosynth --max-rows 100"

Note: the stack now resolves the database from `APP_ENV` automatically.
Development uses `test_db`; staging and production use `neurostore` by default.


## Maintaining docker image and db
If you make a change to neurostore, you should be able to simply restart the server.

    docker-compose restart neurostore

If you change any models, generate a new Alembic migration and migrate the database (commit the generated revision file so it becomes the new source of truth):

    docker-compose exec neurostore flask db migrate
    docker-compose exec neurostore flask db upgrade


## Database migrations

The migrations stored in `backend/migrations` are the **only** source of truth for the schema—avoid merging heads, stamping, or manually altering the history. Always move the database forward (or rebuilt-from-scratch) by applying the tracked revisions.

### Applying migrations after pulling a branch

Any time you start the backend or pull the latest changes, bring the database to the expected state with:

```sh
docker-compose exec neurostore flask db upgrade
```

`upgrade` is idempotent, so rerunning it is harmless; it only applies migrations that have not been run yet.

### Resetting the database when switching branches

Because each branch might change the schema independently, recreate the database before starting work on a different branch so that Alembic can replay only the migrations that exist on that branch.

```sh
docker-compose stop neurostore store_outbox_worker store_metadata_outbox_worker store_nginx store-pghero store-grafana
docker-compose exec store-pgsql17 psql -U postgres -c "DROP DATABASE IF EXISTS test_db;"
docker-compose exec store-pgsql17 psql -U postgres -c "CREATE DATABASE test_db;"
docker-compose up -d
docker-compose exec neurostore flask db upgrade
```

If you're using the legacy Postgres container, replace `store-pgsql17` with `store-pgsql` in the commands above. Re-run any ingestion or seed scripts your branch requires once the upgrade completes.


## Running tests
To run tests after starting services, ensure `test_db` exists. A fresh
development stack creates it automatically.

**NOTE**: This command will ask you for the postgres password which is defined
in the `.env` file.

and execute:

    docker-compose run -e "APP_ENV=docker_test" --rm neurostore bash -c "python -m pytest neurostore/tests"

## Admin interface
The Flask-Admin UI is served at `/admin` once the stack is running.

Access:
- Dev: http://localhost/admin
- Prod: https://neurostore.org/admin

Auth:
- Set `FLASK_ADMIN_USERNAME` and `FLASK_ADMIN_PASSWORD` in the environment.
- The browser will prompt for HTTP Basic auth when you visit `/admin`.

Grant admin access (recommended for any admin UI access):
```sh
# Find the user ID
docker-compose exec store-pgsql17 psql -U postgres -d test_db \
  -c "SELECT id, external_id FROM users WHERE external_id = 'user-external-id';"

# Assign admin role
docker-compose exec store-pgsql17 psql -U postgres -d test_db \
  -c "INSERT INTO roles_users (user_id, role_id) VALUES ('user-id', 'admin');"
```

## pgHero Service

[pgHero](https://github.com/ankane/pghero) is a PostgreSQL monitoring tool that provides insights into database performance and queries through a web UI.

### Starting pgHero with Docker Compose

To start the pgHero service, ensure Docker Compose is set up and run:

```sh
docker-compose up -d store-pghero
```

### Accessing the pgHero Web UI

Once running, access the pgHero dashboard at: [http://localhost/pghero](http://localhost/pghero) (replace "localhost" with your server's address as needed).

The `/pghero` route is proxied by nginx to the pgHero service, so you do not need to specify a port.

pgHero follows the same environment-based database resolution as the rest of the
store stack. It resolves the target database from `APP_ENV`.

Typical local choices:

- Inspect the local development app database: set `APP_ENV=development`
- Inspect the staging/production-style database name locally: set `APP_ENV=staging` or `APP_ENV=production`

### Derived Connection Settings

`DATABASE_URL` is derived at container startup from `POSTGRES_USER`,
`POSTGRES_PASSWORD`, `POSTGRES_HOST`, and the database resolved from `APP_ENV`.

Refer to the `docker-compose.yml` for additional configuration options.
