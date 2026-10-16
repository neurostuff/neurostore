"""Tests of the /review API and its hidden set."""

import copy
import itertools
import json
import re
import threading
import time
from unittest import mock

import pytest
import sqlalchemy as sa
from jsonschema import Draft202012Validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from neurostore.database import db
from neurostore.models import (
    BaseStudy,
    Fulltext,
    PipelineConfig,
    Review,
    ReviewAssignment,
    ReviewOp,
    ReviewSource,
)
from neurostore.resources import body_limit
from neurostore.resources import review as review_views
from neurostore.resources.base import ObjectView
from neurostore.review.app import exports, service
from neurostore.review.core import bundle as review_bundle
from neurostore.review.core import entities
from neurostore.review.core.bundle import validator
from neurostore.review.core.ops import OPS_SCHEMA
from neurostore.review.errors import Conflict
from neurostore.study_schema_tools import sha256_of
from neurostore.tests import study_schema_fixtures as fx
from neurostore.tests.request_utils import AsyncClient
from neurostore.tests.review import records
from neurostore.tests.review.layouts import LEAD, OTHER, REVIEWER, TOKENS, assert_matches_spec

pytestmark = pytest.mark.anyio

_ids = itertools.count()


def op(kind, **fields):
    return {"client_op_id": f"api-{next(_ids):06d}", "type": kind, **fields}


def set_name(entity, name):
    return op(
        "set_value",
        target={"kind": "slot", "entity": entity, "path": "name"},
        value={"extraction_status": "extracted", "value": name, "value_source": "reported"},
    )


def accept(entity):
    return op("verdict", target={"kind": "entity", "entity": entity}, verdict="accept")


def batch(expected_last_seq, *ops):
    return {"expected_last_seq": expected_last_seq, "ops": list(ops)}


def add_source(
    session, label="Golden synthetic paper", base_study=None, text=records.TEXT, record=None
):
    if base_study is None:
        base_study = BaseStudy(name=label, level="group")
        session.add(base_study)
        session.flush()
    fulltext = Fulltext(base_study_id=base_study.id, source="pubget", text=text)
    session.add(fulltext)
    session.flush()
    record = records.golden() if record is None else record
    source = ReviewSource(
        fulltext_id=fulltext.id,
        parsed_paper=fx.parsed_paper(),
        coordinate_parse=records.coordinate_parse(),
        record=record,
        label=label,
        schema_versions={"paper_parse": "0.6.0", "extraction": "0.5.0"},
        record_sha256=sha256_of({"label": label, "record": record}),
        judgeable_keys=entities.judgeable_keys(record, records.coordinate_parse()),
    )
    session.add(source)
    session.commit()
    return source


def add_review(session, source, user_id, state="in_progress", provenance=None):
    review = Review(
        source_id=source.id,
        user_id=user_id,
        state=state,
        record=source.record,
        provenance=provenance or {},
    )
    session.add(review)
    session.commit()
    return review


def op_count(session):
    return session.scalar(sa.select(sa.func.count()).select_from(ReviewOp))


def wait_until_blocked(engine, timeout=10):
    """Whether a session on this database is waiting for a lock within ``timeout`` seconds."""
    query = sa.text(
        "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"
        " AND wait_event_type = 'Lock'"
    )
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with engine.connect() as conn:
            if conn.scalar(query):
                return True
        time.sleep(0.01)
    return False


@pytest.fixture
def source(session):
    return add_source(session)


async def start(clients, source, user_id=REVIEWER):
    response = await clients[user_id].put(f"/api/review/sources/{source.id}/review")
    assert response.status_code in (200, 201), response.json()
    return response.json()


# who may call it


def routes(source_id, review_id):
    return [
        ("get", "/api/review/sources/", None),
        ("get", f"/api/review/sources/{source_id}/bundle", None),
        ("put", f"/api/review/sources/{source_id}/review", None),
        ("get", f"/api/review/reviews/{review_id}", None),
        ("post", f"/api/review/reviews/{review_id}/ops", batch(0, accept("grp_a"))),
        ("patch", f"/api/review/reviews/{review_id}", {"state": "submitted"}),
    ]


async def call(client, method, path, body):
    return await getattr(client, method)(path, data=body)


async def patch(client, review_id, body):
    return await call(client, "patch", f"/api/review/reviews/{review_id}", body)


async def test_every_route_needs_a_token(clients, source, session):
    review = add_review(session, source, REVIEWER)
    for method, path, body in routes(source.id, review.id):
        response = await call(clients[None], method, path, body)
        assert response.status_code == 401, (method, path, response.status_code)


async def test_every_route_needs_the_admin_reviewer_role(clients, source, session, make_user):
    review = add_review(session, source, REVIEWER)
    make_user(OTHER, "admin")
    for user_id in (OTHER, "newuser-id"):
        for method, path, body in routes(source.id, review.id):
            response = await call(clients[user_id], method, path, body)
            assert response.status_code == 403, (user_id, method, path, response.status_code)
    assert op_count(session) == 0


async def test_a_401_on_a_review_route_is_an_error_response(clients, source):
    response = await clients[None].get("/api/review/sources/")

    assert response.status_code == 401
    body = response.json()
    assert body["status"] == 401
    assert body["title"] == "Unauthorized"
    assert body["detail"]
    assert body["request_id"]
    assert body["timestamp"]
    assert_matches_spec(response, "/review/sources/", "get")


@pytest.fixture(params=["debug_off", "debug_on"])
async def reviewer(request, clients):
    """The reviewer's client on the app as it runs without DEBUG, and on one run with it."""
    if request.param == "debug_off":
        yield clients[REVIEWER]
        return
    client = AsyncClient(
        token=TOKENS[REVIEWER],
        asgi_app=request.getfixturevalue("debug_app"),
        username=REVIEWER,
    )
    yield client
    await client.aclose()


@pytest.fixture(scope="module")
def debug_app(app):
    from neurostore import create_asgi_app

    return create_asgi_app({**app.config, "DEBUG": True})


async def test_a_400_on_a_review_route_is_an_error_response_that_does_not_echo_the_batch(
    reviewer, source, session
):
    review = add_review(session, source, REVIEWER)
    too_many = [accept(f"grp_marker_{n}") for n in range(501)]

    response = await reviewer.post(
        f"/api/review/reviews/{review.id}/ops", data=batch(0, *too_many)
    )

    assert response.status_code == 400
    body = response.json()
    assert body["status"] == 400
    assert body["title"] == "Bad Request"
    assert body["request_id"]
    assert body["timestamp"]
    assert body["errors"] == [
        {"field": "ops", "code": "maxItems", "message": "failed the maxItems rule"}
    ]
    assert_matches_spec(response, "/review/reviews/{id}/ops", "post")
    assert "grp_marker_" not in response.text
    assert op_count(session) == 0


@pytest.mark.parametrize("body", [b"{\"ops\": [", b""], ids=["invalid_json", "empty_body"])
async def test_a_body_that_is_not_json_or_is_empty_is_a_400_error_response(
    reviewer, source, session, body
):
    review = add_review(session, source, REVIEWER)

    response = await reviewer.post(
        f"/api/review/reviews/{review.id}/ops",
        data=body,
        headers={"Content-Type": "application/json"},
        json_dump=False,
    )

    assert response.status_code == 400
    error = response.json()
    assert error["status"] == 400
    assert len(error["errors"]) == 1
    assert error["errors"][0]["message"]
    assert_matches_spec(response, "/review/reviews/{id}/ops", "post")
    assert op_count(session) == 0


def compact(document):
    return json.dumps(document, separators=(",", ":")).encode()


async def post_streamed(client, path, body):
    async def chunks():
        for start in range(0, len(body), 16):
            yield body[start:start + 16]

    return await client.client.post(
        path,
        content=chunks(),
        headers={
            "Authorization": f"Bearer {TOKENS[REVIEWER]}",
            "Content-Type": "application/json",
        },
    )


async def test_a_review_body_over_the_cap_is_refused_with_413_before_it_is_read(
    clients, source, session, monkeypatch
):
    monkeypatch.setattr(body_limit, "MAX_REVIEW_BODY_BYTES", 100)
    review = add_review(session, source, REVIEWER)
    oversized = json.dumps(batch(0, accept("grp_a"), accept("grp_b"), accept("grp_c"))).encode()

    response = await clients[REVIEWER].post(
        f"/api/review/reviews/{review.id}/ops",
        data=oversized,
        headers={"Content-Type": "application/json"},
        json_dump=False,
    )

    assert response.status_code == 413
    body = response.json()
    assert body["status"] == 413
    assert body["title"] == "Payload Too Large"
    assert body["request_id"]
    assert_matches_spec(response, "/review/reviews/{id}/ops", "post")
    assert op_count(session) == 0


async def test_a_streamed_review_body_over_the_cap_is_refused_with_413(
    clients, source, session, monkeypatch
):
    monkeypatch.setattr(body_limit, "MAX_REVIEW_BODY_BYTES", 100)
    review = add_review(session, source, REVIEWER)

    async def chunks():
        for _ in range(10):
            yield b"x" * 20

    response = await clients[REVIEWER].client.post(
        f"/api/review/reviews/{review.id}/ops",
        content=chunks(),
        headers={
            "Authorization": f"Bearer {TOKENS[REVIEWER]}",
            "Content-Type": "application/json",
        },
    )

    assert response.status_code == 413
    body = response.json()
    assert body["status"] == 413
    assert body["title"] == "Payload Too Large"
    assert body["request_id"]
    assert op_count(session) == 0


async def test_a_review_body_at_the_cap_is_read(clients, source, session, monkeypatch):
    review = add_review(session, source, REVIEWER)
    body = compact(batch(0, accept("grp_a")))
    monkeypatch.setattr(body_limit, "MAX_REVIEW_BODY_BYTES", len(body))

    response = await clients[REVIEWER].post(
        f"/api/review/reviews/{review.id}/ops",
        data=body,
        headers={"Content-Type": "application/json"},
        json_dump=False,
    )

    assert response.status_code == 200, response.json()


async def test_a_declared_review_body_one_byte_over_the_cap_is_refused(
    clients, source, session, monkeypatch
):
    review = add_review(session, source, REVIEWER)
    body = compact(batch(0, accept("grp_a")))
    monkeypatch.setattr(body_limit, "MAX_REVIEW_BODY_BYTES", len(body) - 1)

    response = await clients[REVIEWER].post(
        f"/api/review/reviews/{review.id}/ops",
        data=body,
        headers={"Content-Type": "application/json"},
        json_dump=False,
    )

    assert response.status_code == 413
    assert op_count(session) == 0


async def test_a_streamed_review_body_at_the_cap_is_read(clients, source, session, monkeypatch):
    review = add_review(session, source, REVIEWER)
    body = compact(batch(0, accept("grp_a")))
    monkeypatch.setattr(body_limit, "MAX_REVIEW_BODY_BYTES", len(body))

    response = await post_streamed(clients[REVIEWER], f"/api/review/reviews/{review.id}/ops", body)

    assert response.status_code == 200, response.json()


async def test_a_streamed_review_body_one_byte_over_the_cap_is_refused(
    clients, source, session, monkeypatch
):
    review = add_review(session, source, REVIEWER)
    body = compact(batch(0, accept("grp_a")))
    monkeypatch.setattr(body_limit, "MAX_REVIEW_BODY_BYTES", len(body) - 1)

    response = await post_streamed(clients[REVIEWER], f"/api/review/reviews/{review.id}/ops", body)

    assert response.status_code == 413
    assert op_count(session) == 0


async def test_a_malformed_content_length_on_a_review_route_is_not_a_500(
    clients, source, session, monkeypatch
):
    review = add_review(session, source, REVIEWER)
    monkeypatch.setattr(body_limit, "MAX_REVIEW_BODY_BYTES", 100)
    oversized = compact(batch(0, accept("grp_a"), accept("grp_b"), accept("grp_c")))

    response = await clients[REVIEWER].post(
        f"/api/review/reviews/{review.id}/ops",
        data=oversized,
        headers={"Content-Type": "application/json", "Content-Length": "lots"},
        json_dump=False,
    )

    assert response.status_code == 413
    assert op_count(session) == 0


def test_a_maximal_schema_valid_batch_fits_under_the_review_body_limit():
    note = "n" * 10000
    maximal = batch(
        0,
        *[
            {
                "client_op_id": f"max-{n:06d}",
                "type": "note",
                "target": {"kind": "entity", "entity": "grp_a"},
                "note": note,
            }
            for n in range(500)
        ],
    )
    schema = json.loads(OPS_SCHEMA.read_text("utf-8"))

    assert list(Draft202012Validator(schema).iter_errors({"ops": maximal["ops"]})) == []
    assert len(compact(maximal)) <= body_limit.MAX_REVIEW_BODY_BYTES


async def test_a_403_on_a_review_route_is_an_error_response(clients, source, make_user):
    make_user("newuser-id", "admin")

    response = await clients["newuser-id"].get("/api/review/sources/")

    assert response.status_code == 403
    body = response.json()
    assert body["status"] == 403
    assert body["title"] == "Forbidden"
    assert body["detail"]
    assert body["request_id"]
    assert body["timestamp"]
    assert_matches_spec(response, "/review/sources/", "get")


# listing sources


async def test_a_pipeline_run_source_is_listed_and_exported_as_one(clients, session, tmp_path):
    config = PipelineConfig()
    session.add(config)
    session.commit()
    source = add_source(session)
    source.pipeline_config_id = config.id
    source.run_id = "run-1"
    session.commit()

    response = await clients[REVIEWER].get("/api/review/sources/")
    [row] = response.json()["results"]
    assert row["origin"] == "pipeline_run"

    exports.export_bulk(session, tmp_path / "out", include_unreviewed=True)
    [provenance] = (tmp_path / "out" / exports.UNREVIEWED_DIR / "run/provenance").glob("*.json")
    wrapper = json.loads(provenance.read_text("utf-8"))
    assert wrapper["source"]["origin"] == "pipeline_run"
    assert wrapper["source"]["run_id"] == "run-1"


async def test_the_source_list_carries_each_reviewers_progress(clients, source, session):
    add_review(session, source, OTHER, state="submitted", provenance={
        "entity:grp_a": {"state": "verified", "user_id": OTHER, "at": "2026-10-14T12:00:00Z"},
        "entity:grp_b": {"state": "verified", "user_id": OTHER, "at": "2026-10-14T12:00:00Z"},
        "slot:grp_a:name": {"state": "edited", "user_id": OTHER, "at": "2026-10-14T12:00:00Z"},
        "entity:tsk_1": {"state": "added", "user_id": OTHER, "at": "2026-10-14T12:00:00Z"},
        "entity:reg_1": {"state": "removed", "user_id": OTHER, "at": "2026-10-14T12:00:00Z"},
    })
    response = await clients[REVIEWER].get("/api/review/sources/")
    assert response.status_code == 200
    body = response.json()
    assert body["metadata"] == {"total_count": 1}
    [row] = body["results"]
    assert {k: row[k] for k in ("id", "base_study_id", "label", "origin")} == {
        "id": source.id,
        "base_study_id": source.fulltext.base_study_id,
        "label": "Golden synthetic paper",
        "origin": "upload",
    }
    assert row["created_at"]
    [progress] = row["reviews"]
    assert {k: v for k, v in progress.items() if k != "updated_at"} == {
        "user_id": OTHER,
        "user_name": f"name of {OTHER}",
        "state": "submitted",
        "last_seq": 0,
        "edited": 3,
        "verified": 2,
        "reviewed": 1,
        "op_count": 0,
        "last_edit_at": None,
    }


async def test_the_source_list_gives_each_source_its_judgeable_total(clients, session):
    record = {
        "local_id": "study-1",
        "name": fx.extracted("A study"),
        "analyses": [
            {
                "local_id": "a_1",
                "name": fx.extracted("one"),
                "definition": fx.extracted("def"),
                "source_table_analysis": fx.extracted("t1"),
                "measure": None,
            }
        ],
    }
    full = add_source(session, label="Judged paper", record=record)
    full.coordinate_parse = fx.parse([
        fx.table_analysis("t1", [1], "patients > controls", [fx.point((10, 20, 30))]),
        fx.table_analysis("t2", [2], "controls > patients", [fx.point((1, 2, 3))]),
    ])
    full.judgeable_keys = entities.judgeable_keys(full.record, full.coordinate_parse)
    empty = add_source(session, label="Empty paper", record={"local_id": "study-2"})
    empty.coordinate_parse = fx.parse([])
    empty.judgeable_keys = entities.judgeable_keys(empty.record, empty.coordinate_parse)
    session.commit()
    response = await clients[REVIEWER].get("/api/review/sources/")
    totals = {row["id"]: row["total"] for row in response.json()["results"]}
    assert totals == {full.id: 5, empty.id: 0}


async def test_the_source_list_totals_the_judgeable_keys_stored_with_the_source(
    clients, source, session
):
    source.judgeable_keys = ["slot:only:name"]
    session.commit()
    response = await clients[REVIEWER].get("/api/review/sources/")
    [row] = response.json()["results"]
    assert row["total"] == 1


def test_the_source_list_never_selects_a_records_body(session, statements, make_user):
    make_user(REVIEWER)
    source = add_source(session, label="Large paper")
    add_review(session, source, REVIEWER)
    session.expunge_all()
    with statements() as seen:
        service.list_sources(session, REVIEWER)
    assert not any(re.search(r"\.(record|coordinate_parse)\b", s) for s in seen)
    page = [s for s in seen if re.search(r"\bLIMIT\b", s)]
    assert any("review_sources.judgeable_keys" in s.split(" FROM ")[0] for s in page)


async def test_the_source_list_counts_the_judgeable_targets_a_review_has_reviewed(
    clients, source, session
):
    add_review(session, source, OTHER, state="submitted", provenance={
        "slot:grp_a:name": {"state": "verified", "user_id": OTHER, "at": "2026-10-14T12:00:00Z"},
        "slot:grp_b:name": {"state": "edited", "user_id": OTHER, "at": "2026-10-14T12:00:00Z"},
        "entity:new_1": {"state": "added", "user_id": OTHER, "at": "2026-10-14T12:00:00Z"},
        "slot:new_1:name": {"state": "verified", "user_id": OTHER, "at": "2026-10-14T12:00:00Z"},
    })
    response = await clients[REVIEWER].get("/api/review/sources/")
    [row] = response.json()["results"]
    assert row["total"] == 38
    [progress] = row["reviews"]
    assert {k: v for k, v in progress.items() if k != "updated_at"} == {
        "user_id": OTHER,
        "user_name": f"name of {OTHER}",
        "state": "submitted",
        "last_seq": 0,
        "edited": 2,
        "verified": 2,
        "reviewed": 2,
        "op_count": 0,
        "last_edit_at": None,
    }


async def test_the_source_list_filters_by_base_study_and_by_mine(clients, source, session):
    other = add_source(session, label="Another paper")
    add_review(session, other, REVIEWER)
    add_review(session, source, OTHER)
    by_study = await clients[REVIEWER].get(
        "/api/review/sources/", params={"base_study_id": source.fulltext.base_study_id}
    )
    assert [row["id"] for row in by_study.json()["results"]] == [source.id]
    mine = await clients[REVIEWER].get("/api/review/sources/", params={"mine": "true"})
    assert [row["id"] for row in mine.json()["results"]] == [other.id]
    assert mine.json()["metadata"] == {"total_count": 1}


async def test_the_source_list_pages(clients, session):
    made = [add_source(session, label=f"paper {n}") for n in range(3)]
    first = await clients[REVIEWER].get("/api/review/sources/", params={"page_size": 2})
    second = await clients[REVIEWER].get(
        "/api/review/sources/", params={"page_size": 2, "page": 2}
    )
    ids = [row["id"] for row in first.json()["results"] + second.json()["results"]]
    assert sorted(ids) == sorted(s.id for s in made)
    assert len(first.json()["results"]) == 2
    assert first.json()["metadata"] == {"total_count": 3}
    largest = await clients[REVIEWER].get("/api/review/sources/", params={"page_size": 100})
    assert largest.status_code == 200
    too_big = await clients[REVIEWER].get("/api/review/sources/", params={"page_size": 101})
    assert too_big.status_code == 400


async def test_the_source_list_is_newest_first(clients, session):
    made = [add_source(session, label=f"paper {n}") for n in range(3)]
    response = await clients[REVIEWER].get("/api/review/sources/")
    assert [row["id"] for row in response.json()["results"]] == [s.id for s in reversed(made)]


async def test_listing_sources_does_not_query_per_row(clients, session, statements):
    async def list_queries():
        with statements() as seen:
            response = await clients[REVIEWER].get("/api/review/sources/")
        assert response.status_code == 200
        return len(seen), len(response.json()["results"])

    first = add_source(session, label="paper 0")
    add_review(session, first, REVIEWER)
    add_review(session, first, OTHER)
    one, rows = await list_queries()
    assert rows == 1
    for n in range(1, 4):
        more = add_source(session, label=f"paper {n}")
        add_review(session, more, REVIEWER)
        add_review(session, more, OTHER)
    four, rows = await list_queries()
    assert rows == 4
    assert four == one


# the bundle


async def test_the_bundle_without_a_review_is_the_source_as_loaded(clients, source, session):
    add_review(session, source, OTHER)
    response = await clients[REVIEWER].get(f"/api/review/sources/{source.id}/bundle")
    assert response.status_code == 200
    bundle = response.json()
    assert [error.message for error in validator().iter_errors(bundle)] == []
    assert bundle["review"] is None
    assert bundle["ops"] == []
    assert bundle["text"] == records.TEXT
    assert bundle["record"] == source.record
    assert bundle["source"]["base_study_id"] == source.fulltext.base_study_id
    assert bundle["source"]["text_sha256"] == source.fulltext.sha256
    expected = review_bundle.hidden(source.record, source.coordinate_parse, None, {})
    assert bundle["hidden"] == expected
    assert [r["user_id"] for r in bundle["reviewers"]] == [OTHER]
    assert bundle["reviewers"][0]["name"] == f"name of {OTHER}"


async def test_a_caller_with_two_sources_gets_each_sources_review_and_reviewers(
    clients, source, session
):
    other = add_source(session, label="Another paper")
    mine_here = await start(clients, source)
    mine_there = await start(clients, other)
    await start(clients, source, OTHER)
    await start(clients, other, LEAD)
    here = (await clients[REVIEWER].get(f"/api/review/sources/{source.id}/bundle")).json()
    there = (await clients[REVIEWER].get(f"/api/review/sources/{other.id}/bundle")).json()
    assert here["review"]["id"] == mine_here["id"]
    assert there["review"]["id"] == mine_there["id"]
    assert {r["user_id"] for r in here["reviewers"]} == {REVIEWER, OTHER}
    assert {r["user_id"] for r in there["reviewers"]} == {REVIEWER, LEAD}


async def test_the_bundle_entities_index_the_review_record(clients, source):
    review = await start(clients, source)
    grown = op(
        "create_entity",
        parent="study",
        list="groups",
        entity=records.item("Group", "grp_c", name=fx.extracted("third")),
    )
    applied = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(0, grown)
    )
    assert applied.status_code == 200, applied.json()
    bundle = (await clients[REVIEWER].get(f"/api/review/sources/{source.id}/bundle")).json()
    assert bundle["entities"] == entities.index_rows(bundle["record"])
    assert bundle["entities"] != entities.index_rows(source.record)
    assert "grp_c" in {row["local_id"] for row in bundle["entities"]}


async def test_the_bundle_hidden_set_is_computed_from_the_review_record(clients, session):
    record = records.golden()
    del record["analyses"][0]["source_table_analysis"]
    source = add_source(session, record=record)
    review = await start(clients, source)
    applied = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(0, set_name("grp_a", "renamed"))
    )
    assert applied.status_code == 200, applied.json()
    bundle = (await clients[REVIEWER].get(f"/api/review/sources/{source.id}/bundle")).json()
    expected = review_bundle.hidden(bundle["record"], source.coordinate_parse, None, {})
    assert expected["analyses"] == ["an_1"]
    assert "grp_a" in expected["entities"]
    assert bundle["hidden"] == expected
    assert applied.json()["hidden"] == expected


def coordinate(key, action, **fields):
    target = {"kind": "coordinate_analysis", "analysis_key": key}
    return op("coordinate", target=target, action=action, **fields)


async def test_the_hidden_set_reads_the_revisions_keys(clients, source):
    review = await start(clients, source)
    ops_path = f"/api/review/reviews/{review['id']}/ops"
    keys = [analysis["key"] for analysis in source.coordinate_parse["analyses"]]
    merged = await clients[REVIEWER].post(
        ops_path, data=batch(0, coordinate(keys[0], "merge", payload={"with": [keys[1]]}))
    )
    assert merged.status_code == 200, merged.json()
    [analysis] = [a for a in merged.json()["record"]["analyses"] if a["local_id"] == "an_1"]
    merged_key = analysis["source_table_analysis"]["value"]
    assert merged_key == merged.json()["coordinate_revision"]["analyses"][0]["key"]
    assert "an_1" not in merged.json()["hidden"]["analyses"]
    shown = (await clients[REVIEWER].get(f"/api/review/sources/{source.id}/bundle")).json()
    assert shown["hidden"] == merged.json()["hidden"]
    rejected = op(
        "verdict",
        target={"kind": "coordinate_analysis", "analysis_key": merged_key},
        verdict="reject",
        reason="duplicate",
    )
    omitted = await clients[REVIEWER].post(ops_path, data=batch(1, rejected))
    assert omitted.status_code == 200, omitted.json()
    bundle = (await clients[REVIEWER].get(f"/api/review/sources/{source.id}/bundle")).json()
    assert bundle["hidden"]["analyses"] == ["an_1"]
    assert omitted.json()["hidden"] == bundle["hidden"]


async def test_a_coordinate_accept_is_a_422_that_names_the_verdict_op(clients, source):
    review = await start(clients, source)
    key = source.coordinate_parse["analyses"][0]["key"]
    refused = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(0, coordinate(key, "accept"))
    )
    assert refused.status_code == 422, refused.json()
    [error] = refused.json()["errors"]
    assert error["context"]["op_index"] == 0
    assert error["message"] == "accept and reject a coordinate analysis with a verdict op"


async def test_a_point_that_does_not_validate_is_refused_as_a_422_naming_its_path(clients, source):
    review = await start(clients, source)
    key = source.coordinate_parse["analyses"][0]["key"]
    bad = {"coordinates": [1, 2], "space": None, "values": [{"kind": "t", "value": 3.0}]}
    refused = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops",
        data=batch(0, coordinate(key, "edit_points", payload={"points": [bad]})),
    )
    assert refused.status_code == 422, refused.json()
    assert "/points/0/coordinates" in str(refused.json())


async def test_an_added_analysis_without_a_role_is_refused_as_a_422(clients, source):
    review = await start(clients, source)
    point = {"coordinates": [1, 2, 3], "space": None, "values": [{"kind": "t", "value": 3.0}]}
    analysis = {"origin": "table", "table_id": "t2", "cells": [], "name": "missed",
                "coordinate_space": "MNI", "points": [point]}
    refused = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops",
        data=batch(0, op("coordinate", target={"kind": "coordinate_parse"}, action="add",
                         payload={"analysis": analysis})),
    )
    assert refused.status_code == 422, refused.json()
    assert "'role' is a required property" in str(refused.json())


async def test_an_unknown_source_is_not_found(clients):
    response = await clients[REVIEWER].get("/api/review/sources/nope/bundle")
    assert response.status_code == 404
    response = await clients[REVIEWER].put("/api/review/sources/nope/review")
    assert response.status_code == 404


# starting a review


async def test_starting_a_review_is_idempotent(clients, source, session):
    first = await clients[REVIEWER].put(f"/api/review/sources/{source.id}/review")
    assert first.status_code == 201
    assert {k: first.json()[k] for k in ("source_id", "user_id", "state", "last_seq")} == {
        "source_id": source.id,
        "user_id": REVIEWER,
        "state": "in_progress",
        "last_seq": 0,
    }
    again = await clients[REVIEWER].put(f"/api/review/sources/{source.id}/review")
    assert again.status_code == 200
    assert again.json()["id"] == first.json()["id"]
    review = session.get(Review, first.json()["id"])
    assert review.record == source.record
    assert review.coordinate_revision is None


# a full round


def logged(ops):
    """Stored ops as the bundle and the review carry them: without the op result's inverses."""
    return [{k: v for k, v in stored.items() if k != "inverse"} for stored in ops]


LOADED_ENTITIES = [
    {"local_id": "study", "entity_class": "Study", "schema_class": "Study",
     "parent": None, "list_path": None},
    *(
        {"local_id": local_id, "entity_class": entity_class, "schema_class": schema_class,
         "parent": parent, "list_path": list_path}
        for local_id, entity_class, schema_class, parent, list_path in [
            ("grp_a", "Group", "Group", "study", "groups"),
            ("grp_b", "Group", "Group", "study", "groups"),
            ("tsk_1", "Task", "Task", "study", "tasks"),
            ("cnd_1", "Condition", "Condition", "tsk_1", "conditions"),
            ("cnd_2", "Condition", "Condition", "tsk_1", "conditions"),
            ("asm_1", "Assessment", "Assessment", "study", "assessments"),
            ("reg_1", "Region", "Region", "study", "regions"),
            ("dev_1", "Device", "Device", "study", "devices"),
            ("acq_1", "Acquisition", "MRI", "study", "acquisitions"),
            ("mdl_1", "ModelEstimation", "ModelEstimation", "study", "model_estimations"),
            ("trm_1", "ModelTerm", "ModelTerm", "mdl_1", "terms"),
            ("msr_1", "Measure", "Measure", "study", "measures"),
            ("an_1", "Analysis", "Analysis", "study", "analyses"),
            ("arm_1", "Arm", "Arm", "study", "design.arms"),
            ("tp_1", "Timepoint", "Timepoint", "study", "design.timepoints"),
        ]
    ),
]


async def test_the_bundle_carries_the_record_as_loaded_beside_the_reviewed_one(clients, source):
    loaded = (await clients[REVIEWER].get(f"/api/review/sources/{source.id}/bundle")).json()
    assert loaded["original"]["record"] == source.record
    assert loaded["original"]["entities"] == LOADED_ENTITIES
    assert loaded["original"]["hidden"] == {"analyses": [], "entities": []}

    review = await start(clients, source)
    ops_path = f"/api/review/reviews/{review['id']}/ops"
    keys = [analysis["key"] for analysis in source.coordinate_parse["analyses"]]
    merged = await clients[REVIEWER].post(
        ops_path,
        data=batch(
            0,
            set_name("grp_b", "healthy controls"),
            coordinate(keys[0], "merge", payload={"with": [keys[1]]}),
        ),
    )
    assert merged.status_code == 200, merged.json()
    merged_key = merged.json()["coordinate_revision"]["analyses"][0]["key"]
    rejected = op(
        "verdict",
        target={"kind": "coordinate_analysis", "analysis_key": merged_key},
        verdict="reject",
        reason="duplicate",
    )
    assert (await clients[REVIEWER].post(ops_path, data=batch(2, rejected))).status_code == 200

    bundle = (await clients[REVIEWER].get(f"/api/review/sources/{source.id}/bundle")).json()
    assert [error.message for error in validator().iter_errors(bundle)] == []
    assert bundle["record"]["groups"][1]["name"]["value"] == "healthy controls"
    provenance = bundle["review"]["provenance"]
    assert provenance[f"coordinate_analysis:{merged_key}"]["state"] == "removed"
    assert bundle["hidden"]["analyses"] == ["an_1"]
    assert bundle["original"]["record"] == source.record
    assert bundle["original"]["record"]["groups"][1]["name"]["value"] == "controls"
    assert bundle["original"]["entities"] == LOADED_ENTITIES
    assert bundle["original"]["hidden"] == {"analyses": [], "entities": []}


async def test_a_full_round_of_editing_a_review(clients, source, session):
    review = await start(clients, source)
    ops_path = f"/api/review/reviews/{review['id']}/ops"
    edit = set_name("grp_b", "healthy controls")

    applied = await clients[REVIEWER].post(ops_path, data=batch(0, edit))
    assert applied.status_code == 200, applied.json()
    result = applied.json()
    assert result["last_seq"] == 1
    assert [stored["seq"] for stored in result["ops"]] == [1]
    assert result["record"]["groups"][1]["name"]["value"] == "healthy controls"
    assert result["provenance"]["slot:grp_b:name"]["state"] == "edited"

    bundle = (await clients[REVIEWER].get(f"/api/review/sources/{source.id}/bundle")).json()
    assert [error.message for error in validator().iter_errors(bundle)] == []
    assert bundle["record"]["groups"][1]["name"]["value"] == "healthy controls"
    assert bundle["review"]["id"] == review["id"]
    assert bundle["review"]["last_seq"] == 1
    assert bundle["ops"] == logged(result["ops"])
    assert bundle["reviewers"][0]["op_count"] == 1
    assert bundle["reviewers"][0]["last_edit_at"] == result["ops"][0]["created_at"]

    replay = await clients[REVIEWER].post(ops_path, data=batch(0, edit))
    assert replay.status_code == 200
    assert replay.json()["ops"] == result["ops"]
    assert replay.json()["last_seq"] == 1
    assert op_count(session) == 1

    partial = await clients[REVIEWER].post(ops_path, data=batch(1, edit, accept("grp_a")))
    assert partial.status_code == 409
    assert partial.json()["title"] == "Conflict"
    session.expire_all()
    assert op_count(session) == 1
    assert session.get(Review, review["id"]).last_seq == 1

    stale = await clients[REVIEWER].post(ops_path, data=batch(0, accept("grp_a")))
    assert stale.status_code == 409
    assert stale.json()["last_seq"] == 1

    submitted = await patch(clients[REVIEWER], review["id"], {"state": "submitted"})
    assert submitted.status_code == 200
    assert submitted.json()["state"] == "submitted"
    closed = await clients[REVIEWER].post(ops_path, data=batch(1, accept("grp_a")))
    assert closed.status_code == 409
    session.expire_all()
    assert op_count(session) == 1
    assert session.get(Review, review["id"]).last_seq == 1

    read = await clients[OTHER].get(f"/api/review/reviews/{review['id']}")
    assert read.status_code == 200
    assert read.json()["record"] == result["record"]
    assert read.json()["provenance"] == result["provenance"]
    assert read.json()["ops"] == logged(result["ops"])
    assert read.json()["state"] == "submitted"


async def test_a_multi_op_replay_returns_its_ops_in_seq_order(clients, source):
    review = await start(clients, source)
    ops_path = f"/api/review/reviews/{review['id']}/ops"
    body = batch(0, set_name("grp_b", "healthy controls"), accept("grp_a"))
    first = await clients[REVIEWER].post(ops_path, data=body)
    assert first.status_code == 200, first.json()
    replay = await clients[REVIEWER].post(ops_path, data=body)
    assert replay.status_code == 200
    assert [stored["seq"] for stored in replay.json()["ops"]] == [1, 2]
    assert replay.json()["ops"] == first.json()["ops"]


async def test_a_full_replay_of_a_submitted_review_returns_the_stored_ops(clients, source):
    review = await start(clients, source)
    ops_path = f"/api/review/reviews/{review['id']}/ops"
    body = batch(0, set_name("grp_b", "healthy controls"))
    applied = await clients[REVIEWER].post(ops_path, data=body)
    assert applied.status_code == 200
    submitted = await patch(clients[REVIEWER], review["id"], {"state": "submitted"})
    assert submitted.status_code == 200
    replay = await clients[REVIEWER].post(ops_path, data=body)
    assert replay.status_code == 200
    assert replay.json()["ops"] == applied.json()["ops"]
    assert replay.json()["last_seq"] == 1


async def test_the_same_client_op_id_in_another_review_is_not_a_replay(clients, source):
    mine = await start(clients, source)
    theirs = await start(clients, source, OTHER)
    edit = {**set_name("grp_b", "healthy controls"), "client_op_id": "shared-op-1"}
    first = await clients[REVIEWER].post(
        f"/api/review/reviews/{mine['id']}/ops", data=batch(0, edit)
    )
    assert first.status_code == 200
    second = await clients[OTHER].post(
        f"/api/review/reviews/{theirs['id']}/ops", data=batch(0, edit)
    )
    assert second.status_code == 200
    assert second.json()["last_seq"] == 1
    assert [stored["seq"] for stored in second.json()["ops"]] == [1]
    assert second.json()["record"]["groups"][1]["name"]["value"] == "healthy controls"


async def test_the_op_result_carries_the_hidden_set_of_the_new_record(clients, source):
    review = await start(clients, source)
    response = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(0, set_name("grp_a", "renamed"))
    )
    assert response.status_code == 200
    result = response.json()
    expected = review_bundle.hidden(result["record"], source.coordinate_parse, None, {})
    assert result["hidden"] == expected


async def test_the_op_result_carries_the_entity_index_of_the_new_record(clients, source):
    review = await start(clients, source)
    created = op(
        "create_entity",
        parent="study",
        list="groups",
        entity=records.item("Group", "grp_new", name=fx.extracted("new group")),
    )
    response = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(0, created)
    )
    assert response.status_code == 200
    result = response.json()
    assert result["entities"] == entities.index_rows(result["record"])
    assert "grp_new" in [row["local_id"] for row in result["entities"]]


# undo


def k(n):
    return records.coordinate_parse()["analyses"][n]["key"]


AGE_SLOT = {"kind": "slot", "entity": "grp_a", "path": "age_mean"}
UNDOABLE = {
    "set_value": (lambda: set_name("grp_b", "healthy controls"), ["set_value"]),
    "set_evidence": (
        lambda: op("set_evidence", target=AGE_SLOT, evidence={
            "status": "present", "sets": [{"spans": [{"start_char": 0, "end_char": 15}]}]
        }),
        ["set_evidence"],
    ),
    "link": (
        lambda: op("link", target={"kind": "relationship", "entity": "an_1", "path": "regions",
                                   "target_entity": "reg_1"}),
        ["unlink"],
    ),
    "unlink": (
        lambda: op("unlink", target={"kind": "relationship", "entity": "an_1", "path": "tasks",
                                     "target_entity": "tsk_1"}),
        ["link"],
    ),
    "create_entity": (
        lambda: op("create_entity", parent="study", list="groups",
                   entity=records.item("Group", "grp_new", name=fx.extracted("new group"))),
        ["delete_entity"],
    ),
    "delete_entity": (
        lambda: op("delete_entity", target={"kind": "entity", "entity": "grp_a"}),
        ["create_entity"],
    ),
    "coordinate": (
        lambda: coordinate(k(0), "edit_points", payload={
            "points": [*records.coordinate_parse()["analyses"][0]["points"],
                       fx.point((1, 2, 3))]
        }),
        ["coordinate"],
    ),
}


def with_ids(ops):
    return [{"client_op_id": f"api-{next(_ids):06d}", **o} for o in ops]


@pytest.mark.parametrize("kind", UNDOABLE)
async def test_each_stored_op_in_the_op_result_carries_its_inverse(clients, source, kind):
    review = await start(clients, source)
    change, inverse_types = UNDOABLE[kind]
    response = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(0, change())
    )
    assert response.status_code == 200, response.json()
    [stored] = response.json()["ops"]
    assert [o["type"] for o in stored["inverse"]] == inverse_types
    assert all("client_op_id" not in o for o in stored["inverse"])


async def test_a_verdict_carries_an_inverse_that_clears_a_first_judgement(clients, source):
    review = await start(clients, source)
    response = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(0, accept("grp_a"))
    )
    assert response.status_code == 200, response.json()
    [stored] = response.json()["ops"]
    assert [o["verdict"] for o in stored["inverse"]] == ["clear"]


async def test_applying_a_rejects_inverse_restores_the_judgement_it_replaced(clients, source):
    review = await start(clients, source)
    ops_path = f"/api/review/reviews/{review['id']}/ops"
    first = await clients[REVIEWER].post(ops_path, data=batch(0, accept("grp_a")))
    assert first.status_code == 200, first.json()
    reject = op("verdict", target={"kind": "entity", "entity": "grp_a"}, verdict="reject",
                reason="duplicate")
    rejected = await clients[REVIEWER].post(ops_path, data=batch(1, reject))
    assert rejected.status_code == 200, rejected.json()
    [stored] = rejected.json()["ops"]
    assert [o["verdict"] for o in stored["inverse"]] == ["restore"]
    undone = await clients[REVIEWER].post(ops_path, data=batch(2, *with_ids(stored["inverse"])))
    assert undone.status_code == 200, undone.json()
    assert undone.json()["provenance"] == first.json()["provenance"]
    assert [s["seq"] for s in undone.json()["ops"]] == [3]


@pytest.mark.parametrize("kind", UNDOABLE)
async def test_applying_the_returned_inverse_restores_the_record_and_parse(clients, source, kind):
    review = await start(clients, source)
    ops_path = f"/api/review/reviews/{review['id']}/ops"
    before = (await clients[REVIEWER].get(f"/api/review/sources/{source.id}/bundle")).json()
    changed = await clients[REVIEWER].post(ops_path, data=batch(0, UNDOABLE[kind][0]()))
    assert changed.status_code == 200, changed.json()
    assert (changed.json()["record"], changed.json()["coordinate_revision"]) != (
        before["record"], before["coordinate_revision"]
    )
    [stored] = changed.json()["ops"]
    undone = await clients[REVIEWER].post(ops_path, data=batch(1, *with_ids(stored["inverse"])))
    assert undone.status_code == 200, undone.json()
    assert undone.json()["record"] == before["record"]
    assert undone.json()["coordinate_revision"] == before["coordinate_revision"]


async def undone_after(clients, source, setup, change):
    """The record before ``change`` and after its stored inverses are posted, last op first."""
    review = await start(clients, source)
    ops_path = f"/api/review/reviews/{review['id']}/ops"
    if setup:
        prepared = await clients[REVIEWER].post(ops_path, data=batch(0, *setup))
        assert prepared.status_code == 200, prepared.json()
    before = (await clients[REVIEWER].get(f"/api/review/sources/{source.id}/bundle")).json()
    changed = await clients[REVIEWER].post(ops_path, data=batch(len(setup), change))
    assert changed.status_code == 200, changed.json()
    inverses = [o for stored in reversed(changed.json()["ops"]) for o in stored["inverse"]]
    undone = await clients[REVIEWER].post(
        ops_path, data=batch(len(setup) + 1, *with_ids(inverses))
    )
    assert undone.status_code == 200, undone.json()
    return before["record"], undone.json()["record"], inverses


def slot_of(record, group, name):
    return next(g for g in record["groups"] if g["local_id"] == group)[name]


async def test_the_inverse_of_an_evidence_edit_restores_a_sets_source(clients, source):
    change = op("set_evidence", target=AGE_SLOT, evidence={
        "status": "present", "sets": [{"spans": [{"start_char": 0, "end_char": 15}]}]
    })
    before, after, _ = await undone_after(clients, source, [], change)
    [restored] = slot_of(after, "grp_a", "age_mean")["evidence"]["sets"]
    assert restored["source"] == "model_quote"
    assert after == before


async def test_the_inverse_of_an_evidence_edit_restores_unlocated_quotes(clients, source):
    setup = op("set_evidence", target=AGE_SLOT,
               evidence={"status": "not_found", "unlocated_quotes": 2})
    change = op("set_evidence", target=AGE_SLOT, evidence={
        "status": "present", "sets": [{"spans": [{"start_char": 0, "end_char": 15}]}]
    })
    before, after, _ = await undone_after(clients, source, [setup], change)
    assert slot_of(after, "grp_a", "age_mean")["evidence"] == {
        "status": "not_found", "unlocated_quotes": 2
    }
    assert after == before


async def test_the_inverse_of_setting_a_not_reported_slot_restores_its_reason(clients, source):
    change = op("set_value", target={"kind": "slot", "entity": "grp_b", "path": "age_mean"},
                value={"extraction_status": "extracted", "value": 41.0,
                       "value_source": "reported"})
    before, after, _ = await undone_after(clients, source, [], change)
    assert slot_of(before, "grp_b", "age_mean")["unreported_reason"] == "ambiguous"
    assert slot_of(after, "grp_b", "age_mean") == slot_of(before, "grp_b", "age_mean")
    assert after == before


async def test_the_inverse_of_setting_an_absent_slot_marks_it_not_reported(clients, source):
    median = {"kind": "slot", "entity": "grp_b", "path": "age_median"}
    change = op("set_value", target=median,
                value={"extraction_status": "extracted", "value": 30.0,
                       "value_source": "reported"})
    before, after, inverses = await undone_after(clients, source, [], change)
    group_b = next(g for g in before["groups"] if g["local_id"] == "grp_b")
    assert "age_median" not in group_b
    assert [o["value"] for o in inverses] == [{"extraction_status": "not_reported"}]
    assert slot_of(after, "grp_b", "age_median") == {
        "extraction_status": "not_reported",
        "evidence": {"status": "not_applicable"},
    }


async def test_the_inverse_of_a_set_value_that_drops_evidence_is_the_value_then_the_evidence(
    clients, source
):
    change = op("set_value", target=AGE_SLOT, value={"extraction_status": "not_reported"})
    before, after, inverses = await undone_after(clients, source, [], change)
    assert [o["type"] for o in inverses] == ["set_value", "set_evidence"]
    assert slot_of(after, "grp_a", "age_mean") == slot_of(before, "grp_a", "age_mean")
    assert after == before


async def test_the_log_holds_the_edit_then_the_appended_inverse(clients, source):
    review = await start(clients, source)
    ops_path = f"/api/review/reviews/{review['id']}/ops"
    edit = set_name("grp_b", "healthy controls")
    changed = await clients[REVIEWER].post(ops_path, data=batch(0, edit))
    [stored] = changed.json()["ops"]
    [undo] = with_ids(stored["inverse"])
    undone = await clients[REVIEWER].post(ops_path, data=batch(1, undo))
    assert undone.status_code == 200, undone.json()
    log = (await clients[REVIEWER].get(f"/api/review/sources/{source.id}/bundle")).json()["ops"]
    assert [entry["seq"] for entry in log] == [1, 2]
    assert [entry["op"] for entry in log] == [edit, undo]
    assert all("inverse" not in entry for entry in log)


async def test_a_note_carries_no_inverse(clients, source):
    review = await start(clients, source)
    note = op("note", target={"kind": "entity", "entity": "grp_a"}, note="see methods")
    response = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(0, note)
    )
    assert response.status_code == 200, response.json()
    [stored] = response.json()["ops"]
    assert "inverse" not in stored


async def test_a_replayed_batch_carries_its_inverses(clients, source):
    review = await start(clients, source)
    ops_path = f"/api/review/reviews/{review['id']}/ops"
    body = batch(0, set_name("grp_b", "healthy controls"))
    first = await clients[REVIEWER].post(ops_path, data=body)
    replay = await clients[REVIEWER].post(ops_path, data=body)
    assert replay.status_code == 200
    assert replay.json()["ops"][0]["inverse"] == first.json()["ops"][0]["inverse"]


async def test_a_coordinate_inverse_after_a_later_edit_of_the_analysis_is_refused(clients, source):
    review = await start(clients, source)
    ops_path = f"/api/review/reviews/{review['id']}/ops"
    split = coordinate(k(1), "split", payload={"parts": [{"indices": [0]}, {"indices": [1]}]})
    first = await clients[REVIEWER].post(ops_path, data=batch(0, split))
    assert first.status_code == 200, first.json()
    part = first.json()["coordinate_revision"]["analyses"][1]["key"]
    later = await clients[REVIEWER].post(
        ops_path, data=batch(1, coordinate(part, "edit_points", payload={
            "points": [fx.point((5, 5, 5))]
        }))
    )
    assert later.status_code == 200, later.json()
    undo = with_ids(first.json()["ops"][0]["inverse"])
    refused = await clients[REVIEWER].post(ops_path, data=batch(2, *undo))
    assert refused.status_code == 422, refused.json()
    [error] = refused.json()["errors"]
    assert error["context"] == {"op_index": 0, "client_op_id": undo[0]["client_op_id"]}
    assert "has changed since" in error["message"]


async def test_only_the_owner_posts_ops(clients, source):
    review = await start(clients, source)
    response = await clients[OTHER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(0, accept("grp_a"))
    )
    assert response.status_code == 403


async def test_an_op_the_core_refuses_is_unprocessable(clients, source, session):
    review = await start(clients, source)
    refused = accept("grp_nope")
    response = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(0, refused)
    )
    assert response.status_code == 422
    assert response.json()["title"] == "Unprocessable Entity"
    [error] = response.json()["errors"]
    assert error["field"] == "ops/0"
    assert error["context"] == {"op_index": 0, "client_op_id": refused["client_op_id"]}
    assert "grp_nope" in error["message"]
    session.expire_all()
    assert session.get(Review, review["id"]).last_seq == 0


async def test_every_op_the_core_refuses_is_named_by_its_index(clients, source, session):
    review = await start(clients, source)
    refused = [
        accept("grp_nope"),
        op(
            "set_evidence",
            target={"kind": "slot", "entity": "grp_a", "path": "age_mean"},
            evidence={"status": "present", "sets": [
                {"spans": [{"start_char": 0, "end_char": 100000}]}
            ]},
        ),
    ]
    response = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops",
        data=batch(0, *refused, accept("grp_a")),
    )
    assert response.status_code == 422
    errors = response.json()["errors"]
    assert [error["field"] for error in errors] == ["ops/0", "ops/1"]
    assert [error["context"] for error in errors] == [
        {"op_index": 0, "client_op_id": refused[0]["client_op_id"]},
        {"op_index": 1, "client_op_id": refused[1]["client_op_id"]},
    ]
    assert "outside the paper" in errors[1]["message"]
    session.expire_all()
    assert session.get(Review, review["id"]).last_seq == 0


async def test_a_batch_that_repeats_a_client_op_id_is_refused_naming_it(clients, source, session):
    review = await start(clients, source)
    first = accept("grp_a")
    again = {**set_name("grp_a", "patients"), "client_op_id": first["client_op_id"]}
    response = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(0, first, again)
    )
    assert response.status_code == 422, response.json()
    [error] = response.json()["errors"]
    assert error["field"] == "ops/1"
    assert error["context"] == {"op_index": 1, "client_op_id": first["client_op_id"]}
    assert first["client_op_id"] in error["message"]
    session.expire_all()
    assert session.get(Review, review["id"]).last_seq == 0


async def test_a_batch_repeating_an_op_that_is_already_stored_is_refused_naming_it(
    clients, source, session
):
    review = await start(clients, source)
    ops_path = f"/api/review/reviews/{review['id']}/ops"
    stored = accept("grp_a")
    applied = await clients[REVIEWER].post(ops_path, data=batch(0, stored))
    assert applied.status_code == 200, applied.json()

    response = await clients[REVIEWER].post(ops_path, data=batch(1, stored, stored))

    assert response.status_code == 422, response.json()
    [error] = response.json()["errors"]
    assert error["field"] == "ops/1"
    assert stored["client_op_id"] in error["message"]
    session.expire_all()
    assert session.get(Review, review["id"]).last_seq == 1


async def test_an_op_that_does_not_validate_is_named_by_its_index(clients, source):
    review = await start(clients, source)
    malformed = {"client_op_id": "malformed-1", "type": "no_such_type"}
    response = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(0, accept("grp_a"), malformed)
    )
    assert response.status_code == 422
    [error] = response.json()["errors"]
    assert error["field"] == "ops/1"
    assert error["context"]["op_index"] == 1
    assert error["context"]["client_op_id"] == "malformed-1"


async def test_an_expected_last_seq_ahead_of_the_review_is_refused(clients, source, session):
    review = await start(clients, source)
    response = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(5, accept("grp_a"))
    )
    assert response.status_code == 409
    assert response.json()["last_seq"] == 0
    session.expire_all()
    assert op_count(session) == 0
    assert session.get(Review, review["id"]).last_seq == 0


async def test_two_concurrent_batches_cannot_both_apply(clients, source, session):
    review_id = (await start(clients, source))["id"]
    first, second = Session(session.bind), Session(session.bind)
    outcome = {}
    started, finished = threading.Event(), threading.Event()

    def post_second():
        started.set()
        try:
            service.post_ops(second, review_id, REVIEWER, batch(0, accept("grp_a")))
            second.commit()
            outcome["second"] = "applied"
        except Conflict as conflict:
            second.rollback()
            outcome["second"] = conflict.last_seq
        except Exception as error:
            second.rollback()
            outcome["second"] = error
        finally:
            finished.set()

    try:
        service.post_ops(first, review_id, REVIEWER, batch(0, set_name("grp_b", "controls 2")))
        thread = threading.Thread(target=post_second)
        thread.start()
        assert started.wait(10)
        assert wait_until_blocked(session.bind), "the second batch did not wait for its lock"
        first.commit()
        assert finished.wait(10)
        thread.join()
    finally:
        first.close()
        second.close()
    assert outcome["second"] == 1, outcome["second"]
    session.expire_all()
    assert session.get(Review, review_id).last_seq == 1


# review state


async def test_the_owner_submits_and_reopens(clients, source):
    review = await start(clients, source)
    submitted = await patch(clients[REVIEWER], review["id"], {"state": "submitted"})
    assert submitted.status_code == 200
    reopened = await patch(clients[REVIEWER], review["id"], {"state": "in_progress"})
    assert reopened.status_code == 200
    assert reopened.json()["state"] == "in_progress"
    again = await patch(clients[REVIEWER], review["id"], {"state": "in_progress"})
    assert again.status_code == 409


async def test_a_submitted_review_is_not_submitted_again(clients, source):
    review = await start(clients, source)
    submitted = await patch(clients[REVIEWER], review["id"], {"state": "submitted"})
    assert submitted.status_code == 200
    again = await patch(clients[REVIEWER], review["id"], {"state": "submitted"})
    assert again.status_code == 409


async def test_another_reviewer_cannot_change_the_state(clients, source):
    review = await start(clients, source)
    response = await patch(clients[OTHER], review["id"], {"state": "submitted"})
    assert response.status_code == 403


async def test_the_owner_sets_a_review_aside_with_a_reason_and_resumes_it(clients, source):
    review = await start(clients, source)
    reason = {"reason": "no_usable_text", "note": "the text is garbled"}
    aside = await patch(clients[REVIEWER], review["id"], {"state": "set_aside", **reason})
    assert aside.status_code == 200, aside.json()
    assert_matches_spec(aside, "/review/reviews/{id}", "patch")
    assert aside.json()["state"] == "set_aside"
    assert aside.json()["set_aside"] == reason
    bundle = await clients[REVIEWER].get(f"/api/review/sources/{source.id}/bundle")
    assert_matches_spec(bundle, "/review/sources/{id}/bundle", "get")
    assert bundle.json()["review"]["set_aside"] == reason
    resumed = await patch(clients[REVIEWER], review["id"], {"state": "in_progress"})
    assert resumed.status_code == 200
    assert resumed.json()["state"] == "in_progress"
    assert "set_aside" not in resumed.json()


@pytest.mark.parametrize("body", [
    {"state": "set_aside"},
    {"state": "set_aside", "reason": "other"},
    {"state": "submitted", "reason": "duplicate"},
    {"state": "submitted", "note": "why"},
    {"state": "set_aside", "reason": "other", "note": "  "},
])
async def test_a_set_aside_needs_its_reason_and_only_it_takes_one(clients, source, body):
    review = await start(clients, source)
    response = await patch(clients[REVIEWER], review["id"], body)
    assert response.status_code == 422, response.json()


async def test_an_unknown_review_is_not_found_before_its_reason_is_checked(clients):
    response = await patch(clients[REVIEWER], "nope", {"state": "set_aside"})
    assert response.status_code == 404
    response = await patch(clients[REVIEWER], "nope", {"state": "submitted", "note": "why"})
    assert response.status_code == 404


async def test_another_reviewer_is_refused_before_the_reason_is_checked(clients, source):
    review = await start(clients, source)
    response = await patch(clients[OTHER], review["id"], {"state": "set_aside"})
    assert response.status_code == 403


async def test_a_submitted_review_is_reopened_before_it_is_set_aside(clients, source):
    review = await start(clients, source)
    await patch(clients[REVIEWER], review["id"], {"state": "submitted"})
    body = {"state": "set_aside", "reason": "duplicate"}
    response = await patch(clients[REVIEWER], review["id"], body)
    assert response.status_code == 409


async def test_a_set_aside_review_is_not_marked_the_reference(clients, source):
    review = await start(clients, source)
    await patch(clients[REVIEWER], review["id"], {"state": "set_aside", "reason": "duplicate"})
    response = await patch(clients[LEAD], review["id"], {"state": "reference"})
    assert response.status_code == 409


async def test_a_note_does_not_outlive_the_set_aside_that_gave_it(clients, source):
    review = await start(clients, source)
    body = {"state": "set_aside", "reason": "duplicate"}
    await patch(clients[REVIEWER], review["id"], {**body, "note": "same"})
    await patch(clients[REVIEWER], review["id"], {"state": "in_progress"})
    again = await patch(clients[REVIEWER], review["id"], body)
    assert again.json()["set_aside"] == {"reason": "duplicate", "note": None}


async def test_a_set_aside_review_takes_no_ops_and_is_not_submitted(clients, source):
    review = await start(clients, source)
    await patch(clients[REVIEWER], review["id"], {"state": "set_aside", "reason": "out_of_scope"})
    posted = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(0, set_name("grp_b", "x"))
    )
    assert posted.status_code == 409
    submitted = await patch(clients[REVIEWER], review["id"], {"state": "submitted"})
    assert submitted.status_code == 409


async def test_the_source_list_shows_a_set_aside_review_with_its_reason(clients, source):
    review = await start(clients, source)
    await patch(clients[REVIEWER], review["id"], {"state": "set_aside", "reason": "duplicate"})
    response = await clients[REVIEWER].get("/api/review/sources/")
    assert_matches_spec(response, "/review/sources/", "get")
    [progress] = response.json()["results"][0]["reviews"]
    assert progress["state"] == "set_aside"
    assert progress["set_aside"] == {"reason": "duplicate", "note": None}


async def test_only_a_lead_sets_one_reference_per_source(clients, source):
    mine = await start(clients, source)
    theirs = await start(clients, source, OTHER)
    assert (await patch(clients[REVIEWER], mine["id"], {"state": "reference"})).status_code == 403
    reference = await patch(clients[LEAD], mine["id"], {"state": "reference"})
    assert reference.status_code == 200
    assert reference.json()["state"] == "reference"
    repeat = await patch(clients[LEAD], mine["id"], {"state": "reference"})
    assert repeat.status_code == 409
    second = await patch(clients[LEAD], theirs["id"], {"state": "reference"})
    assert second.status_code == 409
    back = await patch(clients[REVIEWER], mine["id"], {"state": "in_progress"})
    assert back.status_code == 409


async def test_two_concurrent_reference_marks_leave_one_reference(clients, source, session):
    mine = await start(clients, source)
    theirs = await start(clients, source, OTHER)
    first, second = Session(session.bind), Session(session.bind)
    outcome = {}
    started, finished = threading.Event(), threading.Event()

    def mark_second():
        started.set()
        try:
            service.set_state(second, theirs["id"], LEAD, "reference", lead=True)
            second.commit()
            outcome["second"] = "applied"
        except Exception as error:
            second.rollback()
            outcome["second"] = error
        finally:
            finished.set()

    try:
        service.set_state(first, mine["id"], LEAD, "reference", lead=True)
        thread = threading.Thread(target=mark_second)
        thread.start()
        assert started.wait(10)
        assert wait_until_blocked(session.bind), "the second mark did not wait for its lock"
        first.commit()
        assert finished.wait(10)
        thread.join()
    finally:
        first.close()
        second.close()
    assert isinstance(outcome["second"], Conflict)
    session.expire_all()
    references = session.scalars(sa.select(Review).where(Review.state == "reference")).all()
    assert [review.id for review in references] == [mine["id"]]


# deleting a base study


async def test_a_base_study_with_a_review_source_is_not_deleted(clients, source, session):
    base_study_id = source.fulltext.base_study_id
    response = await clients[LEAD].delete(f"/api/base-studies/{base_study_id}")
    assert response.status_code == 409
    assert response.json()["title"] == "Conflict"
    assert response.json()["under_review"] == 1
    assert response.json()["detail"]
    session.expire_all()
    assert session.get(BaseStudy, base_study_id) is not None


async def test_a_base_study_with_two_review_sources_counts_both(clients, source, session):
    base_study = session.get(BaseStudy, source.fulltext.base_study_id)
    add_source(session, label="second upload", base_study=base_study, text=records.TEXT + " 2")
    response = await clients[LEAD].delete(f"/api/base-studies/{base_study.id}")
    assert response.status_code == 409
    assert response.json()["under_review"] == 2


async def test_an_unrelated_integrity_error_on_delete_is_not_a_conflict(clients, session):
    base_study = BaseStudy(name="no review", level="group")
    session.add(base_study)
    session.commit()
    unrelated = IntegrityError("DELETE", {}, Exception("some other constraint"))
    with mock.patch.object(ObjectView, "delete", side_effect=unrelated):
        response = await clients[LEAD].delete(f"/api/base-studies/{base_study.id}")
    assert response.status_code == 500
    assert "under_review" not in response.json()


async def test_a_base_study_without_one_is_deleted(clients, session):
    base_study = BaseStudy(name="no review", level="group")
    session.add(base_study)
    session.commit()
    base_study_id = base_study.id
    response = await clients[LEAD].delete(f"/api/base-studies/{base_study_id}")
    assert response.status_code == 200
    session.expire_all()
    assert session.get(BaseStudy, base_study_id) is None


# unknown reviews


async def test_an_unknown_review_is_not_found(clients):
    path = "/api/review/reviews/nope"
    assert (await clients[REVIEWER].get(path)).status_code == 404
    assert (await patch(clients[REVIEWER], "nope", {"state": "submitted"})).status_code == 404
    response = await clients[REVIEWER].post(f"{path}/ops", data=batch(0, accept("grp_a")))
    assert response.status_code == 404


# the response contract


async def test_the_responses_match_the_spec(clients, source, session):
    listed = await clients[REVIEWER].get("/api/review/sources/")
    assert_matches_spec(listed, "/review/sources/", "get")
    started = await clients[REVIEWER].put(f"/api/review/sources/{source.id}/review")
    assert_matches_spec(started, "/review/sources/{id}/review", "put")
    review_id = started.json()["id"]
    bundle = await clients[REVIEWER].get(f"/api/review/sources/{source.id}/bundle")
    assert_matches_spec(bundle, "/review/sources/{id}/bundle", "get")
    applied = await clients[REVIEWER].post(
        f"/api/review/reviews/{review_id}/ops", data=batch(0, set_name("grp_b", "x"))
    )
    assert_matches_spec(applied, "/review/reviews/{id}/ops", "post")
    read = await clients[REVIEWER].get(f"/api/review/reviews/{review_id}")
    assert_matches_spec(read, "/review/reviews/{id}", "get")
    submitted = await patch(clients[REVIEWER], review_id, {"state": "submitted"})
    assert_matches_spec(submitted, "/review/reviews/{id}", "patch")
    refused = await clients[LEAD].delete(f"/api/base-studies/{source.fulltext.base_study_id}")
    assert refused.status_code == 409
    assert_matches_spec(refused, "/base-studies/{id}", "delete")


# the hidden set


KEYS = [analysis["key"] for analysis in records.coordinate_parse()["analyses"]]
BEHIND_AN_1 = {"grp_a", "tsk_1", "cnd_1", "cnd_2", "dev_1", "acq_1", "mdl_1", "trm_1", "msr_1"}


def with_key(record, local_id, key):
    record = copy.deepcopy(record)
    for analysis in record["analyses"]:
        if analysis["local_id"] == local_id:
            analysis["source_table_analysis"] = fx.extracted(key)
    return record


def shown_analysis(record, local_id, cells=(), **links):
    """Append a copy of the first analysis with a coordinate key and the given links."""
    analysis = copy.deepcopy(record["analyses"][0])
    analysis.update({
        "local_id": local_id,
        "source_table_analysis": fx.extracted(KEYS[0]),
        "groups": [],
        "tasks": [],
        "acquisitions": [],
        "measure": None,
        "model_estimation": None,
    })
    analysis.update(links)
    analysis["effect"]["cells"] = [
        {"term": term, "level": fx.extracted("p"), "direction": fx.extracted("positive")}
        for term in cells
    ]
    record["analyses"].append(analysis)
    return analysis


def test_an_analysis_without_a_known_table_analysis_is_hidden():
    analyses = [
        fx.record_analysis("a_kept", KEYS[0], "kept"),
        fx.record_analysis("a_missing", KEYS[1], "missing"),
        fx.record_analysis("a_unreported", KEYS[1], "unreported"),
        fx.record_analysis("a_unknown", "analysis#ffffffffffffffff", "unknown"),
    ]
    del analyses[1]["source_table_analysis"]
    analyses[2]["source_table_analysis"] = {"extraction_status": "not_reported"}
    hidden = review_bundle.hidden(fx.record(analyses), records.coordinate_parse(), None, {})
    assert hidden == {"analyses": ["a_missing", "a_unreported", "a_unknown"], "entities": []}


def test_without_a_coordinate_parse_every_analysis_is_hidden():
    record = with_key(records.build(), "an_1", KEYS[0])
    assert review_bundle.hidden(record, None, None, {})["analyses"] == ["an_1"]


def test_entities_reached_only_through_a_hidden_analysis_are_hidden():
    hidden = review_bundle.hidden(records.build(), records.coordinate_parse(), None, {})
    assert hidden["analyses"] == ["an_1"]
    assert set(hidden["entities"]) == BEHIND_AN_1


def test_an_entity_a_shown_analysis_also_reaches_stays_shown():
    record = records.build()
    shown_analysis(record, "an_2", cells=["trm_1"], tasks=["tsk_1"])
    hidden = review_bundle.hidden(record, records.coordinate_parse(), None, {})
    assert hidden["analyses"] == ["an_1"]
    assert set(hidden["entities"]) == {"grp_a", "dev_1", "acq_1", "msr_1"}


def test_an_entity_a_shown_entity_references_stays_shown():
    record = records.build()
    record["acquisitions"].append(records.item("MRI", "acq_2", device="dev_1"))
    hidden = review_bundle.hidden(record, records.coordinate_parse(), None, {})
    assert "acq_1" in hidden["entities"]
    assert "dev_1" not in hidden["entities"]


def test_a_shown_analysis_a_hidden_one_references_stays_shown():
    record = records.build()
    mirror = records.item("Analysis", "an_2", name=fx.extracted("mirror"))
    mirror["source_table_analysis"] = fx.extracted(KEYS[1])
    record["analyses"].append(mirror)
    record["analyses"][0]["mirror_of"] = "an_2"
    hidden = review_bundle.hidden(record, records.coordinate_parse(), None, {})
    assert hidden["analyses"] == ["an_1"]
    assert "an_2" not in hidden["entities"]


def test_a_shown_analysis_that_references_a_hidden_one_hides_what_lies_behind_it():
    record = records.build()
    shown_analysis(record, "an_2", mirror_of="an_1")
    hidden = review_bundle.hidden(record, records.coordinate_parse(), None, {})
    assert hidden["analyses"] == ["an_1"]
    assert set(hidden["entities"]) == BEHIND_AN_1


def test_a_top_level_entity_stays_shown_when_only_its_child_is_reached_through_hidden_analyses():
    record = records.build()
    del record["analyses"][0]["model_estimation"]
    hidden = review_bundle.hidden(record, records.coordinate_parse(), None, {})
    assert "mdl_1" not in hidden["entities"]
    assert "trm_1" not in hidden["entities"]


async def test_starting_a_review_refuses_a_source_whose_record_no_longer_validates(
    clients, session
):
    record = records.golden()
    record["regions"][0]["bogus_slot"] = 1
    source = add_source(session, record=record)
    response = await clients[REVIEWER].put(f"/api/review/sources/{source.id}/review")
    assert response.status_code == 409
    body = response.json()
    assert "re-import the source" in body["detail"]
    assert [error["code"] for error in body["errors"]] == ["source_invalid"]
    assert "extraction-record /regions/0: Additional properties" in body["errors"][0]["message"]
    assert session.scalar(sa.select(Review).where(Review.source_id == source.id)) is None


# assignments


def assignment_path(base_study_id, user_id=None):
    path = f"/api/review/base-studies/{base_study_id}/assignments"
    return path if user_id is None else f"{path}/{user_id}"


async def assign(client, base_study_id, user_id):
    return await client.put(assignment_path(base_study_id, user_id))


async def release(client, base_study_id, user_id):
    return await client.delete(assignment_path(base_study_id, user_id))


async def assignees(client, base_study_id):
    response = await client.get(assignment_path(base_study_id))
    assert response.status_code == 200, response.json()
    return [row["user_id"] for row in response.json()["results"]]


async def test_a_reviewer_assigns_themselves_to_a_paper(clients, source):
    base_study_id = source.fulltext.base_study_id
    response = await assign(clients[REVIEWER], base_study_id, REVIEWER)

    assert response.status_code == 201
    assert response.json()["user_id"] == REVIEWER
    assert response.json()["name"] == f"name of {REVIEWER}"
    assert_matches_spec(response, "/review/base-studies/{id}/assignments/{user_id}", "put")
    assert await assignees(clients[OTHER], base_study_id) == [REVIEWER]


async def test_assigning_a_paper_again_to_the_same_user_is_idempotent(clients, source, session):
    base_study_id = source.fulltext.base_study_id
    first = await assign(clients[REVIEWER], base_study_id, REVIEWER)
    again = await assign(clients[REVIEWER], base_study_id, REVIEWER)

    assert (first.status_code, again.status_code) == (201, 200)
    assert again.json() == first.json()
    assert await assignees(clients[REVIEWER], base_study_id) == [REVIEWER]


async def test_a_reviewer_releases_their_own_assignment(clients, source):
    base_study_id = source.fulltext.base_study_id
    await assign(clients[REVIEWER], base_study_id, REVIEWER)

    response = await release(clients[REVIEWER], base_study_id, REVIEWER)

    assert response.status_code == 204
    assert_matches_spec(response, "/review/base-studies/{id}/assignments/{user_id}", "delete")
    assert await assignees(clients[REVIEWER], base_study_id) == []


async def test_a_reviewer_cannot_assign_or_release_another_user(clients, source, session):
    base_study_id = source.fulltext.base_study_id
    await assign(clients[LEAD], base_study_id, OTHER)

    assigned = await assign(clients[REVIEWER], base_study_id, REVIEWER)
    released = await release(clients[REVIEWER], base_study_id, OTHER)
    other_assigned = await assign(clients[REVIEWER], base_study_id, OTHER)

    assert assigned.status_code == 201
    assert (released.status_code, other_assigned.status_code) == (403, 403)
    assert_matches_spec(released, "/review/base-studies/{id}/assignments/{user_id}", "delete")
    assert sorted(await assignees(clients[REVIEWER], base_study_id)) == sorted([OTHER, REVIEWER])


async def test_a_lead_assigns_reassigns_and_releases_anyone(clients, source):
    base_study_id = source.fulltext.base_study_id

    to_reviewer = await assign(clients[LEAD], base_study_id, REVIEWER)
    to_other = await assign(clients[LEAD], base_study_id, OTHER)
    assert (to_reviewer.status_code, to_other.status_code) == (201, 201)
    assert to_reviewer.json()["assigned_by_id"] == LEAD

    reassigned = await release(clients[LEAD], base_study_id, REVIEWER)
    assert reassigned.status_code == 204
    assert await assignees(clients[LEAD], base_study_id) == [OTHER]

    released = await release(clients[LEAD], base_study_id, OTHER)
    assert released.status_code == 204
    assert await assignees(clients[LEAD], base_study_id) == []


async def test_releasing_an_assignment_that_is_not_there_is_not_an_error(clients, source):
    response = await release(clients[LEAD], source.fulltext.base_study_id, OTHER)

    assert response.status_code == 204


async def test_assigning_a_user_without_the_admin_reviewer_role_is_refused(
    clients, source, session, make_user
):
    make_user("newuser-id")
    base_study_id = source.fulltext.base_study_id

    plain = await assign(clients[LEAD], base_study_id, "newuser-id")
    unknown = await assign(clients[LEAD], base_study_id, "nobody-id")

    assert (plain.status_code, unknown.status_code) == (422, 422)
    assert_matches_spec(plain, "/review/base-studies/{id}/assignments/{user_id}", "put")
    assert "admin-reviewer" in plain.json()["detail"]
    assert await assignees(clients[LEAD], base_study_id) == []


async def test_the_assignment_routes_need_a_token_and_the_admin_reviewer_role(
    clients, source, make_user
):
    base_study_id = source.fulltext.base_study_id
    make_user(OTHER, "admin")
    expected = {None: 401, "newuser-id": 403, OTHER: 403}
    for user_id, status in expected.items():
        client = clients[user_id]
        responses = [
            await assign(client, base_study_id, REVIEWER),
            await release(client, base_study_id, REVIEWER),
            await client.get(assignment_path(base_study_id)),
        ]
        assert [r.status_code for r in responses] == [status] * 3, user_id


async def test_an_assignment_route_on_an_unknown_base_study_is_not_found(clients):
    responses = [
        await assign(clients[LEAD], "nope", REVIEWER),
        await release(clients[LEAD], "nope", REVIEWER),
        await clients[LEAD].get(assignment_path("nope")),
    ]
    assert [r.status_code for r in responses] == [404, 404, 404]
    assert_matches_spec(responses[2], "/review/base-studies/{id}/assignments", "get")


async def test_the_assignees_of_a_paper_list_their_names(clients, source):
    base_study_id = source.fulltext.base_study_id
    await assign(clients[LEAD], base_study_id, OTHER)
    await assign(clients[LEAD], base_study_id, REVIEWER)

    response = await clients[REVIEWER].get(assignment_path(base_study_id))

    assert response.status_code == 200
    assert_matches_spec(response, "/review/base-studies/{id}/assignments", "get")
    assert {row["user_id"]: row["name"] for row in response.json()["results"]} == {
        OTHER: f"name of {OTHER}",
        REVIEWER: f"name of {REVIEWER}",
    }


async def test_the_source_list_carries_each_papers_assignees(clients, source, session):
    await assign(clients[REVIEWER], source.fulltext.base_study_id, REVIEWER)

    response = await clients[OTHER].get("/api/review/sources/")

    [row] = response.json()["results"]
    assert row["assignees"] == [{"user_id": REVIEWER, "name": f"name of {REVIEWER}"}]
    assert_matches_spec(response, "/review/sources/", "get")


async def test_the_source_list_filters_to_the_papers_assigned_to_the_caller(
    clients, source, session
):
    other = add_source(session, label="Another paper")
    await assign(clients[REVIEWER], source.fulltext.base_study_id, REVIEWER)
    await assign(clients[LEAD], other.fulltext.base_study_id, OTHER)

    response = await clients[REVIEWER].get("/api/review/sources/", params={"assigned": "me"})

    assert [row["id"] for row in response.json()["results"]] == [source.id]
    assert response.json()["metadata"] == {"total_count": 1}


async def test_the_source_list_reads_the_assignees_in_one_query_per_page(
    clients, session, statements
):
    async def list_queries():
        with statements() as seen:
            response = await clients[REVIEWER].get("/api/review/sources/")
        assert response.status_code == 200
        return sum("review_assignments" in s for s in seen), len(response.json()["results"])

    first = add_source(session, label="paper 0")
    await assign(clients[REVIEWER], first.fulltext.base_study_id, REVIEWER)
    one, rows = await list_queries()
    assert rows == 1
    for n in range(1, 4):
        more = add_source(session, label=f"paper {n}")
        await assign(clients[LEAD], more.fulltext.base_study_id, OTHER)
    four, rows = await list_queries()
    assert rows == 4
    assert one == four == 1


async def test_the_source_list_carries_each_reviewers_last_edit_and_op_count(
    clients, source
):
    review = await start(clients, source)
    applied = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops",
        data=batch(0, set_name("grp_b", "x"), set_name("grp_a", "y")),
    )
    assert applied.status_code == 200, applied.json()

    response = await clients[REVIEWER].get("/api/review/sources/")

    [progress] = response.json()["results"][0]["reviews"]
    assert progress["op_count"] == 2
    assert progress["last_edit_at"] is not None
    assert_matches_spec(response, "/review/sources/", "get")


async def test_the_source_list_takes_the_last_edit_from_the_latest_batch(clients, source):
    review = await start(clients, source)
    url = f"/api/review/reviews/{review['id']}/ops"
    await clients[REVIEWER].post(url, data=batch(0, set_name("grp_b", "x")))
    second = await clients[REVIEWER].post(
        url, data=batch(1, set_name("grp_a", "y"), set_name("grp_b", "z"))
    )
    assert second.status_code == 200, second.json()

    response = await clients[REVIEWER].get("/api/review/sources/")

    [progress] = response.json()["results"][0]["reviews"]
    assert progress["op_count"] == 3
    assert progress["last_edit_at"] == second.json()["ops"][-1]["created_at"]

    inverse = with_ids(second.json()["ops"][-1]["inverse"])
    undone = await clients[REVIEWER].post(url, data=batch(3, *inverse))
    assert undone.status_code == 200, undone.json()

    response = await clients[REVIEWER].get("/api/review/sources/")

    [progress] = response.json()["results"][0]["reviews"]
    assert progress["op_count"] == 4
    assert progress["last_edit_at"] == undone.json()["ops"][-1]["created_at"]
    assert progress["last_edit_at"] != second.json()["ops"][-1]["created_at"]


async def test_a_refused_batch_changes_neither_the_op_count_nor_the_last_edit(
    clients, source
):
    review = await start(clients, source)
    url = f"/api/review/reviews/{review['id']}/ops"
    applied = await clients[REVIEWER].post(url, data=batch(0, set_name("grp_b", "x")))
    refused = await clients[REVIEWER].post(url, data=batch(1, set_name("nope", "y")))
    assert refused.status_code == 422

    response = await clients[REVIEWER].get("/api/review/sources/")

    [progress] = response.json()["results"][0]["reviews"]
    assert progress["op_count"] == 1
    assert progress["last_edit_at"] == applied.json()["ops"][0]["created_at"]


async def test_the_source_list_never_reads_the_op_log(clients, source, statements):
    review = await start(clients, source)
    applied = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(0, set_name("grp_b", "x"))
    )
    assert applied.status_code == 200, applied.json()

    with statements() as seen:
        response = await clients[REVIEWER].get("/api/review/sources/")

    assert response.status_code == 200
    assert response.json()["results"][0]["reviews"][0]["op_count"] == 1
    assert [s for s in seen if "review_ops" in s] == []


async def test_a_reviewer_lists_the_admin_reviewers_to_assign(clients, make_user):
    make_user("newuser-id")
    response = await clients[REVIEWER].get("/api/review/reviewers/")

    assert response.status_code == 200
    assert_matches_spec(response, "/review/reviewers/", "get")
    assert {row["user_id"] for row in response.json()["results"]} == {REVIEWER, OTHER, LEAD}
    assert (await clients["newuser-id"].get("/api/review/reviewers/")).status_code == 403


async def test_the_caller_gets_their_own_id_name_and_whether_they_lead(clients):
    as_reviewer = await clients[REVIEWER].get("/api/review/me")
    as_lead = await clients[LEAD].get("/api/review/me")

    assert as_reviewer.status_code == 200
    assert as_reviewer.json() == {
        "user_id": REVIEWER,
        "name": f"name of {REVIEWER}",
        "lead": False,
    }
    assert as_lead.json() == {"user_id": LEAD, "name": f"name of {LEAD}", "lead": True}
    assert_matches_spec(as_lead, "/review/me", "get")


async def test_the_reviewer_list_is_only_the_reviewers(clients):
    response = await clients[REVIEWER].get("/api/review/reviewers/")

    assert set(response.json()) == {"results"}


# a failed commit


def failing_commit(monkeypatch, session, reviewer):
    """Make the views run in the test's session as ``reviewer``, with a commit that fails."""
    monkeypatch.setattr(review_views, "get_current_user", lambda: reviewer)

    def commit():
        raise IntegrityError("COMMIT", {}, Exception("forced"))

    monkeypatch.setattr(db.session, "commit", commit)


def test_a_review_start_whose_commit_fails_is_rolled_back(
    monkeypatch, session, source, make_user
):
    failing_commit(monkeypatch, session, make_user(REVIEWER, "admin-reviewer"))
    with pytest.raises(IntegrityError):
        review_views.SourceReviewsView().put(source.id)

    assert session.scalars(sa.select(Review).where(Review.source_id == source.id)).all() == []


@pytest.mark.parametrize("method", ["put", "delete"])
def test_an_assignment_whose_commit_fails_is_rolled_back(
    monkeypatch, session, source, make_user, method
):
    base_study_id = source.fulltext.base_study_id
    reviewer = make_user(REVIEWER, "admin-reviewer")
    if method == "delete":
        session.add(ReviewAssignment(
            base_study_id=base_study_id, user_id=REVIEWER, assigned_by_id=REVIEWER
        ))
        session.commit()
    before = session.scalars(sa.select(ReviewAssignment.user_id)).all()
    failing_commit(monkeypatch, session, reviewer)
    with pytest.raises(IntegrityError):
        getattr(review_views.ReviewAssignmentsView(), method)(base_study_id, REVIEWER)

    assert session.scalars(sa.select(ReviewAssignment.user_id)).all() == before
