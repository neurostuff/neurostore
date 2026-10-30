"""The author's page: a link's cookie, uploads and their checks, matching, issues,
replies and submitting, and that previews and plain GETs record nothing."""

import httpx
import nibabel as nib
import pytest
import sqlalchemy as sa

from neurostore.database import db
from neurostore.ingest.study_schema import ingest_upload
from neurostore.models import OutreachEvent, OutreachIssue, OutreachPerson, OutreachUpload
from neurostore.outreach.drafts import build_draft, check_draft, create_link, mark_sent
from neurostore.tests import study_schema_fixtures as fx
from neurostore.tests.test_outreach_matching import PEAKS_A, PEAKS_B, PEAKS_C, synthetic_map

pytestmark = pytest.mark.anyio

UT = {"ror": "00hj54h04", "name": "The University of Texas at Austin", "country": "US"}


def _table(table_id, name, peaks):
    return fx.table_analysis(table_id, list(range(len(peaks))), name,
                             [fx.point(peak) for peak in peaks])


def _paper(pmid="1001"):
    paper = fx.parsed_paper(pmid=pmid)
    paper["bibliography"]["publication_year"] = 2026
    paper["bibliography"]["authors"] = [{
        "name": "Ada", "orcid": None, "openalex_id": None, "corresponding": True,
        "affiliations": [{"text": UT["name"], "institutions": [UT]}],
        "emails": ["pi@example.org"],
    }]
    analyses = [
        _table("t1", "Faces > Houses", PEAKS_A),
        _table("t2", "Houses > Scrambled", PEAKS_B),
    ]
    return ingest_upload(
        {"coordinate_parse": fx.parse(analyses, pmid=pmid), "parsed_paper": paper}
    )["base_study_id"]


def _sent_draft(preview=False):
    """A checked draft emailed with a live link: (draft, token)."""
    draft = build_draft(_paper())
    check_draft(draft, "admin-user-id")
    _, token = create_link(draft, "admin-user-id")
    mark_sent(draft, "admin-user-id")
    if preview:
        _, token = create_link(draft, "admin-user-id", preview=True)
    db.session.commit()
    return draft, token


@pytest.fixture
def share_settings(app, monkeypatch, tmp_path):
    monkeypatch.setitem(app.config, "OUTREACH_UPLOAD_DIR", str(tmp_path / "uploads"))
    monkeypatch.setitem(app.config, "OUTREACH_ADMINS", "admin-user-id")
    monkeypatch.setitem(app.config, "OUTREACH_SHARE_URL", "https://neurostore.org/share/#")
    return tmp_path


@pytest.fixture
async def author(app):
    client = httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app.asgi_app), base_url="http://testserver"
    )
    try:
        yield client
    finally:
        await client.aclose()


def _nifti(tmp_path, name, image):
    path = tmp_path / name
    nib.save(image, path)
    return path.read_bytes()


def _keys_of(view):
    return {upload["filename"]: upload["analysis_keys"] for upload in view["uploads"]}


def _key(draft, name):
    return next(a["key"] for a in draft.analyses if a["name"] == name)


async def _upload(author, filename, content):
    return await author.post("/api/share/uploads", params={"filename": filename}, content=content)


async def test_a_link_s_token_becomes_a_cookie_for_its_draft_only(author, session, share_settings):
    draft, token = _sent_draft()

    refused = await author.post("/api/share/session", json={"token": "not-a-token"})
    no_cookie = await author.get("/api/share/draft")
    opened = await author.post("/api/share/session", json={"token": token})
    again = await author.get("/api/share/draft")

    assert refused.status_code == 401
    assert no_cookie.status_code == 401
    assert opened.status_code == 200
    assert "httponly" in opened.headers["set-cookie"].lower()
    names = [a["name"] for a in again.json()["analyses"]]
    assert names == ["Faces > Houses", "Houses > Scrambled"]
    assert again.json()["limits"]["max_files"] == 4  # two per analysis
    assert "pi@example.org" not in again.text


async def test_opening_the_page_records_nothing_until_the_author_starts(author, session,
                                                                        share_settings):
    draft, token = _sent_draft()
    await author.post("/api/share/session", json={"token": token})
    await author.get("/api/share/draft")
    db.session.expire_all()
    assert draft.status == "contacted"  # a mail scanner opening the link changes nothing

    started = await author.post("/api/share/opened")

    assert started.json()["status"] == "opened"
    (event,) = db.session.scalars(
        sa.select(OutreachEvent).where(OutreachEvent.kind == "opened")).all()
    assert event.actor == "author"


async def test_uploads_are_kept_checked_and_matched_to_their_analyses(author, session,
                                                                      share_settings):
    draft, token = _sent_draft()
    tmp = share_settings
    await author.post("/api/share/session", json={"token": token})

    a = _nifti(tmp, "a.nii.gz", synthetic_map(PEAKS_A))
    b = _nifti(tmp, "b.nii.gz", synthetic_map(PEAKS_B))
    c = _nifti(tmp, "c.nii.gz", synthetic_map(PEAKS_C, seed=3))
    first = await _upload(author, "faces_gt_houses.nii.gz", a)
    second = await _upload(author, "houses.nii.gz", b)
    extra = await _upload(author, "other.nii.gz", c)

    assert first.status_code == second.status_code == extra.status_code == 201
    view = extra.json()
    assert view["status"] == "uploading"
    assert _keys_of(view) == {
        "faces_gt_houses.nii.gz": [_key(draft, "Faces > Houses")],
        "houses.nii.gz": [_key(draft, "Houses > Scrambled")],
        "other.nii.gz": [],  # matches nothing the paper tabled: kept, not an error
    }
    assert {u["check_status"] for u in view["uploads"]} == {"ok"}
    stored = db.session.scalars(sa.select(OutreachUpload)).all()
    assert all(row.path and row.path.startswith(str(tmp / "uploads")) for row in stored)
    assert all(len(row.sha256) == 64 for row in stored)


async def test_files_outside_the_limits_are_refused_and_bad_ones_flagged(author, session,
                                                                         share_settings):
    draft, token = _sent_draft()
    tmp = share_settings
    await author.post("/api/share/session", json={"token": token})
    good = _nifti(tmp, "a.nii.gz", synthetic_map(PEAKS_A))

    wrong_type = await _upload(author, "map.txt", b"hello")
    empty = await _upload(author, "map.nii.gz", b"")
    unreadable = await _upload(author, "broken.nii.gz", b"not a nifti file")
    for index in range(3):
        await _upload(author, f"map{index}.nii.gz", good)
    too_many = await _upload(author, "one-more.nii.gz", good)

    assert wrong_type.status_code == 422
    assert empty.status_code == 422
    assert unreadable.status_code == 201  # kept, but flagged for the author
    flagged = unreadable.json()["uploads"][0]
    assert (flagged["check_status"], flagged["problem"]) == (
        "problem", "This is not a readable NIfTI file.")
    assert too_many.status_code == 409  # two files per analysis: four here


async def test_the_author_s_assignment_stands_and_files_can_be_removed(author, session,
                                                                       share_settings):
    draft, token = _sent_draft()
    tmp = share_settings
    await author.post("/api/share/session", json={"token": token})
    uploaded = await _upload(author, "a.nii.gz", _nifti(tmp, "a.nii.gz", synthetic_map(PEAKS_A)))
    upload_id = uploaded.json()["uploads"][0]["id"]
    houses = _key(draft, "Houses > Scrambled")

    assigned = await author.patch(f"/api/share/uploads/{upload_id}",
                                  json={"analysis_keys": [houses], "map_type": "t"})
    rematched = await author.post("/api/share/match")
    removed = await author.post(f"/api/share/uploads/{upload_id}/remove")

    assert assigned.json()["uploads"][0]["analysis_keys"] == [houses]
    assert assigned.json()["uploads"][0]["assigned_by"] == "author"
    assert rematched.json()["uploads"][0]["analysis_keys"] == [houses]  # not overridden
    assert removed.json()["uploads"] == []
    row = db.session.get(OutreachUpload, upload_id)
    assert row.deleted_by == "author" and row.path is None


async def test_authors_can_say_an_analysis_is_wrong_or_ask_for_help(author, session,
                                                                    share_settings):
    draft, token = _sent_draft()
    await author.post("/api/share/session", json={"token": token})
    faces = _key(draft, "Faces > Houses")

    wrong = await author.post("/api/share/issues", json={
        "kind": "extraction_error", "analysis_key": faces, "reason": "wrong_direction"})
    bare_help = await author.post("/api/share/issues", json={"kind": "help"})
    help_ = await author.post("/api/share/issues", json={"kind": "help", "note": "Which space?"})

    assert wrong.status_code == 200
    assert bare_help.status_code == 409
    assert help_.json()["issues"] == [
        {"kind": "extraction_error", "analysis_key": faces, "reason": "wrong_direction",
         "note": None},
        {"kind": "help", "analysis_key": None, "reason": None, "note": "Which space?"},
    ]
    assert len(db.session.scalars(sa.select(OutreachIssue)).all()) == 2


async def test_stop_emailing_me_opts_the_address_out(author, session, share_settings):
    draft, token = _sent_draft()
    await author.post("/api/share/session", json={"token": token})

    stopped = await author.post("/api/share/reply", json={"kind": "unsubscribe"})

    assert stopped.json()["status"] == "declined"
    assert db.session.get(OutreachPerson, draft.person_id).opted_out_at is not None


async def test_submitting_needs_a_usable_map_and_a_name_then_locks_the_draft(author, session,
                                                                             share_settings):
    draft, token = _sent_draft()
    tmp = share_settings
    await author.post("/api/share/session", json={"token": token})
    nothing_yet = await author.post("/api/share/submit", json={"name": "Ada"})
    await _upload(author, "a.nii.gz", _nifti(tmp, "a.nii.gz", synthetic_map(PEAKS_A)))
    no_name = await author.post("/api/share/submit", json={"name": " "})
    bad_orcid = await author.post("/api/share/submit", json={"name": "Ada", "orcid": "123"})
    submitted = await author.post(
        "/api/share/submit", json={"name": "Ada Lovelace", "orcid": "0000-0002-1825-0097"})
    late = await _upload(author, "b.nii.gz", _nifti(tmp, "b.nii.gz", synthetic_map(PEAKS_B)))

    assert nothing_yet.status_code == no_name.status_code == bad_orcid.status_code == 409
    assert submitted.json()["status"] == "submitted"
    assert submitted.json()["submitter_orcid"] == "0000-0002-1825-0097"
    assert late.status_code == 409


async def test_a_preview_shows_the_page_but_keeps_nothing(author, session, share_settings):
    draft, token = _sent_draft(preview=True)
    tmp = share_settings
    events_before = len(db.session.scalars(sa.select(OutreachEvent)).all())

    opened = await author.post("/api/share/session", json={"token": token})
    await author.post("/api/share/opened")
    upload = await _upload(author, "a.nii.gz", _nifti(tmp, "a.nii.gz", synthetic_map(PEAKS_A)))
    reply = await author.post("/api/share/reply", json={"kind": "no_maps"})

    assert opened.json()["preview"] is True
    assert upload.status_code == reply.status_code == 403
    assert len(db.session.scalars(sa.select(OutreachEvent)).all()) == events_before


async def test_an_admin_makes_a_preview_link_that_is_no_link_to_send(app, session,
                                                                     share_settings):
    from neurostore.tests.test_outreach import ADMIN_TOKEN
    from neurostore.tests.request_utils import AsyncClient

    draft = build_draft(_paper())
    db.session.commit()
    client = AsyncClient(token=ADMIN_TOKEN, asgi_app=app.asgi_app)
    try:
        made = await client.client.post(
            f"/api/outreach/drafts/{draft.id}/preview", headers=client._get_headers())
        detail = await client.client.get(
            f"/api/outreach/drafts/{draft.id}", headers=client._get_headers())
    finally:
        await client.aclose()

    assert made.status_code == 201
    assert made.json()["url"].startswith("https://neurostore.org/share/#")
    assert detail.json()["link_expires_at"] is None  # a preview is not a live link


async def test_nginx_lets_one_map_through_and_serves_the_page_from_its_build():
    from neurostore.outreach import share
    from neurostore.tests.review.test_nginx import NGINX_DIR, STORE_DIR, location

    conf = (NGINX_DIR / "nginx.conf").read_text()
    api = location(conf, "/api/share/")
    assert f"client_max_body_size {share.MAX_BODY_BYTES // (1024 * 1024)}M" in api
    assert "proxy_request_buffering off" in api
    page = location(conf, "/share/")
    assert "alias /store/outreach-frontend/dist-share/" in page
    assert "try_files $uri $uri/ /share/index.html" in page
    assert "base: '/share/'" in (STORE_DIR / "outreach-frontend/vite.share.config.ts").read_text()
