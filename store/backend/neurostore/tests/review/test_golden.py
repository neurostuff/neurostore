import json

import pytest

from neurostore.review import entities, paths
from neurostore.review.bundle import validator
from neurostore.tests.review import golden, records

REGENERATE = "regenerate it with: cd store/backend && python -m neurostore.tests.review.golden"
ENTRIES = json.loads(golden.OPS.read_text("utf-8")) if golden.OPS.exists() else []


def test_the_committed_bundle_is_what_golden_builds():
    assert golden.BUNDLE.exists(), f"{golden.BUNDLE} is missing; {REGENERATE}"
    assert golden.BUNDLE.read_text("utf-8") == golden.render(golden.build_bundle()), (
        f"bundle.json is stale; {REGENERATE}"
    )


def test_the_bundle_validates_against_the_bundle_schema_with_its_entity_index():
    bundle = golden.build_bundle()
    assert "entities" in bundle
    assert [error.message for error in validator().iter_errors(bundle)] == []
    assert bundle["entities"] == entities.index_rows(bundle["record"])


def test_the_bundle_carries_only_the_synthetic_text():
    assert golden.build_bundle()["text"] == records.TEXT


def _slot(item, path):
    return paths.get(item, path) or {}


def test_the_record_has_the_shapes_the_front_end_tests_need():
    index = entities.index(golden.build_bundle()["record"])
    assert _slot(index["an_1"].item, "groups[#0].n").get("extraction_status") == "extracted"
    assert _slot(index["study"].item, "description").get("extraction_status") == "extracted"
    assert _slot(index["study"].item, "design.description").get("extraction_status") == (
        "extracted"
    )
    assert _slot(index["grp_b"].item, "age_mean").get("extraction_status") == "not_reported"
    sets = _slot(index["grp_a"].item, "age_mean").get("evidence", {}).get("sets", [])
    assert [evidence_set.get("source") for evidence_set in sets] == ["model_quote"]


def test_a_batch_expected_to_fail_fails_the_check_when_it_applies_cleanly():
    entry = {
        "name": "applies",
        "ops": [{"client_op_id": "golden-op-01", "type": "note",
                 "target": {"kind": "paper"}, "note": "a note"}],
        "expect": "outside",
    }
    with pytest.raises(AssertionError):
        golden.check_entry(golden.build_bundle(), entry)


def test_a_batch_failing_with_its_expected_error_passes_the_check():
    entry = {
        "name": "outside",
        "ops": [{"client_op_id": "golden-op-02", "type": "set_evidence",
                 "target": {"kind": "slot", "entity": "grp_a", "path": "age_mean"},
                 "evidence": {"status": "present", "sets": [
                     {"spans": [{"start_char": 0, "end_char": 100000}]}]}}],
        "expect": "outside the paper",
    }
    golden.check_entry(golden.build_bundle(), entry)


@pytest.mark.skipif(
    not golden.OPS.exists(),
    reason="ops.json is written by the front end; its batches are replayed once it exists",
)
@pytest.mark.parametrize("entry", ENTRIES, ids=lambda entry: entry["name"])
def test_each_front_end_batch_applies_as_its_expect_says(entry):
    golden.check_entry(golden.build_bundle(), entry)
