"""Importing papers for review from study_schema layouts: the service, the CLI and the route."""

import json

import pytest
import sqlalchemy as sa
from click.testing import CliRunner
from sqlalchemy.orm import Session
from study_schema.jsonschema import load

from neurostore import cli
from neurostore.database import db
from neurostore.models import BaseStudy, Fulltext, ReviewSource
from neurostore.resources import body_limit
from neurostore.resources import review as review_resources
from neurostore.review.app import imports
from neurostore.review.core import entities
from neurostore.review.core.layout import LayoutError
from neurostore.study_schema_tools import sha256_of
from neurostore.tests.review.layouts import (
    DIGEST,
    LEAD,
    OTHER,
    REVIEWER,
    TEXT,
    assert_matches_spec,
    documents,
    write_layout,
    zip_layout,
)

pytestmark = pytest.mark.anyio


def clean(study_id):
    """The three documents of a paper that imports cleanly, from pubget."""
    paper, coordinate_parse, record = documents(study_id)
    paper["source"] = "pubget"
    return paper, coordinate_parse, record


def add_base_study(session, **identifiers):
    base_study = BaseStudy(name="a paper", level="group", **identifiers)
    session.add(base_study)
    session.commit()
    return base_study


def count(session, model):
    return session.scalar(sa.select(sa.func.count()).select_from(model))


def positional_message(key):
    return (
        f"positional coordinate key {key}; migrate it to content keys with "
        "pondie/scripts/astra_to_study_schema.py (W21)"
    )


def with_source_key(study_id, key):
    paper, coordinate_parse, record = clean(study_id)
    record["analyses"][0]["source_table_analysis"] = {
        "value": key,
        "extraction_status": "extracted",
        "evidence": {"status": "not_found"},
    }
    return paper, coordinate_parse, record


def bad_span(study_id):
    paper, coordinate_parse, record = clean(study_id)
    record["analyses"][0]["name"] = {
        "value": "Faces > Houses",
        "extraction_status": "extracted",
        "value_source": "reported",
        "evidence": {
            "status": "present",
            "sets": [{"spans": [{"start_char": 0, "end_char": 10_000, "text": "Participants"}]}],
        },
    }
    return paper, coordinate_parse, record


def schema_error(study_id):
    paper, coordinate_parse, record = clean(study_id)
    record["extraction_metadata"].pop("extractor_model")
    return paper, coordinate_parse, record


def text_hash_mismatch(study_id):
    paper, coordinate_parse, record = clean(study_id)
    paper["text_sha256"] = "0" * 64
    return paper, coordinate_parse, record


def unknown_text_source(study_id):
    paper, coordinate_parse, record = clean(study_id)
    paper["source"] = "nowhere"
    return paper, coordinate_parse, record


def no_base_study(study_id):
    paper, coordinate_parse, record = clean(study_id)
    paper["header"]["identifiers"] = {"pmid": "9999"}
    return paper, coordinate_parse, record


FAILURES = [
    pytest.param(
        schema_error,
        "record at extraction_metadata: 'extractor_model' is a required property",
        id="schema-error",
    ),
    pytest.param(text_hash_mismatch, "parsed_paper text_sha256", id="text-hash-mismatch"),
    pytest.param(bad_span, "is not within the text", id="bad-span"),
    pytest.param(
        lambda study_id: with_source_key(study_id, "prose#0"),
        positional_message("prose#0"),
        id="positional-key",
    ),
    pytest.param(no_base_study, "no base study for pmid=9999", id="no-base-study"),
    pytest.param(unknown_text_source, "unknown text source 'nowhere'", id="unknown-source"),
]


# the service


def test_a_clean_paper_loads_with_its_text_and_documents(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    base_study = add_base_study(session, pmid="1001")
    paper, coordinate_parse, record = clean("1001")
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER, run_id="run-7")

    assert [entry["study_id"] for entry in report["loaded"]] == ["1001"]
    source = session.scalar(sa.select(ReviewSource))
    fulltext = session.scalar(sa.select(Fulltext))
    assert report == {
        "loaded": [{"study_id": "1001", "source_id": source.id, "base_study_id": base_study.id}],
        "skipped": [],
        "failed": [],
    }
    assert (fulltext.base_study_id, fulltext.source) == (base_study.id, "pubget")
    assert (fulltext.sha256, fulltext.text) == (DIGEST, TEXT)
    assert source.fulltext_id == fulltext.id
    assert (source.origin, source.label, source.run_id) == ("upload", "A paper", "run-7")
    assert source.loaded_by_id == REVIEWER
    assert (source.parsed_paper, source.coordinate_parse, source.record) == (
        paper,
        coordinate_parse,
        record,
    )
    assert source.record_sha256 == sha256_of(record)
    assert source.judgeable_keys == entities.judgeable_keys(record, coordinate_parse)
    assert source.schema_versions == {
        "paper_parse": paper["header"]["schema_version"],
        "coordinate_parse": coordinate_parse["header"]["schema_version"],
        "extraction": load("extraction-record")["version"],
    }


@pytest.mark.parametrize("source", ["pubget", "ace", "pdf", "springer"])
def test_the_fulltext_keeps_the_source_of_its_parsed_paper(
    session, make_user, tmp_path, source
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    paper, coordinate_parse, record = clean("1001")
    paper["source"] = source
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)

    imports.import_layout(session, tmp_path, user_id=REVIEWER)

    fulltext = session.scalar(sa.select(Fulltext))
    assert fulltext.source == source


def test_a_second_import_of_the_same_files_skips_with_the_same_source(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    write_layout(tmp_path, "1001", *clean("1001"))
    first = imports.import_layout(session, tmp_path, user_id=REVIEWER)
    assert [entry["study_id"] for entry in first["loaded"]] == ["1001"]
    source_id = first["loaded"][0]["source_id"]

    second = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert second == {
        "loaded": [],
        "skipped": [{"study_id": "1001", "source_id": source_id, "reason": "already loaded"}],
        "failed": [],
    }
    assert count(session, ReviewSource) == 1


def write_wrapper(root, study_id, review_id):
    wrapper = {
        "record_path": f"run/records/{study_id}.extraction.json",
        "source": {
            "kind": "review",
            "review_id": review_id,
            "user_id": REVIEWER,
            "state": "submitted",
        },
        "reviewed": True,
        "edited": False,
    }
    path = root / f"run/provenance/{study_id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(json.dumps(wrapper).encode("utf-8"))


def test_a_reimport_of_the_same_record_and_wrapper_is_skipped(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    write_layout(tmp_path, "1001", *clean("1001"))
    write_wrapper(tmp_path, "1001", review_id=7)
    first = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    second = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert [entry["reason"] for entry in second["skipped"]] == ["already loaded"]
    assert second["skipped"][0]["source_id"] == first["loaded"][0]["source_id"]
    assert count(session, ReviewSource) == 1


def test_an_unedited_review_of_a_loaded_record_loads_as_its_own_source(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    write_layout(tmp_path, "1001", *clean("1001"))
    imports.import_layout(session, tmp_path, user_id=REVIEWER)
    write_wrapper(tmp_path, "1001", review_id=7)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert [entry["study_id"] for entry in report["loaded"]] == ["1001"]
    assert report["skipped"] == []
    assert count(session, ReviewSource) == 2


def test_a_second_record_with_identical_text_reuses_the_fulltext(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    base_study = add_base_study(session, pmid="1001")
    paper, coordinate_parse, record = clean("1001")
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)
    other_paper, other_parse, other_record = clean("1002")
    other_paper["header"]["identifiers"] = {"pmid": "1001"}
    other_record["local_id"] = "study-2"
    write_layout(tmp_path, "1002", other_paper, other_parse, other_record)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    fulltexts = session.scalars(sa.select(Fulltext)).all()
    sources = session.scalars(sa.select(ReviewSource)).all()
    assert [entry["study_id"] for entry in report["loaded"]] == ["1001", "1002"]
    assert [fulltext.base_study_id for fulltext in fulltexts] == [base_study.id]
    assert len({source.fulltext_id for source in sources}) == 1


def test_the_same_text_on_two_base_studies_gives_a_fulltext_on_each(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    first = add_base_study(session, pmid="1001")
    second = add_base_study(session, pmid="1002")
    write_layout(tmp_path, "1001", *clean("1001"))
    write_layout(tmp_path, "1002", *clean("1002"))

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert [entry["base_study_id"] for entry in report["loaded"]] == [first.id, second.id]
    fulltexts = session.scalars(sa.select(Fulltext)).all()
    assert sorted((fulltext.base_study_id, fulltext.sha256) for fulltext in fulltexts) == sorted(
        [(first.id, DIGEST), (second.id, DIGEST)]
    )


def test_a_record_already_loaded_on_another_base_study_still_loads(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    add_base_study(session, pmid="1002")
    write_layout(tmp_path, "1001", *clean("1001"))
    paper, coordinate_parse, _ = clean("1002")
    _, _, same_record = clean("1001")
    write_layout(tmp_path, "1002", paper, coordinate_parse, same_record)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert [entry["study_id"] for entry in report["loaded"]] == ["1001", "1002"]
    assert report["skipped"] == []
    assert count(session, ReviewSource) == 2


@pytest.mark.parametrize("break_paper, problem", FAILURES)
def test_a_failing_paper_loads_nothing_and_reports_why_while_the_others_load(
    session, make_user, tmp_path, break_paper, problem
):
    make_user(REVIEWER, "admin-reviewer")
    good = add_base_study(session, pmid="1001")
    add_base_study(session, pmid="1002")
    write_layout(tmp_path, "1001", *clean("1001"))
    write_layout(tmp_path, "1002", *break_paper("1002"))

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert [entry["study_id"] for entry in report["loaded"]] == ["1001"]
    assert report["loaded"][0]["base_study_id"] == good.id
    assert report["skipped"] == []
    assert [entry["study_id"] for entry in report["failed"]] == ["1002"]
    assert any(problem in text for text in report["failed"][0]["problems"])
    assert count(session, ReviewSource) == 1
    assert count(session, Fulltext) == 1
    assert count(session, BaseStudy) == 2


def test_a_database_failure_loses_only_its_paper_and_reports_its_first_line(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    for pmid in ("1001", "1002", "1003"):
        add_base_study(session, pmid=pmid)
    write_layout(tmp_path, "1001", *clean("1001"))
    paper, coordinate_parse, record = clean("1002")
    record["extraction_metadata"]["extractor_model"] = "bad\u0000model"
    write_layout(tmp_path, "1002", paper, coordinate_parse, record)
    write_layout(tmp_path, "1003", *clean("1003"))

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert [entry["study_id"] for entry in report["loaded"]] == ["1001", "1003"]
    assert [entry["study_id"] for entry in report["failed"]] == ["1002"]
    [problem] = report["failed"][0]["problems"]
    assert problem and "\n" not in problem and "INSERT" not in problem
    assert count(session, Fulltext) == 2
    assert count(session, ReviewSource) == 2


def test_the_neurostore_base_study_id_beats_a_matching_doi(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    by_doi = add_base_study(session, doi="10.1/one")
    named = add_base_study(session)
    paper, coordinate_parse, record = clean("1001")
    paper["header"]["identifiers"] = {
        "pmid": "1001",
        "doi": "10.1/one",
        "neurostore_base_study_id": named.id,
    }
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert [entry["study_id"] for entry in report["loaded"]] == ["1001"]
    assert report["loaded"][0]["base_study_id"] == named.id
    assert report["loaded"][0]["base_study_id"] != by_doi.id


def test_a_named_base_study_that_is_unknown_falls_through_to_the_identifiers(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    by_pmid = add_base_study(session, pmid="1001")
    paper, coordinate_parse, record = clean("1001")
    paper["header"]["identifiers"] = {"pmid": "1001", "neurostore_base_study_id": "missing"}
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert report["loaded"][0]["base_study_id"] == by_pmid.id


def test_a_doi_beats_a_pmid_on_another_base_study(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    by_doi = add_base_study(session, doi="10.1/one")
    add_base_study(session, pmid="1001")
    paper, coordinate_parse, record = clean("1001")
    paper["header"]["identifiers"] = {"pmid": "1001", "doi": "10.1/one"}
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert report["loaded"][0]["base_study_id"] == by_doi.id


def test_a_pmcid_alone_finds_its_base_study(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    by_pmcid = add_base_study(session, pmcid="PMC1001")
    paper, coordinate_parse, record = clean("1001")
    paper["header"]["identifiers"] = {"pmcid": "PMC1001"}
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert report["loaded"][0]["base_study_id"] == by_pmcid.id


def test_an_inactive_base_study_is_not_matched_and_none_is_created(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001", is_active=False)
    write_layout(tmp_path, "1001", *clean("1001"))

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert report["loaded"] == []
    assert [entry["study_id"] for entry in report["failed"]] == ["1001"]
    assert report["failed"][0]["problems"] == ["no base study for pmid=1001"]
    assert count(session, BaseStudy) == 1


@pytest.mark.parametrize("key", ["prose#0", "prose#12", "table#3"])
def test_a_positional_coordinate_key_fails_its_paper(session, make_user, tmp_path, key):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    write_layout(tmp_path, "1001", *with_source_key("1001", key))

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert report["loaded"] == []
    assert report["failed"][0]["problems"] == [positional_message(key)]


@pytest.mark.parametrize("key", ["table#3a", "xprose#1"])
def test_a_content_key_that_only_looks_positional_loads(session, make_user, tmp_path, key):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    write_layout(tmp_path, "1001", *with_source_key("1001", key))

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert [entry["study_id"] for entry in report["loaded"]] == ["1001"]
    assert report["failed"] == []


def test_a_malformed_paper_fails_alone_and_the_rest_load(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    for pmid in ("1001", "1002", "1003"):
        add_base_study(session, pmid=pmid)
    for study_id in ("1001", "1002", "1003"):
        write_layout(tmp_path, study_id, *clean(study_id))
    (tmp_path / "corpus/1002/parse/parsed_paper.json").write_text("{not json")

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert [entry["study_id"] for entry in report["loaded"]] == ["1001", "1003"]
    assert [entry["study_id"] for entry in report["failed"]] == ["1002"]
    [problem] = report["failed"][0]["problems"]
    assert problem.startswith("corpus/1002/parse/parsed_paper.json is not JSON")


@pytest.mark.parametrize("make", ["empty directory", "not a zip"])
def test_a_source_that_is_not_a_layout_is_refused_whole(session, tmp_path, make):
    source = tmp_path / "source"
    if make == "empty directory":
        source.mkdir()
    else:
        source.write_bytes(b"plain text")

    with pytest.raises(LayoutError):
        imports.import_layout(session, source, user_id=REVIEWER)


def test_a_zip_source_imports_the_same_as_a_directory(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    base_study = add_base_study(session, pmid="1001")
    files = write_layout(tmp_path / "layout", "1001", *clean("1001"))

    report = imports.import_layout(
        session, zip_layout(files, tmp_path / "layout.zip"), user_id=REVIEWER
    )

    assert report["loaded"] == [
        {
            "study_id": "1001",
            "source_id": session.scalar(sa.select(ReviewSource.id)),
            "base_study_id": base_study.id,
        }
    ]


# the CLI


@pytest.fixture
def run_cli(monkeypatch):
    monkeypatch.setattr(cli, "_run_with_runtime", lambda callback: callback(None, db))
    return lambda *args: CliRunner().invoke(cli.main, ["review-import", *args])


def test_the_cli_prints_the_report_and_exits_0_when_every_paper_loads(
    session, make_user, tmp_path, run_cli
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    write_layout(tmp_path, "1001", *clean("1001"))

    result = run_cli(str(tmp_path), "--user-id", REVIEWER, "--run-id", "run-1")

    assert result.exit_code == 0, result.output
    report = json.loads(result.output)
    assert [entry["study_id"] for entry in report["loaded"]] == ["1001"]
    assert report["failed"] == []


def test_the_cli_exits_1_when_a_paper_fails_and_still_prints_the_report(
    session, make_user, tmp_path, run_cli
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    write_layout(tmp_path, "1001", *clean("1001"))
    write_layout(tmp_path, "1002", *unknown_text_source("1002"))

    result = run_cli(str(tmp_path), "--user-id", REVIEWER)

    assert result.exit_code == 1
    report = json.loads(result.output)
    assert [entry["study_id"] for entry in report["loaded"]] == ["1001"]
    assert report["failed"][0]["study_id"] == "1002"


def test_the_cli_commits_the_loaded_sources(session, make_user, tmp_path, run_cli):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    write_layout(tmp_path, "1001", *clean("1001"))

    run_cli(str(tmp_path), "--user-id", REVIEWER)

    with Session(session.bind) as fresh:
        assert count(fresh, ReviewSource) == 1


def test_the_cli_records_the_user_and_the_run_it_is_given(session, make_user, tmp_path, run_cli):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    write_layout(tmp_path, "1001", *clean("1001"))

    run_cli(str(tmp_path), "--user-id", REVIEWER, "--run-id", "run-9")

    with Session(session.bind) as fresh:
        source = fresh.scalar(sa.select(ReviewSource))
        assert (source.loaded_by_id, source.run_id) == (REVIEWER, "run-9")


def test_the_cli_refuses_to_load_without_a_user_id(session, make_user, tmp_path, run_cli):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    write_layout(tmp_path, "1001", *clean("1001"))

    result = run_cli(str(tmp_path))

    assert result.exit_code != 0
    assert "--user-id" in result.output
    with Session(session.bind) as fresh:
        assert count(fresh, ReviewSource) == 0


def test_the_cli_exits_1_for_a_directory_that_is_not_a_layout(session, tmp_path, run_cli):
    (tmp_path / "empty").mkdir()

    result = run_cli(str(tmp_path / "empty"), "--user-id", REVIEWER)

    assert result.exit_code == 1
    assert "no corpus/" in result.output


def test_the_service_raises_for_a_directory_with_no_corpus(session, tmp_path):
    (tmp_path / "empty").mkdir()

    with pytest.raises(LayoutError, match="no corpus/"):
        imports.import_layout(session, tmp_path / "empty", user_id=REVIEWER)


# the route


def upload(path):
    return {"file": ("layout.zip", path.read_bytes(), "application/zip")}


async def post_zip(client, path):
    return await client.post(
        "/api/review/imports/", data=upload(path), content_type="multipart/form-data"
    )


def zipped_clean_paper(tmp_path, study_id="1001"):
    files = write_layout(tmp_path / "layout", study_id, *clean(study_id))
    return zip_layout(files, tmp_path / "layout.zip")


async def test_the_import_route_refuses_anyone_without_a_token(clients, tmp_path):
    response = await post_zip(clients[None], zipped_clean_paper(tmp_path))

    assert response.status_code == 401


async def test_the_import_route_refuses_a_reviewer_who_is_not_admin(clients, tmp_path):
    response = await post_zip(clients[OTHER], zipped_clean_paper(tmp_path))

    assert response.status_code == 403


async def test_the_import_route_refuses_an_admin_who_is_not_an_admin_reviewer(
    clients, make_user, tmp_path
):
    make_user("newuser-id", "admin")

    response = await post_zip(clients["newuser-id"], zipped_clean_paper(tmp_path))

    assert response.status_code == 403


async def test_a_lead_reviewer_gets_the_report(clients, tmp_path, session):
    base_study = add_base_study(session, pmid="1001")

    response = await post_zip(clients[LEAD], zipped_clean_paper(tmp_path))

    assert response.status_code == 200, response.json()
    report = response.json()
    assert report["failed"] == [] and report["skipped"] == []
    assert report["loaded"][0]["study_id"] == "1001"
    assert report["loaded"][0]["base_study_id"] == base_study.id
    assert_matches_spec(response, "/review/imports/", "post")


async def test_the_route_records_the_caller_as_the_loader(clients, tmp_path, session):
    add_base_study(session, pmid="1001")

    response = await post_zip(clients[LEAD], zipped_clean_paper(tmp_path))

    assert response.status_code == 200, response.json()
    source = session.scalar(sa.select(ReviewSource))
    assert source.loaded_by_id == LEAD


async def test_the_loaded_source_then_appears_in_the_source_list(clients, tmp_path, session):
    add_base_study(session, pmid="1001")
    response = await post_zip(clients[LEAD], zipped_clean_paper(tmp_path))

    assert response.status_code == 200, response.json()
    loaded = response.json()["loaded"][0]

    listed = await clients[LEAD].get("/api/review/sources/")

    assert [source["id"] for source in listed.json()["results"]] == [loaded["source_id"]]


async def test_an_imported_paper_can_be_started_and_its_bundle_matches_the_upload(
    clients, tmp_path, session
):
    add_base_study(session, pmid="1001")
    paper, coordinate_parse, record = clean("1001")
    files = write_layout(tmp_path / "layout", "1001", paper, coordinate_parse, record)
    response = await post_zip(clients[LEAD], zip_layout(files, tmp_path / "layout.zip"))
    source_id = response.json()["loaded"][0]["source_id"]

    started = await clients[LEAD].put(f"/api/review/sources/{source_id}/review")

    assert started.status_code == 201
    assert_matches_spec(started, "/review/sources/{id}/review", "put")
    bundle = await clients[LEAD].get(f"/api/review/sources/{source_id}/bundle")
    assert bundle.status_code == 200, bundle.json()
    assert_matches_spec(bundle, "/review/sources/{id}/bundle", "get")
    body = bundle.json()
    assert body["text"] == TEXT
    assert body["source"]["label"] == paper["bibliography"]["title"]
    assert body["coordinate_parse"]["analyses"] == coordinate_parse["analyses"]
    assert body["record"]["analyses"] == record["analyses"]


async def test_the_import_route_refuses_a_file_over_the_limit(clients, tmp_path, monkeypatch):
    monkeypatch.setattr(review_resources, "MAX_IMPORT_BYTES", 10)

    response = await post_zip(clients[LEAD], zipped_clean_paper(tmp_path))

    assert response.status_code == 413
    assert_matches_spec(response, "/review/imports/", "post")


async def test_a_file_exactly_at_the_limit_is_accepted_and_one_byte_more_is_refused(
    clients, tmp_path, monkeypatch, session
):
    add_base_study(session, pmid="1001")
    zipped = zipped_clean_paper(tmp_path)
    size = zipped.stat().st_size

    monkeypatch.setattr(review_resources, "MAX_IMPORT_BYTES", size)
    accepted = await post_zip(clients[LEAD], zipped)
    monkeypatch.setattr(review_resources, "MAX_IMPORT_BYTES", size - 1)
    refused = await post_zip(clients[LEAD], zipped)

    assert accepted.status_code == 200, accepted.json()
    assert refused.status_code == 413
    assert_matches_spec(refused, "/review/imports/", "post")


def test_the_import_limit_is_200_mb():
    assert review_resources.MAX_IMPORT_BYTES == 200 * 1024 * 1024


async def test_the_import_route_refuses_a_file_that_is_not_a_zip(clients, tmp_path):
    not_zip = tmp_path / "layout.zip"
    not_zip.write_bytes(b"this is not a zip")

    response = await post_zip(clients[LEAD], not_zip)

    assert response.status_code == 422
    assert_matches_spec(response, "/review/imports/", "post")


async def test_a_zip_with_no_corpus_is_refused_as_unprocessable(clients, tmp_path):
    bare = zip_layout({"notes/readme.txt": b"no corpus here"}, tmp_path / "bare.zip")

    response = await post_zip(clients[LEAD], bare)

    assert response.status_code == 422
    assert_matches_spec(response, "/review/imports/", "post")


async def test_a_zip_with_no_corpus_names_each_problem_under_the_file_field(clients, tmp_path):
    bare = zip_layout({"notes/readme.txt": b"no corpus here"}, tmp_path / "bare.zip")

    response = await post_zip(clients[LEAD], bare)

    body = response.json()
    assert response.status_code == 422
    assert "no corpus/" in body["detail"]
    assert [(error["field"], error["code"]) for error in body["errors"]] == [
        ("file", "INVALID_LAYOUT")
    ]
    assert "no corpus/" in body["errors"][0]["context"]["provided"]


@pytest.mark.parametrize("field", ["schema_version", "article_id"])
def test_a_parsed_paper_without_a_required_header_field_fails_naming_the_field(
    session, make_user, tmp_path, field
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    paper, coordinate_parse, record = clean("1001")
    del paper["header"][field]
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert report["loaded"] == []
    [failure] = report["failed"]
    assert failure["problems"] == [f"parsed_paper at header: '{field}' is a required property"]
    assert count(session, ReviewSource) == 0
    assert count(session, Fulltext) == 0


def provenance_document(source, reviewed=True):
    return {
        "record_path": "run/records/1001.extraction.json",
        "source": source,
        "reviewed": reviewed,
        "edited": False,
    }


SOURCE_WRAPPER = {"kind": "source", "source_id": 3, "origin": "base_study", "run_id": None}
PIPELINE_WRAPPER = {"kind": "source", "source_id": 4, "origin": "pipeline_run", "run_id": "run-1"}
REVIEW_WRAPPER = {"kind": "review", "review_id": 7, "user_id": REVIEWER, "state": "in_progress"}


def write_provenance(root, study_id, content):
    path = root / f"run/provenance/{study_id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    if not isinstance(content, bytes):
        content = json.dumps(content).encode("utf-8")
    path.write_bytes(content)


@pytest.mark.parametrize("wrapper", [SOURCE_WRAPPER, PIPELINE_WRAPPER], ids=["source", "pipeline"])
def test_a_record_with_a_source_wrapper_is_skipped_as_already_loaded(
    session, make_user, tmp_path, wrapper
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    write_layout(tmp_path, "1001", *clean("1001"))
    first = imports.import_layout(session, tmp_path, user_id=REVIEWER)
    write_provenance(tmp_path, "1001", provenance_document(wrapper, reviewed=False))

    second = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert second == {
        "loaded": [],
        "skipped": [
            {"study_id": "1001", "source_id": first["loaded"][0]["source_id"],
             "reason": "already loaded"}
        ],
        "failed": [],
    }
    assert count(session, ReviewSource) == 1


def test_a_review_wrapper_that_is_not_reviewed_is_a_review_and_loads_as_its_own_source(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    write_layout(tmp_path, "1001", *clean("1001"))
    first = imports.import_layout(session, tmp_path, user_id=REVIEWER)
    write_provenance(tmp_path, "1001", provenance_document(REVIEW_WRAPPER, reviewed=False))

    second = imports.import_layout(session, tmp_path, user_id=REVIEWER)
    third = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert [entry["study_id"] for entry in second["loaded"]] == ["1001"]
    assert second["loaded"][0]["source_id"] != first["loaded"][0]["source_id"]
    assert third["skipped"] == [
        {"study_id": "1001", "source_id": second["loaded"][0]["source_id"],
         "reason": "already loaded"}
    ]
    assert count(session, ReviewSource) == 2


@pytest.mark.parametrize(
    "content, problem",
    [(b"{not json", "is not JSON"), (b"[1, 2]", "is not a JSON object")],
    ids=["not_json", "not_an_object"],
)
def test_a_provenance_wrapper_that_is_not_a_json_object_fails_its_paper_with_the_reason(
    session, make_user, tmp_path, content, problem
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    write_layout(tmp_path, "1001", *clean("1001"))
    write_provenance(tmp_path, "1001", content)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert report["loaded"] == []
    [failed] = report["failed"]
    assert failed["study_id"] == "1001"
    assert any(
        problem in line and "run/provenance/1001.json" in line for line in failed["problems"]
    )
    assert count(session, ReviewSource) == 0


def test_a_zip_layout_reads_its_provenance_wrapper(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    files = write_layout(tmp_path / "layout", "1001", *clean("1001"))
    files["run/provenance/1001.json"] = json.dumps(
        provenance_document(REVIEW_WRAPPER)
    ).encode("utf-8")
    archive = zip_layout(files, tmp_path / "layout.zip")

    report = imports.import_layout(session, archive, user_id=REVIEWER)

    assert [entry["study_id"] for entry in report["loaded"]] == ["1001"]
    again = imports.import_layout(session, archive, user_id=REVIEWER)
    assert again["skipped"][0]["source_id"] == report["loaded"][0]["source_id"]


def test_a_zip_layout_with_a_provenance_wrapper_that_is_not_an_object_fails_its_paper(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    files = write_layout(tmp_path / "layout", "1001", *clean("1001"))
    files["run/provenance/1001.json"] = b'"just a string"'
    archive = zip_layout(files, tmp_path / "layout.zip")

    report = imports.import_layout(session, archive, user_id=REVIEWER)

    assert report["loaded"] == []
    [failed] = report["failed"]
    assert any("is not a JSON object" in line for line in failed["problems"])


async def test_the_import_route_is_not_held_to_the_review_body_limit(
    clients, tmp_path, session, monkeypatch
):
    add_base_study(session, pmid="1001")
    monkeypatch.setattr(body_limit, "MAX_REVIEW_BODY_BYTES", 10)

    response = await post_zip(clients[LEAD], zipped_clean_paper(tmp_path))

    assert response.status_code == 200, response.json()
