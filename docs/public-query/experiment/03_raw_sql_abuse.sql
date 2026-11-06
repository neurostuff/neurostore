-- What a raw read-only SQL endpoint (candidate b) lets an anonymous caller do.
-- Each statement runs on its own (psql -f, ON_ERROR_STOP off), as pq_reader.
select current_database(), current_user, current_setting('statement_timeout'), current_setting('transaction_read_only');
\timing on
\echo T1 base table outside the allow-list
select name, external_id from public.users limit 1;
\echo T2 write
create table public_api.x (a int);
\echo T3 sleep is bounded by the role timeout
select pg_sleep(30);
\echo T4 set_config inside the statement cannot lift its own timer
select set_config('statement_timeout', '0', false), pg_sleep(8);
\echo T5 a session-level set_config that succeeds lifts the timer for the NEXT statement
select set_config('statement_timeout', '0', false);
select pg_sleep(7);
reset statement_timeout;
\echo T5b is the same two statements in one string: psql -c "select set_config(...); select pg_sleep(7);"
\echo T5c SET LOCAL is undone at commit
begin; set local statement_timeout = '2s'; select current_setting('statement_timeout'); commit;
select current_setting('statement_timeout');
\echo T6 cartesian product: planner cost vs timeout
explain select count(*) from points a, points b;
select count(*) from points a, points b;
\echo T7 memory: one row allocates ~500 MB before any timeout fires
select length(repeat('x', 500000000));
\echo T8 query text of other sessions
select usename, left(query, 40) from pg_stat_activity where usename is distinct from current_user limit 3;
\echo T9 catalog: view definitions name the base tables and their filters
select left(definition, 80) from pg_views where schemaname = 'public_api' limit 1;
\echo T10 catalog: database roles are listed
select count(*) from pg_roles;
\echo T11 server files
select pg_read_file('/etc/passwd');
\echo T12 count(distinct) of a text column over the largest view
select count(distinct name) from authorships;
