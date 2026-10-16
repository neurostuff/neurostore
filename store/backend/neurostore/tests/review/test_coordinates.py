"""Coordinate revisions: the reviewer's analyses, the verdicts derived from them, inverses."""

import copy
import itertools
import random

import pytest
from study_schema import keys
from study_schema.models.paper_parse import CoordinateParse, ParsedPoint

from neurostore.ingest.study_schema import _check_verdicts
from neurostore.review.core import coordinates
from neurostore.review.core.bundle import hidden
from neurostore.review.core.ops import ReviewState, apply_batch, inverse
from neurostore.review.errors import ReviewError
from neurostore.study_schema_tools import schema_errors
from neurostore.tests import study_schema_fixtures as fx
from neurostore.tests.review import records

AT = "2026-10-14T12:00:00Z"
PARSE = records.coordinate_parse()
K0, K1, K2 = [analysis["key"] for analysis in PARSE["analyses"]]
P0 = PARSE["analyses"][0]["points"][0]
P1A, P1B = PARSE["analyses"][1]["points"]
UNKNOWN = "analysis#" + "0" * 16
ADDED = {
    "origin": "table",
    "table_id": "t2",
    "cells": fx.cells(2),
    "name": "missed contrast",
    "coordinate_space": "MNI",
    "role": "result",
    "points": [fx.point((12, -40, 6))],
}
_ids = itertools.count()


RECORD = records.linked_analyses()


def state():
    return ReviewState(record=records.linked_analyses(),
                       coordinate_parse=records.coordinate_parse())


def coordinate(key, action, **fields):
    target = {"kind": "coordinate_analysis", "analysis_key": key}
    return {"client_op_id": f"coord-{next(_ids):06d}", "type": "coordinate", "target": target,
            "action": action, **fields}


def edit(key, points, **fields):
    return coordinate(key, "edit_points", payload={"points": points, **fields})


def split(key, *parts):
    return coordinate(key, "split", payload={"parts": list(parts)})


def merge(key, *others):
    return coordinate(key, "merge", payload={"with": list(others)})


def verdict(key, kind, note=None):
    op = {"client_op_id": f"coord-{next(_ids):06d}", "type": "verdict",
          "target": {"kind": "coordinate_analysis", "analysis_key": key}, "verdict": kind}
    if kind == "reject":
        op["reason"] = "not_in_text"
    return {**op, "note": note} if note else op


def add(analysis, **fields):
    return {"client_op_id": f"coord-{next(_ids):06d}", "type": "coordinate",
            "target": {"kind": "coordinate_parse"}, "action": "add",
            "payload": {"analysis": analysis}, **fields}


def apply(review, *ops):
    return apply_batch(review, {"ops": list(ops)}, text=records.TEXT, user_id="u1", at=AT)


def refused(review, *ops):
    with pytest.raises(ReviewError) as raised:
        apply(review, *ops)
    return " ".join(raised.value.problems)


def key_of(name, space, points):
    return keys.analysis_key(name, space, [ParsedPoint.model_validate(p) for p in points])


def exported(*ops, review=None):
    """``(review, revision)``: ``ops`` applied, and the revision export writes after them."""
    review, _ = apply(review or state(), *ops)
    revision = coordinates.judged(PARSE, review.coordinate_revision, review.provenance, ops)
    return review, revision


def checked(revision):
    """``revision``, once it validates and passes the ingester's verdict check."""
    assert schema_errors("coordinate-parse", revision) == []
    _check_verdicts(revision, PARSE)
    return revision


def verdicts(revision, *fields):
    return [
        (v["key"], v["verdict"], v.get("replaced_by"), *(v[f] for f in fields))
        for v in revision["verdicts"]
    ]


def analysis(revision, key):
    return next(a for a in revision["analyses"] if a["key"] == key)


def states(review):
    return {key: entry["state"] for key, entry in review.provenance.items()}


# the revision is the reviewer's set of analyses (D54)


def test_verdicts_follow_the_parse_order_then_the_added_analyses():
    moved = fx.point((10, 20, 32))
    _, revision = exported(
        edit(K0, [moved]),
        add(ADDED),
        verdict(K2, "reject", note="a seed, not a result"),
    )
    revision = checked(revision)
    edited = key_of("patients > controls", "MNI", [moved])
    added = key_of("missed contrast", "MNI", ADDED["points"])
    assert verdicts(revision, "reason") == [
        (K0, "edit", [edited], "reviewer edit_points"),
        (K1, "accept", None, "not judged by the reviewer"),
        (K2, "omit", None, "a seed, not a result"),
        (added, "add", None, "reviewer add"),
    ]
    assert [a["key"] for a in revision["analyses"]] == [edited, K1, added]
    assert [a.get("derived_from") for a in revision["analyses"]] == [[K0], None, None]


def test_a_point_edit_that_keeps_the_key_keeps_the_verdict():
    sized = {**P1A, "cluster_size": 120, "label": "left insula"}
    after, _ = apply(state(), edit(K1, [sized, P1B]))
    revision = checked(after.coordinate_revision)
    assert verdicts(revision)[1] == (K1, "accept", None)
    assert analysis(revision, K1)["points"] == [sized, P1B]
    assert "derived_from" not in analysis(revision, K1)


def test_a_point_edit_may_rename_the_analysis_and_change_its_space():
    after, _ = apply(state(), edit(K0, [P0], name="patients over controls",
                                   coordinate_space="TAL"))
    revision = checked(after.coordinate_revision)
    key = key_of("patients over controls", "TAL", [P0])
    assert analysis(revision, key)["name"] == "patients over controls"
    assert analysis(revision, key)["coordinate_space"] == "TAL"
    assert verdicts(revision)[0] == (K0, "edit", [key])


def test_a_split_partitions_the_points_into_parts():
    after, _ = apply(state(), split(K1, {"indices": [1]},
                                    {"indices": [0], "name": "controls > patients, left"}))
    revision = checked(after.coordinate_revision)
    first = key_of("controls > patients (part 1)", "MNI", [P1B])
    second = key_of("controls > patients, left", "MNI", [P1A])
    assert [a["key"] for a in revision["analyses"]] == [K0, first, second, K2]
    parts = revision["analyses"][1:3]
    assert [(p["name"], p.get("name_is_printed"), p["points"], p["derived_from"])
            for p in parts] == [
        ("controls > patients (part 1)", False, [P1B], [K1]),
        ("controls > patients, left", None, [P1A], [K1]),
    ]
    assert parts[0]["cells"] == PARSE["analyses"][1]["cells"]
    assert verdicts(revision)[1] == (K1, "split", [first, second])


@pytest.mark.parametrize(
    "parts",
    [
        [{"indices": [0]}, {"indices": [0]}],
        [{"indices": [0]}, {"indices": [1, 2]}],
        [{"indices": [0, 1]}, {"indices": [1]}],
    ],
)
def test_a_split_whose_parts_do_not_partition_the_points_is_refused(parts):
    assert f"the split's parts do not partition the 2 points of {K1!r}" in refused(
        state(), split(K1, *parts)
    )


def test_a_merge_appends_the_others_points_to_the_targets():
    _, revision = exported(merge(K0, K1), verdict(K2, "accept"))
    revision = checked(revision)
    merged = key_of("patients > controls", "MNI", [P0, P1A, P1B])
    assert [a["key"] for a in revision["analyses"]] == [merged, K2]
    assert revision["analyses"][0]["points"] == [P0, P1A, P1B]
    assert revision["analyses"][0]["derived_from"] == [K0, K1]
    assert verdicts(revision) == [
        (K0, "merge", [merged]), (K1, "merge", [merged]), (K2, "accept", None),
    ]


@pytest.mark.parametrize(
    "others, message",
    [
        ([K0], "an analysis cannot be merged with itself"),
        ([UNKNOWN], f"the coordinate revision has no analysis {UNKNOWN!r}"),
    ],
)
def test_a_merge_with_itself_or_an_unknown_analysis_is_refused(others, message):
    assert message in refused(state(), merge(K0, *others))


def test_an_added_analysis_gets_its_key_from_the_server():
    after, stored = apply(state(), add(ADDED, note="table 2 row 3"))
    revision = checked(after.coordinate_revision)
    added = key_of("missed contrast", "MNI", ADDED["points"])
    assert revision["analyses"][-1] == {**ADDED, "key": added}
    assert revision["verdicts"][-1] == {"key": added, "verdict": "add", "reason": "table 2 row 3"}


@pytest.mark.parametrize(
    "op, message",
    [
        (add({**ADDED, "key": K0}), "payload/analysis: "),
        (add({**ADDED, "derived_from": [K0]}), "payload/analysis: "),
        ({**add(ADDED), "target": {"kind": "coordinate_analysis", "analysis_key": K0}},
         "target: Additional properties are not allowed ('analysis_key' was unexpected)"),
    ],
)
def test_an_add_is_refused_with_a_key_an_origin_or_an_analysis_target(op, message):
    assert message in refused(state(), op)


def test_a_target_names_the_analysis_as_the_revision_holds_it():
    after, _ = apply(state(), split(K1, {"indices": [0]}, {"indices": [1]}))
    parts = ", ".join(repr(a["key"]) for a in after.coordinate_revision["analyses"][1:3])
    assert (
        f"the coordinate revision has no analysis {K1!r}; it was replaced by {parts}"
        in refused(after, coordinate(K1, "relabel", role="other"))
    )
    assert f"the coordinate revision has no analysis {UNKNOWN!r}" in refused(
        after, coordinate(UNKNOWN, "relabel", role="other")
    )


def test_verdicts_and_relabels_work_on_split_parts_and_added_analyses():
    after, _ = apply(state(), split(K1, {"indices": [0]}, {"indices": [1]}), add(ADDED))
    _, first, second, _, added = [a["key"] for a in after.coordinate_revision["analyses"]]
    ops = (
        coordinate(first, "relabel", role="localization"),
        verdict(second, "accept", note="both rows checked"),
        coordinate(added, "relabel", role="anchor"),
    )
    after, revision = exported(*ops, review=after)
    revision = checked(revision)
    assert [analysis(revision, k)["role"] for k in (first, second, added)] == [
        "localization", "result", "anchor",
    ]
    assert revision["verdicts"][1] == {
        "key": K1, "verdict": "split", "reason": "both rows checked",
        "replaced_by": [first, second],
    }
    assert revision["verdicts"][-1] == {
        "key": added, "verdict": "add", "reason": "reviewer relabel",
    }
    _, revision = exported(verdict(added, "reject"), review=after)
    assert [v["verdict"] for v in checked(revision)["verdicts"]] == ["accept", "split", "accept"]


def test_omitting_every_part_of_a_split_omits_the_original():
    after, _ = apply(state(), split(K1, {"indices": [0]}, {"indices": [1]}))
    first, second = [a["key"] for a in after.coordinate_revision["analyses"][1:3]]
    _, revision = exported(verdict(first, "reject"), verdict(second, "reject", note="noise"),
                           review=after)
    revision = checked(revision)
    assert revision["verdicts"][1] == {"key": K1, "verdict": "omit", "reason": "noise"}
    assert [a["key"] for a in revision["analyses"]] == [K0, K2]


def test_a_move_is_two_point_edits_each_keeping_its_own_origin():
    after, _ = apply(state(), edit(K1, [P1A]), edit(K0, [P0, P1B]))
    revision = checked(after.coordinate_revision)
    source = key_of("controls > patients", "MNI", [P1A])
    destination = key_of("patients > controls", "MNI", [P0, P1B])
    assert [(a["key"], a.get("derived_from")) for a in revision["analyses"]] == [
        (destination, [K0]), (source, [K1]), (K2, None),
    ]
    assert verdicts(revision)[:2] == [(K0, "edit", [destination]), (K1, "edit", [source])]


def test_chained_edits_collapse_into_one_revision_of_the_original():
    after, _ = apply(state(), split(K1, {"indices": [0]}, {"indices": [1]}))
    first, second = [a["key"] for a in after.coordinate_revision["analyses"][1:3]]
    moved = {**P1A, "coordinates": [-4, 2, 10]}
    after, _ = apply(after, edit(first, [moved]))
    revision = checked(after.coordinate_revision)
    edited = key_of("controls > patients (part 1)", "MNI", [moved])
    assert verdicts(revision)[1] == (K1, "split", [edited, second])
    assert analysis(revision, edited)["derived_from"] == [K1]


def test_a_rejected_original_accepted_again_exports_as_accepted():
    _, revision = exported(verdict(K1, "reject"), verdict(K1, "accept"))
    revision = checked(revision)
    assert [a["key"] for a in revision["analyses"]] == [K0, K1, K2]
    assert verdicts(revision, "reason")[1] == (K1, "accept", None, "reviewer accept")


def test_an_accept_note_on_a_relabelled_original_is_its_reason():
    _, revision = exported(
        coordinate(K0, "relabel", role="other"), verdict(K0, "accept", note="checked twice")
    )
    assert verdicts(checked(revision), "reason")[0] == (K0, "relabel", None, "checked twice")


def test_an_accept_note_on_an_edited_key_is_its_reason():
    review, _ = apply(state(), edit(K0, [fx.point((10, 20, 32))]))
    new = review.coordinate_revision["analyses"][0]["key"]
    _, revision = exported(verdict(new, "accept", note="checked edit"), review=review)
    assert verdicts(checked(revision), "reason")[0] == (K0, "edit", [new], "checked edit")


def test_the_last_accept_note_on_a_split_original_is_its_reason():
    review, _ = apply(state(), split(K1, {"indices": [0]}, {"indices": [1]}))
    first, second = [a["key"] for a in review.coordinate_revision["analyses"][1:3]]
    _, revision = exported(
        verdict(first, "accept", note="row 1 ok"),
        verdict(second, "accept", note="both rows checked"),
        review=review,
    )
    assert verdicts(checked(revision), "reason")[1] == (
        K1, "split", [first, second], "both rows checked",
    )


def test_an_op_leaving_two_analyses_with_one_key_is_refused():
    same = {k: v for k, v in PARSE["analyses"][0].items() if k != "key"}
    assert f"the coordinate revision would hold two analyses with key {K0!r}" in refused(
        state(), add(same)
    )


def test_a_verdict_or_note_may_target_a_derived_analysis():
    after, _ = apply(state(), split(K1, {"indices": [0]}, {"indices": [1]}))
    first = after.coordinate_revision["analyses"][1]["key"]
    target = {"kind": "coordinate_analysis", "analysis_key": first}
    after, stored = apply(
        after,
        {"client_op_id": "verdict-on-part", "type": "verdict", "target": target,
         "verdict": "accept"},
        {"client_op_id": "note-on-part", "type": "note", "target": target, "note": "row 2"},
    )
    assert states(after)[f"coordinate_analysis:{first}"] == "added"
    assert stored[0]["after"] == {"state": "added", "user_id": "u1", "at": AT}


# the record follows the revision (D58)


def table_key(record, local_id):
    item = next(a for a in record["analyses"] if a["local_id"] == local_id)
    return item["source_table_analysis"]["value"]


def test_an_added_result_analysis_gets_an_analysis_entity():
    review, stored = apply(state(), add(ADDED), add({**ADDED, "name": "seed 2", "role": "anchor"}))
    key = key_of("missed contrast", "MNI", ADDED["points"])
    [created] = review.record["analyses"][2:]
    assert created["local_id"].startswith("rv_")
    assert created["name"] == fx.extracted("missed contrast")
    assert created["source_table_analysis"] == fx.extracted(key)
    assert created["definition"] == {"extraction_status": "not_reported",
                                     "evidence": {"status": "not_applicable"}}
    assert [e["entity"]["local_id"] for e in stored[0]["after"]["entities"]] == [
        created["local_id"]
    ]
    assert stored[1]["after"]["entities"] == []


def test_a_key_changing_point_edit_and_a_move_repoint_the_analyses():
    review, _ = apply(state(), edit(K0, [P0], name="patients over controls"))
    assert table_key(review.record, "an_1") == key_of("patients over controls", "MNI", [P0])
    review, _ = apply(state(), edit(K1, [P1A]), edit(K0, [P0, P1B]))
    assert table_key(review.record, "an_1") == key_of("patients > controls", "MNI", [P0, P1B])
    assert table_key(review.record, "an_2") == key_of("controls > patients", "MNI", [P1A])


def test_a_split_keeps_the_entity_on_the_first_part_and_copies_it_for_the_others():
    review, stored = apply(state(), split(K1, {"indices": [1]}, {"indices": [0]}))
    first, second = [a["key"] for a in review.coordinate_revision["analyses"][1:3]]
    an_2, copied = review.record["analyses"][1:3]
    assert an_2["local_id"] == "an_2"
    assert an_2["source_table_analysis"]["value"] == first
    assert copied["local_id"].startswith("rv_")
    assert {**copied, "local_id": "an_2", "source_table_analysis": an_2["source_table_analysis"]
            } == an_2
    assert copied["source_table_analysis"]["value"] == second
    assert review.record["analyses"][0]["mirror_of"] == "an_2"
    assert stored[0]["after"]["links"] == [
        {"entity": "an_1", "path": "mirror_of", "target_entity": "an_2"},
    ]


def test_a_merge_repoints_the_target_and_deletes_the_others_entities():
    review, stored = apply(state(), merge(K0, K1))
    merged = review.coordinate_revision["analyses"][0]["key"]
    assert [a["local_id"] for a in review.record["analyses"]] == ["an_1"]
    assert table_key(review.record, "an_1") == merged
    assert stored[0]["before"]["entities"][-1] == {"index": 1, "entity": RECORD["analyses"][1]}
    assert stored[0]["after"]["references"] == [
        {"entity": "an_1", "path": "mirror_of", "target_entity": "an_2"},
    ]


def test_a_rejected_analysis_keeps_its_entity_which_becomes_hidden():
    review, _ = apply(state(), verdict(K0, "reject"))
    assert review.record == RECORD
    assert hidden(review.record, PARSE, review.coordinate_revision,
                  provenance=review.provenance)["analyses"] == ["an_1"]


def test_a_restore_of_an_entity_whose_local_id_is_taken_is_refused():
    review, stored = apply(state(), merge(K0, K1))
    undo = inverse(stored[0], "undo-0001")
    review, _ = apply(review, {"client_op_id": "retake-an-2", "type": "create_entity",
                               "parent": "study", "list": "analyses",
                               "entity": records.item("Analysis", "an_2")})
    assert "local_id 'an_2' already exists" in refused(review, *undo)


# provenance


def test_created_analyses_are_added_and_the_ones_they_replace_edited():
    moved = fx.point((10, 20, 32))
    after, _ = apply(state(), split(K1, {"indices": [0]}, {"indices": [1]}), edit(K0, [moved]),
                     add(ADDED), verdict(K2, "reject"))
    first, second = [a["key"] for a in after.coordinate_revision["analyses"][1:3]]
    edited = key_of("patients > controls", "MNI", [moved])
    added = key_of("missed contrast", "MNI", ADDED["points"])
    created = [a["local_id"] for a in after.record["analyses"][2:]]
    assert {k: v for k, v in states(after).items() if k.startswith("coordinate")} == {
        f"coordinate_analysis:{K1}": "edited",
        f"coordinate_analysis:{first}": "added",
        f"coordinate_analysis:{second}": "added",
        f"coordinate_analysis:{K0}": "edited",
        f"coordinate_analysis:{edited}": "added",
        f"coordinate_analysis:{added}": "added",
        f"coordinate_analysis:{K2}": "removed",
    }
    assert {k: v for k, v in states(after).items() if not k.startswith("coordinate")} == {
        "slot:an_1:source_table_analysis": "edited",
        "slot:an_2:source_table_analysis": "edited",
        **{f"entity:{local_id}": "added" for local_id in created},
    }


def test_a_merge_marks_each_merged_analysis_edited_and_the_result_added():
    after, _ = apply(state(), merge(K0, K1))
    merged = after.coordinate_revision["analyses"][0]["key"]
    assert states(after) == {
        f"coordinate_analysis:{K0}": "edited",
        f"coordinate_analysis:{K1}": "edited",
        f"coordinate_analysis:{merged}": "added",
        "slot:an_1:source_table_analysis": "edited",
        "entity:an_2": "removed",
    }


# inverses


def test_undoing_an_accept_with_a_note_restores_the_export_it_had_before_the_accept():
    edit_op = edit(K0, [fx.point((10, 20, 32))])
    review, _ = apply(state(), edit_op)
    new = review.coordinate_revision["analyses"][0]["key"]
    accept = verdict(new, "accept", note="checked edit")
    accepted, stored = apply(review, accept)
    undo = inverse(stored[0], "undo-0001")
    undone, _ = apply(accepted, *undo)
    before = coordinates.judged(PARSE, review.coordinate_revision, review.provenance, [edit_op])
    after = coordinates.judged(
        PARSE, undone.coordinate_revision, undone.provenance, [edit_op, accept, *undo]
    )
    assert undone.coordinate_revision == review.coordinate_revision
    assert after == before


def test_undoing_a_reject_with_a_note_restores_the_export_it_had_before_the_reject():
    reject = verdict(K2, "reject", note="duplicate of another")
    review, stored = apply(state(), reject)
    undo = inverse(stored[0], "undo-0001")
    undone, _ = apply(review, *undo)
    before = coordinates.judged(PARSE, None, {}, [])
    after = coordinates.judged(
        PARSE, undone.coordinate_revision, undone.provenance, [reject, *undo]
    )
    assert after == before


@pytest.mark.parametrize("kind", ["accept", "reject"])
def test_undoing_a_verdict_on_a_coordinate_analysis_restores_the_export(kind):
    judgement = verdict(K1, kind)
    review, stored = apply(state(), judgement)
    undo = inverse(stored[0], "undo-0001")
    undone, _ = apply(review, *undo)
    before = coordinates.judged(PARSE, None, {}, [])
    after = coordinates.judged(
        PARSE, undone.coordinate_revision, undone.provenance, [judgement, *undo]
    )
    assert undone.coordinate_revision == state().coordinate_revision
    assert after == before


def _split_part(review):
    return review.coordinate_revision["analyses"][1]["key"]


@pytest.mark.parametrize(
    "setup, change",
    [
        ([], lambda r: coordinate(K1, "relabel", role="other", note="checked")),
        ([], lambda r: edit(K1, [{**P1A, "cluster_size": 9}, P1B])),
        ([], lambda r: edit(K0, [P0, fx.point((2, 2, 2))], name="renamed")),
        ([], lambda r: split(K1, {"indices": [1]}, {"indices": [0], "name": "left"})),
        ([], lambda r: merge(K2, K0, K1)),
        ([], lambda r: add(ADDED)),
        ([split(K1, {"indices": [0]}, {"indices": [1]})],
         lambda r: edit(_split_part(r), [fx.point((5, 5, 5))])),
    ],
)
def test_the_inverse_of_a_coordinate_op_restores_the_revision_before(setup, change):
    review = apply(state(), *setup)[0] if setup else state()
    changed, stored = apply(review, change(review))
    assert changed.coordinate_revision != review.coordinate_revision
    restored, _ = apply(changed, *inverse(stored[0], "undo-0001"))
    assert restored.coordinate_revision == review.coordinate_revision
    assert restored.record == review.record
    held = {a["key"] for a in (restored.coordinate_revision or PARSE)["analyses"]}
    for entry in stored[0]["after"]["analyses"]:
        if entry["analysis"]["key"] not in held:
            assert states(restored)[f"coordinate_analysis:{entry['analysis']['key']}"] == "removed"


def _random_op(rng, review):
    """A coordinate op that applies to ``review``'s revision."""
    analyses = (review.coordinate_revision or review.coordinate_parse)["analyses"]
    point = fx.point(tuple(rng.randint(-60, 60) for _ in range(3)), t=rng.choice([2.5, 3.1]))
    choices = ["add"]
    if analyses:
        choices += ["relabel", "edit_points", "edit_points"]
    if any(len(a.get("points") or ()) > 1 for a in analyses):
        choices += ["split", "split"]
    if len(analyses) > 1:
        choices.append("merge")
    action = rng.choice(choices)
    if action == "add":
        return add({**ADDED, "name": f"added {rng.randint(0, 999)}", "points": [point]})
    if action == "split":
        target = rng.choice([a for a in analyses if len(a["points"]) > 1])
        indices = list(range(len(target["points"])))
        rng.shuffle(indices)
        cut = rng.randint(1, len(indices) - 1)
        return split(target["key"], {"indices": indices[:cut]}, {"indices": indices[cut:]})
    target = rng.choice(analyses)
    if action == "merge":
        others = [a["key"] for a in analyses if a is not target]
        return merge(target["key"], *rng.sample(others, rng.randint(1, len(others))))
    if action == "edit_points":
        points = list(target.get("points") or ())
        if points and rng.random() < 0.4:
            points.pop(rng.randrange(len(points)))
        else:
            points.insert(rng.randint(0, len(points)), point)
        return edit(target["key"], points)
    return coordinate(target["key"], "relabel", role=rng.choice(["result", "other", "anchor"]),
                      note=rng.choice([None, "checked"]))


@pytest.mark.parametrize("seed", range(25))
def test_random_coordinate_ops_undone_in_reverse_order_leave_no_revision(seed):
    rng = random.Random(seed)
    review, stored = state(), []
    while len(stored) < 12:
        try:
            review, applied = apply(review, _random_op(rng, review))
        except ReviewError as error:
            assert "would hold two analyses with key" in str(error.problems), error.problems
            continue
        checked(review.coordinate_revision)
        stored.extend(applied)
    for n, entry in enumerate(reversed(stored)):
        review, _ = apply(review, *inverse(entry, f"undo-{n:04d}"))
    assert review.coordinate_revision is None
    assert review.record == RECORD


def test_an_inverse_whose_analyses_changed_since_is_refused():
    review, stored = apply(state(), split(K1, {"indices": [0]}, {"indices": [1]}))
    review, _ = apply(review, edit(_split_part(review), [fx.point((5, 5, 5))]))
    assert "has changed since" in refused(review, *inverse(stored[0], "undo-0001"))


def _random_judgement(rng, review):
    """A verdict op on an analysis of ``review``'s revision, with or without a note."""
    analyses = (review.coordinate_revision or review.coordinate_parse)["analyses"]
    return verdict(rng.choice(analyses)["key"], rng.choice(["accept", "reject"]),
                   note=rng.choice([None, "checked"]))


@pytest.mark.parametrize("seed", range(25))
def test_random_coordinate_ops_and_verdicts_export_revisions_that_pass_the_checks(seed):
    layouts = pytest.importorskip("study_schema.layouts", reason="needs study_schema[layouts]")
    rng = random.Random(seed)
    review, ops = state(), []
    while len(ops) < 16:
        op = _random_judgement(rng, review) if rng.random() < 0.3 else _random_op(rng, review)
        try:
            review, _ = apply(review, op)
        except ReviewError as error:
            assert "would hold two analyses with key" in str(error.problems), error.problems
            continue
        ops.append(op)
        revision = coordinates.judged(PARSE, review.coordinate_revision, review.provenance, ops)
        if revision is not None:
            checked(revision)
            assert layouts.check_revision(
                CoordinateParse.model_validate(PARSE), CoordinateParse.model_validate(revision)
            ) == []


def test_a_split_with_a_part_rejected_then_merged_exports_a_checked_revision():
    layouts = pytest.importorskip("study_schema.layouts", reason="needs study_schema[layouts]")
    cut = split(K1, {"indices": [0]}, {"indices": [1]})
    review, _ = apply(state(), cut)
    first, second = [a["key"] for a in review.coordinate_revision["analyses"][1:3]]
    _, revision = exported(cut, verdict(first, "reject", note="noise"), merge(second, K0))
    revision = checked(revision)
    assert [v["verdict"] for v in revision["verdicts"]] == ["merge", "merge", "accept"]
    assert layouts.check_revision(
        CoordinateParse.model_validate(PARSE), CoordinateParse.model_validate(revision)
    ) == []


def test_a_restore_with_a_key_its_content_does_not_give_is_refused():
    review, stored = apply(state(), edit(K2, [fx.point((1, 1, 1))]))
    undo = copy.deepcopy(inverse(stored[0], "undo-0001"))
    undo[0]["payload"]["insert"][0]["analysis"]["name"] = "not the seed"
    assert "is not the key its name, space and points give" in refused(review, *undo)


# the blockers and majors the W13 tests review found


def _renamed(review):
    return {"client_op_id": "rename-target", "type": "set_value",
            "target": {"kind": "slot", "entity": "an_1", "path": "name"},
            "value": {"extraction_status": "extracted", "value": "renamed",
                      "value_source": "reported"}}


def test_undoing_a_merge_is_refused_once_its_target_entity_has_changed():
    review, stored = apply(state(), merge(K0, K1))
    review, _ = apply(review, _renamed(review))
    assert "entity 'an_1' has changed since" in refused(review, *inverse(stored[0], "undo-0001"))


def test_a_restore_inserting_a_derived_from_that_is_not_an_original_is_refused():
    review, stored = apply(state(), edit(K2, [fx.point((1, 1, 1))]))
    undo = copy.deepcopy(inverse(stored[0], "undo-0001"))
    undo[0]["payload"]["insert"][0]["analysis"]["derived_from"] = [UNKNOWN]
    assert f"derived_from names {UNKNOWN!r}, which is not an analysis" in refused(review, *undo)


def test_rejecting_an_analysis_again_only_updates_its_reason():
    review, revision = exported(verdict(K2, "reject", note="first"))
    _, again = exported(verdict(K2, "reject", note="second"), review=review)
    assert again["analyses"] == revision["analyses"]
    assert verdicts(again, "reason")[2] == (K2, "omit", None, "second")


def test_undoing_a_split_is_refused_once_a_part_changed_under_its_key():
    review, stored = apply(state(), split(K1, {"indices": [0]}, {"indices": [1]}))
    part = _split_part(review)
    review, _ = apply(review, coordinate(part, "relabel", role="other"))
    assert f"analysis {part!r} has changed since" in refused(
        review, *inverse(stored[0], "undo-0001")
    )


@pytest.mark.parametrize("parts", [
    [{"indices": [0, 1]}],
    [{"indices": []}, {"indices": [0, 1]}],
])
def test_a_split_needs_at_least_two_non_empty_parts(parts):
    with pytest.raises(ReviewError):
        apply(state(), split(K1, *parts))


def test_a_merge_names_each_other_analysis_once():
    assert "has non-unique elements" in refused(state(), merge(K2, K0, K0))


def test_a_point_that_does_not_validate_is_refused_with_its_path():
    bad = {"coordinates": [1, 2], "space": None, "values": [{"kind": "t", "value": 3.0}]}
    assert "payload/points/0/coordinates: [1, 2] is too short" in refused(state(), edit(K0, [bad]))


def test_an_added_analysis_without_a_role_is_refused():
    analysis = {k: v for k, v in ADDED.items() if k != "role"}
    assert "'role' is a required property" in refused(state(), add(analysis))


def test_a_restore_of_a_replaced_original_is_refused_when_the_result_holds_its_key_twice():
    review, stored = apply(state(), edit(K0, [fx.point((1, 1, 1))]))
    original = copy.deepcopy(PARSE["analyses"][0])
    original.pop("key")
    review, _ = apply(review, add(original))
    assert "would hold two analyses with key" in refused(review, *inverse(stored[0], "undo-0001"))


def test_an_added_analysis_with_an_originals_key_is_edited_not_added():
    review, _ = apply(state(), edit(K0, [fx.point((1, 1, 1))]), verdict(K0, "reject"))
    original = copy.deepcopy(PARSE["analyses"][0])
    original.pop("key")
    review, _ = apply(review, add(original))
    assert states(review)[f"coordinate_analysis:{K0}"] == "edited"


def test_accepting_an_added_part_keeps_its_added_provenance():
    review, _ = apply(state(), split(K1, {"indices": [0]}, {"indices": [1]}))
    part = _split_part(review)
    review, _ = apply(review, verdict(part, "accept"))
    assert states(review)[f"coordinate_analysis:{part}"] == "added"


def test_a_merge_unions_the_cells_and_text_spans_of_the_merged_analyses():
    parse = copy.deepcopy(PARSE)
    parse["analyses"][0]["text_spans"] = [{"start_char": 0, "end_char": 4}]
    parse["analyses"][1]["text_spans"] = [{"start_char": 0, "end_char": 4},
                                          {"start_char": 9, "end_char": 12}]
    review = ReviewState(record=records.linked_analyses(), coordinate_parse=parse)
    after, _ = apply(review, merge(K0, K1))
    merged = after.coordinate_revision["analyses"][0]
    assert merged["cells"] == fx.cells(1, 2, 3)
    assert merged["text_spans"] == [{"start_char": 0, "end_char": 4},
                                    {"start_char": 9, "end_char": 12}]


def test_a_merge_derives_from_the_originals_in_parse_order():
    after, _ = apply(state(), merge(K2, K0, K1))
    [merged] = after.coordinate_revision["analyses"]
    assert merged["derived_from"] == [K0, K1, K2]


def test_renaming_an_unnamed_part_drops_its_name_is_printed_flag():
    review, _ = apply(state(), split(K1, {"indices": [0]}, {"indices": [1]}))
    assert analysis(review.coordinate_revision, _split_part(review))["name_is_printed"] is False
    review, _ = apply(review, edit(_split_part(review), [P1A], name="renamed part"))
    assert "name_is_printed" not in review.coordinate_revision["analyses"][1]


def test_a_split_copies_the_entity_right_after_the_original():
    review, _ = apply(state(), edit(K0, [P0, fx.point((2, 2, 2))]))
    original = review.coordinate_revision["analyses"][0]["key"]
    review, _ = apply(review, split(original, {"indices": [0]}, {"indices": [1]}))
    ids = [item["local_id"] for item in review.record["analyses"]]
    assert len(ids) == 3 and ids[0] == "an_1" and ids[2] == "an_2"


def test_a_revision_header_names_the_producer_and_its_inputs():
    after, _ = apply(state(), coordinate(K2, "relabel", role="result"))
    header = after.coordinate_revision["header"]
    assert header["producer"] == {"name": "neurostore-review", "version": "1"}
    assert header["inputs"] == [
        {"artifact_kind": "parsed_paper", "fingerprint": PARSE["text_sha256"]},
        {"artifact_kind": "coordinate_parse", "fingerprint": PARSE["parse_id"]},
    ]


# one way to judge (W23)


@pytest.mark.parametrize("action", ["accept", "omit", "reject"])
def test_the_coordinate_op_refuses_accept_and_reject_and_names_the_verdict_op(action):
    assert (
        "accept and reject a coordinate analysis with a verdict op" in refused(
            state(), coordinate(K0, action)
        )
    )


def test_a_key_changing_point_edit_is_an_edit_verdict():
    moved = fx.point((10, 20, 32))
    after, _ = apply(state(), edit(K0, [moved]))
    revision = checked(after.coordinate_revision)
    assert verdicts(revision)[0] == (K0, "edit", [key_of("patients > controls", "MNI", [moved])])


def test_the_revisions_the_core_writes_pass_study_schemas_revision_check():
    layouts = pytest.importorskip("study_schema.layouts", reason="needs study_schema[layouts]")
    moved = fx.point((10, 20, 32))
    revisions = [
        exported(edit(K0, [moved]))[1],
        exported(edit(K0, [P0], name="patients over controls"), verdict(K2, "reject"))[1],
        exported(split(K1, {"indices": [0]}, {"indices": [1]}), add(ADDED))[1],
        exported(merge(K0, K1), verdict(K2, "accept"))[1],
    ]
    original = CoordinateParse.model_validate(PARSE)
    for revision in revisions:
        assert layouts.check_revision(original, CoordinateParse.model_validate(revision)) == []
    assert [v["verdict"] for v in revisions[1]["verdicts"]] == ["edit", "accept", "omit"]


def test_an_original_takes_the_reason_of_the_last_verdict_on_its_parts():
    after, _ = apply(state(), split(K1, {"indices": [0]}, {"indices": [1]}))
    first, second = [a["key"] for a in after.coordinate_revision["analyses"][1:3]]
    _, revision = exported(verdict(first, "reject", note="a"), verdict(second, "reject", note="b"),
                           verdict(first, "reject", note="c"), review=after)
    assert checked(revision)["verdicts"][1] == {"key": K1, "verdict": "omit", "reason": "c"}
