# pg_dump-to-s3
Dump and archive PostgreSQL backups to Amazon S3 from the postgres container.

## Requirements

 - [AWS cli](https://aws.amazon.com/cli)
  
## Setup

Set environment variables:
  - `S3_PATH` with your Amazon S3 bucket and optional path
  - optional `PG_HOST` / `PG_USER` overrides (defaults come from postgres env vars)

The postgres image installs the scripts to `/home`, applies the cron schedule
from `backup.txt`, and starts cron in the container entrypoint. Ensure your
container environment provides:
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`
  - `POSTGRES_PASSWORD`

The target bucket must already exist.

## Usage

```
./pg_to_s3.sh database1 database2 database3 [...]
```

## Manual backup from docker-compose

From the repo root:

```
cd compose
docker compose exec -T compose-pgsql17 /bin/bash /home/pg_dump-to-s3.sh compose
```

## How it works

- The postgres image installs `awscli`, `pg_dump-to-s3.sh`, and `s3-autodelete.sh`.
- `backup.txt` schedules a daily dump at 00:00.
- Each run dumps the database to `/tmp`, uploads to S3, then removes the local file.
- The autodelete script removes backups older than the retention window but keeps
  the newest backup so at least one remains.
- The entrypoint writes `.pgpass` and AWS config files for both `root` and
  `postgres`, so cron and manual runs work without interactive prompts.

## Credentials

This image generates `~/.aws/{credentials,config}` and `~/.pgpass` at startup
from environment variables. If needed, you can still manage those files manually.
