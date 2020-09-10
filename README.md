# neurostuff

[![Build Status](https://travis-ci.com/PsychoinformaticsLab/neurostuff.svg?branch=master)](https://travis-ci.com/PsychoinformaticsLab/neurostuff)

Requirements: Docker and docker-compose.

## Configuration
First, set up the main environment variables in `.env` (see: `.env.example`).

    cp .env.example .env

Next, set up the Flask server's environment variables:

    cp neurostuff/example_config.py neurostuff/config.py


Edit both of these template files to set the correct variables

## Initalizing backend
Build the containers and start services using the development configuration:

    docker-compose build
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

The server should now be running at http://localhost/

Next, migrate and upgrade the database migrations.

    docker-compose exec neurostuff \
    bash -c "python manage.py db stamp head && \
    python manage.py db migrate && \
    python manage.py db upgrade"
    

Finally, add an admin user, and ingest data

    python manage.py add_user admin@neurostuff.org password
    python manage.py ingest_neurosynth


## Maintaining docker image and db
If you make a change to /neurostuff, you should be able to simply restart the server.

    docker-compose restart neurostuff

If you need to upgrade the db after changing any models:

    docker-compose exec neurostuff python manage.py db migrate
    docker-compose exec neurostuff python manage.py db upgrade


## Running tests
To run tests, after starting services, create a test database:

    docker-compose exec postgres psql -h postgres -U postgres -c "create database test_db"

and execute:

    docker-compose run -e "APP_SETTINGS=neurostuff.config.DockerTestConfig" --rm -w /neurostuff neurostuff python -m pytest neurostuff/tests
