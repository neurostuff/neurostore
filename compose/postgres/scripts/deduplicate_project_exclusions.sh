#! /bin/bash

# INSTRUCTIONS:
# Run this script (bash deduplicate_project_exclusions.sh) which will go through all the projects and transform the exclusion tag object into a string,
# containing just the exclusion tag id. For example: exclusionTag: { "id": "neurosynth_exclude_exclusion", label: "Exclude", isExclusionTag: true, isAssignable: true } -> exclusionTag: "neurosynth_exclude_exclusion"
# This script will:
# 1. Create a reusable PostgreSQL function for the transformation
# 2. Validate the transformation by checking that the number of stub studies and the exclusion tag id are the same for each project
# 3. If the validation passes, update the projects with the transformed data WHEN THE USER CONFIRMS "yes"
# 4. Clean up the function

DATABASE_NAME="compose"
DOCKER_COMPOSE_COMMAND="docker compose"

# Create a reusable PostgreSQL function for the transformation
QUERY_CREATE_FUNCTION="
CREATE OR REPLACE FUNCTION transform_exclusion_tags(provenance_data JSONB) RETURNS JSONB AS \$\$
    BEGIN
        RETURN jsonb_set(
            provenance_data,
            '{curationMetadata,columns}',
            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_set(
                            curationColumn,
                            '{stubStudies}',
                            COALESCE(
                                (
                                    SELECT jsonb_agg(
                                        CASE
                                            WHEN stub->>'exclusionTag' IS NULL THEN stub
                                            WHEN jsonb_typeof(stub->'exclusionTag') = 'string' THEN stub
                                            ELSE jsonb_set(
                                                stub,
                                                '{exclusionTag}',
                                                stub->'exclusionTag'->'id'
                                            )
                                        END
                                    )
                                    FROM jsonb_array_elements(curationColumn->'stubStudies') AS stub
                                ),
                                '[]'::jsonb
                            )
                        )
                    )
                    FROM jsonb_array_elements(provenance_data->'curationMetadata'->'columns') AS curationColumn
                ),
                '[]'::jsonb
            )
        );
    END;
\$\$ LANGUAGE plpgsql IMMUTABLE;
"

# Query to show current state of all projects
QUERY_BEFORE="SELECT id, jsonb_pretty(provenance::jsonb) FROM projects WHERE provenance::jsonb->'curationMetadata'->'columns' IS NOT NULL ORDER BY id;"

# Query to preview what the transformed data would look like
QUERY_PREVIEW="SELECT id, jsonb_pretty(transform_exclusion_tags(provenance::jsonb)) AS new_provenance \
FROM projects \
WHERE provenance::jsonb->'curationMetadata'->'columns' IS NOT NULL \
ORDER BY id;"

# Validation query to check both conditions for each project
QUERY_VALIDATE="WITH transformed AS ( \
    SELECT \
        id, \
        provenance::jsonb AS original_provenance, \
        transform_exclusion_tags(provenance::jsonb) AS transformed_provenance \
    FROM projects \
    WHERE provenance::jsonb->'curationMetadata'->'columns' IS NOT NULL \
), \
stub_counts AS ( \
    SELECT \
        id, \
        ( \
            SELECT COUNT(*) \
            FROM jsonb_array_elements(original_provenance->'curationMetadata'->'columns') AS col, \
                 jsonb_array_elements(col->'stubStudies') AS stub \
            WHERE stub IS NOT NULL AND stub != 'null'::jsonb \
        ) AS original_stub_count, \
        ( \
            SELECT COUNT(*) \
            FROM jsonb_array_elements(transformed_provenance->'curationMetadata'->'columns') AS col, \
                 jsonb_array_elements(col->'stubStudies') AS stub \
            WHERE stub IS NOT NULL AND stub != 'null'::jsonb \
        ) AS transformed_stub_count \
    FROM transformed \
), \
exclusion_tag_validation AS ( \
    SELECT \
        t.id, \
        col_idx, \
        stub_idx, \
        original_stub->'exclusionTag'->>'id' AS original_exclusion_id, \
        transformed_stub->>'exclusionTag' AS transformed_exclusion_tag \
    FROM transformed t, \
         jsonb_array_elements(t.original_provenance->'curationMetadata'->'columns') WITH ORDINALITY AS col(col_data, col_idx), \
         jsonb_array_elements(col.col_data->'stubStudies') WITH ORDINALITY AS original(original_stub, stub_idx), \
         jsonb_array_elements(t.transformed_provenance->'curationMetadata'->'columns') WITH ORDINALITY AS tcol(tcol_data, tcol_idx), \
         jsonb_array_elements(tcol.tcol_data->'stubStudies') WITH ORDINALITY AS transformed(transformed_stub, tstub_idx) \
    WHERE col.col_idx = tcol.tcol_idx \
      AND original.stub_idx = transformed.tstub_idx \
      AND original.original_stub->>'exclusionTag' IS NOT NULL \
      AND original.original_stub->'exclusionTag'->>'id' IS NOT NULL \
) \
SELECT \
    NULL AS project_id, \
    'VALIDATION RESULTS' AS report_type, \
    '==================' AS separator \
UNION ALL \
SELECT \
    sc.id AS project_id, \
    'Stub Count' AS report_type, \
    CASE \
        WHEN sc.original_stub_count != sc.transformed_stub_count THEN \
            '❌ FAILED - Stub count mismatch: ' || sc.original_stub_count || ' -> ' || sc.transformed_stub_count \
        ELSE \
            '✓ PASSED - Stub count: ' || sc.original_stub_count \
    END AS separator \
FROM stub_counts sc \
UNION ALL \
SELECT \
    etv.id AS project_id, \
    'ExclusionTag (Col ' || etv.col_idx || ', Stub ' || etv.stub_idx || ')' AS report_type, \
    CASE \
        WHEN etv.original_exclusion_id != etv.transformed_exclusion_tag THEN \
            '❌ FAILED - Mismatch: \"' || COALESCE(etv.original_exclusion_id, 'NULL') || '\" -> \"' || COALESCE(etv.transformed_exclusion_tag, 'NULL') || '\"' \
        ELSE \
            '✓ PASSED - Preserved: \"' || etv.original_exclusion_id || '\"' \
    END AS separator \
FROM exclusion_tag_validation etv \
ORDER BY project_id NULLS FIRST, report_type, separator;"

# Query to actually update all projects
QUERY_UPDATE="UPDATE projects \
SET provenance = transform_exclusion_tags(provenance::jsonb) \
WHERE provenance::jsonb->'curationMetadata'->'columns' IS NOT NULL;"

echo "================================================"
echo "Creating transformation function..."
echo "================================================"
$DOCKER_COMPOSE_COMMAND exec compose_pgsql17 psql -U postgres -d $DATABASE_NAME -c "$QUERY_CREATE_FUNCTION" > /dev/null 2>&1
echo "✓ Function created successfully"
echo ""

echo "================================================"
echo "Running validation checks on all projects..."
echo "================================================"
echo ""

$DOCKER_COMPOSE_COMMAND exec compose_pgsql17 psql -U postgres -d $DATABASE_NAME -c "$QUERY_VALIDATE"

echo ""
echo "================================================"
echo "Checking for validation failures..."
echo "================================================"

# Query to check if there are any failures and raise error with project IDs
QUERY_CHECK_FAILURES="DO \$\$ \
DECLARE \
    failure_count INTEGER; \
    failed_projects TEXT; \
BEGIN \
    WITH transformed AS ( \
        SELECT \
            id, \
            provenance::jsonb AS original_provenance, \
            transform_exclusion_tags(provenance::jsonb) AS transformed_provenance \
        FROM projects \
        WHERE provenance::jsonb->'curationMetadata'->'columns' IS NOT NULL \
    ), \
    stub_counts AS ( \
        SELECT \
            id, \
            ( \
                SELECT COUNT(*) \
                FROM jsonb_array_elements(original_provenance->'curationMetadata'->'columns') AS col, \
                     jsonb_array_elements(col->'stubStudies') AS stub \
                WHERE stub IS NOT NULL AND stub != 'null'::jsonb \
            ) AS original_stub_count, \
            ( \
                SELECT COUNT(*) \
                FROM jsonb_array_elements(transformed_provenance->'curationMetadata'->'columns') AS col, \
                     jsonb_array_elements(col->'stubStudies') AS stub \
                WHERE stub IS NOT NULL AND stub != 'null'::jsonb \
            ) AS transformed_stub_count \
        FROM transformed \
    ), \
    exclusion_tag_validation AS ( \
        SELECT \
            t.id, \
            original_stub->'exclusionTag'->>'id' AS original_exclusion_id, \
            transformed_stub->>'exclusionTag' AS transformed_exclusion_tag \
        FROM transformed t, \
             jsonb_array_elements(t.original_provenance->'curationMetadata'->'columns') WITH ORDINALITY AS col(col_data, col_idx), \
             jsonb_array_elements(col.col_data->'stubStudies') WITH ORDINALITY AS original(original_stub, stub_idx), \
             jsonb_array_elements(t.transformed_provenance->'curationMetadata'->'columns') WITH ORDINALITY AS tcol(tcol_data, tcol_idx), \
             jsonb_array_elements(tcol.tcol_data->'stubStudies') WITH ORDINALITY AS transformed(transformed_stub, tstub_idx) \
        WHERE col.col_idx = tcol.tcol_idx \
          AND original.stub_idx = transformed.tstub_idx \
          AND original.original_stub->>'exclusionTag' IS NOT NULL \
          AND original.original_stub->'exclusionTag'->>'id' IS NOT NULL \
    ), \
    failures AS ( \
        SELECT DISTINCT id \
        FROM stub_counts \
        WHERE original_stub_count != transformed_stub_count \
        UNION \
        SELECT DISTINCT id \
        FROM exclusion_tag_validation \
        WHERE original_exclusion_id != transformed_exclusion_tag \
    ) \
    SELECT COUNT(*), string_agg(id, ', ') \
    INTO failure_count, failed_projects \
    FROM failures; \
    \
    IF failure_count > 0 THEN \
        RAISE EXCEPTION 'Validation failed for % project(s): %', failure_count, failed_projects; \
    ELSE \
        RAISE NOTICE '✓ All validations passed!'; \
    END IF; \
END \$\$;"

$DOCKER_COMPOSE_COMMAND exec compose_pgsql17 psql -U postgres -d $DATABASE_NAME -c "$QUERY_CHECK_FAILURES"

# echo "Saving current state of all projects to output_before.txt..."
$DOCKER_COMPOSE_COMMAND exec compose_pgsql17 psql -U postgres -d $DATABASE_NAME -c "$QUERY_BEFORE" -t -A > ~/WORK/neurostuff/scripts/output_before.txt

# echo "Saving transformed data preview to output_after.txt..."
$DOCKER_COMPOSE_COMMAND exec compose_pgsql17 psql -U postgres -d $DATABASE_NAME -c "$QUERY_PREVIEW" -t -A > ~/WORK/neurostuff/scripts/output_after.txt

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Validation failed! Check the error message above for project IDs."
    echo "Cleaning up..."
    $DOCKER_COMPOSE_COMMAND exec compose_pgsql17 psql -U postgres -d $DATABASE_NAME -c "DROP FUNCTION IF EXISTS transform_exclusion_tags(JSONB);" > /dev/null 2>&1
    exit 1
fi

echo ""
echo "================================================"
echo "Validation complete!"
echo "================================================"
echo ""
# echo "Saving current state of all projects to output_before.txt..."
# docker compose exec compose_pgsql17 psql -U postgres -d compose -c "$QUERY_BEFORE" -t -A > ~/WORK/neurostuff/scripts/output_before.txt

# echo "Saving transformed data preview to output_after.txt..."
# docker compose exec compose_pgsql17 psql -U postgres -d compose -c "$QUERY_PREVIEW" -t -A > ~/WORK/neurostuff/scripts/output_after.txt

# echo ""
# echo "Review the validation results above and the output files."
# echo ""
read -p "Do you want to proceed with the update? (yes/no): " confirmation

if [[ "$confirmation" == "yes" ]]; then
    echo ""
    echo "Applying updates to all projects..."
    RESULT=$($DOCKER_COMPOSE_COMMAND exec compose_pgsql17 psql -U postgres -d $DATABASE_NAME -c "$QUERY_UPDATE")
    echo "$RESULT"
    echo ""
    echo "✓ Update complete! All projects have been transformed."
else
    echo ""
    echo "Update cancelled. No changes were made to the database."
fi

echo ""
echo "Cleaning up..."
$DOCKER_COMPOSE_COMMAND exec compose_pgsql17 psql -U postgres -d $DATABASE_NAME -c "DROP FUNCTION IF EXISTS transform_exclusion_tags(JSONB);" > /dev/null 2>&1
echo "✓ Cleanup complete"
