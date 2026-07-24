# pg_dump-to-s3
Dump and archive PostgreSQL backups to Amazon S3 from the postgres container.

## Requirements

 - [AWS cli](https://aws.amazon.com/cli)
  
## Setup

Set environment variables:
  - `S3_PATH` with your Amazon S3 bucket and optional path
  - optional `DEV_S3_PATH` for reduced dev dumps (defaults to `${S3_PATH}/dev-reduced`)
  - optional `ENABLE_DEV_REDUCED_BACKUP=0` to skip reduced dev dump generation
  - optional `PG_HOST` / `PG_USER` overrides (defaults come from postgres env vars)

The postgres image installs the scripts to `/home`, applies the cron schedule
from `backup.txt`, and starts cron in the container entrypoint. Ensure your
container environment provides:
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`
  - `POSTGRES_PASSWORD`

The target bucket must already exist.

## Usage

```
./pg_dump-to-s3.sh database1 database2 database3 [...]
```

## Manual backup from docker-compose

From the repo root:

Default database for the selected environment:

```
cd store
docker compose exec -T store-pgsql17 /bin/bash /home/pg_dump-to-s3.sh
```

Explicitly back up the production-style database name:

```
cd store
docker compose exec -T store-pgsql17 /bin/bash /home/pg_dump-to-s3.sh neurostore
```

Examples:

- `APP_ENV=development` resolves to `store_test_db`
- `APP_ENV=staging` or `APP_ENV=production` resolves to `neurostore`

## How it works

- The postgres image installs `awscli`, `pg_dump-to-s3.sh`, and `s3-autodelete.sh`.
- `backup.txt` schedules a daily dump at 00:00.
- Each run dumps the database to `/tmp`, uploads to S3, then removes the local file.
- The same run also builds a reduced dev dump and uploads it under `dev-reduced/`
  by default so shared dev can restore that smaller artifact directly.
- The reduced dev dump is built from the live source database by copying the
  selected rows into a temporary reduced database, not by restoring the full dump
  first.
- The autodelete script removes backups older than the retention window but keeps
  the newest backup so at least one remains.
- The entrypoint writes `.pgpass` and AWS config files for both `root` and
  `postgres`, so cron and manual runs work without interactive prompts.

## Credentials

This image generates `~/.aws/{credentials,config}` and `~/.pgpass` at startup
from environment variables. If needed, you can still manage those files manually.
