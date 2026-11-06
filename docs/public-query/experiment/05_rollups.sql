select current_database();
\timing on
set role pq_owner;
\echo build authors rollup
create materialized view public_mat.authors as
  select author_id as id, min(author_name) as name, min(orcid) as orcid, min(openalex_id) as openalex_id,
         count(*) as articles, count(*) filter (where has_coordinates or has_images) as articles_with_data
  from public_mat.authorships group by author_id;
\echo build institutions rollup
create materialized view public_mat.institutions as
  select institution_id as id, min(institution) as name, min(ror) as ror, min(country) as country, count(*) as articles
  from public_mat.affiliations group by institution_id;
\echo build journals rollup
create materialized view public_mat.journals as
  select journal_id as id, min(journal) as title, count(*) as articles,
         count(*) filter (where has_coordinates or has_images) as articles_with_data
  from public_mat.articles where journal_id is not null group by journal_id;
create unique index on public_mat.authors (id);
create index on public_mat.authors (articles_with_data desc, articles desc);
create index on public_mat.authors (articles desc);
create unique index on public_mat.institutions (id);
create index on public_mat.institutions (articles desc);
create unique index on public_mat.journals (id);
create index on public_mat.journals (articles desc);
reset role;
grant select on all tables in schema public_mat to pq_reader;
analyze public_mat.authors; analyze public_mat.institutions; analyze public_mat.journals;
