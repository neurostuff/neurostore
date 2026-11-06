select current_database();
\timing on
drop schema if exists public_mat cascade;
create schema public_mat authorization pq_owner;
grant create on schema public_mat to pq_owner;
set role pq_owner;
\echo build articles
create materialized view public_mat.articles as
  select b.id, b.name as title, b.year, b.doi, b.pmid, b.pmcid, b.journal_id, b.publication as journal,
         b.is_oa, b.publication_status, b.is_retracted, b.license, b.has_coordinates, b.has_images,
         b.has_z_maps, b.has_t_maps, b.created_at, b.updated_at
  from base_studies b where b.is_active and b.public;
\echo build authorships
create materialized view public_mat.authorships as
  select ba.base_study_id as article_id, ba.author_id, au.name as author_name, ba.name as printed_name,
         au.orcid, au.openalex_id, ba.position, ba.corresponding, b.year, b.journal_id,
         b.has_coordinates, b.has_images
  from base_study_authors ba join base_studies b on b.id = ba.base_study_id
  join authors au on au.id = ba.author_id
  where b.is_active and b.public;
\echo build affiliations
create materialized view public_mat.affiliations as
  select distinct ba.base_study_id as article_id, aff.university_id as institution_id,
         u.name as institution, u.ror, u.country, b.year, b.journal_id
  from base_study_author_affiliations aff
  join base_study_authors ba on ba.id = aff.base_study_author_id
  join base_studies b on b.id = ba.base_study_id
  join universities u on u.id = aff.university_id
  where b.is_active and b.public;
\echo indexes
create unique index on public_mat.articles (id);
create index on public_mat.articles (year);
create index on public_mat.articles (journal_id);
create unique index on public_mat.authorships (article_id, position);
create index on public_mat.authorships (author_id);
create unique index on public_mat.affiliations (article_id, institution_id);
create index on public_mat.affiliations (institution_id);
reset role;
grant usage on schema public_mat to pq_reader;
grant select on all tables in schema public_mat to pq_reader;
analyze public_mat.articles; analyze public_mat.authorships; analyze public_mat.affiliations;
\echo refresh concurrently (what the nightly job would run)
refresh materialized view concurrently public_mat.articles;
refresh materialized view concurrently public_mat.authorships;
refresh materialized view concurrently public_mat.affiliations;
select relname, n_live_tup, pg_size_pretty(pg_total_relation_size(c.oid)) from pg_class c join pg_stat_user_tables s on s.relid=c.oid where s.schemaname='public_mat';
