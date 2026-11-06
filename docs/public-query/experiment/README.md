# Experiment scripts

What the measurements in [../DESIGN.md](../DESIGN.md) ran, on a local restore of a production backup.
Never point these at a deployed database: `01` alters `base_studies` and creates roles.

1. Start the throwaway Postgres: `docker compose -p pubquery -f compose.yml up -d --wait`, create a
   database, and stream the backup into it with `pg_restore --no-owner --no-acl`.
2. As `postgres`: `00_profile.sql` (counts), then `01_live_views.sql` (the simulated journal entity,
   the `public_api` views and the `pq_reader` role).
3. As `pq_reader`: `02_usecases_live.sql` (run twice; the second run is reported) and
   `03_raw_sql_abuse.sql` (candidate b). For the plain-view column, reset `security_barrier` on the
   views and `alter role pq_reader set jit = off`.
4. As `postgres`: `04_materialized.sql` and `05_rollups.sql`; the materialized `studies` and
   `analyses` are built inline in the session log (same shape as the `public_api` views, with names
   containing `@` nulled).
5. As `pq_reader`: `06`–`09`. `10_cost_gate_queries.txt` holds `name|sql` pairs, each run as
   `EXPLAIN (FORMAT JSON)` and `EXPLAIN (ANALYZE)` with `jit = off` and
   `max_parallel_workers_per_gather = 0`.

`soql_prototype.py` is the throwaway SoQL-subset compiler (Lark and SQLAlchemy 2): run it with no
arguments to print each use case's compiled SQL and its parse and compile time.

Afterwards: `docker compose -p pubquery -f compose.yml down -v`.
