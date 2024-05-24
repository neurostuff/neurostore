#!/bin/bash
set -e

# Start PostgreSQL and wait for it to be ready
/usr/local/bin/docker-entrypoint.sh postgres &

# Wait for PostgreSQL to start
until pg_isready -p 5432 -U "$POSTGRES_USER"; do
    echo "$(date) - waiting for database to start"
    sleep 2
done

sleep 1

echo "STARTING EXTENSION"
# Enable the pgvector extension
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS vector;
EOSQL

# Wait for PostgreSQL process to keep the container running
wait
