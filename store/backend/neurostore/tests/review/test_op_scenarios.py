"""The op endpoints' scenarios on the golden paper, as the front end's golden file.

Each scenario drives the HTTP app, so the real post_ops and set_state answer. The request and
response of every step, with ids, timestamps and request ids masked, is the golden file the
front end's test server must reproduce. Regenerate it with:
UPDATE_GOLDEN=1 python -m pytest neurostore/tests/review/test_op_scenarios.py
"""

import hashlib
import json
import os

import pytest
from study_schema import keys
from study_schema.models.paper_parse import ParsedPoint

from neurostore.ingest.study_schema import _check_verdicts
from neurostore.study_schema_tools import schema_errors
from neurostore.tests.review import golden, records
from neurostore.tests.review.layouts import OTHER, REVIEWER
from neurostore.tests.review.test_api import add_source

pytestmark = pytest.mark.anyio

GOLDEN = golden.ROOT / "review-frontend/src/test/golden/op-scenarios.json"
REGENERATE = (
    "regenerate it with: cd store/backend && UPDATE_GOLDEN=1 python -m "
    "pytest neurostore/tests/review/test_op_scenarios.py"
)
MOMENT_KEYS = {"created_at", "updated_at", "last_edit_at", "at", "timestamp"}

ACCEPT = {
    "client_op_id": "scenario-accept-a",
    "type": "verdict",
    "target": {"kind": "entity", "entity": "grp_a"},
    "verdict": "accept",
}
NAME = {
    "client_op_id": "scenario-name-b",
    "type": "set_value",
    "target": {"kind": "slot", "entity": "grp_b", "path": "name"},
    "value": {"extraction_status": "extracted", "value": "healthy controls",
              "value_source": "reported"},
}
UNKNOWN_ENTITY = {
    "client_op_id": "scenario-refused-entity",
    "type": "verdict",
    "target": {"kind": "entity", "entity": "grp_nope"},
    "verdict": "accept",
}
SPAN_OUTSIDE_PAPER = {
    "client_op_id": "scenario-refused-span",
    "type": "set_evidence",
    "target": {"kind": "slot", "entity": "grp_a", "path": "age_mean"},
    "evidence": {"status": "present", "sets": [
        {"spans": [{"start_char": 0, "end_char": 100000}]}
    ]},
}
AGE_NOT_A_NUMBER = {
    "client_op_id": "scenario-refused-age",
    "type": "set_value",
    "target": {"kind": "slot", "entity": "grp_a", "path": "age_mean"},
    "value": {"extraction_status": "extracted", "value": "old", "value_source": "reported"},
}
LINK_REGION = {
    "client_op_id": "scenario-link-region",
    "type": "link",
    "target": {"kind": "relationship", "entity": "an_1", "path": "regions",
               "target_entity": "reg_1"},
}
VERDICT_ON_ANALYSIS = {
    "client_op_id": "scenario-coordinate-a",
    "type": "verdict",
    "target": {"kind": "coordinate_analysis",
               "analysis_key": records.coordinate_parse()["analyses"][0]["key"]},
    "verdict": "accept",
}
COORDINATE_ACCEPT = {
    "client_op_id": "scenario-refused-coordinate-accept",
    "type": "coordinate",
    "target": VERDICT_ON_ANALYSIS["target"],
    "action": "accept",
}
PARSE = records.coordinate_parse()
K0, K1, _ = [analysis["key"] for analysis in PARSE["analyses"]]
P0 = PARSE["analyses"][0]["points"][0]
P1A, P1B = PARSE["analyses"][1]["points"]


def coordinate(client_op_id, key, action, **fields):
    target = (
        {"kind": "coordinate_parse"}
        if key is None
        else {"kind": "coordinate_analysis", "analysis_key": key}
    )
    return {"client_op_id": client_op_id, "type": "coordinate", "target": target,
            "action": action, **fields}


def key_of(name, points):
    return keys.analysis_key(name, "MNI", [ParsedPoint.model_validate(p) for p in points])


SPLIT = coordinate("scenario-split-a", K1, "split", payload={"parts": [
    {"indices": [0]}, {"indices": [1], "name": "controls > patients, right"},
]})
EDIT_PART = coordinate("scenario-edit-part-a", key_of("controls > patients (part 1)", [P1A]),
                       "edit_points", payload={"points": [{**P1A, "cluster_size": 48}]})
MOVE = [
    coordinate("scenario-move-from", K1, "edit_points", payload={"points": [P1A]}),
    coordinate("scenario-move-to", K0, "edit_points", payload={"points": [P0, P1B]}),
]
MERGE = coordinate("scenario-merge-a", K0, "merge", payload={"with": [K1]})
REJECT_MERGED = {
    "client_op_id": "scenario-reject-merged",
    "type": "verdict",
    "target": {"kind": "coordinate_analysis",
               "analysis_key": key_of("patients > controls", [P0, P1A, P1B])},
    "verdict": "reject",
    "reason": "other",
    "note": "not a contrast of this study",
}
ADDED = {
    "origin": "table",
    "table_id": "t1",
    "cells": [{"row": 4, "column_group": 0}],
    "name": "patients > controls, right",
    "coordinate_space": "MNI",
    "role": "result",
    "points": [{"coordinates": [40, 20, 30], "values": [{"kind": "t", "value": 3.9}]}],
}
ADD = coordinate("scenario-add-a", None, "add", payload={"analysis": ADDED})
RELABEL_ADDED = coordinate(
    "scenario-relabel-added", key_of("patients > controls, right", ADDED["points"]),
    "relabel", role="localization",
)
SPLIT_NOT_A_PARTITION = coordinate("scenario-refused-split", K1, "split", payload={"parts": [
    {"indices": [0]}, {"indices": [0]},
]})


def minted(client_op_id):
    """The local_id the front end mints for a create_entity, and the server for one without."""
    return "rv_" + hashlib.sha256(client_op_id.encode("utf-8")).hexdigest()[:12]


CREATE_WITH_LOCAL_ID = {
    "client_op_id": "scenario-create-entity-a",
    "type": "create_entity",
    "parent": "study",
    "list": "groups",
    "entity": records.item("Group", minted("scenario-create-entity-a")),
}
SET_ON_CREATED = {
    "client_op_id": "scenario-set-created-a",
    "type": "set_value",
    "target": {"kind": "slot", "entity": minted("scenario-create-entity-a"), "path": "name"},
    "value": {"extraction_status": "extracted", "value": "healthy siblings",
              "value_source": "reported"},
}
CREATE_MINTED = {
    "client_op_id": "scenario-create-entity-b",
    "type": "create_entity",
    "parent": "study",
    "list": "groups",
    "entity": {k: v for k, v in records.item("Group", "x").items() if k != "local_id"},
}
CREATE_TERM = {
    "client_op_id": "scenario-create-term-a",
    "type": "create_entity",
    "parent": "mdl_1",
    "list": "terms",
    "entity": records.item("ModelTerm", minted("scenario-create-term-a")),
}
LINK_ASSESSMENT = {
    "client_op_id": "scenario-link-assessment",
    "type": "link",
    "target": {"kind": "relationship", "entity": "an_1", "path": "assessments",
               "target_entity": "asm_1"},
}
DELETE_GROUP = {
    "client_op_id": "scenario-delete-group-a",
    "type": "delete_entity",
    "target": {"kind": "entity", "entity": "grp_a"},
}
MANY_OPS = [{"client_op_id": f"scenario-many-{n}"} for n in range(501)]
STRANGER = "newuser-id"
SOURCES = "/api/review/sources/"
BUNDLE = "/api/review/sources/{source}/bundle"
SOURCE_REVIEW = "/api/review/sources/{source}/review"
OPS = "/api/review/reviews/{review}/ops"
STATE = "/api/review/reviews/{review}"
START = (REVIEWER, "put", SOURCE_REVIEW, None, 201)


def batch(expected_last_seq, *ops):
    return {"expected_last_seq": expected_last_seq, "ops": list(ops)}


#: Each scenario's steps: (who, method, path template, body, expected status).
SCENARIOS = {
    "sources, paged": [
        START,
        (REVIEWER, "get", f"{SOURCES}?page=1&page_size=1", None, 200),
        (REVIEWER, "get", f"{SOURCES}?page=2&page_size=1", None, 200),
    ],
    "bundle without a review, then with one": [
        (REVIEWER, "get", BUNDLE, None, 200),
        START,
        (REVIEWER, "get", BUNDLE, None, 200),
    ],
    "start a review twice": [
        START,
        (REVIEWER, "put", SOURCE_REVIEW, None, 200),
    ],
    "fresh batch": [
        START,
        (REVIEWER, "post", OPS, batch(0, ACCEPT, NAME), 200),
    ],
    "full replay": [
        START,
        (REVIEWER, "post", OPS, batch(0, ACCEPT, NAME), 200),
        (REVIEWER, "post", OPS, batch(0, ACCEPT, NAME), 200),
    ],
    "partial replay": [
        START,
        (REVIEWER, "post", OPS, batch(0, ACCEPT), 200),
        (REVIEWER, "post", OPS, batch(1, ACCEPT, NAME), 409),
    ],
    "stale expected_last_seq behind": [
        START,
        (REVIEWER, "post", OPS, batch(0, ACCEPT), 200),
        (REVIEWER, "post", OPS, batch(0, NAME), 409),
    ],
    "stale expected_last_seq ahead": [
        START,
        (REVIEWER, "post", OPS, batch(5, NAME), 409),
    ],
    "link reaches a hidden entity": [
        START,
        (REVIEWER, "get", BUNDLE, None, 200),
        (REVIEWER, "post", OPS, batch(0, LINK_REGION), 200),
    ],
    "the bundle of the linked-analyses record": [
        START,
        (REVIEWER, "get", BUNDLE, None, 200),
    ],
    "verdict accept of a coordinate analysis": [
        START,
        (REVIEWER, "post", OPS, batch(0, VERDICT_ON_ANALYSIS), 200),
    ],
    "coordinate accept refused, the verdict op judges": [
        START,
        (REVIEWER, "post", OPS, batch(0, COORDINATE_ACCEPT), 422),
    ],
    "coordinate split": [
        START,
        (REVIEWER, "post", OPS, batch(0, SPLIT), 200),
    ],
    "coordinate split, then a point edit of one part": [
        START,
        (REVIEWER, "post", OPS, batch(0, SPLIT), 200),
        (REVIEWER, "post", OPS, batch(1, EDIT_PART), 200),
    ],
    "coordinate move, one batch of two point edits": [
        START,
        (REVIEWER, "post", OPS, batch(0, *MOVE), 200),
    ],
    "coordinate merge": [
        START,
        (REVIEWER, "post", OPS, batch(0, MERGE), 200),
    ],
    "coordinate merge, then a reject of the merged analysis": [
        START,
        (REVIEWER, "post", OPS, batch(0, MERGE), 200),
        (REVIEWER, "post", OPS, batch(1, REJECT_MERGED), 200),
    ],
    "coordinate add": [
        START,
        (REVIEWER, "post", OPS, batch(0, ADD), 200),
    ],
    "coordinate add, then a relabel of the added analysis": [
        START,
        (REVIEWER, "post", OPS, batch(0, ADD), 200),
        (REVIEWER, "post", OPS, batch(1, RELABEL_ADDED), 200),
    ],
    "coordinate split refused, its parts not a partition": [
        START,
        (REVIEWER, "post", OPS, batch(0, SPLIT_NOT_A_PARTITION), 422),
    ],
    "create an entity with a client local id, then set a value on it": [
        START,
        (REVIEWER, "post", OPS, batch(0, CREATE_WITH_LOCAL_ID), 200),
        (REVIEWER, "post", OPS, batch(1, SET_ON_CREATED), 200),
    ],
    "create an entity the server mints an id for": [
        START,
        (REVIEWER, "post", OPS, batch(0, CREATE_MINTED), 200),
    ],
    "create a term under a model estimation with a client local id": [
        START,
        (REVIEWER, "post", OPS, batch(0, CREATE_TERM), 200),
    ],
    "link an analysis to an assessment of the record": [
        START,
        (REVIEWER, "post", OPS, batch(0, LINK_ASSESSMENT), 200),
    ],
    "delete a group that an analysis still references": [
        START,
        (REVIEWER, "post", OPS, batch(0, DELETE_GROUP), 200),
    ],
    "batch on a submitted review": [
        START,
        (REVIEWER, "patch", STATE, {"state": "submitted"}, 200),
        (REVIEWER, "post", OPS, batch(0, ACCEPT), 409),
    ],
    "refused batch with two failing ops": [
        START,
        (REVIEWER, "post", OPS, batch(0, UNKNOWN_ENTITY, SPAN_OUTSIDE_PAPER), 422),
    ],
    "refused batch, op 1 fails after op 0 would apply": [
        START,
        (REVIEWER, "post", OPS, batch(0, ACCEPT, UNKNOWN_ENTITY), 422),
        (REVIEWER, "get", STATE, None, 200),
    ],
    "refused batch, op 1 leaves an invalid document": [
        START,
        (REVIEWER, "post", OPS, batch(0, ACCEPT, AGE_NOT_A_NUMBER), 422),
    ],
    "batch the spec refuses": [
        START,
        (REVIEWER, "post", OPS, batch(0), 400),
        (REVIEWER, "post", OPS, batch(0, *MANY_OPS), 400),
        (REVIEWER, "post", OPS, {"expected_last_seq": 0, "ops": ["not an op"]}, 400),
    ],
    "submit, reopen and submit again": [
        START,
        (REVIEWER, "patch", STATE, {"state": "submitted"}, 200),
        (REVIEWER, "patch", STATE, {"state": "in_progress"}, 200),
        (REVIEWER, "patch", STATE, {"state": "submitted"}, 200),
        (REVIEWER, "patch", STATE, {"state": "submitted"}, 409),
    ],
    "reference by a non-admin": [
        START,
        (REVIEWER, "patch", STATE, {"state": "reference"}, 403),
    ],
    "batch by a non-owner": [
        START,
        (OTHER, "post", OPS, batch(0, ACCEPT), 403),
    ],
    "unknown source or review": [
        (REVIEWER, "get", "/api/review/sources/nope/bundle", None, 404),
        (REVIEWER, "post", "/api/review/reviews/nope/ops", batch(0, ACCEPT), 404),
        (REVIEWER, "patch", "/api/review/reviews/nope", {"state": "submitted"}, 404),
    ],
    "no token": [
        START,
        (None, "get", BUNDLE, None, 401),
        (None, "post", OPS, batch(0, ACCEPT), 401),
    ],
    "not an admin-reviewer": [
        START,
        (STRANGER, "get", BUNDLE, None, 403),
        (STRANGER, "post", OPS, batch(0, ACCEPT), 403),
    ],
}


#: Scenarios played on records.linked_analyses(), where an_1 and an_2 read the parse's first
#: two analyses; the paged list plays on records.golden(), the record of the front end's test
#: server; the others play on records.hidden_reach().
COORDINATE_RECORD = {name for name in SCENARIOS if name.startswith("coordinate")} | {
    "the bundle of the linked-analyses record"
}


def _mask(value, ids):
    if isinstance(value, dict):
        return {key: _mask_field(key, item, ids) for key, item in value.items()}
    if isinstance(value, list):
        return [_mask(item, ids) for item in value]
    if isinstance(value, str):
        for real, placeholder in ids.items():
            value = value.replace(real, placeholder)
    return value


def _mask_field(key, value, ids):
    if key in MOMENT_KEYS and value is not None:
        return "<iso>"
    if key == "request_id":
        return "<request_id>"
    return _mask(value, ids)


async def _play(clients, session, steps, name=None):
    if name in COORDINATE_RECORD:
        record = records.linked_analyses()
    elif name == "sources, paged":
        record = records.golden()
    else:
        record = records.hidden_reach()
    source = add_source(session, record=record)
    other = add_source(session, label="Another paper")
    ids = {
        source.id: "<source_id>",
        source.fulltext.base_study_id: "<base_study_id>",
        other.id: "<other_source_id>",
        other.fulltext.base_study_id: "<other_base_study_id>",
    }
    review = None
    recorded = []
    for who, method, template, body, status in steps:
        path = template.format(source=source.id, review=review)
        response = await getattr(clients[who], method)(path, data=body)
        assert response.status_code == status, (path, response.json())
        if template == SOURCE_REVIEW and method == "put":
            review = response.json()["id"]
            ids[review] = "<review_id>"
        recorded.append(_step(method, path, body, response, ids))
    return recorded


def _step(method, path, body, response, ids):
    return {
        "request": {"method": method.upper(), "path": _mask(path, ids), "body": body},
        "response": {"status": response.status_code, "body": _mask(response.json(), ids)},
    }


async def test_the_op_scenarios_match_the_golden_file(clients, session):
    document = [
        {"name": name, "steps": await _play(clients, session, steps, name)}
        for name, steps in SCENARIOS.items()
    ]
    rendered = json.dumps(document, indent=2, ensure_ascii=False) + "\n"
    if os.environ.get("UPDATE_GOLDEN") == "1":
        GOLDEN.write_text(rendered, encoding="utf-8")
    assert GOLDEN.exists(), f"{GOLDEN} is missing; {REGENERATE}"
    assert GOLDEN.read_text("utf-8") == rendered, f"op-scenarios.json is stale; {REGENERATE}"


async def test_a_link_that_reaches_a_hidden_entity_changes_the_hidden_set(clients, session):
    steps = await _play(clients, session, SCENARIOS["link reaches a hidden entity"])
    bundle_hidden = steps[1]["response"]["body"]["hidden"]
    applied_hidden = steps[2]["response"]["body"]["hidden"]
    assert "reg_1" in bundle_hidden["entities"]
    assert applied_hidden != bundle_hidden
    assert "reg_1" not in applied_hidden["entities"]


COORDINATE_SCENARIOS = [
    name for name, steps in SCENARIOS.items()
    if name.startswith("coordinate") and steps[-1][-1] == 200
]


@pytest.mark.parametrize("name", COORDINATE_SCENARIOS)
async def test_a_coordinate_op_returns_a_revision(clients, session, name):
    steps = await _play(clients, session, SCENARIOS[name], name)
    revision = steps[-1]["response"]["body"]["coordinate_revision"]
    assert revision is not None
    assert schema_errors("coordinate-parse", revision) == []
    _check_verdicts(revision, PARSE)


async def test_each_step_of_a_coordinate_chain_targets_a_key_the_step_before_returned(
    clients, session
):
    for name in COORDINATE_SCENARIOS:
        steps = await _play(clients, session, SCENARIOS[name], name)
        for before, after in zip(steps[1:], steps[2:]):
            revision = before["response"]["body"]["coordinate_revision"]
            held = [a["key"] for a in revision["analyses"]]
            targets = [op["target"]["analysis_key"] for op in after["request"]["body"]["ops"]]
            assert set(targets) <= set(held), name


def _result(steps, n=-1):
    return steps[n]["response"]["body"]


def _analyses(result):
    return {r["local_id"] for r in result["entities"] if r["entity_class"] == "Analysis"}


async def test_the_record_follows_each_coordinate_scenario(clients, session):
    played = {
        name: await _play(clients, session, SCENARIOS[name], name)
        for name in COORDINATE_RECORD if SCENARIOS[name][-1][-1] == 200
    }
    split = _result(played["coordinate split"])
    assert len(_analyses(split)) == 3
    assert split["ops"][0]["after"]["links"] == [
        {"entity": "an_1", "path": "mirror_of", "target_entity": "an_2"},
    ]
    merge = _result(played["coordinate merge"])
    assert _analyses(merge) == {"an_1"}
    assert merge["ops"][0]["after"]["references"] == [
        {"entity": "an_1", "path": "mirror_of", "target_entity": "an_2"},
    ]
    assert _result(played["coordinate merge, then a reject of the merged analysis"])["hidden"][
        "analyses"
    ] == ["an_1"]
    added = _result(played["coordinate add"])
    [new] = _analyses(added) - {"an_1", "an_2"}
    assert new == minted("scenario-add-a")
    move = _result(played["coordinate move, one batch of two point edits"])
    assert {
        a["local_id"]: a["source_table_analysis"]["value"] for a in move["record"]["analyses"]
    } == {
        "an_1": key_of("patients > controls", [P0, P1B]),
        "an_2": key_of("controls > patients", [P1A]),
    }


async def test_a_created_entity_without_a_local_id_gets_the_minted_id(clients, session):
    steps = await _play(clients, session, SCENARIOS["create an entity the server mints an id for"])
    created = steps[-1]["response"]["body"]["ops"][0]["after"]["entity"]["local_id"]
    assert created == minted("scenario-create-entity-b")


async def test_a_term_created_under_a_model_estimation_gets_the_client_local_id(clients, session):
    steps = await _play(
        clients, session,
        SCENARIOS["create a term under a model estimation with a client local id"],
    )
    created = steps[-1]["response"]["body"]["ops"][0]["after"]
    assert created["parent"] == "mdl_1"
    assert created["entity"]["local_id"] == minted("scenario-create-term-a")


async def test_a_deleted_group_lists_the_references_it_leaves_dangling(clients, session):
    steps = await _play(
        clients, session, SCENARIOS["delete a group that an analysis still references"]
    )
    stored = steps[-1]["response"]["body"]["ops"][0]
    assert stored["after"]["references"] == [
        {"entity": "an_1", "path": "groups[group=grp_a].group", "target_entity": "grp_a"},
    ]
