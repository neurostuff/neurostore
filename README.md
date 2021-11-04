# neurostore

[![Build Status](https://travis-ci.com/PsychoinformaticsLab/neurostore.svg?branch=master)](https://travis-ci.com/PsychoinformaticsLab/neurostore)

Requirements: Docker and docker-compose.

## Configuration
First, set up the main environment variables in `.env` (see: `.env.example`).

    cp .env.example .env

Next, set up the Flask server's environment variables:

    cp neurostore/example_config.py neurostore/config.py


Edit both of these template files to set the correct variables

## Initalizing backend
Create the network, build the containers, and start services using the development configuration:

    docker network create nginx-proxy
    docker-compose build
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

The server should now be running at http://localhost/

Next, migrate and upgrade the database migrations.

    docker-compose exec neurostore \
        bash -c \
            "python manage.py db merge heads && \
             python manage.py db stamp head && \
             python manage.py db migrate && \
             python manage.py db upgrade"

**Note**: `python manage.py db merge heads` is not strictly necessary
unless you have multiple schema versions that are not from the same history
(e.g., multiple files in the `versions` directory).
However, `python manage.py db merge heads` makes the migration more robust
when there are multiple versions from different histories.

Finally ingest data

    docker-compose exec neurostore \
        bash -c "python manage.py ingest_neurosynth"


## Maintaining docker image and db
If you make a change to neurostore, you should be able to simply restart the server.

    docker-compose restart neurostore

If you need to upgrade the db after changing any models:

    docker-compose exec neurostore python manage.py db migrate
    docker-compose exec neurostore python manage.py db upgrade


## Running tests
To run tests, after starting services, create a test database:

    docker-compose exec pgsql psql -U postgres -c "create database test_db"

**NOTE**: This command will ask you for the postgres password which is defined
in the `.env` file.

and execute:

    docker-compose run -e "APP_SETTINGS=neurostore.config.DockerTestConfig" --rm -w /neurostore neurostore python -m pytest neurostore/tests
