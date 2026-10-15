"""The op endpoints' scenarios on the golden paper, as the front end's golden file.

Each scenario drives the HTTP app, so the real post_ops and set_state answer. The request and
response of every step, with ids, timestamps and request ids masked, is the golden file the
front end's test server must reproduce. Regenerate it with:
UPDATE_GOLDEN=1 python -m pytest neurostore/tests/review/test_op_scenarios.py
"""

import json
import os

import pytest

from neurostore.tests.review import golden
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
OPS = "/api/review/reviews/{review}/ops"
STATE = "/api/review/reviews/{review}"


def batch(expected_last_seq, *ops):
    return {"expected_last_seq": expected_last_seq, "ops": list(ops)}


#: Each scenario's steps: (who, method, path template, body, expected status).
SCENARIOS = {
    "fresh batch": [
        (REVIEWER, "post", OPS, batch(0, ACCEPT, NAME), 200),
    ],
    "full replay": [
        (REVIEWER, "post", OPS, batch(0, ACCEPT, NAME), 200),
        (REVIEWER, "post", OPS, batch(0, ACCEPT, NAME), 200),
    ],
    "partial replay": [
        (REVIEWER, "post", OPS, batch(0, ACCEPT), 200),
        (REVIEWER, "post", OPS, batch(1, ACCEPT, NAME), 409),
    ],
    "stale expected_last_seq behind": [
        (REVIEWER, "post", OPS, batch(0, ACCEPT), 200),
        (REVIEWER, "post", OPS, batch(0, NAME), 409),
    ],
    "stale expected_last_seq ahead": [
        (REVIEWER, "post", OPS, batch(5, NAME), 409),
    ],
    "batch on a submitted review": [
        (REVIEWER, "patch", STATE, {"state": "submitted"}, 200),
        (REVIEWER, "post", OPS, batch(0, ACCEPT), 409),
    ],
    "refused batch with two failing ops": [
        (REVIEWER, "post", OPS, batch(0, UNKNOWN_ENTITY, SPAN_OUTSIDE_PAPER), 422),
    ],
    "submit, reopen and submit again": [
        (REVIEWER, "patch", STATE, {"state": "submitted"}, 200),
        (REVIEWER, "patch", STATE, {"state": "in_progress"}, 200),
        (REVIEWER, "patch", STATE, {"state": "submitted"}, 200),
        (REVIEWER, "patch", STATE, {"state": "submitted"}, 409),
    ],
    "reference by a non-admin": [
        (REVIEWER, "patch", STATE, {"state": "reference"}, 403),
    ],
    "batch by a non-owner": [
        (OTHER, "post", OPS, batch(0, ACCEPT), 403),
    ],
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


async def _play(clients, session, steps):
    source = add_source(session)
    started = await clients[REVIEWER].put(f"/api/review/sources/{source.id}/review")
    assert started.status_code in (200, 201), started.json()
    ids = {source.id: "<source_id>", started.json()["id"]: "<review_id>"}
    recorded = [_step("put", f"/api/review/sources/{source.id}/review", None, started, ids)]
    for who, method, template, body, status in steps:
        path = template.format(review=started.json()["id"])
        response = await getattr(clients[who], method)(path, data=body)
        assert response.status_code == status, (path, response.json())
        recorded.append(_step(method, path, body, response, ids))
    return recorded


def _step(method, path, body, response, ids):
    return {
        "request": {"method": method.upper(), "path": _mask(path, ids), "body": body},
        "response": {"status": response.status_code, "body": _mask(response.json(), ids)},
    }


async def test_the_op_scenarios_match_the_golden_file(clients, session):
    document = [
        {"name": name, "steps": await _play(clients, session, steps)}
        for name, steps in SCENARIOS.items()
    ]
    rendered = json.dumps(document, indent=2, ensure_ascii=False) + "\n"
    if os.environ.get("UPDATE_GOLDEN") == "1":
        GOLDEN.write_text(rendered, encoding="utf-8")
    assert GOLDEN.exists(), f"{GOLDEN} is missing; {REGENERATE}"
    assert GOLDEN.read_text("utf-8") == rendered, f"op-scenarios.json is stale; {REGENERATE}"
