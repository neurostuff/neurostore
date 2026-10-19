"""The analyses the real core takes away and puts in place for edit_points, split and merge,
recorded as a golden the front end's memory backend and its follow rule are checked against."""

import copy
import json

from neurostore.review.core.ops import ReviewState, apply_batch
from neurostore.tests.review import golden, records

FOLLOW = golden.BUNDLE.with_name("coordinate-follow.json")


def _coordinate(client_op_id, key, action, **fields):
    return {"client_op_id": client_op_id, "type": "coordinate",
            "target": {"kind": "coordinate_analysis", "analysis_key": key},
            "action": action, **fields}


def build_follow():
    """Edit a point of the second analysis, split the result, then merge the first analysis with
    the second part: each op's stored before and after analyses, and the parse it began on."""
    parse = records.coordinate_parse()
    state = ReviewState(record=records.golden(), coordinate_parse=parse)
    minter = records.Minter("follow")
    edited = copy.deepcopy(parse["analyses"][1]["points"])
    edited[0]["coordinates"] = [-4, 2, 9]
    steps = []

    def apply(op):
        nonlocal state
        state, stored = apply_batch(
            state, {"ops": [op]}, text=records.TEXT, user_id=golden.USER, at=golden.AT,
            stable_ids=minter.stable_ids(),
        )
        [entry] = stored
        steps.append({"op": op, "before": entry["before"]["analyses"],
                      "after": entry["after"]["analyses"]})
        return [item["analysis"]["key"] for item in entry["after"]["analyses"]]

    [edit_key] = apply(_coordinate("follow-edit-0001", parse["analyses"][1]["key"],
                                   "edit_points", payload={"points": edited}))
    parts = apply(_coordinate("follow-split-0001", edit_key, "split",
                              payload={"parts": [{"indices": [0]}, {"indices": [1]}]}))
    apply(_coordinate("follow-merge-0001", parse["analyses"][0]["key"], "merge",
                      payload={"with": [parts[1]]}))
    return {"parse": parse, "steps": steps}


def test_the_committed_follow_golden_is_what_the_core_stores():
    golden.check(FOLLOW, json.dumps(build_follow(), indent=2, ensure_ascii=False) + "\n")


def test_every_step_replaces_the_analyses_it_names_with_new_keys():
    steps = build_follow()["steps"]
    assert [len(step["before"]) for step in steps] == [1, 1, 2]
    assert [len(step["after"]) for step in steps] == [1, 2, 1]
    before = {item["analysis"]["key"] for step in steps for item in step["before"]}
    after = {item["analysis"]["key"] for step in steps for item in step["after"]}
    assert len(after) == 4 and before & after == {steps[0]["after"][0]["analysis"]["key"],
                                                  steps[1]["after"][1]["analysis"]["key"]}
