-- The six use cases over the allow-listed views, as the reader role.
-- Run twice; the second (warm) run is the one reported.
select current_database(), current_user;
\timing on

\echo UC1 articles per year
explain (analyze, buffers, costs, summary)
select year, count(*) as articles from articles group by year order by year;

\echo UC2 articles per journal
explain (analyze, buffers, costs, summary)
select a.journal_id, j.title, count(*) as articles
from articles a join journals j on j.id = a.journal_id
group by a.journal_id, j.title order by articles desc limit 100;

\echo UC3 articles per author, ranked by papers with coordinates or images
explain (analyze, buffers, costs, summary)
select au.id, au.name, au.orcid,
       count(*) filter (where ar.has_coordinates or ar.has_images) as with_data,
       count(*) as articles
from authorships s join articles ar on ar.id = s.article_id join authors au on au.id = s.author_id
group by au.id, au.name, au.orcid order by with_data desc, articles desc limit 100;

\echo UC4 articles per institution
explain (analyze, buffers, costs, summary)
select i.id, i.name, i.country, count(distinct f.article_id) as articles
from affiliations f join institutions i on i.id = f.institution_id
group by i.id, i.name, i.country order by articles desc limit 100;

\echo UC5 users with the most updated studies (username only)
explain (analyze, buffers, costs, summary)
select username, count(*) as updated_studies
from studies where username is not null and updated_at is not null
group by username order by updated_studies desc limit 100;

\echo UC6 meta-analyses per month over a period
explain (analyze, buffers, costs, summary)
select date_trunc('month', created_at) as month, count(*) as meta_analyses
from studies where level = 'meta' and created_at >= '2023-01-01' and created_at < '2026-11-01'
group by 1 order by 1;
