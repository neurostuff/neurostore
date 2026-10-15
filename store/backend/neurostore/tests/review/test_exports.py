"""Exporting reviews as study_schema layouts: one review, bulk trees, the routes and the CLI."""

import io
import json
import zipfile
from datetime import datetime, timezone

import pytest
import sqlalchemy as sa
from click.testing import CliRunner

from neurostore import cli
from neurostore.database import db
from neurostore.exceptions.base import NotFoundError
from neurostore.models import BaseStudy, ReviewOp, ReviewSource
from neurostore.review import ReviewError, exports, imports, service
from neurostore.review.layout import _dumped, read_layout
from neurostore.study_schema_tools import schema_errors
from neurostore.tests.review.layouts import (
    LEAD,
    OTHER,
    REVIEWER,
    TEXT,
    assert_binary_matches_spec,
    assert_matches_spec,
    documents,
    dump,
    dump_unusual,
    write_layout,
)

pytestmark = pytest.mark.anyio

PAPER_ID = "art-s1"
COORDINATE_KEY = documents("s1")[1]["analyses"][0]["key"]


def write_clean(root, study_id="s1", dumps=dump, extraction=None):
    paper, coordinate_parse, record = documents(study_id)
    paper["source"] = "pubget"
    paper["header"]["article_id"] = f"art-{study_id}"
    return write_layout(
        root, study_id, paper, coordinate_parse, extraction or record, dumps=dumps
    )


def exported_name(relative, paper_id=PAPER_ID):
    """The name a paper's file has after export: the paper is renamed to its article id."""
    return relative.replace("corpus/s1/", f"corpus/{paper_id}/").replace(
        "records/s1.", f"records/{paper_id}."
    )


def load(session, root, study_id="s1", dumps=dump):
    """Write a clean paper under ``root``, load it and return (its files, its source id)."""
    files = write_clean(root, study_id, dumps)
    session.add(BaseStudy(name="a paper", level="group", pmid=study_id))
    session.commit()
    report = imports.import_layout(session, root, user_id=REVIEWER)
    session.commit()
    assert report["failed"] == [], report
    return files, report["loaded"][0]["source_id"]


def set_name(entity, name):
    return {
        "client_op_id": f"set-{entity}-{name}",
        "type": "set_value",
        "target": {"kind": "slot", "entity": entity, "path": "name"},
        "value": {"extraction_status": "extracted", "value": name, "value_source": "reported"},
    }


def omit(key):
    return {
        "client_op_id": f"omit-{key}",
        "type": "coordinate",
        "target": {"kind": "coordinate_analysis", "analysis_key": key},
        "action": "omit",
    }


def edit(session, source_id, user_id, *ops):
    summary, _ = service.start_review(session, source_id, user_id)
    if ops:
        service.post_ops(
            session, summary["id"], user_id, {"expected_last_seq": 0, "ops": list(ops)}
        )
    session.commit()
    return summary["id"]


def assert_as_loaded(root, files, paper_id=PAPER_ID):
    """Every file of the paper under ``root``: each JSON document equal to the loaded one and
    written as the layout dumps it, the text byte for byte."""
    for relative, data in files.items():
        exported = (root / exported_name(relative, paper_id)).read_bytes()
        if relative.endswith(".json"):
            assert json.loads(exported) == json.loads(data), relative
            assert exported == _dumped(json.loads(exported)), relative
        else:
            assert exported == data, relative


def tree(user_id, study_id):
    """The record path of study ``study_id``'s review in the tree of ``user_id``."""
    return f"{user_id}/run/records/art-{study_id}.extraction.json"


def as_loaded(study_id):
    return f"{exports.SOURCE_DIR}/run/records/art-{study_id}.extraction.json"


@pytest.fixture
def reviewers(make_user):
    make_user(REVIEWER, "admin-reviewer")
    make_user(OTHER, "admin-reviewer")


def test_the_round_trip_gives_back_every_source_file_as_loaded(
    session, reviewers, tmp_path
):
    files, _ = load(session, tmp_path / "in", dumps=dump_unusual)

    exports.export_bulk(session, tmp_path / "out", include_unreviewed=True)

    assert_as_loaded(tmp_path / "out" / "_source", files)
    assert not (tmp_path / "out" / "_source" / "review").exists()
    assert not (tmp_path / "out" / "_source" / "run" / "revisions").exists()


def test_a_paper_without_an_article_id_exports_under_its_base_study_id(
    session, reviewers, tmp_path
):
    files, source_id = load(session, tmp_path / "in")
    source = session.get(ReviewSource, source_id)
    header = {k: v for k, v in source.parsed_paper["header"].items() if k != "article_id"}
    source.parsed_paper = {**source.parsed_paper, "header": header}
    session.commit()
    base_study_id = source.fulltext.base_study_id

    manifest = exports.export_bulk(session, tmp_path / "out", include_unreviewed=True)

    root = tmp_path / "out" / "_source"
    assert [entry["path"] for entry in manifest] == [
        f"_source/run/records/{base_study_id}.extraction.json"
    ]
    assert (root / f"corpus/{base_study_id}/text/paper.txt").read_bytes() == TEXT.encode("utf-8")
    record = json.loads((root / f"run/records/{base_study_id}.extraction.json").read_text())
    assert record == json.loads(files["run/records/s1.extraction.json"])


def test_an_unedited_review_exports_its_documents_and_an_empty_ops_file(
    session, reviewers, tmp_path
):
    files, source_id = load(session, tmp_path / "in", dumps=dump_unusual)
    review_id = edit(session, source_id, REVIEWER)

    exports.export_review(session, review_id, tmp_path / "out")

    assert_as_loaded(tmp_path / "out", files)
    assert (tmp_path / "out" / f"review/{PAPER_ID}.ops.jsonl").read_bytes() == b""
    assert not (tmp_path / "out" / "run" / "revisions").exists()


def test_an_edited_review_exports_its_record_marked_as_a_review_version(
    session, reviewers, tmp_path
):
    _, source_id = load(session, tmp_path / "in")
    review_id = edit(session, source_id, REVIEWER, set_name("a1", "Faces versus houses"))

    exports.export_review(session, review_id, tmp_path / "out")

    review = service.get_review(session, review_id)
    record = json.loads((tmp_path / "out" / f"run/records/{PAPER_ID}.extraction.json").read_text())
    metadata = record.pop("extraction_metadata")
    expected = {k: v for k, v in review["record"].items() if k != "extraction_metadata"}
    assert record == expected
    assert record["analyses"][0]["name"]["value"] == "Faces versus houses"
    assert metadata["repaired_by"] == f"neurostore-review/{review_id}"
    assert metadata["extraction_date"] == review["ops"][-1]["created_at"][:10]
    assert schema_errors("extraction-record", {**record, "extraction_metadata": metadata}) == []


def test_a_review_that_only_omits_a_coordinate_exports_the_loaded_record(
    session, reviewers, tmp_path
):
    files, source_id = load(session, tmp_path / "in")
    review_id = edit(session, source_id, REVIEWER, omit(COORDINATE_KEY))

    exports.export_review(session, review_id, tmp_path / "out")

    record = json.loads((tmp_path / "out" / f"run/records/{PAPER_ID}.extraction.json").read_text())
    assert record == json.loads(files["run/records/s1.extraction.json"])
    assert "repaired_by" not in record["extraction_metadata"]


def test_the_extraction_date_of_a_marked_record_is_the_day_of_the_last_op(
    session, reviewers, tmp_path
):
    _, source_id = load(session, tmp_path / "in")
    review_id = edit(session, source_id, REVIEWER, set_name("a1", "one"), omit(COORDINATE_KEY))
    first, last = session.scalars(
        sa.select(ReviewOp).where(ReviewOp.review_id == review_id).order_by(ReviewOp.seq)
    ).all()
    first.created_at = datetime(2026, 10, 1, 9, tzinfo=timezone.utc)
    last.created_at = datetime(2026, 10, 3, 18, tzinfo=timezone.utc)
    session.commit()

    exports.export_review(session, review_id, tmp_path / "out")

    record = json.loads((tmp_path / "out" / f"run/records/{PAPER_ID}.extraction.json").read_text())
    assert record["extraction_metadata"]["extraction_date"] == "2026-10-03"


def test_the_ops_file_holds_the_ops_in_seq_order(session, reviewers, tmp_path):
    _, source_id = load(session, tmp_path / "in")
    review_id = edit(
        session, source_id, REVIEWER, set_name("a1", "x"), omit(COORDINATE_KEY)
    )

    exports.export_review(session, review_id, tmp_path / "out")

    lines = (tmp_path / "out" / f"review/{PAPER_ID}.ops.jsonl").read_text("utf-8").splitlines()
    exported = [json.loads(line) for line in lines]
    assert [op["seq"] for op in exported] == [1, 2]
    assert [op["op"]["client_op_id"] for op in exported] == [
        "set-a1-x",
        f"omit-{COORDINATE_KEY}",
    ]
    assert set(exported[0]) == {"seq", "op", "before", "after", "user_id", "created_at"}


def test_a_coordinate_op_writes_a_revision_that_validates(session, reviewers, tmp_path):
    _, source_id = load(session, tmp_path / "in")
    review_id = edit(session, source_id, REVIEWER, omit(COORDINATE_KEY))

    exports.export_review(session, review_id, tmp_path / "out")

    revision_path = tmp_path / "out" / f"run/revisions/{PAPER_ID}.coordinate_parse.json"
    revision = json.loads(revision_path.read_text("utf-8"))
    assert schema_errors("coordinate-parse", revision) == []
    assert revision_path.read_bytes() == _dumped(revision)
    assert COORDINATE_KEY not in [analysis["key"] for analysis in revision["analyses"]]
    assert revision == service.get_review(session, review_id)["coordinate_revision"]


def test_reimporting_an_edited_export_loads_a_new_source(session, reviewers, tmp_path):
    _, source_id = load(session, tmp_path / "in")
    review_id = edit(session, source_id, REVIEWER, set_name("a1", "Faces versus houses"))
    exports.export_review(session, review_id, tmp_path / "out")

    report = imports.import_layout(session, tmp_path / "out", user_id=REVIEWER)
    session.commit()

    assert report["failed"] == []
    assert report["skipped"] == []
    [loaded] = report["loaded"]
    assert loaded["source_id"] != source_id
    exported = json.loads(
        (tmp_path / "out" / f"run/records/{PAPER_ID}.extraction.json").read_text()
    )
    assert session.get(ReviewSource, loaded["source_id"]).record == exported


def test_two_reviewers_of_one_source_get_two_trees(session, reviewers, tmp_path):
    _, source_id = load(session, tmp_path / "in")
    edit(session, source_id, REVIEWER, set_name("a1", "one"))
    edit(session, source_id, OTHER, set_name("a1", "two"))

    manifest = exports.export_bulk(session, tmp_path / "out")

    assert sorted(entry["user_id"] for entry in manifest) == sorted([REVIEWER, OTHER])
    for user_id, value in ((REVIEWER, "one"), (OTHER, "two")):
        record = json.loads(
            (tmp_path / "out" / user_id / f"run/records/{PAPER_ID}.extraction.json").read_text()
        )
        assert record["analyses"][0]["name"]["value"] == value


def test_each_reviewer_tree_holds_its_marked_record_its_revision_and_its_ops(
    session, reviewers, tmp_path
):
    _, source_id = load(session, tmp_path / "in")
    first = edit(session, source_id, REVIEWER, set_name("a1", "one"), omit(COORDINATE_KEY))
    second = edit(session, source_id, OTHER, set_name("a1", "two"))
    reviews = {
        REVIEWER: service.get_review(session, first),
        OTHER: service.get_review(session, second),
    }

    exports.export_bulk(session, tmp_path / "out")

    for user_id, review in reviews.items():
        root = tmp_path / "out" / user_id
        record = json.loads((root / f"run/records/{PAPER_ID}.extraction.json").read_text())
        marker = f"neurostore-review/{review['id']}"
        assert record["extraction_metadata"]["repaired_by"] == marker
        assert record["analyses"][0]["name"] == review["record"]["analyses"][0]["name"]
        lines = (root / f"review/{PAPER_ID}.ops.jsonl").read_text("utf-8").splitlines()
        seqs = [json.loads(line)["seq"] for line in lines]
        assert seqs == [op["seq"] for op in review["ops"]]
    revision = json.loads(
        (tmp_path / "out" / REVIEWER / f"run/revisions/{PAPER_ID}.coordinate_parse.json")
        .read_text()
    )
    assert revision == reviews[REVIEWER]["coordinate_revision"]
    assert not (tmp_path / "out" / OTHER / "run" / "revisions").exists()


def reviewed_papers(session, tmp_path):
    """Paper s1 reviewed by REVIEWER (submitted) and OTHER, paper s2 reviewed by REVIEWER, and
    paper s3 unreviewed. Returns the source ids by study and the review ids by (study, user)."""
    sources = {
        study_id: load(session, tmp_path / f"in-{study_id}", study_id=study_id)[1]
        for study_id in ("s1", "s2", "s3")
    }
    reviews = {
        ("s1", REVIEWER): edit(session, sources["s1"], REVIEWER, set_name("a1", "one")),
        ("s1", OTHER): edit(session, sources["s1"], OTHER, set_name("a1", "two")),
        ("s2", REVIEWER): edit(session, sources["s2"], REVIEWER, set_name("a1", "three")),
    }
    service.set_state(session, reviews[("s1", REVIEWER)], REVIEWER, "submitted", is_admin=False)
    session.commit()
    return sources, reviews


def test_the_bulk_filters_select_sources_and_reviews(session, reviewers, tmp_path):
    _, source_one = load(session, tmp_path / "in", study_id="s1")
    _, source_two = load(session, tmp_path / "in", study_id="s2")
    _, unreviewed = load(session, tmp_path / "in", study_id="s3")
    review_one = edit(session, source_one, REVIEWER, set_name("a1", "one"))
    review_two = edit(session, source_two, OTHER, set_name("a1", "two"))
    service.set_state(session, review_one, REVIEWER, "submitted", is_admin=False)
    session.commit()
    base_two = session.get(ReviewSource, source_two).fulltext.base_study_id

    def selected(**filters):
        manifest = exports.export_bulk(session, tmp_path / "out", **filters)
        return {(e["source_id"], e["review_id"], e["state"]) for e in manifest}

    assert selected(source_ids=[source_one]) == {(source_one, review_one, "submitted")}
    assert selected(base_study_ids=[base_two]) == {(source_two, review_two, "in_progress")}
    assert selected(user_ids=[REVIEWER]) == {(source_one, review_one, "submitted")}
    assert selected(states=["in_progress"]) == {(source_two, review_two, "in_progress")}
    assert selected() == {
        (source_one, review_one, "submitted"),
        (source_two, review_two, "in_progress"),
    }
    assert selected(include_unreviewed=True) == {
        (source_one, review_one, "submitted"),
        (source_two, review_two, "in_progress"),
        (unreviewed, None, None),
    }
    assert selected(user_ids=[], states=[], source_ids=[], base_study_ids=[]) == {
        (source_one, review_one, "submitted"),
        (source_two, review_two, "in_progress"),
    }


def test_the_source_and_base_study_filters_must_both_match(session, reviewers, tmp_path):
    sources, _ = reviewed_papers(session, tmp_path)
    base_two = session.get(ReviewSource, sources["s2"]).fulltext.base_study_id

    manifest = exports.export_bulk(
        session, tmp_path / "out", source_ids=[sources["s1"]], base_study_ids=[base_two]
    )

    assert manifest == []


def test_the_reviewer_and_state_filters_must_both_match(session, reviewers, tmp_path):
    sources, reviews = reviewed_papers(session, tmp_path)

    def selected(**filters):
        manifest = exports.export_bulk(session, tmp_path / "out", **filters)
        return {(e["source_id"], e["review_id"]) for e in manifest}

    assert selected(user_ids=[OTHER], states=["submitted"]) == set()
    assert selected(user_ids=[REVIEWER], states=["submitted"]) == {
        (sources["s1"], reviews[("s1", REVIEWER)])
    }


@pytest.mark.parametrize("filters", [{"user_ids": [REVIEWER]}, {"states": ["submitted"]}])
def test_include_unreviewed_with_a_reviewer_or_state_filter_is_refused(
    session, reviewers, tmp_path, filters
):
    _, source_id = load(session, tmp_path / "in")

    with pytest.raises(ReviewError):
        exports.export_bulk(session, tmp_path / "out", include_unreviewed=True, **filters)


def test_include_unreviewed_with_empty_filter_lists_is_allowed(session, reviewers, tmp_path):
    _, source_id = load(session, tmp_path / "in")

    manifest = exports.export_bulk(
        session, tmp_path / "out", include_unreviewed=True, user_ids=[], states=[]
    )

    assert [entry["path"] for entry in manifest] == [
        f"_source/run/records/{PAPER_ID}.extraction.json"
    ]


def test_an_unknown_review_is_not_found_by_the_export(session, reviewers, tmp_path):
    with pytest.raises(NotFoundError):
        exports.export_review(session, "nope", tmp_path / "out")


async def test_the_review_export_route_refuses_anyone_without_a_token(
    clients, session, reviewers, tmp_path
):
    _, source_id = load(session, tmp_path / "in")
    review_id = edit(session, source_id, REVIEWER)

    response = await clients[None].get(f"/api/review/reviews/{review_id}/export")

    assert response.status_code == 401
    assert_matches_spec(response, "/review/reviews/{id}/export", "get")


async def test_the_review_export_route_refuses_a_user_without_the_role(
    clients, session, reviewers, tmp_path
):
    _, source_id = load(session, tmp_path / "in")
    review_id = edit(session, source_id, REVIEWER)

    response = await clients["newuser-id"].get(f"/api/review/reviews/{review_id}/export")

    assert response.status_code == 403
    assert_matches_spec(response, "/review/reviews/{id}/export", "get")


async def test_any_reviewer_gets_the_review_export_as_a_zip(
    clients, session, reviewers, tmp_path
):
    _, source_id = load(session, tmp_path / "in")
    review_id = edit(session, source_id, REVIEWER, set_name("a1", "one"))

    response = await clients[OTHER].get(f"/api/review/reviews/{review_id}/export")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert response.headers["content-disposition"] == (
        f'attachment; filename="review-{review_id}.zip"'
    )
    archive = tmp_path / "review.zip"
    archive.write_bytes(response.content)
    [paper] = read_layout(archive)
    assert paper.study_id == PAPER_ID
    assert paper.record["analyses"][0]["name"]["value"] == "one"
    assert paper.text == TEXT
    assert_binary_matches_spec(response, "/review/reviews/{id}/export", "get")


async def test_an_unknown_review_export_is_not_found(clients):
    response = await clients[REVIEWER].get("/api/review/reviews/nope/export")

    assert response.status_code == 404
    assert_matches_spec(response, "/review/reviews/{id}/export", "get")


async def test_the_bulk_export_route_refuses_anyone_without_a_token(clients):
    response = await clients[None].post("/api/review/exports/", data={})

    assert response.status_code == 401
    assert_matches_spec(response, "/review/exports/", "post")


async def test_the_bulk_export_route_refuses_a_user_without_the_role(clients):
    response = await clients["newuser-id"].post("/api/review/exports/", data={})

    assert response.status_code == 403
    assert_matches_spec(response, "/review/exports/", "post")


async def test_the_bulk_export_route_refuses_include_unreviewed_with_a_filter(
    clients, session, reviewers, tmp_path
):
    load(session, tmp_path / "in")

    response = await clients[LEAD].post(
        "/api/review/exports/", data={"include_unreviewed": True, "states": ["submitted"]}
    )

    assert response.status_code == 422


async def test_the_bulk_export_route_zips_the_filtered_reviews(
    clients, session, reviewers, tmp_path
):
    _, source_id = load(session, tmp_path / "in")
    edit(session, source_id, REVIEWER, set_name("a1", "one"))

    response = await clients[LEAD].post(
        "/api/review/exports/", data={"user_ids": [REVIEWER], "source_ids": [source_id]}
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    assert f"{REVIEWER}/run/records/{PAPER_ID}.extraction.json" in archive.namelist()
    assert_binary_matches_spec(response, "/review/exports/", "post")


async def test_each_bulk_export_body_filter_changes_the_zip(
    clients, session, reviewers, tmp_path
):
    sources, _ = reviewed_papers(session, tmp_path)
    base_ids = {
        study_id: session.get(ReviewSource, source_id).fulltext.base_study_id
        for study_id, source_id in sources.items()
    }

    async def records(body):
        response = await clients[LEAD].post("/api/review/exports/", data=body)
        assert response.status_code == 200, body
        names = zipfile.ZipFile(io.BytesIO(response.content)).namelist()
        return {name for name in names if name.endswith(".extraction.json")}

    everything = {tree(REVIEWER, "s1"), tree(OTHER, "s1"), tree(REVIEWER, "s2")}
    assert await records({}) == everything
    assert await records({"user_ids": [REVIEWER]}) == {
        tree(REVIEWER, "s1"),
        tree(REVIEWER, "s2"),
    }
    assert await records({"source_ids": [sources["s2"]]}) == {tree(REVIEWER, "s2")}
    assert await records({"base_study_ids": [base_ids["s2"]]}) == {tree(REVIEWER, "s2")}
    assert await records({"states": ["submitted"]}) == {tree(REVIEWER, "s1")}
    assert await records({"include_unreviewed": True}) == everything | {as_loaded("s3")}


async def test_the_bulk_export_route_round_trip_reads_back_and_reimports(
    clients, session, reviewers, tmp_path
):
    sources, _ = reviewed_papers(session, tmp_path)

    response = await clients[LEAD].post("/api/review/exports/", data={"include_unreviewed": True})

    assert response.status_code == 200
    extracted = tmp_path / "zip"
    zipfile.ZipFile(io.BytesIO(response.content)).extractall(extracted)
    trees = {
        name: read_layout(extracted / name)
        for name in (REVIEWER, OTHER, exports.SOURCE_DIR)
    }
    assert [paper.study_id for paper in trees[REVIEWER]] == [PAPER_ID, "art-s2"]
    assert [paper.study_id for paper in trees[OTHER]] == [PAPER_ID]
    assert [paper.study_id for paper in trees[exports.SOURCE_DIR]] == ["art-s3"]

    as_loaded_report = imports.import_layout(
        session, extracted / exports.SOURCE_DIR, user_id=REVIEWER
    )
    session.commit()
    assert as_loaded_report["loaded"] == []
    assert [
        (skipped["study_id"], skipped["source_id"], skipped["reason"])
        for skipped in as_loaded_report["skipped"]
    ] == [("art-s3", sources["s3"], "already loaded")]

    edited = imports.import_layout(session, extracted / REVIEWER, user_id=REVIEWER)
    session.commit()
    assert edited["failed"] == [] and edited["skipped"] == []
    assert [loaded["study_id"] for loaded in edited["loaded"]] == [PAPER_ID, "art-s2"]
    for loaded in edited["loaded"]:
        exported = json.loads(
            (extracted / REVIEWER / f"run/records/{loaded['study_id']}.extraction.json")
            .read_text()
        )
        assert session.get(ReviewSource, loaded["source_id"]).record == exported
        assert loaded["source_id"] not in sources.values()


@pytest.fixture
def run_cli(monkeypatch):
    monkeypatch.setattr(cli, "_run_with_runtime", lambda callback: callback(None, db))
    return lambda *args: CliRunner().invoke(cli.main, ["review-export", *args])


def test_the_cli_refuses_include_unreviewed_with_a_filter(
    session, reviewers, tmp_path, run_cli
):
    load(session, tmp_path / "in")

    result = run_cli(str(tmp_path / "out"), "--include-unreviewed", "--user-id", REVIEWER)

    assert result.exit_code == 2, result.output
    assert not (tmp_path / "out").exists()


def test_each_cli_option_changes_the_manifest(session, reviewers, tmp_path, run_cli):
    sources, _ = reviewed_papers(session, tmp_path)
    base_two = session.get(ReviewSource, sources["s2"]).fulltext.base_study_id
    everything = {tree(REVIEWER, "s1"), tree(OTHER, "s1"), tree(REVIEWER, "s2")}
    cases = [
        ([], everything),
        (["--source-id", sources["s2"]], {tree(REVIEWER, "s2")}),
        (["--base-study-id", base_two], {tree(REVIEWER, "s2")}),
        (["--user-id", OTHER], {tree(OTHER, "s1")}),
        (["--state", "submitted"], {tree(REVIEWER, "s1")}),
        (["--include-unreviewed"], everything | {as_loaded("s3")}),
    ]

    for number, (args, expected) in enumerate(cases):
        result = run_cli(str(tmp_path / f"out-{number}"), *args)

        assert result.exit_code == 0, result.output
        assert {entry["path"] for entry in json.loads(result.output)} == expected, args


def test_the_cli_manifest_gives_each_entry_its_source_review_user_and_state(
    session, reviewers, tmp_path, run_cli
):
    sources, reviews = reviewed_papers(session, tmp_path)

    result = run_cli(str(tmp_path / "out"), "--include-unreviewed")

    assert result.exit_code == 0, result.output
    expected = [
        {
            "path": tree(REVIEWER, "s1"),
            "source_id": sources["s1"],
            "review_id": reviews[("s1", REVIEWER)],
            "user_id": REVIEWER,
            "state": "submitted",
        },
        {
            "path": tree(OTHER, "s1"),
            "source_id": sources["s1"],
            "review_id": reviews[("s1", OTHER)],
            "user_id": OTHER,
            "state": "in_progress",
        },
        {
            "path": tree(REVIEWER, "s2"),
            "source_id": sources["s2"],
            "review_id": reviews[("s2", REVIEWER)],
            "user_id": REVIEWER,
            "state": "in_progress",
        },
        {
            "path": as_loaded("s3"),
            "source_id": sources["s3"],
            "review_id": None,
            "user_id": None,
            "state": None,
        },
    ]

    def by_path(entry):
        return entry["path"]

    assert sorted(json.loads(result.output), key=by_path) == sorted(expected, key=by_path)


def test_the_cli_writes_a_directory_and_prints_the_manifest(
    session, reviewers, tmp_path, run_cli
):
    _, source_id = load(session, tmp_path / "in")
    edit(session, source_id, REVIEWER, set_name("a1", "one"))
    out = tmp_path / "out"

    result = run_cli(str(out), "--user-id", REVIEWER)

    assert result.exit_code == 0, result.output
    assert (out / REVIEWER / f"run/records/{PAPER_ID}.extraction.json").is_file()
    [entry] = json.loads(result.output)
    assert entry["user_id"] == REVIEWER
    assert entry["path"] == f"{REVIEWER}/run/records/{PAPER_ID}.extraction.json"


def _load_two_records_of_one_paper(session, tmp_path):
    """Load two records of one paper (same text, same article id); returns their source ids in
    load order."""
    session.add(BaseStudy(name="a paper", level="group", pmid="s1"))
    session.commit()
    write_clean(tmp_path / "first")
    first = imports.import_layout(session, tmp_path / "first", user_id=REVIEWER)
    session.commit()
    second_record = documents("s1")[2]
    second_record["analyses"][0]["name"]["value"] = "second record"
    write_clean(tmp_path / "second", extraction=second_record)
    second = imports.import_layout(session, tmp_path / "second", user_id=REVIEWER)
    session.commit()
    assert first["failed"] == second["failed"] == []
    return first["loaded"][0]["source_id"], second["loaded"][0]["source_id"]


def test_two_sources_of_one_paper_in_one_tree_both_keep_their_record(
    session, reviewers, tmp_path
):
    first_id, second_id = _load_two_records_of_one_paper(session, tmp_path)
    edit(session, first_id, REVIEWER, set_name("a1", "first"))
    edit(session, second_id, REVIEWER, set_name("a1", "second"))

    manifest = exports.export_bulk(session, tmp_path / "out")

    assert len({entry["path"] for entry in manifest}) == 2
    taking_id = tmp_path / "out" / REVIEWER / f"run/records/{PAPER_ID}.extraction.json"
    suffixed = (
        tmp_path / "out" / REVIEWER / f"run/records/{PAPER_ID}~{second_id}.extraction.json"
    )
    assert json.loads(taking_id.read_text())["analyses"][0]["name"]["value"] == "first"
    assert json.loads(suffixed.read_text())["analyses"][0]["name"]["value"] == "second"
    assert sorted(entry["path"] for entry in manifest) == sorted(
        [
            f"{REVIEWER}/run/records/{PAPER_ID}.extraction.json",
            f"{REVIEWER}/run/records/{PAPER_ID}~{second_id}.extraction.json",
        ]
    )


def test_the_source_loaded_first_keeps_the_bare_id_even_when_its_id_is_larger(
    session, reviewers, tmp_path
):
    first_id, second_id = _load_two_records_of_one_paper(session, tmp_path)
    smaller, larger = session.scalars(
        sa.select(ReviewSource.id)
        .where(ReviewSource.id.in_([first_id, second_id]))
        .order_by(ReviewSource.id)
    ).all()
    session.get(ReviewSource, larger).created_at = datetime(2026, 10, 1, tzinfo=timezone.utc)
    session.get(ReviewSource, smaller).created_at = datetime(2026, 10, 2, tzinfo=timezone.utc)
    session.commit()
    values = {first_id: "first", second_id: "second"}
    for source_id, value in values.items():
        edit(session, source_id, REVIEWER, set_name("a1", value))

    exports.export_bulk(session, tmp_path / "out")

    root = tmp_path / "out" / REVIEWER / "run" / "records"
    bare = json.loads((root / f"{PAPER_ID}.extraction.json").read_text())
    assert bare["analyses"][0]["name"]["value"] == values[larger]
    suffixed = json.loads((root / f"{PAPER_ID}~{smaller}.extraction.json").read_text())
    assert suffixed["analyses"][0]["name"]["value"] == values[smaller]


def test_two_sources_of_one_paper_as_loaded_both_keep_their_record(
    session, reviewers, tmp_path
):
    _, second_id = _load_two_records_of_one_paper(session, tmp_path)

    manifest = exports.export_bulk(session, tmp_path / "out", include_unreviewed=True)

    assert len({entry["path"] for entry in manifest}) == 2
    assert (
        tmp_path / "out" / f"_source/run/records/{PAPER_ID}~{second_id}.extraction.json"
    ).is_file()
    assert (tmp_path / "out" / f"_source/run/records/{PAPER_ID}.extraction.json").is_file()


def test_the_export_issues_the_same_statements_for_one_source_as_for_four(
    session, reviewers, tmp_path, statements
):
    _, source_id = load(session, tmp_path / "in-s1", study_id="s1")
    edit(session, source_id, REVIEWER, set_name("a1", "one"))
    edit(session, source_id, OTHER, set_name("a1", "two"))
    with statements() as one_source:
        exports.export_bulk(session, tmp_path / "one", source_ids=[source_id])

    more = []
    for study_id in ("s2", "s3", "s4", "s5"):
        _, source_id = load(session, tmp_path / f"in-{study_id}", study_id=study_id)
        edit(session, source_id, REVIEWER, set_name("a1", "one"))
        edit(session, source_id, OTHER, set_name("a1", "two"))
        more.append(source_id)
    with statements() as four_sources:
        manifest = exports.export_bulk(session, tmp_path / "four", source_ids=more)

    assert len(manifest) == 8
    assert len(four_sources) == len(one_source)
