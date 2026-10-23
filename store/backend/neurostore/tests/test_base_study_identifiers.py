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
from sqlalchemy.exc import IntegrityError

from neurostore import service_migrations
from neurostore.base_studies import (
    article_identifiers,
    find_base_study,
    normalize,
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


def test_no_two_active_base_studies_hold_an_id_whatever_its_case(session):
    _base_study(session, "first", doi=DOI)

    session.add(BaseStudy(name="second", level="group", doi=DOI.upper()))
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()

    assert session.scalar(sa.select(sa.func.count()).select_from(BaseStudy)) == 1


def test_a_base_study_cannot_hold_an_id_another_holds_as_a_preprint_or_alternative(session):
    holder = _base_study(session, "holder", pmid=PMID)
    _add(session, holder, "preprint", "doi", PREPRINT_DOI["doi"], server="biorxiv")

    session.add(BaseStudy(name="taker", level="group", doi=PREPRINT_DOI["doi"]))
    with pytest.raises(IntegrityError):
        session.commit()


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


async def test_a_put_naming_an_id_another_base_study_holds_is_a_conflict(auth_client, session):
    base_study = await _post(auth_client, {"name": "paper", "doi": DOI})
    other = _base_study(session, "other", pmid=PMID)

    response = await auth_client.put(
        f"/api/base-studies/{base_study['id']}", data={"pmid": PMID}
    )

    assert response.status_code == 409
    assert response.json()["identifiers"] == {f"pmid:{PMID}": other.id}
    assert _held(session, base_study["id"]) == {("vor", "doi", DOI.lower())}


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
        )
    )
    session.commit()


def test_an_enrichment_gaining_an_id_another_base_study_holds_skips_it_and_records_the_pair(
    session, caplog
):
    holder = _base_study(session, "holder", created=1, doi=DOI)
    enriched = _base_study(session, "enriched", created=2, pmid=PMID)

    with caplog.at_level(logging.WARNING, logger="neurostore.base_studies"):
        _enrich(session, enriched, pmid=PMID, doi=DOI, pmcid=PMCID)

    enriched = session.get(BaseStudy, enriched.id)
    assert (enriched.doi, enriched.pmid, enriched.pmcid) == (None, PMID, PMCID)
    assert enriched.is_active
    assert session.get(BaseStudy, holder.id).is_active
    report = _shared_report(caplog)
    assert (report["source"], report["base_study_id"]) == ("enrichment", enriched.id)
    assert report["also_held_by"] == {
        holder.id: [{"kind": "vor", "scheme": "doi", "value": DOI.lower()}]
    }
    assert [c[:2] for c in _candidates(session)] == [tuple(sorted((holder.id, enriched.id)))]


def test_an_enrichment_skips_an_id_held_as_another_base_studys_preprint(session):
    holder = _base_study(session, "holder", created=1, pmid="1")
    _add(session, holder, "preprint", "doi", PREPRINT_DOI["doi"], server="biorxiv")
    enriched = _base_study(session, "enriched", created=2, pmid=PMID)

    _enrich(session, enriched, pmid=PMID, doi=PREPRINT_DOI["doi"])

    assert session.get(BaseStudy, enriched.id).doi is None


def test_an_enrichment_gaining_a_free_id_takes_it(session):
    enriched = _base_study(session, "enriched", pmid=PMID)

    _enrich(session, enriched, pmid=PMID, doi=DOI)

    assert session.get(BaseStudy, enriched.id).doi == DOI
    assert _held(session, enriched.id) == {("vor", "pmid", PMID), ("vor", "doi", DOI.lower())}


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
