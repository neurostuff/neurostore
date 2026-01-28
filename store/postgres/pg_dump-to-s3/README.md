# pg_dump-to-s3
Dump and archive PostgreSQL backups to Amazon S3 from the postgres container.

## Requirements

 - [AWS cli](https://aws.amazon.com/cli)
  
## Setup

Edit pg_dump-to-s3.sh and replace:
  - PG_HOST and PG_USER with your PostgreSQL host and backup user.
  - S3_PATH with your Amazon S3 bucket and path

The postgres image installs the scripts to `/home` and applies the cron schedule
from `backup.txt`. Ensure your container environment provides:
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`
  - `POSTGRES_PASSWORD` (or a `~/.pgpass` file inside the container)

The target bucket must already exist.

## Usage

```
./pg_to_s3.sh database1 database2 database3 [...]
```

## Manual backup from docker-compose

From the repo root:

```
cd store
docker compose exec -T store-pgsql17 /bin/bash /home/pg_dump-to-s3.sh neurostore
```

## How it works

- The postgres image installs `awscli`, `pg_dump-to-s3.sh`, and `s3-autodelete.sh`.
- `backup.txt` schedules the monthly dump (00:00 on the 25th).
- Each run dumps the database to `/tmp`, uploads to S3, then removes the local file.
- The autodelete script removes backups older than the retention window but keeps
  the newest backup so at least one remains.
- If cron is not running in your container, use the manual command above or start
  cron in the container entrypoint.

## Credentials

### AWS credentials

AWS credentials should be stored in a file called `~/.aws`. A documentation is available here: http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html

### PostgreSQL password

The PostgreSQL password can be stored in a file called `~/.pgpass`, see: https://www.postgresql.org/docs/current/static/libpq-pgpass.html
