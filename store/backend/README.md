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

    docker-compose exec store-pgsql psql -U postgres -c "create database neurostore"

Next, migrate and upgrade the database migrations.

    docker-compose exec neurostore \
        bash -c \
            "flask db merge heads && \
             flask db stamp head && \
             flask db migrate && \
             flask db upgrade"

**Note**: `flask db merge heads` is not strictly necessary
unless you have multiple schema versions that are not from the same history
(e.g., multiple files in the `versions` directory).
However, `flask db merge heads` makes the migration more robust
when there are multiple versions from different histories.

Finally ingest data

    docker-compose exec neurostore \
        bash -c "flask ingest-neurosynth --max-rows 100"


## Maintaining docker image and db
If you make a change to neurostore, you should be able to simply restart the server.

    docker-compose restart neurostore

If you need to upgrade the db after changing any models:

    docker-compose exec neurostore flask db migrate
    docker-compose exec neurostore flask db upgrade


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
