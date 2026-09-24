-- Measures the claim study-schema-ingestion-design.md rests on: that JSONB is the
-- wrong query surface for extracted records, and a normalized projection is worth
-- building.
--
-- Run against a restore of a real neurostore dump, never a live database:
--
--   docker run -d --rm --name ns-bench -e POSTGRES_PASSWORD=test \
--     -p 55432:5432 pgvector/pgvector:pg17
--   createdb / pg_restore the dump, then generate and apply the projection:
--
--   python scripts/generate_projection_ddl.py \
--       --schema .../neuroimaging-study-storage.yaml --out projection.sql
--   psql -h localhost -p 55432 -U postgres -d neurostore -f projection.sql
--   psql -h localhost -p 55432 -U postgres -d neurostore -f this_file.sql
--
-- Measured 2026-09-18 on the 2026-04-20 dump: 73,343 pipeline_study_results
-- (97 MB), 41,683 base studies, 211,555 analyses, 2,113,057 points.
--
-- The corpus holds no study_schema records yet, so the projection is populated
-- from the ParticipantDemographicsExtractor documents that are there. Their
-- group fields map onto the schema's Group almost one-to-one, which makes this
-- a real measurement of the generated table rather than of a stand-in.

\timing on

ANALYZE pipeline_study_results;

-- ---------------------------------------------------------------------------
-- Populate the generated "Group" projection from the documents.
-- ---------------------------------------------------------------------------
-- CASCADE because other projection tables reference Group. That is the
-- rebuild model working as intended: the projection is disposable.
TRUNCATE "Group" CASCADE;

INSERT INTO "Group" (
  id, base_study_id, name, description,
  enrolled_count, age_mean, age_minimum, age_maximum,
  medical_condition
)
SELECT
  psr.id || ':' || (ord - 1)::text,
  psr.base_study_id,
  g ->> 'group_name',
  g ->> 'subgroup_name',
  round(NULLIF(g ->> 'count', '')::numeric)::int,  -- documents hold "18.0"
  NULLIF(g ->> 'age_mean', '')::float,
  NULLIF(g ->> 'age_minimum', '')::float,
  NULLIF(g ->> 'age_maximum', '')::float,
  CASE WHEN g ->> 'diagnosis' IS NULL THEN NULL
       ELSE ARRAY[g ->> 'diagnosis'] END
FROM pipeline_study_results psr
CROSS JOIN LATERAL jsonb_array_elements(psr.result_data -> 'groups')
  WITH ORDINALITY AS t(g, ord)
WHERE psr.result_data ? 'groups';

-- The sex split is a distribution, and the facet column is what keeps it
-- distinguishable from the handedness/race/ethnicity distributions that share
-- this table. Without it these rows are indistinguishable once written.
INSERT INTO "CategoryDistribution" (category, count, "Group_id", group_facet, base_study_id)
SELECT 'female', round(NULLIF(g ->> 'female_count', '')::numeric)::int,
       psr.id || ':' || (ord - 1)::text, 'sex_distribution', psr.base_study_id
FROM pipeline_study_results psr
CROSS JOIN LATERAL jsonb_array_elements(psr.result_data -> 'groups')
  WITH ORDINALITY AS t(g, ord)
WHERE psr.result_data ? 'groups' AND g ->> 'female_count' IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_group_age_mean ON "Group" (age_mean);
CREATE INDEX IF NOT EXISTS ix_group_enrolled_count ON "Group" (enrolled_count);
CREATE INDEX IF NOT EXISTS ix_group_medical_condition ON "Group" USING gin (medical_condition);
CREATE INDEX IF NOT EXISTS ix_group_base_study ON "Group" (base_study_id);
CREATE INDEX IF NOT EXISTS ix_catdist_facet ON "CategoryDistribution" (group_facet);
ANALYZE "Group";
ANALYZE "CategoryDistribution";

SELECT count(*) AS group_rows,
       pg_size_pretty(pg_total_relation_size('"Group"')) AS projection_size,
       pg_size_pretty(pg_total_relation_size('pipeline_study_results')) AS document_size
FROM "Group";

-- ---------------------------------------------------------------------------
-- 1. One numeric filter. 84 ms -> 6 ms.
-- ---------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(DISTINCT base_study_id) FROM pipeline_study_results
WHERE jsonb_path_exists(result_data, '$.groups[*].age_mean ? (@ > 60)');

EXPLAIN (ANALYZE, BUFFERS)
SELECT count(DISTINCT base_study_id) FROM "Group" WHERE age_mean > 60;

-- ---------------------------------------------------------------------------
-- 2. Several filters, the shape a meta-analyst actually asks. 94 ms -> 7 ms.
--
-- Note the JSONB estimate: 24,448 rows against 467 actual, and *the same
-- 24,448* as the single-filter query above. Postgres has no statistics for a
-- path inside a document, so it is not estimating at all -- 24,448 is one third
-- of the table, its fallback constant. Adding three conditions changed the
-- estimate by nothing. The projection estimates 634 against 520.
-- ---------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(DISTINCT base_study_id) FROM pipeline_study_results
WHERE jsonb_path_exists(
  result_data,
  '$.groups[*] ? (@.age_mean > 25 && @.age_mean < 60 && @.count >= 20 && @.diagnosis == "Healthy")'
);

EXPLAIN (ANALYZE, BUFFERS)
SELECT count(DISTINCT base_study_id) FROM "Group"
WHERE age_mean > 25 AND age_mean < 60 AND enrolled_count >= 20
  AND medical_condition @> ARRAY['Healthy'];

-- ---------------------------------------------------------------------------
-- 3. Joined to the coordinate skeleton. 349 ms -> 302 ms: only 1.15x, and
--    worth recording precisely because it is the unflattering case.
--
--    The bad estimate does change the plan -- JSONB gets three Parallel Hash
--    Joins off a 587,006-row estimate against 49,884 actual, the projection
--    gets nested loops over index scans off an estimate that is close. But
--    both have to touch ~2.1M points, and that dominates, so the better plan
--    only buys 15%.
--
--    So the projection's order-of-magnitude win is on filtering, not on
--    joining. A claim that bad estimates wreck join performance is not
--    supported by this corpus; they change the plan, and here the change is
--    worth 15%.
-- ---------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
FROM pipeline_study_results psr
JOIN studies s ON s.base_study_id = psr.base_study_id
JOIN analyses a ON a.study_id = s.id
JOIN points p ON p.analysis_id = a.id
WHERE jsonb_path_exists(result_data, '$.groups[*].age_mean ? (@ > 60)');

EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
FROM "Group" g
JOIN studies s ON s.base_study_id = g.base_study_id
JOIN analyses a ON a.study_id = s.id
JOIN points p ON p.analysis_id = a.id
WHERE g.age_mean > 60;

-- ---------------------------------------------------------------------------
-- 4. The indexed JSONB case, for contrast: Modality is the one field with a GIN
--    expression index (ix_pipeline_study_results__modality).
--
--    Slower than the unindexed scan in (1). The index is not at fault:
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
