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

## Initializing backend
Create the network, build the containers, and start services using the development configuration:

    docker network create nginx-proxy
    docker-compose build
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

The server should now be running at http://localhost/

Create the database for neurostore:

    docker-compose exec store-pgsql17 psql -U postgres -c "create database neurostore"

Next, apply the existing migrations (they are the canonical definition of the schema).

    docker-compose exec neurostore flask db upgrade

Finally ingest data

    docker-compose exec neurostore \
        bash -c "flask ingest-neurosynth --max-rows 100"


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
docker-compose stop neurostore
docker-compose exec store-pgsql17 psql -U postgres -c "DROP DATABASE IF EXISTS neurostore;"
docker-compose exec store-pgsql17 psql -U postgres -c "CREATE DATABASE neurostore;"
docker-compose start neurostore
docker-compose exec neurostore flask db upgrade
```

If you're using the legacy Postgres container, replace `store-pgsql17` with `store-pgsql` in the commands above. Re-run any ingestion or seed scripts your branch requires once the upgrade completes.


## Running tests
To run tests, after starting services, create a test database:

    docker-compose exec store-pgsql psql -U postgres -c "create database test_db"

**NOTE**: This command will ask you for the postgres password which is defined
in the `.env` file.

and execute:

    docker-compose run -e "APP_SETTINGS=neurostore.config.DockerTestConfig" --rm -w /neurostore neurostore python -m pytest neurostore/tests

## pgHero Service

[pgHero](https://github.com/ankane/pghero) is a PostgreSQL monitoring tool that provides insights into database performance and queries through a web UI.

### Starting pgHero with Docker Compose

To start the pgHero service, ensure Docker Compose is set up and run:

```sh
docker-compose up -d pghero
```

### Accessing the pgHero Web UI

Once running, access the pgHero dashboard at: [http://localhost/pghero](http://localhost/pghero) (replace "localhost" with your server's address as needed).

The `/pghero` route is proxied by nginx to the pgHero service, so you do not need to specify a port.

### Required Environment Variables

Set the following environment variables (typically in your `.env` file):

- `PGHERO_DATABASE_URL` — The connection string for your PostgreSQL database (e.g., `postgres://postgres:password@store-pgsql:5432/neurostore`).

Refer to the `docker-compose.yml` for additional configuration options.
