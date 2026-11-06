-- Candidate (b)/(a) substrate: allow-listed views in their own schema, a NOLOGIN owner
-- that can read the base tables, and a reader that can read only the views.
-- Local restore only.
select current_database();
\set ON_ERROR_STOP 1

-- Simulated journal entity (production's schema predates neurostuff/neurostore#1916):
-- one row per case-folded publication string, standing in for one per OpenAlex source.
create table if not exists journals_sim (id text primary key, title text not null);
insert into journals_sim
select md5(k), min(publication) from (select lower(btrim(publication)) k, publication from base_studies
  where publication is not null and btrim(publication) <> '') s group by k
on conflict do nothing;
alter table base_studies add column if not exists journal_id text;
update base_studies b set journal_id = md5(lower(btrim(b.publication)))
  where b.publication is not null and btrim(b.publication) <> '' and b.journal_id is distinct from md5(lower(btrim(b.publication)));
create index if not exists ix_base_studies_journal_id on base_studies (journal_id);
analyze base_studies; analyze journals_sim;

drop schema if exists public_api cascade;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'pq_owner') then create role pq_owner nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'pq_reader') then
    create role pq_reader login;
  end if;
end $$;
create schema public_api authorization pq_owner;
grant select on base_studies, journals_sim, base_study_authors, authors, base_study_author_affiliations,
  universities, studies, users, analyses, points, images, studysets, studyset_studies, annotations
  to pq_owner;

set role pq_owner;
create view public_api.articles with (security_barrier) as
  select b.id, b.name as title, b.year, b.doi, b.pmid, b.pmcid, b.journal_id,
         b.publication as journal, b.is_oa, b.publication_status, b.is_retracted, b.license,
         b.has_coordinates, b.has_images, b.has_z_maps, b.has_t_maps, b.created_at, b.updated_at
  from base_studies b where b.is_active and b.public;
create view public_api.journals with (security_barrier) as
  select j.id, j.title from journals_sim j;
create view public_api.authors with (security_barrier) as
  select a.id, a.name, a.orcid, a.openalex_id from authors a;
create view public_api.authorships with (security_barrier) as
  select ba.base_study_id as article_id, ba.author_id, ba.position, ba.name, ba.corresponding
  from base_study_authors ba join base_studies b on b.id = ba.base_study_id
  where b.is_active and b.public;
create view public_api.institutions with (security_barrier) as
  select u.id, u.ror, u.name, u.country from universities u;
create view public_api.affiliations with (security_barrier) as
  select ba.base_study_id as article_id, ba.author_id, aff.university_id as institution_id, aff.text
  from base_study_author_affiliations aff
  join base_study_authors ba on ba.id = aff.base_study_author_id
  join base_studies b on b.id = ba.base_study_id
  where b.is_active and b.public;
create view public_api.studies with (security_barrier) as
  select s.id, s.base_study_id as article_id, s.name, s.year, s.level, s.source,
         u.name as username, s.created_at, s.updated_at, s.has_coordinates, s.has_images
  from studies s left join users u on u.external_id = s.user_id
  where s.public;
create view public_api.analyses with (security_barrier) as
  select a.id, a.study_id, a.name, a.point_count, a.image_count, a.has_coordinates, a.has_images,
         a.role, a.outcome, a.created_at, a.updated_at
  from analyses a join studies s on s.id = a.study_id where s.public;
create view public_api.points with (security_barrier) as
  select p.id, p.analysis_id, p.x, p.y, p.z, p.space, p.kind
  from points p join analyses a on a.id = p.analysis_id join studies s on s.id = a.study_id
  where s.public;
create view public_api.authorships_flat with (security_barrier) as
  select ba.base_study_id as article_id, ba.author_id, au.name as author_name, au.orcid, ba.position,
         b.year, b.journal_id, b.has_coordinates, b.has_images
  from base_study_authors ba join base_studies b on b.id = ba.base_study_id
  join authors au on au.id = ba.author_id
  where b.is_active and b.public;
create view public_api.affiliations_flat with (security_barrier) as
  select distinct ba.base_study_id as article_id, aff.university_id as institution_id, u.name as institution,
         u.ror, u.country, b.year
  from base_study_author_affiliations aff
  join base_study_authors ba on ba.id = aff.base_study_author_id
  join base_studies b on b.id = ba.base_study_id
  left join universities u on u.id = aff.university_id
  where b.is_active and b.public;
reset role;

grant usage on schema public_api to pq_reader;
grant select on all tables in schema public_api to pq_reader;
alter role pq_reader set statement_timeout = '5s';
alter role pq_reader set default_transaction_read_only = on;
alter role pq_reader set work_mem = '16MB';
alter role pq_reader set search_path = public_api;
revoke all on schema public from pq_reader;
revoke create on schema public from public;
