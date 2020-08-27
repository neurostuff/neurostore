# neurostuff

[Add badges]

Requirements: Docker and docker-compose.

## Configuration
First, set up the main environment variables in `.env` (see: `.env.example`).

Next, set up the Flask server's environment variables ....

Finally, set up the frontend's env variables by ....

## Initalizing backend
Build the containers and start services using the development configuration:

    docker-compose build
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

The server should now be running at http://localhost/

Next, initialize, migrate and upgrade the database migrations.

    docker-compose exec neurostuff bash
    rm -rf /migrations/migrations
    python manage.py db init
    python manage.py db migrate
    python manage.py db upgrade
    python manage.py add_user useremail password

## Setting up front end


## Ingesting

## Maintaining docker image and db
If you make a change to /neurostuff, you should be able to simply restart the server.

    docker-compose restart neurostuff

If you need to upgrade the db after changing any models:

    docker-compose exec neurostuff python manage.py db migrate
    docker-compose exec neurostuff python manage.py db upgrade

To inspect the database using psql:
