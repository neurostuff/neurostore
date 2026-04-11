\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS postgres_fdw;

DROP SCHEMA IF EXISTS seed_source CASCADE;
CREATE SCHEMA seed_source;

DROP SERVER IF EXISTS compose_seed_source CASCADE;
CREATE SERVER compose_seed_source
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host '127.0.0.1', dbname :'source_db', port '5432');

CREATE USER MAPPING FOR CURRENT_USER
  SERVER compose_seed_source
  OPTIONS (user 'postgres', password :'source_password');

IMPORT FOREIGN SCHEMA public
  LIMIT TO (
    alembic_version,
    annotation_references,
    annotations,
    conditions,
    devices,
    meta_analyses,
    meta_analysis_results,
    meta_analysis_tags,
    neurostore_analyses,
    neurostore_studies,
    neurovault_collections,
    neurovault_files,
    projects,
    roles,
    roles_users,
    specification_conditions,
    specifications,
    studyset_references,
    studysets,
    tags,
    users
  )
  FROM SERVER compose_seed_source
  INTO seed_source;

CREATE TEMP TABLE target_external_ids (
  external_id text PRIMARY KEY
);

INSERT INTO target_external_ids (external_id)
VALUES
  ('github|12564882'),
  ('google-oauth2|100511154128738502835'),
  ('github|26612023'),
  ('google-oauth2|103699420714013575386'),
  ('google-oauth2|106569899084750504852'),
  ('google-oauth2|107202989614455747499');

CREATE TEMP TABLE keep_users AS
SELECT id, external_id
FROM seed_source.users
WHERE external_id IN (SELECT external_id FROM target_external_ids);

CREATE TEMP TABLE keep_projects AS
SELECT id, studyset_id, annotation_id
FROM (
  SELECT
    project.id,
    project.studyset_id,
    project.annotation_id
  FROM seed_source.projects project
  WHERE project.user_id IN (SELECT external_id FROM target_external_ids)
  ORDER BY project.created_at NULLS LAST, project.id
  LIMIT 10
) refs;

CREATE TEMP TABLE keep_meta_analyses AS
SELECT
  id,
  specification_id,
  cached_studyset_id,
  cached_annotation_id,
  neurostore_studyset_id,
  neurostore_annotation_id,
  project_id
FROM seed_source.meta_analyses
WHERE project_id IN (SELECT id FROM keep_projects);

CREATE TEMP TABLE keep_studysets AS
SELECT DISTINCT id
FROM (
  SELECT project.studyset_id AS id
  FROM keep_projects project
  WHERE project.studyset_id IS NOT NULL
  UNION ALL
  SELECT meta.cached_studyset_id AS id
  FROM keep_meta_analyses meta
  WHERE meta.cached_studyset_id IS NOT NULL
) refs;

CREATE TEMP TABLE keep_annotations AS
SELECT DISTINCT id
FROM (
  SELECT project.annotation_id AS id
  FROM keep_projects project
  WHERE project.annotation_id IS NOT NULL
  UNION ALL
  SELECT meta.cached_annotation_id AS id
  FROM keep_meta_analyses meta
  WHERE meta.cached_annotation_id IS NOT NULL
) refs;

CREATE TEMP TABLE keep_specifications AS
SELECT DISTINCT specification_id AS id
FROM keep_meta_analyses
WHERE specification_id IS NOT NULL;

CREATE TEMP TABLE keep_studyset_references AS
SELECT DISTINCT id
FROM (
  SELECT meta.neurostore_studyset_id AS id
  FROM keep_meta_analyses meta
  WHERE meta.neurostore_studyset_id IS NOT NULL
  UNION ALL
  SELECT studyset.neurostore_id AS id
  FROM seed_source.studysets studyset
  WHERE studyset.id IN (SELECT id FROM keep_studysets)
    AND studyset.neurostore_id IS NOT NULL
) refs;

CREATE TEMP TABLE keep_annotation_references AS
SELECT DISTINCT id
FROM (
  SELECT meta.neurostore_annotation_id AS id
  FROM keep_meta_analyses meta
  WHERE meta.neurostore_annotation_id IS NOT NULL
  UNION ALL
  SELECT annotation.neurostore_id AS id
  FROM seed_source.annotations annotation
  WHERE annotation.id IN (SELECT id FROM keep_annotations)
    AND annotation.neurostore_id IS NOT NULL
) refs;

CREATE TEMP TABLE keep_neurostore_studies AS
SELECT DISTINCT neurostore_id
FROM (
  SELECT study.neurostore_id
  FROM seed_source.neurostore_studies study
  WHERE study.project_id IN (SELECT id FROM keep_projects)
    AND study.neurostore_id IS NOT NULL
  UNION ALL
  SELECT analysis.neurostore_study_id AS neurostore_id
  FROM seed_source.neurostore_analyses analysis
  WHERE analysis.meta_analysis_id IN (SELECT id FROM keep_meta_analyses)
    AND analysis.neurostore_study_id IS NOT NULL
) refs;

CREATE TEMP TABLE keep_conditions AS
SELECT DISTINCT condition_id AS id
FROM seed_source.specification_conditions
WHERE specification_id IN (SELECT id FROM keep_specifications);

CREATE TEMP TABLE keep_tags AS
SELECT DISTINCT id
FROM (
  SELECT tag.id
  FROM seed_source.tags tag
  WHERE tag.user_id IN (SELECT external_id FROM target_external_ids)
  UNION ALL
  SELECT mat.tag_id AS id
  FROM seed_source.meta_analysis_tags mat
  WHERE mat.meta_analysis_id IN (SELECT id FROM keep_meta_analyses)
) refs;

INSERT INTO alembic_version
SELECT *
FROM seed_source.alembic_version;

INSERT INTO users
SELECT *
FROM seed_source.users
WHERE id IN (SELECT id FROM keep_users);

INSERT INTO roles
SELECT *
FROM seed_source.roles
WHERE id IN (
  SELECT DISTINCT role_id
  FROM seed_source.roles_users
  WHERE user_id IN (SELECT id FROM keep_users)
);

INSERT INTO roles_users
SELECT *
FROM seed_source.roles_users
WHERE user_id IN (SELECT id FROM keep_users);

INSERT INTO studyset_references
SELECT *
FROM seed_source.studyset_references
WHERE id IN (SELECT id FROM keep_studyset_references);

INSERT INTO annotation_references
SELECT *
FROM seed_source.annotation_references
WHERE id IN (SELECT id FROM keep_annotation_references);

INSERT INTO studysets
SELECT *
FROM seed_source.studysets
WHERE id IN (SELECT id FROM keep_studysets);

INSERT INTO annotations
SELECT *
FROM seed_source.annotations
WHERE id IN (SELECT id FROM keep_annotations);

INSERT INTO projects (
  id,
  created_at,
  updated_at,
  name,
  description,
  provenance,
  user_id,
  public,
  draft,
  studyset_id,
  annotation_id
)
SELECT
  id,
  created_at,
  updated_at,
  name,
  description,
  provenance,
  user_id,
  public,
  COALESCE(draft, FALSE) AS draft,
  studyset_id,
  annotation_id
FROM seed_source.projects
WHERE id IN (SELECT id FROM keep_projects);

INSERT INTO specifications
SELECT *
FROM seed_source.specifications
WHERE id IN (SELECT id FROM keep_specifications);

INSERT INTO conditions
SELECT *
FROM seed_source.conditions
WHERE id IN (SELECT id FROM keep_conditions);

INSERT INTO specification_conditions
SELECT *
FROM seed_source.specification_conditions
WHERE specification_id IN (SELECT id FROM keep_specifications);

INSERT INTO meta_analyses
SELECT *
FROM seed_source.meta_analyses
WHERE id IN (SELECT id FROM keep_meta_analyses);

INSERT INTO tags
SELECT *
FROM seed_source.tags
WHERE id IN (SELECT id FROM keep_tags);

INSERT INTO meta_analysis_tags
SELECT *
FROM seed_source.meta_analysis_tags
WHERE meta_analysis_id IN (SELECT id FROM keep_meta_analyses);

INSERT INTO neurostore_studies
SELECT *
FROM seed_source.neurostore_studies
WHERE neurostore_id IN (SELECT neurostore_id FROM keep_neurostore_studies);

INSERT INTO neurostore_analyses
SELECT *
FROM seed_source.neurostore_analyses
WHERE meta_analysis_id IN (SELECT id FROM keep_meta_analyses)
  AND (
    neurostore_study_id IS NULL
    OR neurostore_study_id IN (SELECT neurostore_id FROM keep_neurostore_studies)
  );

INSERT INTO meta_analysis_results
SELECT *
FROM seed_source.meta_analysis_results
WHERE meta_analysis_id IN (SELECT id FROM keep_meta_analyses);

INSERT INTO neurovault_collections
SELECT *
FROM seed_source.neurovault_collections
WHERE result_id IN (
  SELECT id
  FROM seed_source.meta_analysis_results
  WHERE meta_analysis_id IN (SELECT id FROM keep_meta_analyses)
);

INSERT INTO neurovault_files
SELECT *
FROM seed_source.neurovault_files
WHERE collection_id IN (
  SELECT collection_id
  FROM seed_source.neurovault_collections
  WHERE result_id IN (
    SELECT id
    FROM seed_source.meta_analysis_results
    WHERE meta_analysis_id IN (SELECT id FROM keep_meta_analyses)
  )
);

INSERT INTO devices
SELECT *
FROM seed_source.devices
WHERE user_id IN (SELECT id FROM keep_users);

UPDATE studysets
SET snapshot = NULL;

UPDATE annotations
SET snapshot = NULL;

UPDATE meta_analysis_results
SET
  cli_args = NULL,
  diagnostic_table = NULL;

ANALYZE;

DROP SCHEMA seed_source CASCADE;
DROP SERVER compose_seed_source CASCADE;
