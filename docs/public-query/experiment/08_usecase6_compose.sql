select current_database(), current_user;
\echo UC6b meta-analyses run in Compose per month (an analysis in a meta study with no base study)
explain (analyze, buffers, summary)
select date_trunc('month', a.created_at) as month, count(*) as meta_analyses
from analyses a join studies s on s.id = a.study_id
where s.level = 'meta' and s.article_id is null
  and a.created_at >= '2023-01-01' and a.created_at < '2026-11-01'
group by 1 order by 1;
select date_trunc('year', a.created_at)::date as year, count(*) as meta_analyses
from analyses a join studies s on s.id = a.study_id
where s.level = 'meta' and s.article_id is null group by 1 order by 1;
