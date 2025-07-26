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

    docker-compose exec compose_pgsql psql -U postgres -c "create database compose"

Next, migrate and upgrade the database migrations.

    docker-compose exec compose \
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


## Maintaining docker image and db
If you make a change to compose, you should be able to simply restart the server.

    docker-compose restart compose

If you need to upgrade the db after changing any models:

    docker-compose exec compose flask db migrate
    docker-compose exec compose flask db upgrade


## Running tests
To run tests, after starting services, create a test database:

    docker-compose exec compose_pgsql psql -U postgres -c "create database test_db"

**NOTE**: This command will ask you for the postgres password which is defined
in the `.env` file.

and execute:

    docker-compose run -e "APP_SETTINGS=neurosynth_compose.config.DockerTestConfig" --rm -w /compose compose python -m pytest compose/tests
