-- Data-model profile of the restore. Read-only.
select current_database();
\echo base_studies: total / active / public / active+public
select count(*), count(*) filter (where is_active), count(*) filter (where public), count(*) filter (where is_active and public) from base_studies;
\echo base_studies level
select level, count(*) from base_studies group by 1;
\echo studies: total / public / level
select level, public, count(*) from studies group by 1,2 order by 1,2;
\echo studies without base study
select level, count(*) from studies where base_study_id is null group by 1;
\echo authors, base_study_authors, affiliations, universities
select (select count(*) from authors) authors,
       (select count(*) from authors where orcid is not null) with_orcid,
       (select count(*) from authors where openalex_id is not null) with_openalex,
       (select count(*) from base_study_authors) bsa,
       (select count(distinct base_study_id) from base_study_authors) papers_with_authors,
       (select count(*) from base_study_author_affiliations) affs,
       (select count(*) from base_study_author_affiliations where university_id is not null) affs_ror,
       (select count(*) from universities) universities;
\echo base_studies.authors string set
select count(*) filter (where authors is not null and authors <> '') from base_studies where is_active;
\echo users: total, names that look like emails, names null
select count(*), count(*) filter (where name ~ '@'), count(*) filter (where name is null) from users;
\echo studysets / annotations public
select public, count(*) from studysets group by 1;
select public, count(*) from annotations group by 1;
\echo meta-level studies by year of creation, with analyses
select date_trunc('year', s.created_at)::date, count(*) studies,
       count(*) filter (where exists (select 1 from analyses a where a.study_id = s.id)) with_analyses,
       count(*) filter (where s.public) public
from studies s where s.level = 'meta' group by 1 order by 1;
\echo studies updated_at set vs not, user_id set
select count(*) filter (where updated_at is not null) upd, count(*) filter (where user_id is not null) owned,
       count(distinct user_id) owners from studies;
\echo table sizes
select relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 20;
