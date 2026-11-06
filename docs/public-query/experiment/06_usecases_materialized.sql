-- The six use cases over the allow-listed views, as the reader role.
-- Run twice; the second (warm) run is the one reported.
set search_path=public_mat, public_api; select current_database(), current_user;
\timing on

\echo UC1 articles per year
explain (analyze, buffers, costs, summary)
select year, count(*) as articles from articles group by year order by year;

\echo UC2 articles per journal
explain (analyze, buffers, costs, summary)
select journal_id, journal, count(*) as articles
from articles where journal_id is not null group by journal_id, journal order by articles desc limit 100;

\echo UC3 articles per author, ranked by papers with coordinates or images
explain (analyze, buffers, costs, summary)
select author_id, author_name, orcid,
       count(*) filter (where has_coordinates or has_images) as with_data,
       count(*) as articles
from authorships group by author_id, author_name, orcid order by with_data desc, articles desc limit 100;

\echo UC4 articles per institution
explain (analyze, buffers, costs, summary)
select institution_id, institution, country, count(*) as articles
from affiliations group by institution_id, institution, country order by articles desc limit 100;

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
