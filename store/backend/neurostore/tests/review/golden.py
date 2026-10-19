"""The synthetic review bundle the front end's tests open, and the op batches replayed on it.

Every golden file is regenerated the one way store/review-frontend/README.md gives: the store
test command with UPDATE_GOLDEN=1, then the front end's tests with UPDATE_GOLDEN=1 for ops.json.
ops.json is a list of {"name", "ops": [op, ...], "expect": "ok" | "<error substring>"}; an
"ok" entry also holds the "record", "provenance" and "annotations" the front end's applyOp
left. Each entry is one batch, applied on its own to the bundle's state.
"""

import hashlib
import json
import os
from pathlib import Path

from neurostore.review.core import coordinates, entities, paths
from neurostore.review.core.bundle import bundle
from neurostore.review.core.ops import ReviewState, apply_batch
from neurostore.review.errors import ReviewError
from neurostore.tests import study_schema_fixtures as fx
from neurostore.tests.review import records

ROOT = Path(__file__).resolve().parents[4]
BUNDLE = ROOT / "review-frontend/src/test/golden/bundle.json"
OPS = BUNDLE.with_name("ops.json")
DIFF_BUNDLE = BUNDLE.with_name("diff-bundle.json")
DIFF_VERDICTS = BUNDLE.with_name("diff-verdicts.json")
#: The create_entity the front end's New entity sends beside the golden analysis;
#: the front end writes it.
CREATE_ANALYSIS = BUNDLE.with_name("create-analysis.json")
REGENERATE = (
    "regenerate it: cd store && docker compose run -e APP_ENV=docker_test -e UPDATE_GOLDEN=1 "
    '--rm neurostore bash -c "python -m pytest neurostore/tests/review"'
)
AT = "2026-10-14T12:00:00Z"
USER = "golden-reviewer"
DOCUMENTS = ("record", "provenance", "annotations")
REVIEW_OPS = [
    {"client_op_id": "golden-0001", "type": "verdict",
     "target": {"kind": "entity", "entity": "grp_a"}, "verdict": "accept"},
    {"client_op_id": "golden-0002", "type": "set_evidence",
     "target": {"kind": "entity", "entity": "grp_b"},
     "evidence": {"status": "present", "sets": [
         {"spans": [{"start_char": 0, "end_char": 6}]}]}},
]

_PARSE = records.coordinate_parse()
DIFF_OPS = [
    {"client_op_id": "golden-diff-0001", "type": "set_value",
     "target": {"kind": "slot", "entity": "grp_a", "path": "age_mean"},
     "value": {"extraction_status": "extracted", "value": 35.0, "value_source": "reported"}},
    {"client_op_id": "golden-diff-0002", "type": "create_entity", "parent": "study",
     "list": "groups", "entity": records.item("Group", "grp_c", name=fx.extracted("siblings"))},
    {"client_op_id": "golden-diff-0003", "type": "link",
     "target": {"kind": "relationship", "entity": "grp_b", "path": "diagnostic_instrument",
                "target_entity": "asm_1"}},
    {"client_op_id": "golden-diff-0004", "type": "unlink",
     "target": {"kind": "relationship", "entity": "an_1", "path": "tasks",
                "target_entity": "tsk_1"}},
    {"client_op_id": "golden-diff-0005", "type": "coordinate",
     "target": {"kind": "coordinate_analysis", "analysis_key": _PARSE["analyses"][1]["key"]},
     "action": "split", "payload": {"parts": [{"indices": [0]}, {"indices": [1]}]}},
    {"client_op_id": "golden-diff-0006", "type": "verdict",
     "target": {"kind": "coordinate_analysis", "analysis_key": _PARSE["analyses"][2]["key"]},
     "verdict": "reject", "reason": "not_in_text"},
]


def build_bundle():
    return _build("golden-1", "golden-base-1", "Golden synthetic paper", REVIEW_OPS)


def build_diff():
    """The bundle of a review that edited a slot, created an entity, linked and unlinked,
    split a coordinate analysis and rejected another, and the verdicts export derives from it."""
    document = _build(
        "golden-diff-1", "golden-diff-base-1", "Golden synthetic paper, edited", DIFF_OPS
    )
    judged = coordinates.judged(
        document["coordinate_parse"],
        document["coordinate_revision"],
        document["review"]["provenance"],
        [stored["op"] for stored in document["ops"]],
    )
    return document, judged["verdicts"]


def _build(source_id, base_study_id, label, review_ops):
    base = ReviewState(record=records.golden(), coordinate_parse=records.coordinate_parse())
    state, stored = apply_batch(
        base, {"ops": review_ops}, text=records.TEXT, user_id=USER, at=AT,
        stable_ids=records.Minter(source_id).stable_ids(),
    )
    document = bundle(
        source={
            "id": source_id,
            "base_study_id": base_study_id,
            "label": label,
            "origin": "upload",
            "text_sha256": hashlib.sha256(records.TEXT.encode("utf-8")).hexdigest(),
            "schema_versions": {"paper_parse": "0.6.0", "extraction": "0.5.0"},
        },
        text=records.TEXT,
        parsed_paper=fx.parsed_paper(),
        original={"record": base.record, "coordinate_revision": None},
        state=state,
        review={"id": "golden-review-1", "user_id": USER, "state": "in_progress"},
        ops=stored,
        reviewers=[{
            "user_id": USER,
            "name": None,
            "state": "in_progress",
            "op_count": len(stored),
            "last_edit_at": AT,
        }],
    )
    return document


def render(bundle):
    return json.dumps(bundle, indent=2, ensure_ascii=False) + "\n"


def check(path, rendered):
    """Assert that ``path`` holds ``rendered``, writing it first under UPDATE_GOLDEN=1."""
    if os.environ.get("UPDATE_GOLDEN") == "1":
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(rendered, encoding="utf-8")
    assert path.exists(), f"{path} is missing; {REGENERATE}"
    assert path.read_text("utf-8") == rendered, f"{path.name} is stale; {REGENERATE}"


def check_entry(bundle, entry):
    """Apply one ops.json entry to the bundle's state; raise AssertionError if it misbehaves."""
    review = bundle["review"]
    state = ReviewState(
        record=bundle["record"],
        coordinate_parse=bundle["coordinate_parse"],
        coordinate_revision=bundle["coordinate_revision"],
        provenance=review["provenance"],
        annotations=review["annotations"],
        last_seq=review["last_seq"],
    )
    name, expect = entry["name"], entry["expect"]
    try:
        after, stored = apply_batch(
            state, {"ops": entry["ops"]}, text=bundle["text"], user_id=review["user_id"], at=AT,
            stable_ids=records.minting(),
        )
    except ReviewError as error:
        problems = " ".join([str(error), *error.problems])
        assert expect != "ok" and expect in problems, f"{name}: {problems}"
        return
    assert expect == "ok", f"{name}: applied, but expected an error containing {expect!r}"
    for document in DOCUMENTS:
        assert document in entry, f"{name}: the entry records no {document}"
        assert getattr(after, document) == entry[document], (
            f"{name}: the {document} after the batch is not the one the front end recorded"
        )
    index = entities.index(state.record)
    checked = set()
    for stored_op in stored:
        op = stored_op["op"]
        target = op.get("target", {})
        if op["type"] != "set_evidence" or target.get("kind") != "slot":
            continue
        slot = (target["entity"], target["path"])
        if slot in checked:
            continue
        checked.add(slot)
        wrapper = paths.get(index[target["entity"]].item, target["path"]) or {}
        assert stored_op["before"] == wrapper.get("evidence"), (
            f"{name}: the stored before of {slot} is not the bundle's evidence"
        )
