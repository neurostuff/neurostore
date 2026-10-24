"""The identifiers of base studies: one table of every id, the version of record's columns
kept in step with it by a trigger, and one resolver for every write that names a paper.

The papers are real: the 2003 NeuroImage paper (doi 10.1016/S1053-8119(03)00003-X, pmid
12667850) already on neurostore as two base studies, and a bioRxiv preprint that was
published later.
"""

import datetime as dt
import json
import logging

import pytest
import sqlalchemy as sa

from click.testing import CliRunner

from neurostore import cli, service_migrations
from neurostore.base_studies import (
    LOCK_BUCKETS,
    Holder,
    article_identifiers,
    find_base_study,
    lock_identifiers,
    normalize,
    resolve,
    searched_identifiers,
)
from neurostore.ingest.study_schema import ingest_upload
from neurostore.models import BaseStudy, BaseStudyIdentifier, BaseStudyMergeCandidate
from neurostore.services.base_study_metadata_enrichment import (
    _apply_base_study_enrichment,
    _GatheredEnrichment,
    merge_base_study,
)
from neurostore.tests import study_schema_fixtures as fx
from neurostore.tests.test_merge_base_studies import GAIN
from neurostore.tests.test_study_schema_ingest import preprint_parse

pytestmark = pytest.mark.anyio

DOI = "10.1016/S1053-8119(03)00003-X"
PMID = "12667850"
PMCID = "PMC1234567"
PREPRINT_DOI = {"doi": "10.1101/2025.01.01.000001", "server": "biorxiv"}
OTHER_PREPRINT_DOI = {"doi": "10.1101/2025.02.02.000002", "server": "medrxiv"}


def _at(day):
    return dt.datetime(2025, 1, day, tzinfo=dt.timezone.utc)


def _rows(session, base_study_id=None):
    session.expire_all()
    query = sa.select(
        BaseStudyIdentifier.base_study_id,
        BaseStudyIdentifier.kind,
        BaseStudyIdentifier.scheme,
        BaseStudyIdentifier.value,
    ).order_by(BaseStudyIdentifier.scheme, BaseStudyIdentifier.value)
    if base_study_id is not None:
        query = query.where(BaseStudyIdentifier.base_study_id == base_study_id)
    return [tuple(row) for row in session.execute(query)]


def _held(session, base_study_id):
    return {(kind, scheme, value) for _, kind, scheme, value in _rows(session, base_study_id)}


def _base_study(session, name, created=1, **fields):
    base_study = BaseStudy(name=name, level="group", created_at=_at(created), **fields)
    session.add(base_study)
    session.commit()
    return base_study


def _add(session, base_study, kind, scheme, value, server=None):
    session.add(
        BaseStudyIdentifier(
            base_study_id=base_study.id, kind=kind, scheme=scheme, value=value, server=server
        )
    )
    session.commit()


def _candidates(session):
    session.expire_all()
    return [
        (c.first_base_study_id, c.second_base_study_id, c.matched, c.source)
        for c in session.scalars(sa.select(BaseStudyMergeCandidate))
    ]


def _shared_report_of(caplog, source):
    (record,) = [
        r
        for r in caplog.records
        if r.name == "neurostore.base_studies" and r.base_study_identifiers["source"] == source
    ]
    return record.base_study_identifiers


def _shared_report(caplog):
    (record,) = [r for r in caplog.records if r.name == "neurostore.base_studies"]
    assert record.levelno == logging.WARNING
    report = json.loads(record.getMessage().split(": ", 1)[1])
    assert report == record.base_study_identifiers
    return report


# --- one normal form ---------------------------------------------------------------

NORMAL_FORMS = [
    ("doi", "10.1016/S1053-8119(03)00003-X", "10.1016/s1053-8119(03)00003-x"),
    ("doi", " https://doi.org/10.1101/2025.01.01.000001\n", "10.1101/2025.01.01.000001"),
    ("doi", "http://dx.doi.org/10.7554/eLife.106070.1", "10.7554/elife.106070.1"),
    ("doi", "DOI: 10.1038/NN.1234", "10.1038/nn.1234"),
    ("doi", "   ", None),
    ("pmid", "12667850", "12667850"),
    ("pmid", " 12667850 ", "12667850"),
    ("pmid", "https://pubmed.ncbi.nlm.nih.gov/12667850/", "12667850"),
    ("pmid", "PMID: 12667850", "12667850"),
    # The marker production's duplicate base studies carry after the pmid they duplicate.
    ("pmid", "14715131-DUPLICATE", "14715131"),
    # Not a pmid: kept, so never taken for one.
    ("pmid", "k6Rp9XqL", "k6Rp9XqL"),
    ("pmid", "9STu4w8M", "9STu4w8M"),
    ("pmid", "", None),
    ("pmcid", "PMC1234567", "PMC1234567"),
    ("pmcid", "pmc1234567", "PMC1234567"),
    ("pmcid", "1234567", "PMC1234567"),
    ("pmcid", " https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1234567/ ", "PMC1234567"),
]


@pytest.mark.parametrize("scheme, value, expected", NORMAL_FORMS)
def test_python_and_the_database_normalize_an_identifier_alike(session, scheme, value, expected):
    in_database = session.scalar(
        sa.text("SELECT normalize_base_study_identifier(:scheme, :value)"),
        {"scheme": scheme, "value": value},
    )
    assert normalize(scheme, value) == in_database == expected


def test_a_paper_is_held_under_each_of_its_buckets():
    identifiers = article_identifiers(
        {
            "doi": DOI,
            "pmid": PMID,
            "preprint_dois": [PREPRINT_DOI],
            "preprint_pmids": ["40000001"],
            "alternative_dois": ["10.1016/s1053-8119(03)00003-x", "10.1016/ALT"],
            "alternative_pmcids": ["1234567"],
        }
    )
    assert [(i.kind, i.scheme, i.value) for i in identifiers] == [
        ("vor", "doi", DOI.lower()),
        ("vor", "pmid", PMID),
        ("preprint", "doi", PREPRINT_DOI["doi"]),
        ("preprint", "pmid", "40000001"),
        # An id posted under two kinds is held once, under the stronger.
        ("alternative", "doi", "10.1016/alt"),
        ("alternative", "pmcid", "PMC1234567"),
    ]
    assert identifiers[2].server == "biorxiv"


# --- the trigger keeps the version of record's rows in step with the columns -------


def test_the_columns_of_a_new_base_study_become_its_version_of_record_rows(session):
    base_study = _base_study(session, "paper", doi=DOI, pmid=PMID, pmcid="1234567")

    assert _held(session, base_study.id) == {
        ("vor", "doi", DOI.lower()),
        ("vor", "pmid", PMID),
        ("vor", "pmcid", PMCID),
    }
    # The API's column keeps what was written.
    assert session.get(BaseStudy, base_study.id).doi == DOI


def test_changing_and_clearing_a_column_changes_and_clears_its_row(session):
    base_study = _base_study(session, "paper", doi=DOI, pmid=PMID)

    base_study.doi = "10.1016/CHANGED"
    base_study.pmid = None
    session.commit()

    assert _held(session, base_study.id) == {("vor", "doi", "10.1016/changed")}


def test_a_column_written_by_raw_sql_is_kept_in_step_too(session):
    base_study = _base_study(session, "paper", pmid=PMID)

    session.execute(
        sa.text("UPDATE base_studies SET doi = :doi, pmid = NULL WHERE id = :id"),
        {"doi": DOI, "id": base_study.id},
    )
    session.commit()

    assert _held(session, base_study.id) == {("vor", "doi", DOI.lower())}


def test_a_column_taking_an_id_the_base_study_already_holds_as_an_alternative_makes_it_the_record(
    session,
):
    base_study = _base_study(session, "paper", pmid=PMID)
    _add(session, base_study, "alternative", "doi", DOI.lower())

    base_study.doi = DOI
    session.commit()

    assert _held(session, base_study.id) == {("vor", "pmid", PMID), ("vor", "doi", DOI.lower())}


def test_an_id_stays_with_its_holder_whatever_its_case_and_the_pair_is_recorded(session):
    first = _base_study(session, "first", created=1, doi=DOI)

    second = _base_study(session, "second", created=2, doi=DOI.upper())

    assert session.get(BaseStudy, second.id).doi == DOI.upper()
    assert _held(session, first.id) == {("vor", "doi", DOI.lower())}
    assert _held(session, second.id) == set()
    assert [c[:2] for c in _candidates(session)] == [tuple(sorted((first.id, second.id)))]


def test_an_id_held_as_a_preprint_or_alternative_stays_with_its_holder(session):
    holder = _base_study(session, "holder", created=1, pmid=PMID)
    _add(session, holder, "preprint", "doi", PREPRINT_DOI["doi"], server="biorxiv")

    taker = _base_study(session, "taker", created=2, doi=PREPRINT_DOI["doi"])

    assert _held(session, taker.id) == set()
    assert ("preprint", "doi", PREPRINT_DOI["doi"]) in _held(session, holder.id)
    assert [c[:2] for c in _candidates(session)] == [tuple(sorted((holder.id, taker.id)))]


def test_a_deactivated_base_study_gives_its_ids_to_its_successor_as_alternatives(session):
    keeper = _base_study(session, "keeper", doi=DOI, pmcid=PMCID)
    old = _base_study(session, "old", created=2, doi="10.1016/OLD", pmid=PMID)
    _add(session, old, "preprint", "doi", PREPRINT_DOI["doi"], server="biorxiv")

    session.execute(
        sa.update(BaseStudy)
        .where(BaseStudy.id == old.id)
        .values(is_active=False, superseded_by=keeper.id)
    )
    session.commit()

    assert _held(session, old.id) == set()
    assert _held(session, keeper.id) == {
        ("vor", "doi", DOI.lower()),
        ("vor", "pmcid", PMCID),
        ("alternative", "doi", "10.1016/old"),
        ("alternative", "pmid", PMID),
        ("preprint", "doi", PREPRINT_DOI["doi"]),
    }
    assert session.get(BaseStudy, old.id).doi == "10.1016/OLD"


def test_a_deactivated_base_study_with_no_successor_frees_its_ids(session):
    pruned = _base_study(session, "pruned", doi=DOI)

    session.execute(sa.update(BaseStudy).where(BaseStudy.id == pruned.id).values(is_active=False))
    session.commit()

    assert _rows(session) == []
    _base_study(session, "new", created=2, doi=DOI)


def test_deleting_a_base_study_deletes_its_ids(session):
    base_study = _base_study(session, "paper", doi=DOI)
    session.execute(sa.delete(BaseStudy).where(BaseStudy.id == base_study.id))
    session.commit()

    assert _rows(session) == []


# --- POST /base-studies ------------------------------------------------------------


async def _post(auth_client, body):
    response = await auth_client.post("/api/base-studies/", data=body)
    assert response.status_code == 200, response.text
    return response.json()


async def test_a_single_post_naming_a_held_id_returns_that_base_study(auth_client, session):
    first = await _post(auth_client, {"name": "paper", "pmid": PMID, "level": "group"})

    second = await _post(
        auth_client, {"name": "same paper again", "pmid": PMID, "doi": DOI, "level": "group"}
    )

    assert second["id"] == first["id"]
    assert second["name"] == "paper"
    assert second["doi"] == DOI
    assert session.scalar(sa.select(sa.func.count()).select_from(BaseStudy)) == 1
    assert _held(session, first["id"]) == {("vor", "pmid", PMID), ("vor", "doi", DOI.lower())}


async def test_a_post_matching_by_any_bucket_adds_the_ids_it_lacks_and_keeps_curated_ones(
    auth_client, session
):
    base_study = _base_study(session, "curated", doi=DOI)
    _add(session, base_study, "preprint", "doi", PREPRINT_DOI["doi"], server="biorxiv")

    result = await _post(
        auth_client,
        [
            {
                "name": "ignored",
                "doi": "10.1016/ANOTHER",
                "pmid": PMID,
                "preprint_dois": [PREPRINT_DOI, OTHER_PREPRINT_DOI],
                "preprint_pmids": ["40000001"],
                "alternative_pmcids": ["1234567"],
            }
        ],
    )

    assert [r["id"] for r in result] == [base_study.id]
    assert result[0]["doi"] == DOI
    assert result[0]["pmid"] == PMID
    assert result[0]["name"] == "curated"
    assert result[0]["preprint_dois"] == [PREPRINT_DOI, OTHER_PREPRINT_DOI]
    assert result[0]["preprint_pmids"] == ["40000001"]
    assert result[0]["alternative_pmcids"] == [PMCID]
    # A doi that is not the record's, the record's doi being curated, is kept as an alternative.
    assert result[0]["alternative_dois"] == ["10.1016/another"]
    assert session.scalar(sa.select(sa.func.count()).select_from(BaseStudy)) == 1
    assert _candidates(session) == []


async def test_a_post_naming_no_held_id_creates_a_base_study_holding_every_id(
    auth_client, session
):
    created = await _post(
        auth_client,
        {
            "name": "new",
            "doi": DOI,
            "publication_status": "published",
            "preprint_dois": [PREPRINT_DOI],
            "alternative_pmids": ["40000002"],
        },
    )

    assert created["publication_status"] == "published"
    assert created["preprint_dois"] == [PREPRINT_DOI]
    assert created["alternative_pmids"] == ["40000002"]
    assert _held(session, created["id"]) == {
        ("vor", "doi", DOI.lower()),
        ("preprint", "doi", PREPRINT_DOI["doi"]),
        ("alternative", "pmid", "40000002"),
    }
    assert session.get(BaseStudy, created["id"]).publication_status == "published"


async def test_a_preprint_only_post_creates_a_preprint_base_study(auth_client, session):
    created = await _post(
        auth_client,
        {"name": "preprint", "publication_status": "preprint", "preprint_pmids": ["40000001"]},
    )

    assert created["doi"] is None
    assert created["preprint_pmids"] == ["40000001"]
    assert created["publication_status"] == "preprint"


async def test_one_bulk_post_resolves_its_studies_against_each_other(auth_client, session):
    older = _base_study(session, "older", pmid=PMID)

    result = await _post(
        auth_client,
        [
            {"name": "a", "preprint_pmids": ["40000001"]},
            {"name": "a again, by its doi", "doi": DOI, "preprint_pmids": ["40000001"]},
            {"name": "the held one", "pmid": PMID},
            {"name": "also the held one", "pmid": PMID, "alternative_dois": [DOI]},
            {"name": "unrelated", "pmid": "99999999"},
        ],
    )

    ids = [r["id"] for r in result]
    assert ids[0] == ids[1]
    assert ids[2] == ids[3] == older.id
    assert len({ids[0], ids[2], ids[4]}) == 3
    assert result[1]["doi"] == DOI
    # The doi the second study took was no longer free for the fourth: held by the first.
    assert _held(session, ids[0]) >= {("vor", "doi", DOI.lower())}
    ((first, second, matched, source),) = _candidates(session)
    assert (first, second) == tuple(sorted((ids[0], older.id)))
    assert matched == [{"kind": "alternative", "scheme": "doi", "value": DOI.lower()}]
    assert source == "post"


async def test_ids_spanning_two_active_base_studies_use_the_one_of_the_strongest_id(
    auth_client, session, caplog
):
    by_pmid = _base_study(session, "holds the pmid", created=1, pmid=PMID)
    by_doi = _base_study(session, "holds the doi", created=2, doi=DOI)

    with caplog.at_level(logging.WARNING, logger="neurostore.base_studies"):
        result = await _post(auth_client, {"name": "paper", "doi": DOI, "pmid": PMID})

    # A doi outranks a pmid, so the newer base study is the paper; the pmid stays where it was.
    assert result["id"] == by_doi.id
    assert result["pmid"] is None
    assert _held(session, by_doi.id) == {("vor", "doi", DOI.lower())}
    assert _held(session, by_pmid.id) == {("vor", "pmid", PMID)}
    report = _shared_report(caplog)
    assert report["source"] == "post"
    assert report["base_study_id"] == by_doi.id
    assert report["also_held_by"] == {
        by_pmid.id: [{"kind": "vor", "scheme": "pmid", "value": PMID}]
    }
    first, second = sorted((by_doi.id, by_pmid.id))
    assert _candidates(session) == [
        (first, second, [{"kind": "vor", "scheme": "pmid", "value": PMID}], "post")
    ]


@pytest.mark.parametrize(
    "posted, winner",
    [
        # doi > pmid > pmcid
        ({"pmid": PMID, "pmcid": PMCID}, "pmid"),
        # a version of record's id > a preprint's > an alternative
        ({"pmcid": PMCID, "preprint_pmids": ["40000001"]}, "pmcid"),
        ({"preprint_pmids": ["40000001"], "alternative_pmids": ["40000002"]}, "preprint"),
    ],
)
async def test_the_strength_of_an_id_decides_between_base_studies(
    auth_client, session, posted, winner
):
    holders = {
        "pmid": _base_study(session, "pmid", created=2, pmid=PMID),
        "pmcid": _base_study(session, "pmcid", created=1, pmcid=PMCID),
        "preprint": _base_study(session, "preprint", created=2),
        "alternative": _base_study(session, "alternative", created=1),
    }
    _add(session, holders["preprint"], "preprint", "pmid", "40000001")
    _add(session, holders["alternative"], "alternative", "pmid", "40000002")

    result = await _post(auth_client, {"name": "paper", **posted})

    assert result["id"] == holders[winner].id


async def test_of_equally_strong_ids_the_oldest_base_study_is_used(auth_client, session):
    newer = _base_study(session, "newer", created=5)
    older = _base_study(session, "older", created=3)
    _add(session, newer, "alternative", "doi", "10.1/a")
    _add(session, older, "alternative", "doi", "10.1/b")

    result = await _post(auth_client, {"name": "paper", "alternative_dois": ["10.1/a", "10.1/b"]})

    assert result["id"] == older.id
    assert [c[:2] for c in _candidates(session)] == [tuple(sorted((newer.id, older.id)))]


async def test_a_post_is_never_refused_for_ids_held_by_several_base_studies(
    auth_client, session
):
    one = _base_study(session, "one", created=1, doi=DOI)
    two = _base_study(session, "two", created=2, pmid=PMID)
    three = _base_study(session, "three", created=3, pmcid=PMCID)

    result = await _post(
        auth_client,
        {"name": "paper", "doi": DOI, "pmid": PMID, "pmcid": PMCID, "preprint_pmids": ["1"]},
    )

    assert result["id"] == one.id
    assert result["preprint_pmids"] == ["1"]
    pairs = {(first, second) for first, second, _, _ in _candidates(session)}
    assert pairs == {tuple(sorted((one.id, two.id))), tuple(sorted((one.id, three.id)))}


async def test_a_second_candidate_of_one_pair_adds_the_ids_to_the_record_of_the_pair(
    auth_client, session
):
    one = _base_study(session, "one", created=1, doi=DOI, pmid="1")
    two = _base_study(session, "two", created=2, pmid=PMID, pmcid=PMCID)

    await _post(auth_client, {"doi": DOI, "pmid": PMID})
    await _post(auth_client, {"doi": DOI, "pmcid": PMCID})

    ((first, second, matched, _),) = _candidates(session)
    assert (first, second) == tuple(sorted((one.id, two.id)))
    assert {m["scheme"] for m in matched} == {"pmid", "pmcid"}


async def test_a_post_with_a_bad_server_is_a_validation_error(auth_client):
    response = await auth_client.post(
        "/api/base-studies/",
        data={"name": "x", "preprint_dois": [{"doi": "10.1101/x", "server": "not-a-server"}]},
    )
    assert response.status_code in (400, 422)


# --- PUT /base-studies/{id} ---------------------------------------------------------


async def test_a_put_changing_the_doi_moves_its_row(auth_client, session):
    base_study = await _post(auth_client, {"name": "paper", "doi": DOI})

    response = await auth_client.put(
        f"/api/base-studies/{base_study['id']}", data={"doi": "10.1016/CORRECTED"}
    )

    assert response.status_code == 200, response.text
    assert _held(session, base_study["id"]) == {("vor", "doi", "10.1016/corrected")}


async def test_a_put_adds_the_ids_it_lists(auth_client, session):
    base_study = await _post(auth_client, {"name": "paper", "doi": DOI})

    response = await auth_client.put(
        f"/api/base-studies/{base_study['id']}",
        data={"preprint_dois": [PREPRINT_DOI], "alternative_pmids": ["40000002"]},
    )

    assert response.status_code == 200, response.text
    assert response.json()["preprint_dois"] == [PREPRINT_DOI]
    assert response.json()["alternative_pmids"] == ["40000002"]
    assert _held(session, base_study["id"]) >= {
        ("preprint", "doi", PREPRINT_DOI["doi"]),
        ("alternative", "pmid", "40000002"),
    }


async def test_a_put_naming_an_id_another_base_study_holds_is_taken_as_it_is(
    auth_client, session, caplog
):
    base_study = await _post(auth_client, {"name": "paper", "doi": DOI})
    other = _base_study(session, "other", pmid=PMID)

    with caplog.at_level(logging.WARNING, logger="neurostore.base_studies"):
        response = await auth_client.put(
            f"/api/base-studies/{base_study['id']}",
            data={"pmid": PMID, "preprint_pmids": ["40000001"]},
        )

    assert response.status_code == 200, response.text
    assert response.json()["pmid"] == PMID
    assert response.json()["preprint_pmids"] == ["40000001"]
    # The id stays with the base study that held it, and the pair is left to be merged.
    assert _held(session, other.id) == {("vor", "pmid", PMID)}
    assert _held(session, base_study["id"]) == {
        ("vor", "doi", DOI.lower()),
        ("preprint", "pmid", "40000001"),
    }
    report = _shared_report(caplog)
    assert (report["source"], report["also_held_by"]) == (
        "put",
        {other.id: [{"kind": "vor", "scheme": "pmid", "value": PMID}]},
    )
    assert [c[:2] for c in _candidates(session)] == [
        tuple(sorted((base_study["id"], other.id)))
    ]


async def test_a_get_lists_the_ids_of_each_bucket(auth_client, session):
    base_study = _base_study(session, "paper", doi=DOI, publication_status="published")
    _add(session, base_study, "preprint", "doi", PREPRINT_DOI["doi"], server="biorxiv")
    _add(session, base_study, "alternative", "pmcid", PMCID)

    body = (await auth_client.get(f"/api/base-studies/{base_study.id}")).json()

    assert body["preprint_dois"] == [PREPRINT_DOI]
    assert body["alternative_pmcids"] == [PMCID]
    assert body["preprint_pmids"] == []
    assert body["publication_status"] == "published"
    listed = (await auth_client.get("/api/base-studies/")).json()["results"]
    assert listed[0]["preprint_dois"] == [PREPRINT_DOI]


# --- POST /studies -------------------------------------------------------------------


async def test_a_study_post_is_linked_to_the_base_study_holding_any_of_its_ids(
    auth_client, session
):
    held = _base_study(session, "held by its pmid", pmid=PMID)

    response = await auth_client.post(
        "/api/studies/", data={"name": "a version", "doi": DOI, "pmid": PMID, "level": "group"}
    )

    assert response.status_code == 200, response.text
    assert response.json()["base_study"] == held.id
    assert session.scalar(sa.select(sa.func.count()).select_from(BaseStudy)) == 1
    assert _held(session, held.id) == {("vor", "pmid", PMID), ("vor", "doi", DOI.lower())}


async def test_a_study_post_with_ids_held_by_two_base_studies_is_linked_to_the_strongest(
    auth_client, session
):
    by_pmid = _base_study(session, "pmid", created=1, pmid=PMID)
    by_doi = _base_study(session, "doi", created=2, doi=DOI)

    response = await auth_client.post(
        "/api/studies/", data={"name": "a version", "doi": DOI, "pmid": PMID, "level": "group"}
    )

    assert response.status_code == 200, response.text
    assert response.json()["base_study"] == by_doi.id
    assert [c[:2] for c in _candidates(session)] == [tuple(sorted((by_pmid.id, by_doi.id)))]


async def test_a_study_post_naming_new_ids_creates_the_base_study_holding_them(
    auth_client, session
):
    response = await auth_client.post(
        "/api/studies/",
        data={"name": "a version", "doi": DOI, "pmcid": "1234567", "level": "group"},
    )

    assert response.status_code == 200, response.text
    assert _held(session, response.json()["base_study"]) == {
        ("vor", "doi", DOI.lower()),
        ("vor", "pmcid", PMCID),
    }


# --- the ingest ----------------------------------------------------------------------


def _parse(**ids):
    return preprint_parse(**ids)


def test_a_preprint_only_parse_creates_a_preprint_base_study(session):
    summary = ingest_upload(
        {"coordinate_parse": _parse(preprint_pmids=["40000001"], preprint_dois=[PREPRINT_DOI])}
    )

    base_study = session.get(BaseStudy, summary["base_study_id"])
    assert base_study.publication_status == "preprint"
    assert _held(session, base_study.id) == {
        ("preprint", "pmid", "40000001"),
        ("preprint", "doi", PREPRINT_DOI["doi"]),
    }


def test_a_later_parse_with_the_version_of_record_publishes_the_preprint_base_study(session):
    first = ingest_upload({"coordinate_parse": _parse(preprint_dois=[PREPRINT_DOI])})

    second = ingest_upload(
        {"coordinate_parse": _parse(pmid=PMID, preprint_dois=[PREPRINT_DOI])}
    )

    assert second["base_study_id"] == first["base_study_id"]
    base_study = session.get(BaseStudy, first["base_study_id"])
    assert (base_study.pmid, base_study.publication_status) == (PMID, "published")
    assert _held(session, base_study.id) == {
        ("vor", "pmid", PMID),
        ("preprint", "doi", PREPRINT_DOI["doi"]),
    }


def test_a_published_base_study_is_not_made_a_preprint_again(session):
    first = ingest_upload({"coordinate_parse": _parse(pmid=PMID)})

    ingest_upload({"coordinate_parse": _parse(pmid=PMID, preprint_pmids=["40000001"])})

    base_study = session.get(BaseStudy, first["base_study_id"])
    assert base_study.publication_status == "published"
    assert ("preprint", "pmid", "40000001") in _held(session, base_study.id)


def test_a_parse_names_the_base_study_of_its_alternative_ids(session):
    holder = _base_study(session, "paper", doi=DOI)

    summary = ingest_upload(
        {"coordinate_parse": _parse(pmid=PMID, alternative_dois=[DOI.lower()])}
    )

    assert summary["base_study_id"] == holder.id
    assert _held(session, holder.id) == {("vor", "doi", DOI.lower()), ("vor", "pmid", PMID)}


def test_a_parse_whose_ids_span_two_base_studies_takes_the_strongest_and_records_the_pair(
    session, caplog
):
    by_pmid = _base_study(session, "pmid", created=1, pmid=PMID)
    by_doi = _base_study(session, "doi", created=2, doi=DOI)

    with caplog.at_level(logging.WARNING, logger="neurostore.base_studies"):
        summary = ingest_upload({"coordinate_parse": _parse(doi=DOI, pmid=PMID)})

    assert summary["base_study_id"] == by_doi.id
    assert _shared_report(caplog)["source"] == "ingest"
    assert [c[:2] for c in _candidates(session)] == [tuple(sorted((by_pmid.id, by_doi.id)))]


def test_every_searched_identifier_is_named_when_no_base_study_matches():
    header = {
        "neurostore_base_study_id": "abc",
        "identifiers": fx.identifiers(
            pmid=PMID, preprint_dois=[PREPRINT_DOI], alternative_pmcids=["1234567"]
        ),
    }

    assert list(searched_identifiers(header)) == [
        ("neurostore_base_study_id", "abc"),
        ("pmid", PMID),
        ("preprint_doi", PREPRINT_DOI["doi"]),
        ("alternative_pmcid", PMCID),
    ]


# --- merged base studies --------------------------------------------------------------


def test_a_chain_of_merges_leaves_every_id_on_the_last_keeper(session):
    first = _base_study(session, "first", created=1, doi="10.1/first", pmid="1")
    second = _base_study(session, "second", created=2, doi="10.1/second", pmid="2")
    third = _base_study(session, "third", created=3, pmid="3")
    _add(session, first, "preprint", "doi", PREPRINT_DOI["doi"], server="biorxiv")

    merge_base_study(second, first)
    session.commit()
    merge_base_study(third, second)
    session.commit()

    assert {row[0] for row in _rows(session)} == {third.id}
    assert _held(session, third.id) == {
        ("vor", "pmid", "3"),
        ("vor", "doi", "10.1/second"),
        ("alternative", "doi", "10.1/first"),
        ("alternative", "pmid", "1"),
        ("alternative", "pmid", "2"),
        ("preprint", "doi", PREPRINT_DOI["doi"]),
    }
    # The ids of the base study merged first find the last keeper, and so does its own id.
    assert find_base_study(session, {"identifiers": {"doi": "10.1/first"}}).id == third.id
    preprint_header = {"identifiers": {"preprint_dois": [PREPRINT_DOI]}}
    assert find_base_study(session, preprint_header).id == third.id
    assert find_base_study(session, {"neurostore_base_study_id": first.id}).id == third.id


# --- the enrichment worker ------------------------------------------------------------


def _enrich(session, base_study, **gathered):
    _apply_base_study_enrichment(
        _GatheredEnrichment(
            base_study.id, {"doi": None, "pmid": None, "pmcid": None, **gathered}, []
        ),
        logger=logging.getLogger("worker-test"),
    )
    session.commit()


def test_an_enrichment_gaining_an_id_another_base_study_holds_merges_into_the_older(session):
    holder = _base_study(session, "holder", created=1, doi=DOI)
    enriched = _base_study(session, "enriched", created=2, pmid=PMID)

    _enrich(session, enriched, pmid=PMID, doi=DOI, pmcid=PMCID)

    session.expire_all()
    enriched, holder = session.get(BaseStudy, enriched.id), session.get(BaseStudy, holder.id)
    assert (enriched.is_active, enriched.superseded_by) == (False, holder.id)
    assert (holder.doi, holder.pmid, holder.pmcid) == (DOI, PMID, PMCID)
    assert _held(session, holder.id) == {
        ("vor", "doi", DOI.lower()),
        ("vor", "pmid", PMID),
        ("vor", "pmcid", PMCID),
    }
    assert _candidates(session) == []


def test_an_enrichment_gaining_an_id_held_as_a_preprint_merges_into_the_holder(session):
    holder = _base_study(session, "holder", created=1, pmid="1")
    _add(session, holder, "preprint", "doi", PREPRINT_DOI["doi"], server="biorxiv")
    enriched = _base_study(session, "enriched", created=2, pmid=PMID)

    _enrich(session, enriched, pmid=PMID, doi=PREPRINT_DOI["doi"])

    session.expire_all()
    assert session.get(BaseStudy, enriched.id).superseded_by == holder.id
    assert _held(session, holder.id) == {
        ("vor", "pmid", "1"),
        ("alternative", "pmid", PMID),
        ("preprint", "doi", PREPRINT_DOI["doi"]),
    }


def test_a_refused_merge_leaves_the_id_with_its_holder_and_records_the_pair(session, caplog):
    holder = _base_study(session, "holder", created=1, doi=DOI)
    enriched = _base_study(session, "enriched", created=2, pmid=PMID)
    for base_study in (holder, enriched):
        parse = fx.parse([GAIN], pmid=None)
        parse["header"]["neurostore_base_study_id"] = base_study.id
        ingest_upload(
            {
                "coordinate_parse": parse,
                "record": fx.record([fx.record_analysis("a0", GAIN["key"], GAIN["name"])]),
            }
        )
    session.commit()

    with caplog.at_level(logging.WARNING):
        _enrich(session, enriched, pmid=PMID, doi=DOI, pmcid=PMCID)

    session.expire_all()
    enriched = session.get(BaseStudy, enriched.id)
    assert enriched.is_active and session.get(BaseStudy, holder.id).is_active
    assert (enriched.doi, enriched.pmcid) == (None, PMCID)
    assert any("base-study merge refused" in r.getMessage() for r in caplog.records)
    report = _shared_report_of(caplog, "enrichment")
    assert report["also_held_by"] == {
        holder.id: [{"kind": "vor", "scheme": "doi", "value": DOI.lower()}]
    }
    assert [c[:2] for c in _candidates(session)] == [tuple(sorted((holder.id, enriched.id)))]


def test_an_enrichment_does_not_ask_again_for_the_ids_a_loser_stores(session, caplog):
    keeper = _base_study(session, "keeper", created=1, pmid="1")
    loser = _base_study(session, "loser", created=2, pmid="1-DUPLICATE")
    for base_study in (keeper, loser):
        parse = fx.parse([GAIN], pmid=None)
        parse["header"]["neurostore_base_study_id"] = base_study.id
        ingest_upload(
            {
                "coordinate_parse": parse,
                "record": fx.record([fx.record_analysis("a0", GAIN["key"], GAIN["name"])]),
            }
        )
    session.commit()

    with caplog.at_level(logging.WARNING, logger="neurostore.base_studies"):
        _enrich(session, loser, pmcid=PMCID)

    session.expire_all()
    # The merge is refused, the new pmcid is taken, and the pmid the loser stores is not
    # reported again: its pair is already a candidate.
    assert session.get(BaseStudy, loser.id).pmcid == PMCID
    assert session.get(BaseStudy, loser.id).is_active
    assert not [r for r in caplog.records if r.name == "neurostore.base_studies"]
    assert [c[3] for c in _candidates(session)] == ["trigger"]


def test_an_enrichment_offers_only_the_ids_a_base_study_lacks(session, caplog):
    other = _base_study(session, "other", created=1, pmid="40000009")
    enriched = _base_study(session, "enriched", created=2, pmid=PMID)

    with caplog.at_level(logging.WARNING, logger="neurostore.base_studies"):
        # A pmid different from the stored one is not the base study's to take.
        _enrich(session, enriched, pmid="40000009", doi=DOI)

    session.expire_all()
    assert session.get(BaseStudy, enriched.id).pmid == PMID
    assert session.get(BaseStudy, enriched.id).doi == DOI
    assert session.get(BaseStudy, enriched.id).is_active
    assert session.get(BaseStudy, other.id).is_active
    assert _candidates(session) == []
    assert not [r for r in caplog.records if r.name == "neurostore.base_studies"]


def test_an_enrichment_gaining_a_free_id_takes_it(session):
    enriched = _base_study(session, "enriched", pmid=PMID)

    _enrich(session, enriched, pmid=PMID, doi=DOI)

    assert session.get(BaseStudy, enriched.id).doi == DOI
    assert _held(session, enriched.id) == {("vor", "pmid", PMID), ("vor", "doi", DOI.lower())}


# --- base studies the migration left holding an id another holds ----------------------

# Production's shapes: a pmid stored as "NNN-DUPLICATE", and dois that differ in case only.
# Each is a keeper (older) and a loser that keeps the id in its column; ``post`` is a body
# naming an id the loser does hold, with an empty column to fill.
LOSER_SHAPES = {
    "duplicate-marker": (
        {"pmid": "14715131"},
        {"doi": "10.1/b", "pmid": "14715131-DUPLICATE"},
        {"doi": "10.1/b", "pmcid": "PMC5"},
        ("pmid", "14715131"),
    ),
    "case-only-doi": (
        {"doi": "10.1/AbC", "pmid": "1"},
        {"doi": "10.1/abc", "pmid": "2"},
        {"pmid": "2", "pmcid": "PMC5"},
        ("doi", "10.1/abc"),
    ),
}


def _loser_pair(session, shape, user_id=None):
    keeper_ids, loser_ids, post, lost = LOSER_SHAPES[shape]
    keeper = _base_study(session, "keeper", created=1, **keeper_ids)
    loser = _base_study(session, "loser", created=2, user_id=user_id, **loser_ids)
    # The loser keeps its id in its column, the keeper holds the row, and the pair is a candidate.
    assert [c[:2] for c in _candidates(session)] == [tuple(sorted((keeper.id, loser.id)))]
    assert ("vor", *lost) in _held(session, keeper.id)
    assert ("vor", *lost) not in _held(session, loser.id)
    return keeper, loser, post


@pytest.mark.parametrize("shape", LOSER_SHAPES)
async def test_a_post_naming_a_loser_fills_its_empty_column_without_error(
    auth_client, session, shape
):
    keeper, loser, post = _loser_pair(session, shape)

    single = await _post(auth_client, {"name": "again", **post})
    assert single["id"] == loser.id
    assert single["pmcid"] == "PMC5"
    as_list = await _post(auth_client, [{"name": "again", **post, "preprint_pmids": ["7"]}])
    assert as_list[0]["id"] == loser.id

    assert ("vor", "pmcid", "PMC5") in _held(session, loser.id)
    assert session.get(BaseStudy, keeper.id).is_active


@pytest.mark.parametrize("shape", LOSER_SHAPES)
async def test_a_put_of_a_losers_own_ids_is_taken_and_asks_nobody(
    auth_client, session, shape, caplog
):
    keeper, loser, _ = _loser_pair(session, shape, user_id="user1-id")
    stored = {k: getattr(session.get(BaseStudy, loser.id), k) for k in ("doi", "pmid")}

    with caplog.at_level(logging.WARNING, logger="neurostore.base_studies"):
        response = await auth_client.put(
            f"/api/base-studies/{loser.id}", data={"name": "renamed", **stored}
        )

    assert response.status_code == 200, response.text
    assert response.json()["name"] == "renamed"
    assert not [r for r in caplog.records if r.name == "neurostore.base_studies"]


@pytest.mark.parametrize("shape", LOSER_SHAPES)
def test_raw_sql_writing_a_loser_is_not_refused(session, shape):
    keeper, loser, _ = _loser_pair(session, shape)

    session.execute(
        sa.text("UPDATE base_studies SET pmcid = 'PMC5', name = 'x' WHERE id = :id"),
        {"id": loser.id},
    )
    session.commit()

    assert ("vor", "pmcid", "PMC5") in _held(session, loser.id)
    assert session.get(BaseStudy, loser.id).is_active


@pytest.mark.parametrize("shape", LOSER_SHAPES)
def test_an_enrichment_of_a_loser_leaves_its_pair_to_a_reviewed_plan(session, shape):
    keeper, loser, _ = _loser_pair(session, shape)

    _enrich(session, loser, pmcid="PMC5")

    session.expire_all()
    assert session.get(BaseStudy, loser.id).is_active
    assert session.get(BaseStudy, loser.id).pmcid == "PMC5"
    assert [c[:2] for c in _candidates(session)] == [tuple(sorted((keeper.id, loser.id)))]


@pytest.mark.parametrize("shape", LOSER_SHAPES)
def test_an_enrichment_finding_a_loser_an_id_its_keeper_holds_merges_them(session, shape):
    keeper, loser, _ = _loser_pair(session, shape)
    keeper.pmcid = "PMC9"
    session.commit()

    _enrich(session, loser, pmcid="PMC9")

    session.expire_all()
    assert session.get(BaseStudy, loser.id).superseded_by == keeper.id
    assert _candidates(session) == []


async def test_an_id_a_user_posted_does_not_merge_two_papers_on_the_next_enrichment(
    auth_client, session
):
    first = _base_study(session, "first", created=1, doi="10.1016/j.neuroimage.2010.01.001")
    second = _base_study(session, "second", created=2, doi="10.1016/j.neuroimage.2011.02.002")

    posted = await _post(
        auth_client,
        {"name": "second", "doi": second.doi, "alternative_dois": [first.doi]},
    )
    assert posted["id"] == second.id
    assert [c[:2] for c in _candidates(session)] == [tuple(sorted((first.id, second.id)))]

    _enrich(session, session.get(BaseStudy, second.id), pmid=PMID)

    session.expire_all()
    assert session.get(BaseStudy, second.id).is_active
    assert session.get(BaseStudy, second.id).pmid == PMID
    assert [c[:2] for c in _candidates(session)] == [tuple(sorted((first.id, second.id)))]


def test_a_write_that_hits_a_held_id_updates_the_pairs_candidate(session):
    keeper = _base_study(session, "keeper", created=1, pmid=PMID, doi=DOI)
    loser = _base_study(session, "loser", created=2, pmid=PMID)
    loser.doi = DOI.upper()
    session.commit()

    ((first, second, matched, source),) = _candidates(session)
    assert (first, second, source) == (*sorted((keeper.id, loser.id)), "trigger")
    assert {m["scheme"] for m in matched} == {"pmid", "doi"}


# --- which base study keeps a paper -----------------------------------------------


def _text(session, base_study, version, source="ace"):
    from neurostore.models import Fulltext

    session.add(
        Fulltext(
            base_study_id=base_study.id,
            source=source,
            source_version="1",
            text=f"{base_study.name} {version}",
            sha256=f"{base_study.id}{version}".ljust(64, "0"),
            text_copy={"version": version},
        )
    )
    session.commit()


def _in_studysets(session, base_study, count):
    from neurostore.models import Study, Studyset, StudysetStudy

    study = Study(name="version", level="group", base_study=base_study)
    session.add(study)
    for n in range(count):
        studyset = Studyset(name=f"set {n}")
        session.add(studyset)
        session.add(StudysetStudy(study=study, studyset=studyset))
    session.commit()


def _keeper_names(session, *base_studies):
    from neurostore.services.base_study_metadata_enrichment import keeper_order

    return [b.name for b in keeper_order(list(base_studies))]


def test_the_better_full_text_copy_keeps_the_paper_before_use_and_age(session):
    oldest = _base_study(session, "oldest", created=1)
    best_text = _base_study(session, "best text", created=3)
    other_text = _base_study(session, "other text", created=2)
    used = _base_study(session, "used", created=4)
    _in_studysets(session, used, 3)
    _text(session, best_text, "vor")
    _text(session, other_text, "am")

    assert _keeper_names(session, oldest, best_text, other_text, used) == [
        "best text",
        "other text",
        "used",
        "oldest",
    ]


def test_more_studysets_keep_the_paper_before_age_and_age_breaks_the_last_tie(session):
    oldest = _base_study(session, "oldest", created=1)
    newer = _base_study(session, "newer", created=2)
    used_once = _base_study(session, "used once", created=3)
    used_twice = _base_study(session, "used twice", created=4)
    _in_studysets(session, used_once, 1)
    _in_studysets(session, used_twice, 2)

    assert _keeper_names(session, newer, used_twice, oldest, used_once) == [
        "used twice",
        "used once",
        "oldest",
        "newer",
    ]


def test_the_worker_merges_into_the_base_study_with_the_better_copy_not_the_older(session):
    older = _base_study(session, "older", created=1, pmid="1")
    better = _base_study(session, "better", created=2, doi=DOI)
    _text(session, better, "vor")

    _enrich(session, older, doi=DOI)

    session.expire_all()
    assert session.get(BaseStudy, older.id).superseded_by == better.id
    assert session.get(BaseStudy, better.id).pmid == "1"


def test_the_plan_keeps_the_base_study_in_more_studysets_not_the_older(
    session, tmp_path, db, monkeypatch
):
    monkeypatch.setattr(cli, "_run_with_runtime", lambda callback: callback(None, db))
    older = _base_study(session, "older", created=1, pmid="1")
    used = _base_study(session, "used", created=2, pmid="1-DUPLICATE")
    _in_studysets(session, used, 2)
    plan_path = tmp_path / "plan.json"

    written = CliRunner().invoke(cli.main, ["plan-base-study-merges", "--output", str(plan_path)])

    assert written.exit_code == 0, written.output
    assert [(m["keeper"], m["old"]) for m in json.loads(plan_path.read_text())["merges"]] == [
        (used.id, older.id)
    ]


def test_a_merge_pass_that_cannot_make_progress_stops_and_says_so(session, caplog, monkeypatch):
    from neurostore.services import base_study_metadata_enrichment as service

    primary = _base_study(session, "primary", created=1, pmid="1")
    _base_study(session, "duplicate", created=2, doi=DOI)
    # A merge that changes nothing leaves the duplicate holding the id, pass after pass.
    monkeypatch.setattr(
        service,
        "merge_base_study",
        lambda keeper, old: service.BaseStudyMerge(
            cache_ids={"base-studies": set(), "studies": set()}, changes=[]
        ),
    )

    with caplog.at_level(logging.WARNING, logger=service.__name__):
        survivor, _, refused = service.merge_duplicates(
            session.get(BaseStudy, primary.id), {"doi": DOI}
        )

    assert survivor.id == primary.id and refused == []
    assert "stopped after" in " ".join(r.getMessage() for r in caplog.records)


def test_ids_added_to_a_base_study_are_read_again_by_the_next_dump(session):
    from neurostore.base_studies import attach_identifiers

    base_study = _base_study(session, "paper", doi=DOI)
    session.refresh(base_study, ["identifiers"])
    assert base_study.preprint_pmids == []

    attach_identifiers(
        session,
        base_study,
        article_identifiers({"preprint_pmids": ["40000001"]}),
        {},
        source="test",
    )

    assert base_study.preprint_pmids == ["40000001"]


# --- merge candidates -----------------------------------------------------------------


def test_merging_a_pair_closes_its_candidate_and_moves_the_others(session):
    keeper = _base_study(session, "keeper", created=1, pmid="1")
    old = _base_study(session, "old", created=2, pmid="1-DUPLICATE")
    other_keeper = _base_study(session, "other keeper", created=3, pmid="7")
    other_old = _base_study(session, "other old", created=4, pmid="8")
    loser = _base_study(session, "loser", created=5, pmid="8-DUPLICATE")
    assert [c[:2] for c in _candidates(session)] == [
        tuple(sorted((keeper.id, old.id))),
        tuple(sorted((other_old.id, loser.id))),
    ]

    merge_base_study(keeper, old)
    merge_base_study(other_keeper, other_old)
    session.commit()

    # The pair merged is closed; a pair of a merged base study is now one of its keeper.
    assert [c[:2] for c in _candidates(session)] == [tuple(sorted((other_keeper.id, loser.id)))]


def test_a_merge_keeps_the_publication_status_of_the_version_of_record(session):
    keeper = _base_study(session, "keeper", created=1, publication_status="preprint")
    _add(session, keeper, "preprint", "doi", PREPRINT_DOI["doi"], server="biorxiv")
    old = _base_study(session, "old", created=2, pmid=PMID, publication_status="published")

    merge_base_study(keeper, old)
    session.commit()

    assert session.get(BaseStudy, keeper.id).publication_status == "published"
    assert session.get(BaseStudy, keeper.id).pmid == PMID


def test_the_plan_of_the_open_candidates_is_a_merge_plan_that_closes_them(
    session, tmp_path, db, monkeypatch
):
    monkeypatch.setattr(cli, "_run_with_runtime", lambda callback: callback(None, db))
    # One paper on three base studies, and an unrelated pair.
    first = _base_study(session, "first", created=1, pmid="1")
    second = _base_study(session, "second", created=2, pmid="1-DUPLICATE")
    third = _base_study(session, "third", created=3, pmid="1 ")
    fourth = _base_study(session, "fourth", created=4, doi=DOI)
    fifth = _base_study(session, "fifth", created=5, doi=DOI.upper())
    plan_path = tmp_path / "plan.json"

    written = CliRunner().invoke(cli.main, ["plan-base-study-merges", "--output", str(plan_path)])

    assert written.exit_code == 0, written.output
    plan = json.loads(plan_path.read_text())
    # The older base study of each pair is its keeper; first's second pair waits for the next run.
    assert [(m["keeper"], m["old"]) for m in plan["merges"]] == [
        (first.id, second.id),
        (fourth.id, fifth.id),
    ]
    assert plan["merges"][0]["matched"] == [{"scheme": "pmid", "value": "1", "kind": "vor"}]
    assert "1 left out" in written.output

    applied = CliRunner().invoke(cli.main, ["merge-base-studies", str(plan_path), "--execute"])
    assert applied.exit_code == 0, applied.output
    again = CliRunner().invoke(cli.main, ["plan-base-study-merges", "--output", str(plan_path)])
    assert again.exit_code == 0, again.output
    assert [(m["keeper"], m["old"]) for m in json.loads(plan_path.read_text())["merges"]] == [
        (first.id, third.id)
    ]
    session.expire_all()
    assert session.get(BaseStudy, second.id).superseded_by == first.id
    assert session.get(BaseStudy, fifth.id).superseded_by == fourth.id


# --- one order for every tie ----------------------------------------------------------


def test_the_strongest_id_of_a_base_study_decides_not_its_weakest():
    older = Holder("older", _at(1), "preprint")
    newer = Holder("newer", _at(2), "vor")
    identifiers = article_identifiers(
        {"doi": DOI, "preprint_dois": [PREPRINT_DOI], "alternative_pmids": [PMID]}
    )
    held = {
        ("doi", DOI.lower()): newer,
        ("pmid", PMID): newer,
        ("doi", PREPRINT_DOI["doi"]): older,
    }

    # newer holds a version of record's doi and an alternative; older only a preprint's doi.
    assert resolve(identifiers, held) == "newer"


def test_equally_old_base_studies_tie_by_the_code_point_order_of_their_ids():
    identifiers = article_identifiers({"alternative_pmids": ["1", "2"]})
    held = {
        ("pmid", "1"): Holder("abc", _at(1), "alternative"),
        ("pmid", "2"): Holder("Bcd", _at(1), "alternative"),
    }

    assert resolve(identifiers, held) == "Bcd"
    held[("pmid", "2")] = Holder("Bcd", None, "alternative")
    # A base study with no creation time is the newest.
    assert resolve(identifiers, held) == "abc"


def test_the_migration_breaks_a_tie_of_creation_time_as_the_resolver_does(session):
    session.remove()
    service_migrations.downgrade(BEFORE_IDENTIFIERS)
    try:
        with session.bind.begin() as conn:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO base_studies (id, name, level, pmid, is_active, created_at)
                    VALUES ('abc', 'a', 'group', '1', true, '2025-01-01'),
                           ('Bcd', 'b', 'group', '1-DUPLICATE', true, '2025-01-01')
                    """
                )
            )
        service_migrations.upgrade("heads")
        # "Bcd" sorts before "abc" by code point, though not in a locale-aware collation.
        assert _rows(session) == [("Bcd", "vor", "pmid", "1")]
    finally:
        service_migrations.upgrade("heads")


# --- one lock strategy that scales ----------------------------------------------------


def test_a_bulk_of_any_size_holds_a_bounded_number_of_locks(session):
    identifiers = article_identifiers(
        {"alternative_dois": [f"10.1/lock-{n}" for n in range(3000)]}
    )

    lock_identifiers(session, identifiers)

    locks = session.execute(
        sa.text(
            "SELECT count(*) FROM pg_locks "
            "WHERE locktype = 'advisory' AND pid = pg_backend_pid()"
        )
    ).scalar()
    assert 0 < locks <= LOCK_BUCKETS
    session.rollback()


def test_a_second_write_of_one_paper_waits_for_the_first(session):
    from sqlalchemy.orm import Session

    identifiers = article_identifiers({"doi": DOI})
    with Session(session.bind) as first, Session(session.bind) as second:
        lock_identifiers(first, identifiers)
        second.execute(sa.text("SET LOCAL lock_timeout = '200ms'"))
        with pytest.raises(sa.exc.OperationalError, match="lock timeout"):
            lock_identifiers(second, identifiers)
        second.rollback()

        first.commit()
        second.execute(sa.text("SET LOCAL lock_timeout = '200ms'"))
        lock_identifiers(second, identifiers)
        second.rollback()


# --- a pmid search --------------------------------------------------------------------


async def test_a_pmid_search_finds_every_pmid_a_base_study_holds(auth_client, session):
    by_column = _base_study(session, "by column", pmid=PMID)
    by_alternative = _base_study(session, "by alternative")
    _add(session, by_alternative, "alternative", "pmid", "13667850")
    by_preprint = _base_study(session, "by preprint")
    _add(session, by_preprint, "preprint", "pmid", "23667850")
    _base_study(session, "unrelated", pmid="99999999")

    for pmid, expected in (
        (PMID, by_column),
        ("13667850", by_alternative),
        ("23667850", by_preprint),
    ):
        found = (await auth_client.get(f"/api/base-studies/?search={pmid}")).json()
        assert [r["id"] for r in found["results"]] == [expected.id]


# --- the dataset loaders --------------------------------------------------------------


def test_a_loader_run_finds_the_base_study_an_earlier_row_made_and_merges_a_pair(session):
    from neurostore.base_studies import BaseStudyIndex
    from neurostore.ingest import _find_or_create_base_study

    older = _base_study(session, "older", created=1, pmid=PMID)
    newer = _base_study(session, "newer", created=2, doi=DOI)
    index = BaseStudyIndex(session, source="ingest")

    found, is_new = _find_or_create_base_study(
        index, {"doi": DOI, "pmid": PMID}, lambda: BaseStudy(name="made", level="group")
    )
    assert not is_new
    assert found.id == older.id
    session.commit()
    session.expire_all()
    assert session.get(BaseStudy, newer.id).superseded_by == older.id
    assert session.get(BaseStudy, older.id).doi == DOI
    assert _candidates(session) == []

    made, is_new = _find_or_create_base_study(
        index, {"pmcid": PMCID}, lambda: BaseStudy(name="made", level="group")
    )
    again, again_new = _find_or_create_base_study(
        index, {"pmcid": "1234567"}, lambda: BaseStudy(name="made twice", level="group")
    )
    assert (is_new, again_new, again is made) == (True, False, True)


async def test_a_bulk_post_waits_for_the_lock_of_its_ids(auth_client, session):
    import anyio
    from sqlalchemy.orm import Session

    results = []

    async def post():
        results.append(
            await auth_client.post("/api/base-studies/", data=[{"name": "paper", "doi": DOI}])
        )

    with Session(session.bind) as holder:
        lock_identifiers(holder, article_identifiers({"doi": DOI}))
        waiting = 0
        async with anyio.create_task_group() as tasks:
            tasks.start_soon(post)
            for _ in range(100):
                await anyio.sleep(0.05)
                waiting = session.execute(
                    sa.text(
                        "SELECT count(*) FROM pg_stat_activity "
                        "WHERE wait_event_type = 'Lock' AND wait_event = 'advisory'"
                    )
                ).scalar()
                if waiting:
                    break
            holder.commit()

    assert waiting == 1
    assert results[0].status_code == 200


# --- the migration --------------------------------------------------------------------

BEFORE_IDENTIFIERS = "d4e6f8a0b2c4"


def test_the_migration_gives_a_shared_id_to_the_oldest_and_records_the_rest(session):
    session.remove()
    service_migrations.downgrade(BEFORE_IDENTIFIERS)
    try:
        with session.bind.begin() as conn:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO base_studies
                        (id, name, level, doi, pmid, pmcid, is_active, created_at)
                    VALUES
                    -- one paper on three base studies: two share a doi (written in two
                    -- cases), two share a pmid
                    ('newest', 'n', 'group', '10.1016/S1053-8119(03)00003-X', '12667850', NULL,
                     true, '2025-01-03'),
                    ('oldest', 'o', 'group', '10.1016/s1053-8119(03)00003-x', NULL, NULL,
                     true, '2025-01-01'),
                    ('middle', 'm', 'group', NULL, '12667850', 'pmc1234567', true, '2025-01-02'),
                    -- held alone, and held only by an inactive base study
                    ('alone', 'a', 'group', '10.1/alone', '1', NULL, true, '2025-01-04'),
                    ('gone', 'g', 'group', '10.1/alone', '1', NULL, false, '2025-01-05'),
                    ('blank', 'b', 'group', NULL, NULL, NULL, true, '2025-01-06')
                    """
                )
            )
        service_migrations.upgrade("heads")

        rows = {(r[1], r[2], r[3]): r[0] for r in _rows(session)}
        assert rows == {
            ("vor", "doi", "10.1016/s1053-8119(03)00003-x"): "oldest",
            ("vor", "pmid", "12667850"): "middle",
            ("vor", "pmcid", "PMC1234567"): "middle",
            ("vor", "doi", "10.1/alone"): "alone",
            ("vor", "pmid", "1"): "alone",
        }
        candidates = {c[:2]: (c[2], c[3]) for c in _candidates(session)}
        assert candidates == {
            ("newest", "oldest"): (
                [{"kind": "vor", "scheme": "doi", "value": "10.1016/s1053-8119(03)00003-x"}],
                "migration",
            ),
            ("middle", "newest"): (
                [{"kind": "vor", "scheme": "pmid", "value": "12667850"}],
                "migration",
            ),
        }
        # No base study was changed: the loser keeps the id in its own column.
        with session.bind.connect() as conn:
            assert conn.execute(
                sa.text("SELECT doi, pmid FROM base_studies WHERE id = 'newest'")
            ).one() == ("10.1016/S1053-8119(03)00003-X", "12667850")
        # A write after the migration is kept in step.
        with session.bind.begin() as conn:
            conn.execute(sa.text("UPDATE base_studies SET pmcid = '7' WHERE id = 'blank'"))
        assert ("vor", "pmcid", "PMC7") in _held(session, "blank")
    finally:
        service_migrations.upgrade("heads")


def test_the_migration_goes_down_and_up_over_rows_it_made(session):
    _base_study(session, "paper", doi=DOI, pmid=PMID)
    session.remove()

    def tables():
        return set(sa.inspect(session.bind).get_table_names())

    try:
        service_migrations.downgrade(BEFORE_IDENTIFIERS)
        assert not {"base_study_identifiers", "base_study_merge_candidates"} & tables()
        with session.bind.connect() as conn:
            assert conn.execute(sa.text("SELECT count(*) FROM base_studies")).scalar() == 1
        service_migrations.upgrade("heads")
        assert {"base_study_identifiers", "base_study_merge_candidates"} <= tables()
        assert _held(session, session.scalar(sa.select(BaseStudy.id))) == {
            ("vor", "doi", DOI.lower()),
            ("vor", "pmid", PMID),
        }
    finally:
        service_migrations.upgrade("heads")
