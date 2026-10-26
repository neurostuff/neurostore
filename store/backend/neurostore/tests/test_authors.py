"""A paper's authors and universities: one person across papers by their ids, the
universities each paper gives them, and their correspondence addresses."""

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import selectinload

from neurostore import authors, corresponding_authors
from neurostore.database import db
from neurostore.ingest.study_schema import ingest_upload
from neurostore.services.base_study_metadata_enrichment import merge_base_study
from neurostore.models import (
    Author,
    BaseStudy,
    BaseStudyAuthor,
    BaseStudyAuthorAffiliation,
    CorrespondingAuthorEmail,
    University,
)
from neurostore.tests import study_schema_fixtures as fx

ANALYSIS = fx.table_analysis("tbl1", [0], "Gain > Neutral", [fx.point((10, 20, 30))])
UT = {"ror": "00hj54h04", "name": "The University of Texas at Austin", "country": "US"}
STANFORD = {"ror": "00f54p054", "name": "Stanford University", "country": "US"}
# ORCID's own documentation iD (a fictional researcher), so no real person is named.
ORCID = "0000-0002-1825-0097"


def _person(name, orcid=None, openalex_id=None, *affiliations, emails=(), corresponding=None):
    return {"name": name, "orcid": orcid, "openalex_id": openalex_id,
            "affiliations": list(affiliations) or None, "corresponding": corresponding,
            "emails": list(emails) or None}


def _at(text, *institutions):
    return {"text": text, "institutions": list(institutions) or None}


def _upload(pmid, *listed, unpaired=()):
    paper = fx.parsed_paper(pmid=pmid)
    paper["bibliography"]["authors"] = list(listed)
    paper["bibliography"]["correspondence_emails"] = list(unpaired) or None
    return ingest_upload(
        {"coordinate_parse": fx.parse([ANALYSIS], pmid=pmid), "parsed_paper": paper})


def _listed(base_study_id):
    return db.session.scalars(
        sa.select(BaseStudyAuthor)
        .where(BaseStudyAuthor.base_study_id == base_study_id)
        .order_by(BaseStudyAuthor.position)
    ).all()


def _universities_of(author_id):
    return sorted(db.session.scalars(
        sa.select(University.ror)
        .join(BaseStudyAuthorAffiliation,
              BaseStudyAuthorAffiliation.university_id == University.id)
        .join(BaseStudyAuthor,
              BaseStudyAuthor.id == BaseStudyAuthorAffiliation.base_study_author_id)
        .where(BaseStudyAuthor.author_id == author_id)
    ).unique())


def _universities_on(row_id):
    return sorted(db.session.scalars(
        sa.select(University.ror)
        .join(BaseStudyAuthorAffiliation,
              BaseStudyAuthorAffiliation.university_id == University.id)
        .where(BaseStudyAuthorAffiliation.base_study_author_id == row_id)
    ))


def test_a_paper_s_authors_their_affiliations_and_universities_are_stored(session):
    summary = _upload(
        "1001",
        _person("Ada Lovelace", ORCID, "A5000000001",
                _at("Dept. of Psychology, UT Austin", UT), _at("Home office"),
                emails=["ada@example.org"], corresponding=True),
        _person("Charles Babbage", None, None, _at("Somewhere", UT, STANFORD)),
    )
    ada, charles = _listed(summary["base_study_id"])
    assert (ada.position, ada.name, ada.corresponding, charles.corresponding) == (
        0, "Ada Lovelace", True, None)
    person = db.session.get(Author, ada.author_id)
    assert (person.orcid, person.openalex_id) == (ORCID, "A5000000001")
    texts = db.session.execute(
        sa.select(BaseStudyAuthorAffiliation.text, University.ror)
        .outerjoin(University)
        .where(BaseStudyAuthorAffiliation.base_study_author_id.in_([ada.id, charles.id]))
        .order_by(BaseStudyAuthorAffiliation.base_study_author_id == charles.id,
                  BaseStudyAuthorAffiliation.position, University.ror)
    ).all()
    assert [tuple(t) for t in texts] == [
        ("Dept. of Psychology, UT Austin", "00hj54h04"), ("Home office", None),
        ("Somewhere", "00f54p054"), ("Somewhere", "00hj54h04")]
    assert db.session.get(University, db.session.scalar(
        sa.select(University.id).where(University.ror == "00hj54h04"))).country == "US"
    (email,) = db.session.scalars(sa.select(CorrespondingAuthorEmail)).all()
    assert email.base_study_author_id == ada.id


def test_one_orcid_is_one_author_across_papers_and_each_paper_gives_its_university(session):
    first = _upload("1001", _person("Ada Lovelace", ORCID, None, _at("UT Austin", UT)))
    second = _upload("1002", _person("A. Lovelace", ORCID, None, _at("Stanford", STANFORD)))
    (a,), (b,) = _listed(first["base_study_id"]), _listed(second["base_study_id"])
    assert a.author_id == b.author_id
    assert (a.name, b.name) == ("Ada Lovelace", "A. Lovelace")
    assert _universities_of(a.author_id) == ["00f54p054", "00hj54h04"]
    assert db.session.scalar(sa.select(sa.func.count()).select_from(University)) == 2


def test_an_openalex_id_joins_papers_and_a_later_orcid_fills_in(session):
    first = _upload("1001", _person("Ada Lovelace", None, "A5000000001"))
    second = _upload("1002", _person("Ada Lovelace", ORCID, "A5000000001"))
    (a,), (b,) = _listed(first["base_study_id"]), _listed(second["base_study_id"])
    assert a.author_id == b.author_id
    assert db.session.get(Author, a.author_id).orcid == ORCID


def test_authors_without_ids_are_never_joined_across_papers(session):
    first = _upload("1001", _person("J. Smith"))
    second = _upload("1002", _person("J. Smith"))
    (a,), (b,) = _listed(first["base_study_id"]), _listed(second["base_study_id"])
    assert a.author_id != b.author_id


def test_uploading_a_paper_again_keeps_its_authors_and_their_marks(session):
    listed = (_person("J. Smith", None, None, _at("UT Austin", UT),
                      emails=["smith@example.org"], corresponding=True),
              _person("Ada Lovelace", ORCID))
    summary = _upload("1001", *listed)
    (email,) = db.session.scalars(sa.select(CorrespondingAuthorEmail)).all()
    email.contacted = True
    db.session.commit()
    before = [row.author_id for row in _listed(summary["base_study_id"])]

    _upload("1001", *listed)

    after = _listed(summary["base_study_id"])
    assert [row.author_id for row in after] == before
    assert db.session.scalar(sa.select(sa.func.count()).select_from(Author)) == 2
    (email,) = db.session.scalars(sa.select(CorrespondingAuthorEmail)).all()
    assert (email.contacted, email.base_study_author_id) == (True, after[0].id)


def test_an_author_the_paper_no_longer_lists_is_dropped_when_on_no_other_paper(session):
    summary = _upload("1001", _person("J. Smith"), _person("Ada Lovelace", ORCID))
    _upload("1001", _person("Ada Lovelace", ORCID))
    assert len(_listed(summary["base_study_id"])) == 1
    assert db.session.scalars(sa.select(Author.name)).all() == ["Ada Lovelace"]


def test_a_paper_listing_no_authors_leaves_the_list_alone(session):
    summary = _upload("1001", _person("Ada Lovelace", ORCID))
    paper = fx.parsed_paper(pmid="1001")
    ingest_upload({"coordinate_parse": fx.parse([ANALYSIS], pmid="1001"), "parsed_paper": paper})
    assert [row.name for row in _listed(summary["base_study_id"])] == ["Ada Lovelace"]


def test_a_merge_gives_the_keeper_the_old_list_when_it_has_none(session):
    keeper = BaseStudy(name="keeper", level="group")
    db.session.add(keeper)
    db.session.flush()
    old = _upload("1001", _person("Ada Lovelace", ORCID, emails=["ada@example.org"],
                                  corresponding=True))["base_study_id"]
    (row,) = _listed(old)

    corresponding_authors.move_emails(old, keeper.id)
    authors.move_authors(old, keeper.id)

    assert [r.id for r in _listed(keeper.id)] == [row.id]
    (email,) = db.session.scalars(sa.select(CorrespondingAuthorEmail)).all()
    assert (email.base_study_id, email.base_study_author_id) == (keeper.id, row.id)


def test_a_merge_ties_moved_addresses_to_the_keeper_s_own_author(session):
    keeper = _upload("1001", _person("Ada Lovelace", ORCID))["base_study_id"]
    old = _upload("1002", _person("Ada Lovelace", ORCID, emails=["ada@example.org"],
                                  corresponding=True))["base_study_id"]
    (kept,) = _listed(keeper)

    corresponding_authors.move_emails(old, keeper)
    authors.move_authors(old, keeper)

    (email,) = db.session.scalars(sa.select(CorrespondingAuthorEmail)).all()
    assert (email.base_study_id, email.base_study_author_id) == (keeper, kept.id)
    assert [r.name for r in _listed(old)] == ["Ada Lovelace"]  # the superseded copy keeps its own


def test_a_merge_gives_the_keeper_the_universities_of_the_same_author_on_the_old_paper(session):
    keeper = _upload("1001", _person("Ada Lovelace", ORCID))["base_study_id"]
    old = _upload("1002", _person("Ada Lovelace", ORCID, None, _at("UT Austin", UT),
                                  corresponding=True))["base_study_id"]
    (kept,) = _listed(keeper)

    merge_base_study(db.session.get(BaseStudy, keeper), db.session.get(BaseStudy, old))

    (row,) = _listed(keeper)
    assert (row.id, row.corresponding) == (kept.id, True)
    assert _universities_on(row.id) == [UT["ror"]]
    assert len(_listed(keeper)) == 1  # the same person is not listed twice


def test_a_merge_keeps_the_keeper_s_own_affiliations_and_list(session):
    keeper = _upload("1001", _person("Ada Lovelace", ORCID, None, _at("Stanford", STANFORD)),
                     _person("Charles Babbage"))["base_study_id"]
    old = _upload("1002", _person("Ada Lovelace", ORCID, None, _at("UT Austin", UT)),
                  _person("Grace Hopper"))["base_study_id"]

    merge_base_study(db.session.get(BaseStudy, keeper), db.session.get(BaseStudy, old))

    assert [r.name for r in _listed(keeper)] == ["Ada Lovelace", "Charles Babbage"]
    ada = _listed(keeper)[0]
    assert _universities_on(ada.id) == [STANFORD["ror"]]


def test_the_authors_string_follows_the_listed_authors(session):
    summary = _upload("1001", _person("Ada Lovelace", ORCID), _person("Charles Babbage"))
    base_study = db.session.get(BaseStudy, summary["base_study_id"])
    assert base_study.authors == "Ada Lovelace; Charles Babbage"

    _upload("1001", _person("Charles Babbage"), _person("Ada King", ORCID))
    assert base_study.authors == "Charles Babbage; Ada King"


def test_a_base_study_without_listed_authors_keeps_its_authors_string(session):
    base_study = BaseStudy(
        name="paper", level="group", authors="Lovelace A, Babbage C", pmid="1001")
    db.session.add(base_study)
    db.session.flush()
    paper = fx.parsed_paper(pmid="1001")
    ingest_upload({"coordinate_parse": fx.parse([ANALYSIS], pmid="1001"), "parsed_paper": paper})
    other = BaseStudy(name="other", level="group", authors="Hopper G")
    db.session.add(other)
    db.session.flush()

    merge_base_study(base_study, other)

    assert (base_study.authors, other.authors) == ("Lovelace A, Babbage C", "Hopper G")


def test_a_merge_derives_the_keeper_s_authors_string_from_the_authors_it_gains(session):
    keeper = BaseStudy(name="keeper", level="group", authors="A. Lovelace")
    db.session.add(keeper)
    db.session.flush()
    old = _upload("1001", _person("Ada Lovelace", ORCID), _person("Charles Babbage")
                  )["base_study_id"]

    outcome = merge_base_study(keeper, db.session.get(BaseStudy, old))

    assert keeper.authors == "Ada Lovelace; Charles Babbage"
    assert ("base_studies", keeper.id, "authors", "A. Lovelace",
            "Ada Lovelace; Charles Babbage") in outcome.changes


def test_a_merge_leaves_the_authors_string_of_a_keeper_that_lists_authors(session):
    keeper = _upload("1001", _person("Ada Lovelace", ORCID))["base_study_id"]
    old = _upload("1002", _person("Grace Hopper"))["base_study_id"]

    merge_base_study(db.session.get(BaseStudy, keeper), db.session.get(BaseStudy, old))

    assert db.session.get(BaseStudy, keeper).authors == "Ada Lovelace"


@pytest.mark.anyio
async def test_a_put_does_not_set_the_authors_string_apart_from_the_listed_authors(
    session, auth_client, caplog
):
    own = {"name": "paper", "authors": "Old A"}
    posted = [await auth_client.post("/api/base-studies/", data={**own, "pmid": pmid})
              for pmid in ("1002", "1001")]
    plain, listed = (response.json()["id"] for response in posted)
    assert _upload("1001", _person("Ada Lovelace", ORCID))["base_study_id"] == listed
    db.session.commit()

    with caplog.at_level("WARNING"):
        kept = await auth_client.put(
            f"/api/base-studies/{listed}", data={"authors": "Someone Else"})
    assert f"PUT of base study {listed} ignores `authors`" in caplog.text
    changed = await auth_client.put(f"/api/base-studies/{plain}", data={"authors": "New B"})

    assert (kept.status_code, changed.status_code) == (200, 200)
    db.session.expire_all()
    assert db.session.get(BaseStudy, listed).authors == "Ada Lovelace"
    assert db.session.get(BaseStudy, plain).authors == "New B"


def test_a_paper_giving_both_ids_joins_the_rows_each_id_made_into_one_author(session):
    papers = [_upload("1001", _person("Ada Lovelace", ORCID)),
              _upload("1002", _person("A. Lovelace", None, "A5000000001")),
              _upload("1003", _person("Ada Lovelace", ORCID, "A5000000001"))]

    (person,) = db.session.scalars(sa.select(Author)).all()

    assert (person.orcid, person.openalex_id) == (ORCID, "A5000000001")
    linked = db.session.scalars(
        sa.select(BaseStudyAuthor.base_study_id).where(BaseStudyAuthor.author_id == person.id)
    ).all()
    assert sorted(linked) == sorted(p["base_study_id"] for p in papers)
    assert [db.session.get(BaseStudy, p["base_study_id"]).authors for p in papers] == [
        "Ada Lovelace", "A. Lovelace", "Ada Lovelace"]


def test_rows_holding_different_other_ids_are_not_joined_by_a_paper_naming_both(session, caplog):
    other_orcid = "0000-0001-5109-3700"
    _upload("1001", _person("Ada Lovelace", ORCID, "A5000000002"))
    _upload("1002", _person("Ada Lovelace", other_orcid, "A5000000001"))

    with caplog.at_level("WARNING", logger="neurostore.authors"):
        _upload("1003", _person("Ada Lovelace", ORCID, "A5000000001"))

    assert sorted((a.orcid, a.openalex_id) for a in db.session.scalars(sa.select(Author))) == [
        (other_orcid, "A5000000001"), (ORCID, "A5000000002")]
    assert "not merged" in caplog.text


def test_a_name_holding_a_comma_is_kept_whole_in_the_authors_string(session):
    summary = _upload("1001", _person("Lovelace, A."), _person("Babbage, C."))
    base_study = db.session.get(BaseStudy, summary["base_study_id"])
    assert base_study.authors == "Lovelace, A.; Babbage, C."


def test_a_merge_carries_the_affiliations_of_an_author_without_ids_named_alike(session):
    keeper = _upload("1001", _person("Ada Lovelace"))["base_study_id"]
    old = _upload("1002", _person("Ada Lovelace", None, None, _at("UT Austin", UT),
                                  corresponding=True))["base_study_id"]

    merge_base_study(db.session.get(BaseStudy, keeper), db.session.get(BaseStudy, old))

    (row,) = _listed(keeper)
    assert (_universities_on(row.id), row.corresponding) == ([UT["ror"]], True)


def test_a_merge_leaves_a_different_person_at_the_place_on_the_old_paper_and_says_so(
    session, caplog
):
    keeper = _upload("1001", _person("Ada Lovelace", ORCID))["base_study_id"]
    old = _upload("1002", _person("Grace Hopper", "0000-0001-5109-3700", None,
                                  _at("UT Austin", UT)))["base_study_id"]
    (left,) = _listed(old)

    with caplog.at_level("WARNING", logger="neurostore.authors"):
        outcome = merge_base_study(
            db.session.get(BaseStudy, keeper), db.session.get(BaseStudy, old))

    (row,) = _listed(keeper)
    assert _universities_on(row.id) == []
    assert _universities_on(left.id) == [UT["ror"]]
    assert ("base_study_authors", left.id, "kept", None,
            "the keeper lists a different person at this place") in outcome.changes
    assert left.id in caplog.text


def test_a_merge_does_not_join_authors_without_ids_named_differently(session):
    keeper = _upload("1001", _person("Ada Lovelace"))["base_study_id"]
    old = _upload(
        "1002", _person("Grace Hopper", None, None, _at("UT Austin", UT)))["base_study_id"]

    merge_base_study(db.session.get(BaseStudy, keeper), db.session.get(BaseStudy, old))

    (row,) = _listed(keeper)
    assert _universities_on(row.id) == []


def test_a_merge_names_the_old_row_an_address_was_tied_to(session):
    keeper = _upload("1001", _person("Ada Lovelace", ORCID))["base_study_id"]
    old = _upload("1002", _person("Ada Lovelace", ORCID, emails=["ada@example.org"],
                                  corresponding=True))["base_study_id"]
    (kept,) = _listed(keeper)
    (left,) = _listed(old)

    outcome = merge_base_study(
        db.session.get(BaseStudy, keeper), db.session.get(BaseStudy, old))

    (email,) = db.session.scalars(sa.select(CorrespondingAuthorEmail)).all()
    assert ("corresponding_author_emails", email.id, "base_study_author_id", left.id,
            kept.id) in outcome.changes


def test_an_upload_listing_one_openalex_id_twice_stores_one_author_for_both(session):
    _upload("1001", _person("Ada Lovelace", ORCID))
    _upload("1002", _person("A. Lovelace", None, "A5000000001"))

    summary = _upload("1003", _person("A. Lovelace", None, "A5000000001"),
                      _person("Ada Lovelace", ORCID, "A5000000001"))

    (person,) = db.session.scalars(sa.select(Author)).all()
    assert (person.orcid, person.openalex_id) == (ORCID, "A5000000001")
    assert {row.author_id for row in _listed(summary["base_study_id"])} == {person.id}


def test_the_relationships_are_never_loaded_by_accident(session):
    summary = _upload("1001", _person("Ada Lovelace", ORCID, None, _at("UT Austin", UT)))
    base_study = db.session.get(BaseStudy, summary["base_study_id"])
    for read in (lambda: base_study.authors_listed, lambda: base_study.universities):
        with pytest.raises(sa.exc.InvalidRequestError):
            read()


@pytest.mark.anyio
async def test_no_endpoint_serves_authors_universities_or_affiliations(session, auth_client):
    summary = _upload("1001", _person("Ada Lovelace", ORCID, "A5000000001",
                                      _at("Dept. of Psychology, UT Austin", UT)))
    db.session.commit()
    response = await auth_client.get(f"/api/base-studies/{summary['base_study_id']}")
    assert response.status_code == 200
    for stored in (ORCID, "A5000000001", "00hj54h04", "UT Austin"):
        assert stored not in response.text


def test_a_base_study_s_and_an_author_s_universities_load_when_asked_for(session):
    first = _upload("1001", _person("Ada Lovelace", ORCID, None, _at("UT Austin", UT)))
    _upload("1002", _person("Ada Lovelace", ORCID, None, _at("Stanford", STANFORD)))
    base_study = db.session.scalar(
        sa.select(BaseStudy).where(BaseStudy.id == first["base_study_id"])
        .options(selectinload(BaseStudy.universities))
    )
    assert [u.ror for u in base_study.universities] == ["00hj54h04"]
    person = db.session.scalar(
        sa.select(Author).options(selectinload(Author.universities)))
    assert sorted(u.ror for u in person.universities) == ["00f54p054", "00hj54h04"]


def test_an_address_in_an_affiliation_s_text_is_not_stored_with_it(session):
    summary = _upload("1001", _person("Ada Lovelace", ORCID, None,
                                      _at("UT Austin. Electronic address: ada@example.org.", UT)))
    assert len(_listed(summary["base_study_id"])) == 1
    texts = db.session.scalars(sa.select(BaseStudyAuthorAffiliation.text)).all()
    assert texts and all("@" not in text for text in texts)
