set search_path=public_mat; set jit=off; set max_parallel_workers_per_gather=0; select current_database(), current_user;
\echo UC5m
explain (analyze, summary) select username, count(*) as n from studies where username is not null and updated_at is not null group by username order by n desc limit 100;
\echo UC6m
explain (analyze, summary) select date_trunc('month', created_at) as month, count(*) from analyses where level = 'meta' and article_id is null and created_at >= '2023-01-01' and created_at < '2026-11-01' group by 1 order by 1;
