"""Which journal a base study appeared in: neurostore's matcher tier by tier, the venue an
upload names, and refreshing journals from OpenAlex. Recorded OpenAlex and NCBI answers
for real papers found in production (docs/journals/DESIGN.md)."""

import pytest
import requests

from neurostore.ingest.study_schema import ingest_upload
from neurostore.models import BaseStudy, BaseStudyIdentifier, BaseStudyMetadataOutbox, Journal
from neurostore.services import journals
from neurostore.services.base_study_metadata_enrichment import _match_journals
from neurostore.tests import study_schema_fixtures as fx

HBM = "S121666818"  # Human Brain Mapping
ANALYSIS = fx.table_analysis("tbl1", [0], "Gain > Neutral", [fx.point((10, 20, 30))])


@pytest.fixture(scope="module")
def vcr_config(vcr_config):
    return {**vcr_config, "filter_query_parameters": ["mailto", "api_key"]}


def _base_study(session, name, **fields):
    base_study = BaseStudy(name=name, level="group", **fields)
    session.add(base_study)
    session.commit()
    return base_study


def _hbm(session):
    journal = Journal(
        openalex_id=HBM,
        kind="journal",
        title="Human Brain Mapping",
        abbreviation="Hum Brain Mapp",
        issns=["1065-9471", "1097-0193"],
        issn_l="1065-9471",
    )
    session.add(journal)
    session.commit()
    return journal


def _upload(pmid, venue):
    paper = fx.parsed_paper(pmid=pmid)
    paper["bibliography"]["journal"] = "Hum Brain Mapp"
    paper["bibliography"]["venue"] = venue
    return {"coordinate_parse": fx.parse([ANALYSIS], pmid=pmid), "parsed_paper": paper}


@pytest.mark.vcr
def test_ids_find_the_journal_tier_by_tier(session, app):
    # Movement Disorders: OpenAlex's primary location is the Radboud Repository's copy.
    by_doi = _base_study(session, "by doi", doi="10.1002/mds.26295", pmid="26095114")
    by_pmid = _base_study(session, "by pmid", pmid="20857849")  # Acta Biomedica
    # AJNR: OpenAlex knows the PMID only as PubMed Central's copy, a repository, so
    # PubMed's ISSN decides it.
    copy_only = _base_study(session, "copy only", pmid="15090336")
    preprint = _base_study(session, "preprint only", publication="bioRxiv")
    session.add(
        BaseStudyIdentifier(
            base_study_id=preprint.id,
            kind="preprint",
            scheme="doi",
            value="10.1101/2025.08.26.672253",
            server="biorxiv",
        )
    )
    session.commit()
    # Arzneimittel-Forschung: OpenAlex has no work for the PMID; PubMed gives its ISSN.
    by_issn = _base_study(session, "by issn", pmid="5107855")
    none = _base_study(session, "nothing to go on")

    matches, reviews = journals.match_base_studies(
        [by_doi, by_pmid, copy_only, preprint, by_issn, none], settings=app.config
    )

    assert matches == {
        by_doi.id: journals.Match("S163027424", "doi"),
        by_pmid.id: journals.Match("S4393915150", "pmid"),
        copy_only.id: journals.Match("S101278519", "issn"),
        preprint.id: journals.Match("S4306402567", "preprint_server"),
        by_issn.id: journals.Match("S132758211", "issn"),
    }
    assert reviews == []


def test_a_name_finds_the_journal_its_papers_were_matched_to(session, app):
    hbm = _hbm(session)
    _base_study(session, "matched", publication="Human brain mapping", journal_id=hbm.id,
                journal_match="doi")
    cases = {
        "HUMAN BRAIN MAPPING": journals.Match(HBM, "title"),
        "Hum. Brain Mapp.": journals.Match(HBM, "title"),
        "Human Brain Maping": journals.Match(HBM, "fuzzy", 97.3),
    }
    papers = {name: _base_study(session, name, publication=name) for name in
              [*cases, "Human Brain Mapping Journal", "Journal of Human Brain Mapping"]}

    matches, reviews = journals.match_base_studies(list(papers.values()), settings=app.config)

    assert {name: matches.get(bs.id) for name, bs in papers.items() if bs.id in matches} == cases
    assert reviews == [
        journals.Review(papers["Human Brain Mapping Journal"].id, "Human Brain Mapping Journal",
                        HBM, "Human Brain Mapping", 82.6)
    ]


def test_one_name_for_two_journals_is_not_taken(session, app):
    for source in ("S1", "S2"):
        session.add(Journal(openalex_id=source, kind="journal", title="Neuroscience"))
    session.commit()
    paper = _base_study(session, "paper", publication="Neuroscience")

    assert journals.match_base_studies([paper], settings=app.config) == ({}, [])


@pytest.mark.vcr
def test_an_upload_names_its_journal_and_neurostore_reads_it_once(session, app):
    first = ingest_upload(_upload("11111111", {"openalex_id": HBM, "match": "doi"}),
                          settings=app.config)
    second = ingest_upload(_upload("22222222", {"openalex_id": HBM, "match": "title"}),
                           settings=app.config)
    session.commit()

    (journal,) = Journal.query.all()
    assert (journal.openalex_id, journal.title, journal.kind) == (
        HBM, "Human Brain Mapping", "journal")
    assert journal.issn_l == "1065-9471" and set(journal.issns) == {"1065-9471", "1097-0193"}
    assert (journal.nlm_id, journal.abbreviation) == ("9419065", "Hum Brain Mapp")
    for summary, match in ((first, "doi"), (second, "title")):
        base_study = session.get(BaseStudy, summary["base_study_id"])
        assert (base_study.journal_id, base_study.journal_match) == (journal.id, match)
        assert base_study.publication == "Hum Brain Mapp"


def test_an_upload_whose_journal_cannot_be_read_still_stands(session, app, monkeypatch):
    def unreachable(settings, source_id):
        raise requests.ConnectionError("OpenAlex is down")

    monkeypatch.setattr(journals, "read_source", unreachable)
    summary = ingest_upload(_upload("33333333", {"openalex_id": HBM, "match": "doi"}),
                            settings=app.config)
    session.commit()

    base_study = session.get(BaseStudy, summary["base_study_id"])
    assert base_study.journal_id is None and Journal.query.count() == 0
    assert session.get(BaseStudyMetadataOutbox, base_study.id).reason == "journal"


@pytest.mark.vcr
def test_the_metadata_outbox_matches_a_base_study_without_a_journal(session, app):
    paper = _base_study(session, "paper", doi="10.1002/mds.26295")
    matched = _base_study(session, "matched", doi="10.1002/hbm.20025",
                          journal_id=_hbm(session).id, journal_match="doi")

    found = _match_journals([paper.id, matched.id], settings=app.config, logger=app.logger)

    assert found == {paper.id}
    assert session.get(Journal, paper.journal_id).openalex_id == "S163027424"
    assert paper.journal_match == "doi"


@pytest.mark.vcr
def test_refresh_moves_papers_off_a_source_openalex_merged(session, app):
    # OpenAlex merged S119599544 into Acta Physiologica Scandinavica, S4210232992.
    merged = Journal(openalex_id="S119599544", kind="journal", title="Acta Physiol Scand",
                     issns=["0001-6772"], issn_l="0001-6772")
    session.add(merged)
    session.commit()
    paper = _base_study(session, "paper", journal_id=merged.id, journal_match="doi")

    refreshed, moved = journals.refresh_journals(settings=app.config, logger=app.logger)
    session.commit()

    (survivor,) = Journal.query.all()
    assert (refreshed, moved) == (0, 1)
    assert (survivor.openalex_id, survivor.issn_l) == ("S4210232992", "0001-6772")
    assert session.get(BaseStudy, paper.id).journal_id == survivor.id
