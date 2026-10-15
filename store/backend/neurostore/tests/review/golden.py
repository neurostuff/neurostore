"""The synthetic review bundle the front end's tests open, and the op batches replayed on it.

Run ``python -m neurostore.tests.review.golden`` from store/backend to rewrite bundle.json.
ops.json is a list of {"name", "ops": [op, ...], "expect": "ok" | "<error substring>"}.
Each entry is one batch, applied on its own to the bundle's state.
"""

import hashlib
import json
from pathlib import Path

from neurostore.review import ReviewError, entities, paths
from neurostore.review.bundle import bundle
from neurostore.review.ops import ReviewState, apply_batch
from neurostore.tests import study_schema_fixtures as fx
from neurostore.tests.review import records

ROOT = Path(__file__).resolve().parents[4]
BUNDLE = ROOT / "review-frontend/src/test/golden/bundle.json"
OPS = BUNDLE.with_name("ops.json")
AT = "2026-10-14T12:00:00Z"
USER = "golden-reviewer"
REVIEW_OPS = [
    {"client_op_id": "golden-0001", "type": "verdict",
     "target": {"kind": "entity", "entity": "grp_a"}, "verdict": "accept"},
    {"client_op_id": "golden-0002", "type": "set_evidence",
     "target": {"kind": "entity", "entity": "grp_b"},
     "evidence": {"status": "present", "sets": [
         {"spans": [{"start_char": 0, "end_char": 6}]}]}},
]


def build_bundle():
    base = ReviewState(record=records.golden(), coordinate_parse=records.coordinate_parse())
    state, stored = apply_batch(base, {"ops": REVIEW_OPS}, text=records.TEXT, user_id=USER, at=AT)
    document = bundle(
        source={
            "id": "golden-1",
            "base_study_id": "golden-base-1",
            "label": "Golden synthetic paper",
            "origin": "upload",
            "text_sha256": hashlib.sha256(records.TEXT.encode("utf-8")).hexdigest(),
            "schema_versions": {"paper_parse": "0.6.0", "extraction": "0.5.0"},
        },
        text=records.TEXT,
        parsed_paper=fx.parsed_paper(),
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
        _, stored = apply_batch(
            state, {"ops": entry["ops"]}, text=bundle["text"], user_id=review["user_id"], at=AT
        )
    except ReviewError as error:
        problems = " ".join([str(error), *error.problems])
        assert expect != "ok" and expect in problems, f"{name}: {problems}"
        return
    assert expect == "ok", f"{name}: applied, but expected an error containing {expect!r}"
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


def main():
    BUNDLE.parent.mkdir(parents=True, exist_ok=True)
    BUNDLE.write_text(render(build_bundle()), encoding="utf-8")


if __name__ == "__main__":
    main()
