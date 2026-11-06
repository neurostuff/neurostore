set search_path=public_mat; select current_database(), current_user;
\echo UC2r journals rollup
explain (analyze, buffers, summary) select id, title, articles from journals order by articles desc limit 100;
\echo UC3r authors rollup
explain (analyze, buffers, summary) select id, name, orcid, articles_with_data, articles from authors order by articles_with_data desc, articles desc limit 100;
\echo UC4r institutions rollup
explain (analyze, buffers, summary) select id, name, country, articles from institutions order by articles desc limit 100;
