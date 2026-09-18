-- Measures the claim study-schema-ingestion-design.md rests on: that JSONB is the
-- wrong query surface for extracted records, and a normalized projection is worth
-- building.
--
-- Run against a restore of a real neurostore dump, never a live database:
--
--   docker run -d --rm --name ns-bench -e POSTGRES_PASSWORD=test \
--     -p 55432:5432 pgvector/pgvector:pg17
--   createdb / pg_restore the dump, then:
--   psql -h localhost -p 55432 -U postgres -d neurostore -f this_file.sql
--
-- Measured 2026-09-18 on the 2026-04-20 dump: 73,343 pipeline_study_results
-- (97 MB), 41,683 base studies, 211,555 analyses, 2,113,057 points.

\timing on

ANALYZE pipeline_study_results;

-- ---------------------------------------------------------------------------
-- The projection, built from the documents themselves. One row per reported
-- group -- the shape the design doc's Tier A gives Group.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS proj_group;
CREATE TABLE proj_group AS
SELECT
  psr.id                                 AS result_id,
  psr.base_study_id,
  (g ->> 'group_name')                   AS group_name,
  (g ->> 'diagnosis')                    AS diagnosis,
  (g ->> 'subgroup_name')                AS subgroup_name,
  (g ->> 'imaging_sample')               AS imaging_sample,
  NULLIF(g ->> 'count', '')::numeric     AS n_count,
  NULLIF(g ->> 'age_mean', '')::numeric  AS age_mean,
  NULLIF(g ->> 'age_minimum', '')::numeric AS age_minimum,
  NULLIF(g ->> 'age_maximum', '')::numeric AS age_maximum,
  NULLIF(g ->> 'male_count', '')::numeric  AS male_count,
  NULLIF(g ->> 'female_count', '')::numeric AS female_count
FROM pipeline_study_results psr
CROSS JOIN LATERAL jsonb_array_elements(psr.result_data -> 'groups') AS g
WHERE psr.result_data ? 'groups';

CREATE INDEX ix_proj_group_age_mean ON proj_group (age_mean);
CREATE INDEX ix_proj_group_diagnosis ON proj_group (diagnosis);
CREATE INDEX ix_proj_group_n_count ON proj_group (n_count);
ANALYZE proj_group;

-- 62,366 rows / 11 MB against 73,343 documents / 97 MB.
SELECT count(*) AS group_rows,
       pg_size_pretty(pg_total_relation_size('proj_group')) AS projection_size,
       pg_size_pretty(pg_total_relation_size('pipeline_study_results')) AS document_size
FROM proj_group;

-- ---------------------------------------------------------------------------
-- 1. One numeric filter. 98 ms -> 8 ms cold, 69 ms -> 6 ms warm.
-- ---------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(DISTINCT base_study_id) FROM pipeline_study_results
WHERE jsonb_path_exists(result_data, '$.groups[*].age_mean ? (@ > 60)');

EXPLAIN (ANALYZE, BUFFERS)
SELECT count(DISTINCT base_study_id) FROM proj_group WHERE age_mean > 60;

-- ---------------------------------------------------------------------------
-- 2. Four filters, the shape a meta-analyst actually asks.
--    84 ms -> 3 ms cold, 79 ms -> 2 ms warm.
--
-- The timing is the smaller half of the result. On the JSONB plan the planner
-- estimates 24,448 rows against 467 actual -- a 52x overestimate, because there
-- are no statistics for a path inside a document. That estimate is what feeds
-- join planning, so the cost compounds in any query that is not this simple.
-- ---------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(DISTINCT base_study_id) FROM pipeline_study_results
WHERE jsonb_path_exists(
  result_data,
  '$.groups[*] ? (@.age_mean > 25 && @.age_mean < 60 && @.count >= 20 && @.diagnosis == "Healthy")'
);

EXPLAIN (ANALYZE, BUFFERS)
SELECT count(DISTINCT base_study_id) FROM proj_group
WHERE age_mean > 25 AND age_mean < 60 AND n_count >= 20 AND diagnosis = 'Healthy';

-- ---------------------------------------------------------------------------
-- 3. The indexed JSONB case, for contrast: Modality is the one field with a GIN
--    expression index (ix_pipeline_study_results__modality).
--
--    222 ms -- slower than the unindexed scan in (1). The index is not at fault:
--    'fMRI-BOLD' matches 30,713 of 73,343 rows, so the bitmap heap scan visits
--    most of the table anyway and pays for the index on top. Worth stating
--    because it means "add a GIN index per field" is not the cheaper answer the
--    design doc is arguing against -- an index does not help a filter that is
--    not selective, while a normalized column still gives the planner a real
--    row estimate.
-- ---------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM pipeline_study_results
WHERE result_data -> 'Modality' @> '["fMRI-BOLD"]'::jsonb;

DROP TABLE proj_group;
