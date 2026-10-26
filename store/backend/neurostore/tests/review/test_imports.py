"""Importing papers for review from study_schema layouts: the service, the CLI and the route."""

import copy
import hashlib
import json

import httpx
import pytest
import sqlalchemy as sa
from click.testing import CliRunner
from sqlalchemy.orm import Session
from study_schema.jsonschema import load
from study_schema.models.paper_parse import CoordinateParse

from neurostore import cli
from neurostore.database import db
from neurostore.exceptions.base import NeuroStoreException
from neurostore.ingest.study_schema import PARSE_PIPELINE, ingest_upload
from neurostore.models import (
    BaseStudy,
    Fulltext,
    Pipeline,
    PipelineConfig,
    ExtractionEntityLink,
    FieldClaim,
    PipelineStudyResult,
    ReviewSource,
    StudyEntity,
)
from neurostore.resources import body_limit
from neurostore.review.app import exports, imports, service
from neurostore.review.core import coordinates, entities
from neurostore.review.core.bundle import validator
from neurostore.review.core.layout import LayoutError
from neurostore.review.errors import Conflict, NotFound, Unprocessable
from neurostore.study_schema_tools import schema_errors, sha256_of
from neurostore.tests import study_schema_fixtures as fx
from neurostore.tests.review import records
from neurostore.tests.review.layouts import (
    DIGEST,
    LEAD,
    OTHER,
    REVIEWER,
    TEXT,
    TOKENS,
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
        f"positional coordinate key {key}; import takes content keys only, "
        "as study_schema's coordinate parse keys analyses"
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
    paper["header"]["identifiers"] = fx.identifiers(pmid="9999")
    return paper, coordinate_parse, record


LOWERCASE_UUID = records.LOWERCASE_UUID
STABLE_STUDY = "0b8e5a52-6c1d-4f0e-9a3b-2d4c6e8f0a1b"
STABLE_ANALYSIS = "7f3e1d2c-4b5a-4968-8776-655443322110"


def is_uuid(value):
    return isinstance(value, str) and LOWERCASE_UUID.fullmatch(value) is not None


def stable_ids(record):
    """``{local_id: stable_id}`` of the study and its analyses, the entities these records
    hold."""
    return {
        item["local_id"]: item.get("stable_id")
        for item in [record, *(record.get("analyses") or ())]
    }


def without_stable_ids(record):
    record = copy.deepcopy(record)
    for item in [record, *(record.get("analyses") or ())]:
        item.pop("stable_id", None)
    return record


def entity_stable_ids(session, base_study):
    """``{(class, identity as JSON): stable_id}`` of every StudyEntity of ``base_study``."""
    return {
        (entity.entity_class, json.dumps(entity.identity)): entity.stable_id
        for entity in session.scalars(
            sa.select(StudyEntity).where(StudyEntity.base_study_id == base_study.id)
        )
    }


def with_unkeyed_analysis(record):
    """``record`` plus a2, an analysis with no coordinate key, which ingest gives no entity."""
    unkeyed = fx.record_analysis("a2", "unused", "Houses > Faces")
    unkeyed["source_table_analysis"] = {
        "extraction_status": "not_reported", "evidence": {"status": "not_applicable"},
    }
    return {**record, "analyses": [*record["analyses"], unkeyed]}


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
    assert (source.parsed_paper, source.coordinate_parse) == (paper, coordinate_parse)
    assert without_stable_ids(source.record) == record
    assert all(is_uuid(value) for value in stable_ids(source.record).values())
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


def test_the_fulltext_keeps_the_text_copy_of_its_parsed_paper(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    paper, coordinate_parse, record = clean("1001")
    paper["text_copy"] = fx.text_copy(version="submitted", license=fx.ALL_RIGHTS_RESERVED)
    paper["text_copy"]["preprint_server"] = "biorxiv"
    paper["text_copy"]["route"] = "preprint_server"
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)

    imports.import_layout(session, tmp_path, user_id=REVIEWER)

    fulltext = session.scalar(sa.select(Fulltext))
    assert fulltext.text_copy == paper["text_copy"]


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
    other_paper["header"]["identifiers"] = fx.identifiers(pmid="1001")
    other_record["local_id"] = "study-2"
    write_layout(tmp_path, "1002", other_paper, other_parse, other_record)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    fulltexts = session.scalars(sa.select(Fulltext)).all()
    sources = session.scalars(sa.select(ReviewSource)).all()
    assert [entry["study_id"] for entry in report["loaded"]] == ["1001", "1002"]
    assert [fulltext.base_study_id for fulltext in fulltexts] == [base_study.id]
    assert len({source.fulltext_id for source in sources}) == 1


def test_a_second_paper_with_the_same_text_keeps_the_first_papers_text_copy(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    paper, coordinate_parse, record = clean("1001")
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)
    other_paper, other_parse, other_record = clean("1002")
    other_paper["header"]["identifiers"] = fx.identifiers(pmid="1001")
    other_paper["text_copy"] = fx.text_copy(version="am", license=fx.ALL_RIGHTS_RESERVED)
    other_record["local_id"] = "study-2"
    write_layout(tmp_path, "1002", other_paper, other_parse, other_record)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert len(report["loaded"]) == 2
    assert session.scalar(sa.select(Fulltext)).text_copy == paper["text_copy"]


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
    paper["header"]["identifiers"] = fx.identifiers(pmid="1001", doi="10.1/one")
    paper["header"]["neurostore_base_study_id"] = named.id
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
    paper["header"]["neurostore_base_study_id"] = "missing"
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert report["loaded"][0]["base_study_id"] == by_pmid.id


def test_a_doi_beats_a_pmid_on_another_base_study(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    by_doi = add_base_study(session, doi="10.1/one")
    add_base_study(session, pmid="1001")
    paper, coordinate_parse, record = clean("1001")
    paper["header"]["identifiers"] = fx.identifiers(pmid="1001", doi="10.1/one")
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert report["loaded"][0]["base_study_id"] == by_doi.id


def test_a_pmcid_alone_finds_its_base_study(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    by_pmcid = add_base_study(session, pmcid="PMC1001")
    paper, coordinate_parse, record = clean("1001")
    paper["header"]["identifiers"] = fx.identifiers(pmcid="PMC1001")
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert report["loaded"][0]["base_study_id"] == by_pmcid.id


PREPRINT_DOI = {"doi": "10.1101/2025.01.01.000001", "server": "biorxiv"}
OTHER_PREPRINT_DOI = {"doi": "10.1101/2025.02.02.000002", "server": "medrxiv"}


def import_with_identifiers(session, tmp_path, **ids):
    paper, coordinate_parse, record = clean("1001")
    paper["header"]["identifiers"] = fx.identifiers(**ids)
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)
    return imports.import_layout(session, tmp_path, user_id=REVIEWER)


def test_a_version_of_record_id_beats_a_preprint_id_on_an_older_base_study(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, doi=PREPRINT_DOI["doi"])
    by_pmid = add_base_study(session, pmid="1001")

    report = import_with_identifiers(session, tmp_path, pmid="1001", preprint_dois=[PREPRINT_DOI])

    assert report["loaded"][0]["base_study_id"] == by_pmid.id


@pytest.mark.parametrize(
    "column, values, ids",
    [
        ("pmid", ["1001", "1002"], {"preprint_pmids": ["1001", "1002"]}),
        ("pmcid", ["PMC1001", "PMC1002"], {"preprint_pmcids": ["PMC1001", "PMC1002"]}),
        (
            "doi",
            [PREPRINT_DOI["doi"], OTHER_PREPRINT_DOI["doi"]],
            {"preprint_dois": [PREPRINT_DOI, OTHER_PREPRINT_DOI]},
        ),
    ],
)
def test_the_oldest_base_study_holding_an_id_of_one_strength_is_matched(
    session, make_user, tmp_path, column, values, ids
):
    make_user(REVIEWER, "admin-reviewer")
    oldest = add_base_study(session, **{column: values[1]})
    add_base_study(session, **{column: values[0]})

    report = import_with_identifiers(session, tmp_path, **ids)

    assert report["loaded"][0]["base_study_id"] == oldest.id


def test_the_oldest_base_study_holding_a_preprint_doi_is_matched_whatever_the_order_listed(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    oldest = add_base_study(session, doi=OTHER_PREPRINT_DOI["doi"])
    add_base_study(session, doi=PREPRINT_DOI["doi"])

    report = import_with_identifiers(
        session, tmp_path, preprint_dois=[PREPRINT_DOI, OTHER_PREPRINT_DOI]
    )

    assert report["loaded"][0]["base_study_id"] == oldest.id


def test_a_preprints_doi_pmid_and_pmcid_are_equally_strong_so_the_oldest_base_study_wins(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    oldest = add_base_study(session, pmid="40000001")
    add_base_study(session, pmcid="PMC40000001")
    add_base_study(session, doi=PREPRINT_DOI["doi"])

    report = import_with_identifiers(
        session,
        tmp_path,
        preprint_pmids=["40000001"],
        preprint_pmcids=["PMC40000001"],
        preprint_dois=[PREPRINT_DOI],
    )

    assert report["loaded"][0]["base_study_id"] == oldest.id


def test_a_preprint_id_beats_an_alternative_id_on_an_older_base_study(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1002")
    by_preprint = add_base_study(session, pmid="40000001")

    report = import_with_identifiers(
        session, tmp_path, preprint_pmids=["40000001"], alternative_pmids=["1002"]
    )

    assert report["loaded"][0]["base_study_id"] == by_preprint.id


def test_a_later_preprint_doi_is_tried_when_the_first_has_no_base_study(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    by_second = add_base_study(session, doi=OTHER_PREPRINT_DOI["doi"])

    report = import_with_identifiers(
        session, tmp_path, preprint_dois=[PREPRINT_DOI, OTHER_PREPRINT_DOI]
    )

    assert report["loaded"][0]["base_study_id"] == by_second.id


@pytest.mark.parametrize(
    "column, ids",
    [
        ("pmid", {"preprint_pmids": ["40000001", "40000002"]}),
        ("pmcid", {"preprint_pmcids": ["PMC40000001", "PMC40000002"]}),
    ],
)
def test_a_later_preprint_pmid_or_pmcid_is_tried_when_the_first_has_no_base_study(
    session, make_user, tmp_path, column, ids
):
    """A preprint indexed on two servers has a PubMed record, or a PMC copy, for each."""
    make_user(REVIEWER, "admin-reviewer")
    by_second = add_base_study(session, **{column: list(ids.values())[0][1]})

    report = import_with_identifiers(session, tmp_path, **ids)

    assert report["loaded"][0]["base_study_id"] == by_second.id


def test_a_paper_matching_no_base_study_names_every_identifier_searched_in_order(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, doi="10.1/another")
    paper, coordinate_parse, record = clean("1001")
    paper["header"]["neurostore_base_study_id"] = "missing"
    paper["header"]["identifiers"] = fx.identifiers(
        pmid="1001",
        preprint_pmcids=["PMC40000001"],
        preprint_pmids=["40000001"],
        preprint_dois=[PREPRINT_DOI, {"doi": "10.1101/2025.02.02.000002", "server": "medrxiv"}],
    )
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert report["loaded"] == []
    assert report["failed"][0]["problems"] == [
        "no base study for neurostore_base_study_id=missing, pmid=1001, "
        f"preprint_doi={PREPRINT_DOI['doi']}, preprint_doi=10.1101/2025.02.02.000002, "
        "preprint_pmid=40000001, preprint_pmcid=PMC40000001"
    ]


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
    assert body["record"] == session.get(ReviewSource, source_id).record
    assert without_stable_ids(body["record"]) == record


def multipart(path):
    """The body and content type the client sends when it uploads ``path``."""
    request = httpx.Request("POST", "http://testserver/", files=upload(path))
    return request.read(), request.headers["content-type"]


async def post_declaring(client, path, length):
    """Upload ``path`` in 1 KiB chunks under a Content-Length of ``length``."""
    body, content_type = multipart(path)

    async def chunks():
        for start in range(0, len(body), 1024):
            yield body[start:start + 1024]

    return await client.client.post(
        "/api/review/imports/",
        content=chunks(),
        headers={
            "Authorization": f"Bearer {TOKENS[LEAD]}",
            "Content-Type": content_type,
            "Content-Length": str(length),
        },
    )


async def test_the_import_route_refuses_a_file_over_the_limit(
    clients, tmp_path, monkeypatch, session
):
    monkeypatch.setattr(body_limit, "MAX_IMPORT_BYTES", 10)

    response = await post_zip(clients[LEAD], zipped_clean_paper(tmp_path))

    assert response.status_code == 413
    assert_matches_spec(response, "/review/imports/", "post")
    assert count(session, ReviewSource) == 0


async def test_an_upload_exactly_at_the_limit_is_accepted_and_one_byte_more_is_refused(
    clients, tmp_path, monkeypatch, session
):
    add_base_study(session, pmid="1001")
    zipped = zipped_clean_paper(tmp_path)
    size = len(multipart(zipped)[0])

    monkeypatch.setattr(body_limit, "MAX_IMPORT_BYTES", size)
    accepted = await post_zip(clients[LEAD], zipped)
    monkeypatch.setattr(body_limit, "MAX_IMPORT_BYTES", size - 1)
    refused = await post_zip(clients[LEAD], zipped)

    assert accepted.status_code == 200, accepted.json()
    assert refused.status_code == 413
    assert_matches_spec(refused, "/review/imports/", "post")


async def test_an_upload_whose_content_length_lies_is_refused_once_it_streams_past_the_limit(
    clients, tmp_path, monkeypatch, session
):
    add_base_study(session, pmid="1001")
    zipped = zipped_clean_paper(tmp_path)
    size = len(multipart(zipped)[0])
    monkeypatch.setattr(body_limit, "MAX_IMPORT_BYTES", size - 1)

    response = await post_declaring(clients[LEAD], zipped, size // 2)

    assert response.status_code == 413
    assert response.json()["title"] == "Payload Too Large"
    assert_matches_spec(response, "/review/imports/", "post")
    assert count(session, ReviewSource) == 0


async def test_a_chunked_upload_with_no_content_length_is_refused_before_it_is_read(
    clients, tmp_path, session
):
    body, content_type = multipart(zipped_clean_paper(tmp_path))

    async def chunks():
        for start in range(0, len(body), 1024):
            yield body[start:start + 1024]

    response = await clients[LEAD].client.post(
        "/api/review/imports/",
        content=chunks(),
        headers={"Authorization": f"Bearer {TOKENS[LEAD]}", "Content-Type": content_type},
    )

    # connexion answers a body with no Content-Length with 400 before the route reads it, so
    # the import cap never sees the stream: this is not a 413.
    assert response.status_code == 400
    assert "RequestBody is required" in response.text
    assert count(session, ReviewSource) == 0


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


@pytest.mark.parametrize("label", ["parsed_paper", "coordinate_parse"])
def test_a_document_whose_header_is_not_the_pinned_version_fails_naming_it(
    session, make_user, tmp_path, label
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    paper, coordinate_parse, record = clean("1001")
    {"parsed_paper": paper, "coordinate_parse": coordinate_parse}[label]["header"][
        "schema_version"
    ] = "0.6.0"
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert report["loaded"] == []
    [failure] = report["failed"]
    pinned = load(label.replace("_", "-"))["version"]
    assert failure["problems"] == [
        f"{label} at header.schema_version: is 0.6.0, not the pinned {pinned}"
    ]
    assert count(session, ReviewSource) == 0


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


# a pipeline run already in neurostore


def moved_analysis(z=-16, name="Faces > Houses"):
    return fx.table_analysis("t1", [1], name, [fx.point((20, -4, z))])


def revision_of(revised, analyses, verdicts):
    revision = fx.parse(
        analyses, pmid=revised["header"]["identifiers"]["pmid"],
        revision_of=revised["parse_id"], verdicts=verdicts,
    )
    revision["text_sha256"] = DIGEST
    return revision


def pipeline_documents(study_id, chain=0):
    """``(paper, original, revisions, record)``: a run's parse, ``chain`` revisions of it, and
    the record read from the last."""
    paper, original, record = clean(study_id)
    revisions, current = [], original
    if chain >= 1:
        moved = moved_analysis()
        current = revision_of(original, [moved], [
            fx.verdict(original["analyses"][0]["key"], "edit", [moved["key"]], "model edit"),
        ])
        revisions.append(current)
    if chain >= 2:
        added = fx.table_analysis("t1", [2], "Houses > Faces", [fx.point((-30, 2, 4))])
        current = revision_of(current, [current["analyses"][0], added], [
            fx.verdict(current["analyses"][0]["key"], "accept", [current["analyses"][0]["key"]]),
            {"key": added["key"], "verdict": "add", "reason": "model add"},
        ])
        revisions.append(current)
    record["analyses"][0]["source_table_analysis"] = fx.extracted(current["analyses"][0]["key"])
    return paper, original, revisions, record


def ingest_run(study_id, chain=0, run_id="run-1"):
    """Ingest a pipeline run for ``study_id`` the way the pipeline does; returns its documents
    and the record's config id."""
    paper, original, revisions, record = pipeline_documents(study_id, chain)
    uploads = [original, *revisions]
    for parse in uploads[:-1]:
        ingest_upload({"coordinate_parse": parse, "parsed_paper": paper})
    summary = ingest_upload({
        "coordinate_parse": uploads[-1], "record": record, "parsed_paper": paper,
        "run_id": run_id,
    })
    db.session.commit()
    config_id = summary["provenance"]["record"]["config_id"]
    return (paper, original, revisions, record), config_id


def write_papers(root, study_id, paper, text=TEXT):
    """Write only the parsed paper and its text, as a pipeline import takes them."""
    for relative, data in {
        f"corpus/{study_id}/parse/parsed_paper.json": json.dumps(paper).encode("utf-8"),
        f"corpus/{study_id}/{paper['text_path']}": text.encode("utf-8"),
    }.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


def import_run(session, root, config_id, run_id="run-1"):
    return imports.import_pipeline_run(
        session, config_id=config_id, run_id=run_id, user_id=REVIEWER, papers=root
    )


def test_a_run_with_an_unrevised_parse_loads_its_parse_and_record(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    base_study = add_base_study(session, pmid="1001")
    (paper, original, _, record), config_id = ingest_run("1001")
    write_papers(tmp_path, "1001", paper)

    report = import_run(session, tmp_path, config_id)

    source = session.scalar(sa.select(ReviewSource))
    assert report == {
        "loaded": [{"study_id": "1001", "source_id": source.id, "base_study_id": base_study.id}],
        "skipped": [],
        "failed": [],
    }
    assert (source.coordinate_parse, source.coordinate_revision) == (original, None)
    assert (without_stable_ids(source.record), source.parsed_paper) == (record, paper)
    assert (source.origin, source.pipeline_config_id, source.run_id) == (
        "pipeline_run", config_id, "run-1"
    )
    assert source.judgeable_keys == entities.judgeable_keys(record, original)
    assert source.fulltext.text == TEXT


@pytest.mark.parametrize("chain", [1, 2])
def test_a_run_read_from_a_revision_keeps_the_original_and_the_pipelines_revision(
    session, make_user, tmp_path, chain
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    (paper, original, revisions, record), config_id = ingest_run("1001", chain)
    write_papers(tmp_path, "1001", paper)

    report = import_run(session, tmp_path, config_id)

    assert report["failed"] == []
    source = session.scalar(sa.select(ReviewSource))
    assert source.coordinate_parse == original
    loaded = source.coordinate_revision
    assert loaded["revision_of"] == original["parse_id"]
    first, moved = original["analyses"][0]["key"], revisions[0]["analyses"][0]["key"]
    added = [a["key"] for a in revisions[-1]["analyses"][1:]]
    assert [(a["key"], a.get("derived_from")) for a in loaded["analyses"]] == [
        (moved, [first]), *((key, None) for key in added),
    ]
    assert [(v["key"], v["verdict"], v["reason"]) for v in loaded["verdicts"]] == [
        (first, "edit", "model edit"), *((key, "add", "model add") for key in added),
    ]
    assert len(added) == chain - 1
    assert {"artifact_kind": "coordinate_parse", "fingerprint": revisions[-1]["parse_id"]} in (
        loaded["header"]["inputs"]
    )
    assert source.origin == "pipeline_run"
    assert source.judgeable_keys == entities.judgeable_keys(record, source.coordinate_revision)


def test_a_second_import_of_the_same_run_is_skipped(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    (paper, *_), config_id = ingest_run("1001", chain=1)
    write_papers(tmp_path, "1001", paper)
    first = import_run(session, tmp_path, config_id)

    second = import_run(session, tmp_path, config_id)

    assert second == {
        "loaded": [],
        "skipped": [{
            "study_id": "1001", "source_id": first["loaded"][0]["source_id"],
            "reason": "already loaded",
        }],
        "failed": [],
    }
    assert count(session, ReviewSource) == 1


def test_a_pipeline_source_is_not_taken_for_the_same_record_loaded_from_files(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    (paper, original, revisions, record), config_id = ingest_run("1001", chain=1)
    write_layout(tmp_path / "files", "1001", paper, original, record)
    imports.import_layout(session, tmp_path / "files", user_id=REVIEWER)
    write_papers(tmp_path / "papers", "1001", paper)

    report = import_run(session, tmp_path / "papers", config_id)

    assert [entry["study_id"] for entry in report["loaded"]] == ["1001"]
    assert count(session, ReviewSource) == 2


def test_an_unrevised_run_record_already_loaded_from_files_is_skipped_as_that_source(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    (paper, original, _, record), config_id = ingest_run("1001")
    write_layout(tmp_path / "files", "1001", paper, original, record)
    loaded = imports.import_layout(session, tmp_path / "files", user_id=REVIEWER)["loaded"]
    write_papers(tmp_path / "papers", "1001", paper)

    report = import_run(session, tmp_path / "papers", config_id)

    assert report == {
        "loaded": [],
        "skipped": [{
            "study_id": "1001", "source_id": loaded[0]["source_id"], "reason": "already loaded",
        }],
        "failed": [],
    }
    assert session.get(ReviewSource, loaded[0]["source_id"]).origin == "upload"
    assert count(session, ReviewSource) == 1


def test_a_text_the_run_did_not_read_fails_its_paper_and_the_others_load(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    add_base_study(session, pmid="1002")
    (paper, *_), config_id = ingest_run("1001")
    (other, *_), _ = ingest_run("1002")
    write_papers(tmp_path, "1001", paper)
    changed = TEXT + " A sentence the run never read."
    other = {**other, "text_sha256": hashlib.sha256(changed.encode("utf-8")).hexdigest()}
    write_papers(tmp_path, "1002", other, text=changed)

    report = import_run(session, tmp_path, config_id)

    assert [entry["study_id"] for entry in report["loaded"]] == ["1001"]
    assert report["failed"] == [{
        "study_id": "1002",
        "problems": [f"the text's sha256 {other['text_sha256']} is not the {DIGEST} the run read"],
    }]
    assert count(session, ReviewSource) == 1


def test_a_record_of_the_run_with_no_uploaded_paper_fails_and_the_others_load(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    missing = add_base_study(session, pmid="1002")
    (paper, *_), config_id = ingest_run("1001")
    (_, original, _, _), _ = ingest_run("1002")
    write_papers(tmp_path, "1001", paper)

    report = import_run(session, tmp_path, config_id)

    assert [entry["study_id"] for entry in report["loaded"]] == ["1001"]
    assert report["failed"] == [{
        "study_id": original["header"]["article_id"],
        "problems": [f"no uploaded paper for base study {missing.id}"],
    }]


def test_an_uploaded_paper_with_no_base_study_or_a_second_for_one_is_reported_failed(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    (paper, *_), config_id = ingest_run("1001")
    write_papers(tmp_path, "1001", paper)
    write_papers(tmp_path, "1001-again", paper)
    stray, _, _ = clean("9999")
    write_papers(tmp_path, "9999", stray)

    report = import_run(session, tmp_path, config_id)

    assert [entry["study_id"] for entry in report["loaded"]] == ["1001"]
    assert report["failed"] == [
        {"study_id": "1001-again",
         "problems": ["1001 is already the uploaded paper of the same base study"]},
        {"study_id": "9999", "problems": ["no base study for pmid=9999"]},
    ]


def test_an_unknown_config_or_run_is_refused_whole(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    (paper, *_), config_id = ingest_run("1001")
    write_papers(tmp_path, "1001", paper)

    with pytest.raises(NotFound, match="pipeline run run-2 not found"):
        import_run(session, tmp_path, config_id, run_id="run-2")
    with pytest.raises(NotFound, match="pipeline config nope not found"):
        import_run(session, tmp_path, "nope")
    assert count(session, ReviewSource) == 0


def test_a_review_of_a_revision_carrying_source_starts_from_the_revision(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    (paper, *_), config_id = ingest_run("1001", chain=1)
    write_papers(tmp_path, "1001", paper)
    source_id = import_run(session, tmp_path, config_id)["loaded"][0]["source_id"]
    source = session.get(ReviewSource, source_id)

    review, created = service.start_review(session, source_id, REVIEWER)

    assert created
    stored = service.get_review(session, review["id"])
    assert stored["coordinate_revision"] == source.coordinate_revision


def test_the_bundle_of_a_revision_carrying_source_shows_the_revision_as_loaded(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    (paper, *_), config_id = ingest_run("1001", chain=1)
    write_papers(tmp_path, "1001", paper)
    source_id = import_run(session, tmp_path, config_id)["loaded"][0]["source_id"]
    loaded = session.get(ReviewSource, source_id).coordinate_revision

    before = service.get_bundle(session, source_id, REVIEWER)
    service.start_review(session, source_id, REVIEWER)
    after = service.get_bundle(session, source_id, REVIEWER)

    for bundle in (before, after):
        assert bundle["coordinate_revision"] == loaded
        assert bundle["original"]["coordinate_revision"] == loaded
        # The record names the pipeline's key, which the raw parse lacks.
        assert bundle["hidden"] == bundle["original"]["hidden"] == {
            "analyses": [], "entities": [],
        }
    assert list(validator().iter_errors(after)) == []


def test_a_review_does_not_start_from_a_pipeline_revision_that_no_longer_validates(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    (paper, *_), config_id = ingest_run("1001", chain=1)
    write_papers(tmp_path, "1001", paper)
    source_id = import_run(session, tmp_path, config_id)["loaded"][0]["source_id"]
    source = session.get(ReviewSource, source_id)
    source.coordinate_revision = {**source.coordinate_revision, "analyses": "none"}
    session.flush()

    with pytest.raises(Conflict) as refused:
        service.start_review(session, source_id, REVIEWER)

    assert [error.code for error in refused.value.errors] == ["source_invalid"]
    assert "analyses" in refused.value.errors[0].message


def pipeline_source(session, root, chain):
    """``(source_id, paper)``: the source a run with ``chain`` revisions imports as."""
    (paper, *_), config_id = ingest_run("1001", chain)
    return pipeline_source_of(session, root, paper, config_id)


def pipeline_source_of(session, root, paper, config_id):
    """``(source_id, paper)``: the source the run of ``config_id`` imports as."""
    write_papers(root, "1001", paper)
    return import_run(session, root, config_id)["loaded"][0]["source_id"], paper


def exported_review(session, out, source_id, user_id, *ops):
    """``(record, revision)``: what the export of ``user_id``'s review with ``ops`` writes."""
    review, _ = service.start_review(session, source_id, user_id)
    if ops:
        batch = {"expected_last_seq": 0, "ops": list(ops)}
        service.post_ops(session, review["id"], user_id, batch)
    session.commit()
    exports.export_review(session, review["id"], out)
    article = session.get(ReviewSource, source_id).parsed_paper["header"]["article_id"]
    return tuple(
        json.loads((out / relative).read_text("utf-8"))
        for relative in (
            f"run/records/{article}.extraction.json",
            f"run/revisions/{article}.coordinate_parse.json",
        )
    )


def accept(key):
    return {
        "client_op_id": f"accept-{key}", "type": "verdict",
        "target": {"kind": "coordinate_analysis", "analysis_key": key}, "verdict": "accept",
    }


def test_the_export_of_an_unrevised_pipeline_source_ingests_as_a_revision_of_its_parse(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    _, original, _, _ = pipeline_documents("1001")

    source_id, paper = pipeline_source(session, tmp_path / "papers", 0)
    record, revision = exported_review(
        session, tmp_path / "out", source_id, REVIEWER, accept(original["analyses"][0]["key"])
    )

    assert revision["revision_of"] == original["parse_id"]
    summary = ingest_upload(
        {"coordinate_parse": revision, "record": record, "parsed_paper": paper}
    )
    assert (summary["kind"], summary["parse_id"]) == ("revision", revision["parse_id"])


@pytest.mark.parametrize("chain", [1, 2])
def test_the_export_of_a_revision_carrying_source_is_a_checked_revision_of_the_original(
    session, make_user, tmp_path, chain
):
    layouts = pytest.importorskip("study_schema.layouts", reason="needs study_schema[layouts]")
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    _, original, revisions, _ = pipeline_documents("1001", chain)
    loaded = coordinates.from_chain(original, revisions)

    source_id, _ = pipeline_source(session, tmp_path / "papers", chain)
    _, unedited = exported_review(session, tmp_path / "a", source_id, REVIEWER)
    make_user(OTHER, "admin-reviewer")
    _, judged = exported_review(
        session, tmp_path / "b", source_id, OTHER, accept(revisions[-1]["analyses"][0]["key"])
    )

    assert unedited == loaded
    for revision in (unedited, judged):
        assert schema_errors("coordinate-parse", revision) == []
        assert layouts.check_revision(
            CoordinateParse.model_validate(original), CoordinateParse.model_validate(revision)
        ) == []
    assert [v["verdict"] for v in judged["verdicts"]][0] == "edit"


def refused_not_current(body):
    with pytest.raises(NeuroStoreException) as refused, db.session.begin_nested():
        ingest_upload(body)
    assert "NOT_CURRENT" in str(refused.value.to_payload())


def read_from(revision, parse_id):
    """``revision`` with its header inputs naming ``parse_id`` as the parse it was read from."""
    inputs = [
        entry for entry in revision["header"]["inputs"]
        if entry["fingerprint"] in (revision["revision_of"], revision["text_sha256"])
    ]
    inputs.append({"artifact_kind": "coordinate_parse", "fingerprint": parse_id})
    return {**revision, "header": {**revision["header"], "inputs": inputs}}


@pytest.mark.parametrize("chain", [1, 2])
def test_the_export_of_a_revision_carrying_source_ingests_as_the_new_current_parse(
    session, make_user, tmp_path, chain
):
    make_user(REVIEWER, "admin-reviewer")
    make_user(OTHER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    _, original, revisions, _ = pipeline_documents("1001", chain)
    source_id, paper = pipeline_source(session, tmp_path / "papers", chain)
    record, unedited = exported_review(session, tmp_path / "a", source_id, REVIEWER)
    other_record, judged = exported_review(
        session, tmp_path / "b", source_id, OTHER, accept(revisions[-1]["analyses"][0]["key"])
    )
    stale = [original, *revisions][-2]["parse_id"]
    refused_not_current({"coordinate_parse": read_from(judged, stale), "parsed_paper": paper})

    summary = ingest_upload(
        {"coordinate_parse": unedited, "record": record, "parsed_paper": paper}
    )

    assert (summary["kind"], summary["parse_id"]) == ("revision", unedited["parse_id"])
    assert unedited["revision_of"] == original["parse_id"]
    stored = session.scalar(
        sa.select(PipelineStudyResult).join(PipelineConfig).join(Pipeline).where(
            Pipeline.name == PARSE_PIPELINE,
            PipelineStudyResult.id == summary["provenance"]["parse"]["result_id"],
        )
    )
    assert stored.result_data == unedited
    stored_record = session.get(PipelineStudyResult, summary["provenance"]["record"]["result_id"])
    assert {"artifact_kind": "coordinate_parse", "fingerprint": unedited["parse_id"]} in (
        stored_record.file_inputs
    )
    refused_not_current(
        {"coordinate_parse": judged, "record": other_record, "parsed_paper": paper}
    )


def test_an_unreviewed_revision_carrying_source_exports_the_pipelines_revision(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    source_id, paper = pipeline_source(session, tmp_path / "papers", 1)

    exports.export_bulk(session, tmp_path / "out", include_unreviewed=True)

    article = paper["header"]["article_id"]
    path = tmp_path / "out" / exports.UNREVIEWED_DIR / "run/revisions"
    path = path / f"{article}.coordinate_parse.json"
    assert path.is_file()
    assert json.loads(path.read_text("utf-8")) == session.get(
        ReviewSource, source_id
    ).coordinate_revision


@pytest.fixture
def run_import_cli(monkeypatch):
    monkeypatch.setattr(cli, "_run_with_runtime", lambda callback: callback(None, db))
    return lambda *args: CliRunner().invoke(cli.main, ["review-import-run", *args])


def test_the_run_cli_commits_the_sources_and_prints_the_report(
    session, make_user, tmp_path, run_import_cli
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    (paper, *_), config_id = ingest_run("1001", chain=1)
    write_papers(tmp_path, "1001", paper)

    result = run_import_cli(
        "--config-id", config_id, "--run-id", "run-1", "--user-id", REVIEWER,
        "--papers", str(tmp_path),
    )

    assert result.exit_code == 0, result.output
    assert [entry["study_id"] for entry in json.loads(result.output)["loaded"]] == ["1001"]
    with Session(session.bind) as fresh:
        source = fresh.scalar(sa.select(ReviewSource))
        assert (source.origin, source.loaded_by_id) == ("pipeline_run", REVIEWER)


def test_the_run_cli_exits_1_when_a_paper_fails_or_the_run_is_unknown(
    session, make_user, tmp_path, run_import_cli
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    _, config_id = ingest_run("1001")
    (tmp_path / "corpus").mkdir()

    missing = run_import_cli(
        "--config-id", config_id, "--run-id", "run-1", "--user-id", REVIEWER,
        "--papers", str(tmp_path),
    )
    unknown = run_import_cli(
        "--config-id", config_id, "--run-id", "run-9", "--user-id", REVIEWER,
        "--papers", str(tmp_path),
    )

    # A failed paper and an unknown run share exit 1 on purpose: either way nothing the
    # caller asked for loaded whole, and the output says which.
    assert missing.exit_code == 1
    assert json.loads(missing.output)["failed"][0]["problems"][0].startswith("no uploaded paper")
    assert unknown.exit_code == 1
    assert "pipeline run run-9 not found" in unknown.output


async def post_run(client, path, config_id, run_id="run-1"):
    return await client.client.post(
        "/api/review/imports/pipeline",
        data={"config_id": config_id, "run_id": run_id},
        files=upload(path),
        headers=client._get_headers(),
    )


def zipped_papers(tmp_path, chain=0):
    add_base_study(db.session, pmid="1001")
    (paper, *_), config_id = ingest_run("1001", chain)
    write_papers(tmp_path / "papers", "1001", paper)
    files = {
        str(path.relative_to(tmp_path / "papers")): path.read_bytes()
        for path in (tmp_path / "papers").rglob("*") if path.is_file()
    }
    return zip_layout(files, tmp_path / "papers.zip"), config_id


@pytest.mark.parametrize("caller, status", [(None, 401), (OTHER, 403), ("newuser-id", 403)])
async def test_the_pipeline_import_route_is_for_lead_reviewers_only(
    clients, make_user, tmp_path, session, caller, status
):
    make_user("newuser-id", "admin")
    archive, config_id = zipped_papers(tmp_path)

    response = await post_run(clients[caller], archive, config_id)

    assert response.status_code == status
    assert count(session, ReviewSource) == 0


async def test_a_lead_reviewer_gets_the_report_of_a_pipeline_import(clients, tmp_path, session):
    archive, config_id = zipped_papers(tmp_path, chain=1)

    response = await post_run(clients[LEAD], archive, config_id)

    assert response.status_code == 200, response.json()
    assert_matches_spec(response, "/review/imports/pipeline", "post")
    assert [entry["study_id"] for entry in response.json()["loaded"]] == ["1001"]
    source = session.scalar(sa.select(ReviewSource))
    assert (source.origin, source.loaded_by_id) == ("pipeline_run", LEAD)
    assert (source.pipeline_config_id, source.run_id) == (config_id, "run-1")
    assert source.coordinate_revision is not None


async def test_the_pipeline_import_route_answers_422_for_the_coordinate_parse_config(
    clients, tmp_path, session
):
    archive, _ = zipped_papers(tmp_path)
    parse_config = session.scalar(
        sa.select(PipelineConfig.id).join(Pipeline).where(Pipeline.name == PARSE_PIPELINE)
    )

    response = await post_run(clients[LEAD], archive, parse_config)

    assert response.status_code == 422
    assert_matches_spec(response, "/review/imports/pipeline", "post")
    assert count(session, ReviewSource) == 0


@pytest.mark.parametrize("missing", ["config_id", "run_id"])
async def test_the_pipeline_import_route_answers_400_without_a_config_or_run(
    clients, tmp_path, session, missing
):
    archive, config_id = zipped_papers(tmp_path)
    data = {"config_id": config_id, "run_id": "run-1"}
    del data[missing]

    response = await clients[LEAD].client.post(
        "/api/review/imports/pipeline", data=data, files=upload(archive),
        headers=clients[LEAD]._get_headers(),
    )

    assert response.status_code == 400
    assert_matches_spec(response, "/review/imports/pipeline", "post")
    assert count(session, ReviewSource) == 0


async def test_the_pipeline_import_route_answers_404_for_an_unknown_run(
    clients, tmp_path, session
):
    archive, config_id = zipped_papers(tmp_path)

    response = await post_run(clients[LEAD], archive, config_id, run_id="run-9")

    assert response.status_code == 404
    assert_matches_spec(response, "/review/imports/pipeline", "post")


async def test_the_pipeline_import_route_is_held_to_the_import_limit(
    clients, tmp_path, monkeypatch, session
):
    archive, config_id = zipped_papers(tmp_path)
    monkeypatch.setattr(body_limit, "MAX_IMPORT_BYTES", 10)

    response = await post_run(clients[LEAD], archive, config_id)

    assert response.status_code == 413
    assert_matches_spec(response, "/review/imports/pipeline", "post")
    assert count(session, ReviewSource) == 0


def test_the_coordinate_parse_pipelines_config_is_refused_as_holding_no_records(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    (paper, *_), _ = ingest_run("1001")
    write_papers(tmp_path, "1001", paper)
    parse_config = session.scalar(
        sa.select(PipelineConfig.id).join(Pipeline).where(Pipeline.name == "coordinate-parse")
    )

    with pytest.raises(Unprocessable, match="stores coordinate parses, not extraction records"):
        import_run(session, tmp_path, parse_config)


# stable entity ids (ADR 0009)


def test_a_runs_entities_get_the_stable_ids_of_the_study_entities_the_run_linked(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    base_study = add_base_study(session, pmid="1001")
    paper, original, record = clean("1001")
    record = with_unkeyed_analysis(record)
    summary = ingest_upload({
        "coordinate_parse": original, "record": record, "parsed_paper": paper, "run_id": "run-1",
    })
    db.session.commit()
    config_id = summary["provenance"]["record"]["config_id"]
    write_papers(tmp_path, "1001", paper)
    analysis_key = original["analyses"][0]["key"]
    stored = entity_stable_ids(session, base_study)
    assert sorted(stored) == [("Analysis", json.dumps(analysis_key)), ("Study", '""')]

    import_run(session, tmp_path, config_id)

    source = session.scalar(sa.select(ReviewSource))
    ids = stable_ids(source.record)
    assert ids["study-1"] == stored[("Study", '""')]
    assert ids["a1"] == stored[("Analysis", json.dumps(analysis_key))]
    assert is_uuid(ids["a2"])
    assert ids["a2"] not in stored.values()
    assert without_stable_ids(source.record) == record
    assert source.record_sha256 == sha256_of(record)
    assert source.judgeable_keys == entities.judgeable_keys(source.record, original)


def test_a_record_no_run_stored_gets_a_new_stable_id_on_each_entity(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    _, _, record = clean("1001")
    write_layout(tmp_path, "1001", *clean("1001"))

    imports.import_layout(session, tmp_path, user_id=REVIEWER)

    source = session.scalar(sa.select(ReviewSource))
    ids = stable_ids(source.record)
    assert sorted(ids) == ["a1", "study-1"]
    assert all(is_uuid(value) for value in ids.values()), ids
    assert ids["a1"] != ids["study-1"]
    assert count(session, StudyEntity) == 0
    assert without_stable_ids(source.record) == record
    assert source.record_sha256 == sha256_of(record)


def test_a_file_holding_the_record_a_run_stored_gets_the_runs_stable_ids(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    base_study = add_base_study(session, pmid="1001")
    (paper, original, _, record), _ = ingest_run("1001")
    stored = entity_stable_ids(session, base_study)
    write_layout(tmp_path, "1001", paper, original, record)

    imports.import_layout(session, tmp_path, user_id=REVIEWER)

    source = session.scalar(sa.select(ReviewSource))
    assert stable_ids(source.record) == {
        "study-1": stored[("Study", '""')],
        "a1": stored[("Analysis", json.dumps(original["analyses"][0]["key"]))],
    }


def test_an_entity_that_carries_a_stable_id_keeps_it_and_the_others_get_new_ones(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    paper, coordinate_parse, record = clean("1001")
    record["analyses"][0]["stable_id"] = STABLE_ANALYSIS
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)

    imports.import_layout(session, tmp_path, user_id=REVIEWER)

    ids = stable_ids(session.scalar(sa.select(ReviewSource)).record)
    assert ids["a1"] == STABLE_ANALYSIS
    assert is_uuid(ids["study-1"])
    assert ids["study-1"] != STABLE_ANALYSIS


def test_a_record_whose_run_linked_an_entity_keeps_the_stable_id_it_carries(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    base_study = add_base_study(session, pmid="1001")
    (paper, original, _, record), _ = ingest_run("1001")
    stored = entity_stable_ids(session, base_study)
    carried = {
        **record,
        "stable_id": STABLE_STUDY,
        "extraction_metadata": {**record["extraction_metadata"], "extractor_model": "other"},
    }
    ingest_upload({
        "coordinate_parse": original, "record": carried, "parsed_paper": paper, "run_id": "run-2",
    })
    db.session.commit()
    assert entity_stable_ids(session, base_study) == stored
    write_layout(tmp_path, "1001", paper, original, carried)

    imports.import_layout(session, tmp_path, user_id=REVIEWER)

    ids = stable_ids(session.scalar(sa.select(ReviewSource)).record)
    assert ids == {
        "study-1": STABLE_STUDY,
        "a1": stored[("Analysis", json.dumps(original["analyses"][0]["key"]))],
    }
    assert STABLE_STUDY not in stored.values()


def test_a_record_whose_entities_share_a_stable_id_fails_naming_it(session, make_user, tmp_path):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    paper, coordinate_parse, record = clean("1001")
    record["stable_id"] = STABLE_STUDY
    record["analyses"][0]["stable_id"] = STABLE_STUDY
    write_layout(tmp_path, "1001", paper, coordinate_parse, record)

    report = imports.import_layout(session, tmp_path, user_id=REVIEWER)

    assert report["failed"] == [{
        "study_id": "1001",
        "problems": [f"stable_id {STABLE_STUDY} is on more than one entity: a1, study-1"],
    }]
    assert count(session, ReviewSource) == 0


def test_a_reimport_of_an_unreviewed_export_is_skipped_as_the_source_it_exported(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    paper, coordinate_parse, record = clean("1001")
    paper["header"]["article_id"] = "art-1001"
    write_layout(tmp_path / "in", "1001", paper, coordinate_parse, record)
    first = imports.import_layout(session, tmp_path / "in", user_id=REVIEWER)
    source = session.get(ReviewSource, first["loaded"][0]["source_id"])
    exports.export_bulk(session, tmp_path / "out", include_unreviewed=True)
    exported = json.loads(
        (tmp_path / "out/unreviewed/run/records/art-1001.extraction.json").read_text("utf-8")
    )
    assert exported == source.record
    assert all(is_uuid(v) for v in stable_ids(exported).values())

    second = imports.import_layout(session, tmp_path / "out/unreviewed", user_id=REVIEWER)

    assert second["skipped"] == [
        {"study_id": "art-1001", "source_id": source.id, "reason": "already loaded"}
    ]
    assert count(session, ReviewSource) == 1


def test_a_reimported_review_export_keeps_its_stable_ids_and_a_second_reimport_is_skipped(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    paper, coordinate_parse, record = clean("1001")
    paper["header"]["article_id"] = "art-1001"
    write_layout(tmp_path / "in", "1001", paper, coordinate_parse, record)
    source_id = imports.import_layout(session, tmp_path / "in", user_id=REVIEWER)["loaded"][0][
        "source_id"
    ]
    loaded_ids = stable_ids(session.get(ReviewSource, source_id).record)
    review, _ = service.start_review(session, source_id, REVIEWER)
    exports.export_review(session, review["id"], tmp_path / "out")

    first = imports.import_layout(session, tmp_path / "out", user_id=REVIEWER)
    second = imports.import_layout(session, tmp_path / "out", user_id=REVIEWER)

    [loaded] = first["loaded"]
    assert all(is_uuid(v) for v in loaded_ids.values()), loaded_ids
    assert stable_ids(session.get(ReviewSource, loaded["source_id"]).record) == loaded_ids
    assert [entry["source_id"] for entry in second["skipped"]] == [loaded["source_id"]]
    assert count(session, ReviewSource) == 2


def test_a_group_renamed_in_review_keeps_its_entity_and_claims_through_export_and_ingest(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    base_study = add_base_study(session, pmid="1001")
    paper, original, record = clean("1001")
    record["groups"] = [
        records.item("Group", "g1", name=fx.extracted("patients"), age_mean=fx.extracted(34.2)),
        records.item("Group", "g2", name=fx.extracted("controls")),
    ]
    ingested = ingest_upload({
        "coordinate_parse": original, "record": record, "parsed_paper": paper, "run_id": "run-1",
    })
    db.session.commit()
    config_id = ingested["provenance"]["record"]["config_id"]

    def groups():
        return {
            entity.identity[0]: entity
            for entity in session.scalars(sa.select(StudyEntity).where(
                StudyEntity.base_study_id == base_study.id, StudyEntity.entity_class == "Group",
            ))
        }

    def claims(entity_id):
        return sorted(
            (claim.field_path, json.dumps(claim.value))
            for claim in session.scalars(
                sa.select(FieldClaim).where(FieldClaim.entity_id == entity_id)
            )
        )

    def links(config):
        prefix = f"{base_study.id}:"
        return {
            link.local_id.removeprefix(prefix): link.entity_id
            for link in session.scalars(
                sa.select(ExtractionEntityLink).where(ExtractionEntityLink.config_id == config)
            )
        }

    patients, controls = groups()["patients"], groups()["controls"]
    before = {"patients": claims(patients.id), "controls": claims(controls.id)}
    assert ("name", '"patients"') in before["patients"]
    assert ("age_mean", "34.2") in before["patients"]
    assert (links(config_id)["g1"], links(config_id)["g2"]) == (patients.id, controls.id)
    source_id, _ = pipeline_source_of(session, tmp_path / "papers", paper, config_id)
    rename = {
        "client_op_id": "rename-g1", "type": "set_value",
        "target": {"kind": "slot", "entity": "g1", "path": "name"},
        "value": {"extraction_status": "extracted", "value": "MDD patients",
                  "value_source": "reported"},
    }
    exported, revision = exported_review(
        session, tmp_path / "out", source_id, REVIEWER,
        rename, accept(original["analyses"][0]["key"]),
    )
    assert [(g["local_id"], g["name"]["value"], g["stable_id"]) for g in exported["groups"]] == [
        ("g1", "MDD patients", patients.stable_id), ("g2", "controls", controls.stable_id),
    ]

    summary = ingest_upload(
        {"coordinate_parse": revision, "record": exported, "parsed_paper": paper}
    )
    db.session.commit()

    correction = summary["provenance"]["record"]["config_id"]
    assert correction != config_id
    assert {name: entity.id for name, entity in groups().items()} == {
        "patients": patients.id, "controls": controls.id,
    }
    assert (links(correction)["g1"], links(correction)["g2"]) == (patients.id, controls.id)
    assert (links(config_id)["g1"], links(config_id)["g2"]) == (patients.id, controls.id)
    assert claims(patients.id) == sorted([*before["patients"], ("name", '"MDD patients"')])
    assert claims(controls.id) == before["controls"]


def with_groups(record, *names, model=None):
    """``record`` with a Group g1, g2, ... for each of ``names``, from ``model`` if given."""
    record = {
        **record,
        "groups": [
            records.item("Group", f"g{n}", name=fx.extracted(name))
            for n, name in enumerate(names, 1)
        ],
    }
    if model is not None:
        record["extraction_metadata"] = {**record["extraction_metadata"], "extractor_model": model}
    return record


def group_entities(session, base_study):
    """``{name: StudyEntity}`` of the base study's groups."""
    return {
        entity.identity[0]: entity
        for entity in session.scalars(sa.select(StudyEntity).where(
            StudyEntity.base_study_id == base_study.id, StudyEntity.entity_class == "Group",
        ))
    }


def entity_links(session, base_study, config_id):
    """``{local_id: entity id}`` of the config's links for ``base_study``."""
    prefix = f"{base_study.id}:"
    return {
        link.local_id.removeprefix(prefix): link.entity_id
        for link in session.scalars(
            sa.select(ExtractionEntityLink).where(ExtractionEntityLink.config_id == config_id)
        )
    }


def test_a_file_record_no_run_stored_gets_new_ids_though_a_run_of_its_paper_shares_local_ids(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    base_study = add_base_study(session, pmid="1001")
    paper, original, record = clean("1001")
    ran = ingest_upload({
        "coordinate_parse": original, "record": with_groups(record, "patients"),
        "parsed_paper": paper, "run_id": "run-1",
    })
    db.session.commit()
    run_config = ran["provenance"]["record"]["config_id"]
    patients = group_entities(session, base_study)["patients"]
    stored = entity_stable_ids(session, base_study)
    write_layout(tmp_path, "1001", paper, original, with_groups(record, "controls"))

    imports.import_layout(session, tmp_path, user_id=REVIEWER)

    source = session.scalar(sa.select(ReviewSource))
    g1 = source.record["groups"][0]["stable_id"]
    assert is_uuid(g1)
    assert g1 != patients.stable_id
    assert g1 not in stored.values()
    assert source.record["stable_id"] != stored[("Study", '""')]

    summary = ingest_upload(
        {"coordinate_parse": original, "record": source.record, "parsed_paper": paper}
    )
    db.session.commit()

    groups = group_entities(session, base_study)
    assert sorted(groups) == ["controls", "patients"]
    assert (groups["patients"].id, groups["patients"].stable_id) == (
        patients.id, patients.stable_id,
    )
    assert groups["controls"].stable_id == g1
    assert summary["provenance"]["record"]["config_id"] == run_config
    assert entity_links(session, base_study, run_config)["g1"] == groups["controls"].id


def test_a_run_record_gets_the_stable_ids_its_own_config_linked_not_another_configs(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    base_study = add_base_study(session, pmid="1001")
    paper, original, record = clean("1001")
    configs = {}
    for run_id, name, model in (("run-1", "patients", None), ("run-2", "controls", "other")):
        summary = ingest_upload({
            "coordinate_parse": original, "record": with_groups(record, name, model=model),
            "parsed_paper": paper, "run_id": run_id,
        })
        db.session.commit()
        configs[name] = (summary["provenance"]["record"]["config_id"], run_id)
    assert configs["patients"][0] != configs["controls"][0]
    groups = group_entities(session, base_study)
    write_papers(tmp_path, "1001", paper)

    loaded = {}
    for name, (config_id, run_id) in configs.items():
        [entry] = import_run(session, tmp_path, config_id, run_id)["loaded"]
        loaded[name] = session.get(ReviewSource, entry["source_id"]).record["groups"][0]

    assert {name: group["stable_id"] for name, group in loaded.items()} == {
        "patients": groups["patients"].stable_id, "controls": groups["controls"].stable_id,
    }
    assert groups["patients"].stable_id != groups["controls"].stable_id


def test_a_run_of_an_ingested_export_is_skipped_as_the_file_source_it_exported(
    session, make_user, tmp_path
):
    make_user(REVIEWER, "admin-reviewer")
    add_base_study(session, pmid="1001")
    paper, original, record = clean("1001")
    write_layout(tmp_path / "files", "1001", paper, original, record)
    [loaded] = imports.import_layout(session, tmp_path / "files", user_id=REVIEWER)["loaded"]
    exported = session.get(ReviewSource, loaded["source_id"]).record
    assert all(is_uuid(value) for value in stable_ids(exported).values())
    summary = ingest_upload({
        "coordinate_parse": original, "record": exported, "parsed_paper": paper,
        "run_id": "run-2",
    })
    db.session.commit()
    write_papers(tmp_path / "papers", "1001", paper)

    report = import_run(
        session, tmp_path / "papers", summary["provenance"]["record"]["config_id"], "run-2"
    )

    assert report == {
        "loaded": [],
        "skipped": [{
            "study_id": "1001", "source_id": loaded["source_id"], "reason": "already loaded",
        }],
        "failed": [],
    }
    assert count(session, ReviewSource) == 1
