"""The study_schema truth layer: entity hashes, and staying out of the API.

Claims and their evidence are stored but not served yet, so nothing that reaches a client --
a route, an API schema, an admin view -- may read these tables. The tests fail the day one
does, so exposing them is a decision rather than an accident.
"""

import hashlib
import json
import re
from pathlib import Path

import pytest

from neurostore import schemas
from neurostore.models import data
from neurostore.models.data import study_entity_hash
from neurostore.tests import study_schema_fixtures as fx

TRUTH_LAYER = (
    data.PipelineAnalysisResult,
    data.StudyEntity,
    data.StudyEntityAlias,
    data.StudyEntityCandidateLink,
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


PO = fx.text_analysis([(5, 9)], "PO > Sil", [fx.point((-4, 50.5, 0), t=5.8)])


def test_the_hash_is_a_full_sha256():
    value = study_entity_hash("bs1", "Analysis", PO["key"])
    assert re.fullmatch(r"[0-9a-f]{64}", value)


def test_the_hash_separates_papers_classes_and_keys():
    base = study_entity_hash("bs1", "Analysis", PO["key"])
    assert base != study_entity_hash("bs2", "Analysis", PO["key"])  # same analysis, other paper
    assert base != study_entity_hash("bs1", "CoordinateSet", PO["key"])
    moved = fx.text_analysis([(5, 9)], "PO > Sil", [fx.point((-4, 50.5, 2), t=5.8)])
    assert base != study_entity_hash("bs1", "Analysis", moved["key"])


def test_a_key_cannot_be_mistaken_for_a_name():
    # The class is inside the hash, so a Group named like a key is still a Group.
    as_group = study_entity_hash("bs1", "Group", PO["key"])
    assert as_group != study_entity_hash("bs1", "Analysis", PO["key"])


def test_the_key_separates_names_given_the_same_points():
    # gx2zzUbbydf9 reads "PO > Sil" and "PC > Sil" from the same spans; one
    # identity for both merged two contrasts' claims onto one coordinate set.
    points = PO["points"]
    assert PO["key"] != fx.text_analysis([(5, 9)], "PC > Sil", points)["key"]
    # Case, dash and spacing are not a different contrast.
    for name in ("po  >  SIL", "PO>Sil"):
        assert fx.text_analysis([(5, 9)], name, points)["key"] == PO["key"]
    dashed = (fx.text_analysis([(5, 9)], n, points)["key"] for n in ("PO - Sil", "po \u2013 sil"))
    assert len(set(dashed)) == 1


def test_the_key_is_the_hash_coordinates_yaml_spells_out():
    # ParsedAnalysis.key, written out by hand: the compact JSON of the normalized name,
    # the space and each point's coordinates (0.01 mm), own space and values (6 digits).
    canonical = ["po>sil", "MNI", [["-4.00", "50.50", "0.00", "", [["t", "5.8"]]]]]
    payload = json.dumps(canonical, separators=(",", ":"), ensure_ascii=False)
    assert PO["key"] == "analysis#" + hashlib.sha256(payload.encode()).hexdigest()[:16]
