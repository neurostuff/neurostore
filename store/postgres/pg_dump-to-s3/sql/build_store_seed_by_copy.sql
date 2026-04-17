\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS postgres_fdw;

DROP SCHEMA IF EXISTS seed_source CASCADE;
CREATE SCHEMA seed_source;

DROP SERVER IF EXISTS store_seed_source CASCADE;
CREATE SERVER store_seed_source
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host '127.0.0.1', dbname :'source_db', port '5432');

CREATE USER MAPPING FOR CURRENT_USER
  SERVER store_seed_source
  OPTIONS (user 'postgres', password :'source_password');

IMPORT FOREIGN SCHEMA public
  LIMIT TO (
    alembic_version,
    analyses,
    analysis_conditions,
    annotation_analyses,
    annotations,
    base_studies,
    base_study_flag_outbox,
    base_study_metadata_outbox,
    conditions,
    entities,
    image_entities,
    images,
    pipeline_configs,
    pipeline_embeddings,
    pipeline_study_results,
    pipelines,
    point_entities,
    point_values,
    points,
    roles,
    roles_users,
    studies,
    studyset_studies,
    studysets,
    tables,
    users
  )
  FROM SERVER store_seed_source
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

CREATE TEMP TABLE keep_studysets AS
SELECT DISTINCT id
FROM seed_source.studysets
WHERE user_id IN (SELECT external_id FROM target_external_ids);

CREATE TEMP TABLE keep_annotations AS
SELECT DISTINCT id
FROM (
  SELECT annotation.id
  FROM seed_source.annotations annotation
  WHERE annotation.user_id IN (SELECT external_id FROM target_external_ids)
  UNION ALL
  SELECT annotation.id
  FROM seed_source.annotations annotation
  WHERE annotation.studyset_id IN (SELECT id FROM keep_studysets)
) refs;

CREATE TEMP TABLE keep_studyset_studies AS
SELECT DISTINCT studyset_id, study_id
FROM seed_source.studyset_studies
WHERE studyset_id IN (SELECT id FROM keep_studysets);

CREATE TEMP TABLE keep_studies AS
SELECT DISTINCT id
FROM (
  SELECT study.id
  FROM seed_source.studies study
  WHERE study.user_id IN (SELECT external_id FROM target_external_ids)
  UNION ALL
  SELECT study_id AS id
  FROM keep_studyset_studies
) refs;

CREATE TEMP TABLE direct_keep_base_studies AS
SELECT DISTINCT base_study_id AS id
FROM seed_source.studies
WHERE id IN (SELECT id FROM keep_studies)
  AND base_study_id IS NOT NULL;

CREATE TEMP TABLE keep_base_studies AS
WITH RECURSIVE base_study_chain AS (
  SELECT id
  FROM direct_keep_base_studies
  UNION
  SELECT base_study.superseded_by AS id
  FROM seed_source.base_studies base_study
  JOIN base_study_chain chain
    ON chain.id = base_study.id
  WHERE base_study.superseded_by IS NOT NULL
)
SELECT DISTINCT id
FROM base_study_chain;

CREATE TEMP TABLE keep_tables AS
SELECT DISTINCT id
FROM seed_source.tables
WHERE study_id IN (SELECT id FROM keep_studies)
   OR user_id IN (SELECT external_id FROM target_external_ids);

CREATE TEMP TABLE keep_analyses AS
SELECT DISTINCT id
FROM seed_source.analyses
WHERE study_id IN (SELECT id FROM keep_studies)
   OR table_id IN (SELECT id FROM keep_tables)
   OR user_id IN (SELECT external_id FROM target_external_ids);

CREATE TEMP TABLE keep_conditions AS
SELECT DISTINCT id
FROM (
  SELECT condition.id
  FROM seed_source.conditions condition
  WHERE condition.user_id IN (SELECT external_id FROM target_external_ids)
  UNION ALL
  SELECT analysis_condition.condition_id AS id
  FROM seed_source.analysis_conditions analysis_condition
  WHERE analysis_condition.analysis_id IN (SELECT id FROM keep_analyses)
) refs;

CREATE TEMP TABLE keep_entities AS
SELECT DISTINCT id
FROM seed_source.entities
WHERE analysis_id IN (SELECT id FROM keep_analyses);

CREATE TEMP TABLE keep_points AS
SELECT DISTINCT id
FROM seed_source.points
WHERE analysis_id IN (SELECT id FROM keep_analyses);

CREATE TEMP TABLE keep_images AS
SELECT DISTINCT id
FROM seed_source.images
WHERE analysis_id IN (SELECT id FROM keep_analyses);

CREATE TEMP TABLE keep_pipeline_configs AS
SELECT DISTINCT config_id AS id
FROM (
  SELECT config_id
  FROM seed_source.pipeline_study_results
  WHERE base_study_id IN (SELECT id FROM keep_base_studies)
  UNION ALL
  SELECT config_id
  FROM seed_source.pipeline_embeddings
  WHERE base_study_id IN (SELECT id FROM keep_base_studies)
) refs;

CREATE TEMP TABLE keep_pipelines AS
SELECT DISTINCT pipeline_id AS id
FROM seed_source.pipeline_configs
WHERE id IN (SELECT id FROM keep_pipeline_configs);

CREATE TEMP TABLE keep_external_ids AS
SELECT DISTINCT external_id
FROM (
  SELECT external_id
  FROM target_external_ids
  UNION ALL
  SELECT user_id AS external_id
  FROM seed_source.studysets
  WHERE id IN (SELECT id FROM keep_studysets)
    AND user_id IS NOT NULL
  UNION ALL
  SELECT user_id AS external_id
  FROM seed_source.annotations
  WHERE id IN (SELECT id FROM keep_annotations)
    AND user_id IS NOT NULL
  UNION ALL
  SELECT user_id AS external_id
  FROM seed_source.studies
  WHERE id IN (SELECT id FROM keep_studies)
    AND user_id IS NOT NULL
  UNION ALL
  SELECT user_id AS external_id
  FROM seed_source.base_studies
  WHERE id IN (SELECT id FROM keep_base_studies)
    AND user_id IS NOT NULL
  UNION ALL
  SELECT user_id AS external_id
  FROM seed_source.tables
  WHERE id IN (SELECT id FROM keep_tables)
    AND user_id IS NOT NULL
  UNION ALL
  SELECT user_id AS external_id
  FROM seed_source.analyses
  WHERE id IN (SELECT id FROM keep_analyses)
    AND user_id IS NOT NULL
  UNION ALL
  SELECT user_id AS external_id
  FROM seed_source.conditions
  WHERE id IN (SELECT id FROM keep_conditions)
    AND user_id IS NOT NULL
  UNION ALL
  SELECT user_id AS external_id
  FROM seed_source.annotation_analyses
  WHERE annotation_id IN (SELECT id FROM keep_annotations)
    AND analysis_id IN (SELECT id FROM keep_analyses)
    AND (studyset_id, study_id) IN (SELECT studyset_id, study_id FROM keep_studyset_studies)
    AND user_id IS NOT NULL
  UNION ALL
  SELECT user_id AS external_id
  FROM seed_source.points
  WHERE id IN (SELECT id FROM keep_points)
    AND user_id IS NOT NULL
  UNION ALL
  SELECT user_id AS external_id
  FROM seed_source.point_values
  WHERE point_id IN (SELECT id FROM keep_points)
    AND user_id IS NOT NULL
  UNION ALL
  SELECT user_id AS external_id
  FROM seed_source.images
  WHERE id IN (SELECT id FROM keep_images)
    AND user_id IS NOT NULL
) refs
WHERE external_id IS NOT NULL;

CREATE TEMP TABLE keep_users AS
SELECT id, external_id
FROM seed_source.users
WHERE external_id IN (SELECT external_id FROM keep_external_ids);

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

INSERT INTO studysets (
  id,
  created_at,
  updated_at,
  name,
  description,
  publication,
  authors,
  metadata_,
  source,
  source_id,
  source_updated_at,
  doi,
  pmid,
  public,
  user_id
)
SELECT
  id,
  created_at,
  updated_at,
  name,
  description,
  publication,
  authors,
  metadata_,
  source,
  source_id,
  source_updated_at,
  doi,
  pmid,
  public,
  user_id
FROM seed_source.studysets
WHERE id IN (SELECT id FROM keep_studysets);

INSERT INTO annotations
SELECT *
FROM seed_source.annotations
WHERE id IN (SELECT id FROM keep_annotations);

INSERT INTO base_studies (
  id,
  created_at,
  updated_at,
  name,
  description,
  publication,
  doi,
  pmid,
  authors,
  year,
  public,
  level,
  metadata_,
  user_id,
  has_coordinates,
  has_images,
  pmcid,
  ace_fulltext,
  pubget_fulltext,
  is_oa,
  is_active,
  superseded_by,
  has_z_maps,
  has_t_maps,
  has_beta_and_variance_maps
)
SELECT
  id,
  created_at,
  updated_at,
  name,
  description,
  publication,
  doi,
  pmid,
  authors,
  year,
  public,
  level,
  metadata_,
  user_id,
  has_coordinates,
  has_images,
  pmcid,
  ace_fulltext,
  pubget_fulltext,
  is_oa,
  is_active,
  superseded_by,
  has_z_maps,
  has_t_maps,
  has_beta_and_variance_maps
FROM seed_source.base_studies
WHERE id IN (SELECT id FROM keep_base_studies);

INSERT INTO studies (
  id,
  created_at,
  updated_at,
  name,
  description,
  publication,
  doi,
  pmid,
  authors,
  year,
  public,
  metadata_,
  source,
  source_id,
  source_updated_at,
  user_id,
  level,
  base_study_id,
  pmcid,
  has_coordinates,
  has_z_maps,
  has_t_maps,
  has_beta_and_variance_maps,
  has_images
)
SELECT
  id,
  created_at,
  updated_at,
  name,
  description,
  publication,
  doi,
  pmid,
  authors,
  year,
  public,
  metadata_,
  source,
  source_id,
  source_updated_at,
  user_id,
  level,
  base_study_id,
  pmcid,
  has_coordinates,
  has_z_maps,
  has_t_maps,
  has_beta_and_variance_maps,
  has_images
FROM seed_source.studies
WHERE id IN (SELECT id FROM keep_studies);

INSERT INTO studyset_studies
SELECT *
FROM seed_source.studyset_studies
WHERE (studyset_id, study_id) IN (SELECT studyset_id, study_id FROM keep_studyset_studies);

INSERT INTO tables
SELECT *
FROM seed_source.tables
WHERE id IN (SELECT id FROM keep_tables);

INSERT INTO analyses
SELECT *
FROM seed_source.analyses
WHERE id IN (SELECT id FROM keep_analyses);

INSERT INTO conditions
SELECT *
FROM seed_source.conditions
WHERE id IN (SELECT id FROM keep_conditions);

INSERT INTO analysis_conditions
SELECT *
FROM seed_source.analysis_conditions
WHERE analysis_id IN (SELECT id FROM keep_analyses)
  AND condition_id IN (SELECT id FROM keep_conditions);

INSERT INTO entities
SELECT *
FROM seed_source.entities
WHERE id IN (SELECT id FROM keep_entities);

INSERT INTO annotation_analyses
SELECT *
FROM seed_source.annotation_analyses
WHERE annotation_id IN (SELECT id FROM keep_annotations)
  AND analysis_id IN (SELECT id FROM keep_analyses)
  AND (studyset_id, study_id) IN (SELECT studyset_id, study_id FROM keep_studyset_studies);

INSERT INTO points
SELECT *
FROM seed_source.points
WHERE id IN (SELECT id FROM keep_points);

INSERT INTO point_values
SELECT *
FROM seed_source.point_values
WHERE point_id IN (SELECT id FROM keep_points);

INSERT INTO point_entities
SELECT *
FROM seed_source.point_entities
WHERE point IN (SELECT id FROM keep_points)
  AND entity IN (SELECT id FROM keep_entities);

INSERT INTO images
SELECT *
FROM seed_source.images
WHERE id IN (SELECT id FROM keep_images);

INSERT INTO image_entities
SELECT *
FROM seed_source.image_entities
WHERE image IN (SELECT id FROM keep_images)
  AND entity IN (SELECT id FROM keep_entities);

INSERT INTO pipelines
SELECT *
FROM seed_source.pipelines
WHERE id IN (SELECT id FROM keep_pipelines);

INSERT INTO pipeline_configs
SELECT *
FROM seed_source.pipeline_configs
WHERE id IN (SELECT id FROM keep_pipeline_configs);

INSERT INTO pipeline_study_results
SELECT *
FROM seed_source.pipeline_study_results
WHERE base_study_id IN (SELECT id FROM keep_base_studies)
  AND config_id IN (SELECT id FROM keep_pipeline_configs);

INSERT INTO pipeline_embeddings
SELECT *
FROM seed_source.pipeline_embeddings
WHERE base_study_id IN (SELECT id FROM keep_base_studies)
  AND config_id IN (SELECT id FROM keep_pipeline_configs);

INSERT INTO base_study_flag_outbox
SELECT *
FROM seed_source.base_study_flag_outbox
WHERE base_study_id IN (SELECT id FROM keep_base_studies);

INSERT INTO base_study_metadata_outbox
SELECT *
FROM seed_source.base_study_metadata_outbox
WHERE base_study_id IN (SELECT id FROM keep_base_studies);

UPDATE base_studies
SET
  ace_fulltext = NULL,
  pubget_fulltext = NULL;

ANALYZE;

DROP SCHEMA seed_source CASCADE;
DROP SERVER store_seed_source CASCADE;
