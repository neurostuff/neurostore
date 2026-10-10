"""The study_schema truth layer: entity hashes, and staying out of the API.

Claims and their evidence are stored but not served yet, so nothing that reaches a client --
a route, an API schema, an admin view -- may read these tables. The tests fail the day one
does, so exposing them is a decision rather than an accident.
"""

import re
from pathlib import Path

import pytest

from neurostore import schemas
from neurostore.models import data
from neurostore.models.data import analysis_identity, study_entity_hash

TRUTH_LAYER = (
    data.PipelineAnalysisResult,
    data.StudyEntity,
    data.StudyEntityAlias,
    data.ExtractionEntityLink,
    data.FieldClaim,
    data.FieldClaimRun,
    data.FieldClaimEvidence,
)

OPENAPI = Path(data.__file__).resolve().parents[1] / "openapi" / "neurostore-openapi.yml"


def test_no_api_schema_serializes_the_truth_layer():
    for name in dir(schemas):
        schema = getattr(schemas, name)
        meta = getattr(schema, "Meta", None)
        assert getattr(meta, "model", None) not in TRUTH_LAYER, name


def test_pipeline_config_does_not_serialize_its_analysis_results():
    assert "analysis_results" not in schemas.PipelineConfigSchema().fields


@pytest.mark.skipif(not OPENAPI.is_file(), reason="openapi submodule not checked out")
def test_no_route_or_component_names_the_truth_layer():
    spec = OPENAPI.read_text(encoding="utf-8")
    for model in TRUTH_LAYER:
        table = model.__tablename__
        assert not re.search(rf"\b{table}\b|\b{table.replace('_', '-')}\b", spec), table


def test_the_hash_is_a_full_sha256():
    locator = analysis_identity("table", "tbl1", cells=[(0, 0)])
    value = study_entity_hash("bs1", "Analysis", locator)
    assert re.fullmatch(r"[0-9a-f]{64}", value)


def test_the_hash_separates_papers_classes_and_cells():
    cells = analysis_identity("table", "tbl2", cells=[(3, 0), (4, 0)])
    base = study_entity_hash("bs1", "Analysis", cells)
    assert base != study_entity_hash("bs2", "Analysis", cells)  # same table id, other paper
    assert base != study_entity_hash("bs1", "CoordinateSet", cells)
    assert base != study_entity_hash(
        "bs1", "Analysis", analysis_identity("table", "tbl2", cells=[(3, 0), (4, 1)])
    )
    assert base != study_entity_hash(
        "bs1", "Analysis", analysis_identity("table", "tbl3", cells=[(3, 0), (4, 0)])
    )


def test_the_hash_ignores_cell_order_and_repeats():
    a = analysis_identity("table", "tbl2", cells=[(4, 0), (3, 0), (4, 0)])
    assert a == analysis_identity("table", "tbl2", cells=[(3, 0), (4, 0)]) == "table|tbl2|3:0,4:0"


def test_text_and_figure_sets_hash_their_spans():
    spans = [(1288, 1300), (1200, 1288)]
    assert analysis_identity("text", spans=spans) == "text||1200-1288,1288-1300"
    assert analysis_identity("figure", spans=[(5, 9)]) != analysis_identity("text", spans=[(5, 9)])


def test_a_set_with_nothing_to_locate_it_is_refused():
    with pytest.raises(ValueError):
        analysis_identity("table", "tbl1", cells=[])
    with pytest.raises(ValueError):
        analysis_identity("text", spans=[])
    with pytest.raises(ValueError):
        analysis_identity("prose", spans=[(0, 1)])


def test_a_name_cannot_be_mistaken_for_a_locator():
    # The class is inside the hash, so a Group named like a locator is still a Group.
    locator = analysis_identity("table", "tbl1", cells=[(0, 0)])
    as_group = study_entity_hash("bs1", "Group", locator)
    assert as_group != study_entity_hash("bs1", "Analysis", locator)
