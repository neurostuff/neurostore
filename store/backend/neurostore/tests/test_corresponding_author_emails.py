"""Corresponding authors' emails: encrypted, added once, kept through merges, never served."""

import pytest
import sqlalchemy as sa

from neurostore import corresponding_authors
from neurostore.database import db
from neurostore.ingest.study_schema import ingest_upload
from neurostore.models import BaseStudy, CorrespondingAuthorEmail
from neurostore.tests import study_schema_fixtures as fx

ANALYSIS = fx.table_analysis("tbl1", [0], "Gain > Neutral", [fx.point((10, 20, 30))])


def _author(name, *emails, corresponding=True):
    return {"name": name, "corresponding": corresponding, "emails": list(emails) or None}


def _upload(*authors, unpaired=()):
    paper = fx.parsed_paper()
    paper["bibliography"]["authors"] = list(authors)
    paper["bibliography"]["correspondence_emails"] = list(unpaired) or None
    return ingest_upload({"coordinate_parse": fx.parse([ANALYSIS]), "parsed_paper": paper})


def _emails(base_study_id):
    return db.session.scalars(
        sa.select(CorrespondingAuthorEmail)
        .where(CorrespondingAuthorEmail.base_study_id == base_study_id)
        .order_by(CorrespondingAuthorEmail.created_at, CorrespondingAuthorEmail.id)
    ).all()


def test_an_uploaded_paper_s_emails_are_stored_encrypted(session):
    summary = _upload(
        _author("Ada Lovelace", "ada@example.org"),
        _author("Charles Babbage", corresponding=False),  # no email, nothing stored
    )
    (row,) = _emails(summary["base_study_id"])
    assert (row.email, row.contacted, row.responded, row.shared) == (
        "ada@example.org", False, False, False)

    stored = db.session.execute(
        sa.text("SELECT email, email_index FROM corresponding_author_emails")
    ).one()
    assert "ada" not in stored.email and "example" not in stored.email
    assert "ada" not in stored.email_index


def test_an_address_is_stored_once_and_its_marks_survive_a_new_upload(session):
    summary = _upload(unpaired=["ada@example.org"])
    (row,) = _emails(summary["base_study_id"])
    row.contacted = True
    db.session.commit()

    _upload(_author("Ada Lovelace", "ADA@example.org"), unpaired=["charles@example.org"])
    rows = _emails(summary["base_study_id"])
    assert [(r.email, r.contacted) for r in rows] == [
        ("ada@example.org", True), ("charles@example.org", False)]


@pytest.mark.anyio
async def test_no_endpoint_serves_the_emails(session, auth_client):
    summary = _upload(_author("Ada Lovelace", "ada@example.org"))
    db.session.commit()
    base_study = await auth_client.get(f"/api/base-studies/{summary['base_study_id']}")
    study = await auth_client.get(f"/api/studies/{summary['study_id']}")
    assert base_study.status_code == study.status_code == 200
    for response in (base_study, study):
        assert "ada@example.org" not in response.text
        assert "corresponding_author" not in response.text


def test_the_relationship_is_never_loaded_by_accident(session):
    summary = _upload(unpaired=["ada@example.org"])
    with pytest.raises(sa.exc.InvalidRequestError):
        db.session.get(BaseStudy, summary["base_study_id"]).corresponding_author_emails


def test_a_merge_moves_the_addresses_and_keeps_either_s_marks(session):
    primary = BaseStudy(name="primary", level="group")
    duplicate = BaseStudy(name="duplicate", level="group")
    db.session.add_all([primary, duplicate])
    db.session.flush()
    corresponding_authors.add_emails(primary.id, [("ada@example.org", None)])
    corresponding_authors.add_emails(
        duplicate.id, [("ADA@example.org", None), ("charles@example.org", None)])
    db.session.flush()
    for row in _emails(duplicate.id):
        row.responded = True

    corresponding_authors.move_emails(duplicate.id, primary.id)

    assert _emails(duplicate.id) == []
    assert sorted((r.email, r.responded) for r in _emails(primary.id)) == [
        ("ada@example.org", True), ("charles@example.org", True)]
