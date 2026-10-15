"""Tests of the /review API and its hidden set."""

import copy
import itertools
import threading
import time
from unittest import mock

import pytest
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from neurostore.exceptions.base import ConflictError
from neurostore.models import BaseStudy, Fulltext, Review, ReviewOp, ReviewSource
from neurostore.resources.base import ObjectView
from neurostore.review import bundle as review_bundle
from neurostore.review import entities, service
from neurostore.review.bundle import validator
from neurostore.study_schema_tools import sha256_of
from neurostore.tests import study_schema_fixtures as fx
from neurostore.tests.review import records
from neurostore.tests.review.layouts import LEAD, OTHER, REVIEWER, assert_matches_spec

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
        origin="upload",
        label=label,
        schema_versions={"paper_parse": "0.6.0", "extraction": "0.5.0"},
        record_sha256=sha256_of({"label": label, "record": record}),
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


# listing sources


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
    assert bundle["hidden"] == review_bundle.hidden(source.record, source.coordinate_parse)
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
    expected = review_bundle.hidden(bundle["record"], source.coordinate_parse)
    assert expected["analyses"] == ["an_1"]
    assert "grp_a" in expected["entities"]
    assert bundle["hidden"] == expected
    assert applied.json()["hidden"] == expected


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
    assert bundle["ops"] == result["ops"]
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
    assert read.json()["ops"] == result["ops"]
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
    assert result["hidden"] == review_bundle.hidden(result["record"], source.coordinate_parse)


async def test_only_the_owner_posts_ops(clients, source):
    review = await start(clients, source)
    response = await clients[OTHER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(0, accept("grp_a"))
    )
    assert response.status_code == 403


async def test_an_op_the_core_refuses_is_unprocessable(clients, source, session):
    review = await start(clients, source)
    response = await clients[REVIEWER].post(
        f"/api/review/reviews/{review['id']}/ops", data=batch(0, accept("grp_nope"))
    )
    assert response.status_code == 422
    assert response.json()["title"] == "Unprocessable Entity"
    [error] = response.json()["errors"]
    assert "grp_nope" in error["context"]["provided"]
    session.expire_all()
    assert session.get(Review, review["id"]).last_seq == 0


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
        except ConflictError as conflict:
            second.rollback()
            outcome["second"] = conflict.to_payload()
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
    assert outcome["second"]["last_seq"] == 1, outcome["second"]
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
            service.set_state(second, theirs["id"], LEAD, "reference", is_admin=True)
            second.commit()
            outcome["second"] = "applied"
        except Exception as error:
            second.rollback()
            outcome["second"] = error
        finally:
            finished.set()

    try:
        service.set_state(first, mine["id"], LEAD, "reference", is_admin=True)
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
    assert isinstance(outcome["second"], ConflictError)
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
    hidden = review_bundle.hidden(fx.record(analyses), records.coordinate_parse())
    assert hidden == {"analyses": ["a_missing", "a_unreported", "a_unknown"], "entities": []}


def test_without_a_coordinate_parse_every_analysis_is_hidden():
    record = with_key(records.build(), "an_1", KEYS[0])
    assert review_bundle.hidden(record, None)["analyses"] == ["an_1"]


def test_entities_reached_only_through_a_hidden_analysis_are_hidden():
    hidden = review_bundle.hidden(records.build(), records.coordinate_parse())
    assert hidden["analyses"] == ["an_1"]
    assert set(hidden["entities"]) == BEHIND_AN_1


def test_an_entity_a_shown_analysis_also_reaches_stays_shown():
    record = records.build()
    shown_analysis(record, "an_2", cells=["trm_1"], tasks=["tsk_1"])
    hidden = review_bundle.hidden(record, records.coordinate_parse())
    assert hidden["analyses"] == ["an_1"]
    assert set(hidden["entities"]) == {"grp_a", "dev_1", "acq_1", "msr_1"}


def test_an_entity_a_shown_entity_references_stays_shown():
    record = records.build()
    record["acquisitions"].append(records.item("MRI", "acq_2", device="dev_1"))
    hidden = review_bundle.hidden(record, records.coordinate_parse())
    assert "acq_1" in hidden["entities"]
    assert "dev_1" not in hidden["entities"]


def test_a_shown_analysis_a_hidden_one_references_stays_shown():
    record = records.build()
    mirror = records.item("Analysis", "an_2", name=fx.extracted("mirror"))
    mirror["source_table_analysis"] = fx.extracted(KEYS[1])
    record["analyses"].append(mirror)
    record["analyses"][0]["mirror_of"] = "an_2"
    hidden = review_bundle.hidden(record, records.coordinate_parse())
    assert hidden["analyses"] == ["an_1"]
    assert "an_2" not in hidden["entities"]


def test_a_shown_analysis_that_references_a_hidden_one_hides_what_lies_behind_it():
    record = records.build()
    shown_analysis(record, "an_2", mirror_of="an_1")
    hidden = review_bundle.hidden(record, records.coordinate_parse())
    assert hidden["analyses"] == ["an_1"]
    assert set(hidden["entities"]) == BEHIND_AN_1


def test_a_top_level_entity_stays_shown_when_only_its_child_is_reached_through_hidden_analyses():
    record = records.build()
    del record["analyses"][0]["model_estimation"]
    hidden = review_bundle.hidden(record, records.coordinate_parse())
    assert "mdl_1" not in hidden["entities"]
    assert "trm_1" not in hidden["entities"]
