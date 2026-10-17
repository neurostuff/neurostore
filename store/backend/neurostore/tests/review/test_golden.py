import json

import pytest

from neurostore.review.core import coordinates, entities, paths
from neurostore.review.core.bundle import validator
from neurostore.tests.review import golden, records

ENTRIES = json.loads(golden.OPS.read_text("utf-8")) if golden.OPS.exists() else []


def test_the_committed_bundle_is_what_golden_builds():
    golden.check(golden.BUNDLE, golden.render(golden.build_bundle()))


def test_the_bundle_validates_against_the_bundle_schema_with_its_entity_index():
    bundle = golden.build_bundle()
    assert "entities" in bundle
    assert [error.message for error in validator().iter_errors(bundle)] == []
    assert bundle["entities"] == entities.index_rows(bundle["record"])


def test_the_bundle_carries_only_the_synthetic_text():
    assert golden.build_bundle()["text"] == records.TEXT


def test_the_committed_diff_bundle_and_its_verdicts_are_what_golden_builds():
    bundle, verdicts = golden.build_diff()
    golden.check(golden.DIFF_BUNDLE, golden.render(bundle))
    golden.check(golden.DIFF_VERDICTS, golden.render(verdicts))


def test_the_diff_bundle_validates_and_carries_the_original_beside_the_edited_record():
    bundle, _ = golden.build_diff()
    assert [error.message for error in validator().iter_errors(bundle)] == []
    before = {e["local_id"] for e in bundle["original"]["entities"]}
    after = {e["local_id"] for e in bundle["entities"]}
    assert after - before == {"grp_c"}
    assert bundle["original"]["record"] == records.golden()


def test_the_diff_bundle_holds_one_change_of_each_kind_in_its_ops():
    bundle, _ = golden.build_diff()
    assert [(o["op"]["type"], o["op"].get("action")) for o in bundle["ops"]] == [
        ("set_value", None),
        ("create_entity", None),
        ("link", None),
        ("unlink", None),
        ("coordinate", "split"),
        ("verdict", None),
    ]


def test_the_diff_verdicts_are_the_ones_export_derives_from_the_revision_and_provenance():
    bundle, verdicts = golden.build_diff()
    review = bundle["review"]
    judged = coordinates.judged(
        bundle["coordinate_parse"],
        bundle["coordinate_revision"],
        review["provenance"],
        [stored["op"] for stored in bundle["ops"]],
    )
    assert verdicts == judged["verdicts"]
    kinds = {v["verdict"] for v in verdicts}
    assert {"accept", "split", "omit"} <= kinds


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


def _entry(bundle, op, expect="ok", **documents):
    review = bundle["review"]
    return {
        "name": op["client_op_id"],
        "ops": [op],
        "expect": expect,
        "record": bundle["record"],
        "provenance": review["provenance"],
        "annotations": review["annotations"],
        **documents,
    }


NOTE = {"client_op_id": "golden-op-note", "type": "note",
        "target": {"kind": "paper"}, "note": "a note"}
SPAN_OUTSIDE = {"client_op_id": "golden-op-span", "type": "set_evidence",
                "target": {"kind": "slot", "entity": "grp_a", "path": "age_mean"},
                "evidence": {"status": "present", "sets": [
                    {"spans": [{"start_char": 0, "end_char": 100000}]}]}}


def test_a_batch_expected_to_fail_fails_the_check_when_it_applies_cleanly():
    bundle = golden.build_bundle()
    with pytest.raises(AssertionError):
        golden.check_entry(bundle, _entry(bundle, NOTE, "outside"))


def test_a_batch_failing_with_its_expected_error_passes_the_check():
    bundle = golden.build_bundle()
    golden.check_entry(bundle, _entry(bundle, SPAN_OUTSIDE, "outside the paper"))


def test_a_refusal_with_another_message_than_the_cores_fails_the_check():
    bundle = golden.build_bundle()
    with pytest.raises(AssertionError, match="outside"):
        golden.check_entry(bundle, _entry(bundle, SPAN_OUTSIDE, "no such entity"))


def test_a_batch_leaving_other_documents_than_the_front_end_recorded_fails_the_check():
    bundle = golden.build_bundle()
    op = {"client_op_id": "golden-op-03", "type": "set_value",
          "target": {"kind": "slot", "entity": "grp_a", "path": "age_mean"},
          "value": {"extraction_status": "extracted", "value": 35}}
    with pytest.raises(AssertionError, match="record"):
        golden.check_entry(bundle, _entry(bundle, op))


def test_a_batch_leaving_other_provenance_than_the_front_end_recorded_fails_the_check():
    bundle = golden.build_bundle()
    with pytest.raises(AssertionError, match="provenance"):
        golden.check_entry(bundle, _entry(bundle, NOTE, provenance={}))


def test_a_batch_leaving_other_annotations_than_the_front_end_recorded_fails_the_check():
    bundle = golden.build_bundle()
    with pytest.raises(AssertionError, match="annotations"):
        golden.check_entry(bundle, _entry(bundle, NOTE, annotations={}))


@pytest.mark.parametrize("document", ["record", "provenance", "annotations"])
def test_an_applied_batch_must_record_each_document(document):
    bundle = golden.build_bundle()
    entry = _entry(bundle, NOTE)
    golden.check_entry(bundle, entry)
    del entry[document]
    with pytest.raises(AssertionError, match=f"records no {document}"):
        golden.check_entry(bundle, entry)


@pytest.mark.skipif(
    not golden.OPS.exists(),
    reason="ops.json is written by the front end; its batches are replayed once it exists",
)
@pytest.mark.parametrize("entry", ENTRIES, ids=lambda entry: entry["name"])
def test_each_front_end_batch_applies_as_its_expect_says(entry):
    golden.check_entry(golden.build_bundle(), entry)
