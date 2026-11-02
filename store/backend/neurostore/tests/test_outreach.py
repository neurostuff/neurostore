"""Outreach: drafts built from a paper's coordinate parse, their statuses, the pilot's
candidates, merges, and who may use the admin API."""

import base64

import pytest
import sqlalchemy as sa
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from jose.jwt import encode

from neurostore.database import db
from neurostore.ingest.study_schema import ingest_upload
from neurostore.models import (
    BaseStudy,
    OutreachDraft,
    OutreachEvent,
    OutreachLink,
    OutreachPerson,
)
from neurostore.outreach.candidates import candidates_query
from neurostore.outreach.software import packages, software_by_base_study
from neurostore.outreach.drafts import (
    DraftError,
    build_draft,
    check_draft,
    clean_analyses,
    create_link,
    edit_draft,
    next_status,
    record_event,
    token_sha256,
)
from neurostore.services.base_study_metadata_enrichment import merge_base_study
from neurostore.tests import study_schema_fixtures as fx
from neurostore.tests.request_utils import AsyncClient

GAIN = fx.table_analysis(
    "tbl1", [0, 1], "Gain > Neutral", [fx.point((10, 20, 30)), fx.point((-10, 20, 30))]
)
SEED = fx.table_analysis("tbl2", [0], "Seed ROI", [fx.point((0, 0, 0))], role="roi_definition")
UT = {"ror": "00hj54h04", "name": "The University of Texas at Austin", "country": "US"}
OXFORD = {"ror": "052gg0110", "name": "University of Oxford", "country": "GB"}
OSF = "https://osf.io/abc12/"
NEUROVAULT = "https://neurovault.org/collections/1234/"
ADMIN_TOKEN = encode({"sub": "admin-user-id"}, "admin123", algorithm="HS256")
USER_TOKEN = encode({"sub": "user1-id"}, "abc", algorithm="HS256")


def _author(name, *institutions, emails=("pi@example.org",), corresponding=True, orcid=None):
    affiliations = [{"text": i["name"], "institutions": [i]} for i in institutions]
    return {"name": name, "orcid": orcid, "openalex_id": None,
            "affiliations": affiliations or None, "corresponding": corresponding,
            "emails": list(emails) or None}


def _upload(pmid="1001", analyses=(GAIN, SEED), authors=None, links=(OSF,), year=2026,
            record=None):
    paper = fx.parsed_paper(pmid=pmid)
    paper["bibliography"]["publication_year"] = year
    paper["bibliography"]["authors"] = authors if authors is not None else [_author("Ada", UT)]
    if links:
        paper["links"] = [fx.link(url) for url in links]
    body = {"coordinate_parse": fx.parse(list(analyses), pmid=pmid), "parsed_paper": paper}
    if record is not None:
        body["record"] = record
    return ingest_upload(body)["base_study_id"]


def _candidates(since_year=2026, country="US"):
    return [base_study.id for base_study, _ in db.session.execute(
        candidates_query(since_year, country)).all()]


# status


@pytest.mark.parametrize(
    "current, kind, expected",
    [
        ("draft", "checked", "checked"),
        ("uploading", "opened", "uploading"),  # progress only moves forward
        ("contacted", "file_uploaded", "uploading"),
        ("uploading", "link_created", "uploading"),  # not a status event
        ("submitted", "rejected", "rejected"),  # outcomes apply whatever it was
        ("declined", "opened", "declined"),  # opening alone does not undo an outcome
        ("declined", "file_uploaded", "uploading"),  # an upload does
        ("failed", "publish_retried", "approved"),
        ("uploading", "files_deleted", "files_deleted"),
    ],
)
def test_a_draft_s_status_follows_its_events(current, kind, expected):
    assert next_status(current, kind) == expected


# building drafts


def test_a_draft_copies_the_paper_s_result_analyses_and_their_coordinates(session):
    base_study_id = _upload()

    draft = build_draft(base_study_id, actor_id="admin-user-id")
    db.session.commit()

    assert [a["name"] for a in draft.analyses] == ["Gain > Neutral"]  # the ROI seed is not
    assert [(p["x"], p["y"], p["z"]) for p in draft.analyses[0]["points"]] == [
        (10, 20, 30), (-10, 20, 30)]
    assert {p["space"] for p in draft.analyses[0]["points"]} == {"MNI"}
    assert draft.status == "draft"
    assert len(draft.source_sha256) == 64
    assert draft.collection["full_dataset_url"] == OSF
    (event,) = db.session.scalars(sa.select(OutreachEvent)).all()
    assert (event.kind, event.actor, event.actor_id) == ("built", "admin", "admin-user-id")


def test_a_draft_is_addressed_to_one_person_found_by_the_address_s_hash(session):
    first = build_draft(_upload("1001"))
    second = build_draft(_upload("1002"))
    db.session.commit()

    (person,) = db.session.scalars(sa.select(OutreachPerson)).all()
    assert first.person_id == second.person_id == person.id
    assert person.author_id is not None
    stored = db.session.execute(sa.text("SELECT * FROM outreach_people")).mappings().one()
    assert "pi@example.org" not in {str(value) for value in stored.values()}


def test_a_paper_gets_one_draft(session):
    base_study_id = _upload()
    build_draft(base_study_id)
    with pytest.raises(DraftError, match="already has an outreach draft"):
        build_draft(base_study_id)


def test_a_paper_without_result_analyses_gets_no_draft(session):
    with pytest.raises(DraftError, match="no result analyses"):
        build_draft(_upload(analyses=(SEED,)))


def test_a_link_keeps_only_its_token_s_hash(session):
    draft = build_draft(_upload())
    link, token = create_link(draft, actor_id="admin-user-id")
    db.session.commit()

    assert db.session.get(OutreachLink, link.id).token_sha256 == token_sha256(token)
    assert token not in db.session.execute(
        sa.text("SELECT token_sha256 FROM outreach_links")).scalar_one()
    assert draft.status == "draft"  # making a link is not sending it


def test_events_move_a_draft_s_last_activity(session):
    draft = build_draft(_upload())
    db.session.commit()
    built_at = draft.last_activity_at

    record_event(draft, "opened", "author")
    db.session.commit()

    assert draft.last_activity_at > built_at
    # Progress moves forward even past a step not marked yet, such as "mark as sent".
    assert draft.status == "opened"


# candidates


def test_a_us_paper_with_coordinates_and_a_data_link_is_a_candidate(session):
    base_study_id = _upload()
    assert _candidates() == [base_study_id]


@pytest.mark.parametrize(
    "upload",
    [
        dict(links=(OSF, NEUROVAULT)),  # already gives a NeuroVault link
        dict(links=()),  # no data repository link
        dict(authors=[_author("Ada", OXFORD)]),  # the corresponding author is not in the US
        dict(authors=[_author("Ada")]),  # no institution to tell where they are
        dict(authors=[_author("Ada", UT, emails=())]),  # no address to write to
        dict(year=2024),  # too old
        dict(analyses=(SEED,)),  # no result analyses with coordinates
    ],
)
def test_papers_outside_the_pilot_are_not_candidates(session, upload):
    _upload(**upload)
    assert _candidates() == []


def test_a_drafted_paper_is_no_longer_a_candidate(session):
    build_draft(_upload())
    assert _candidates() == []


# merges and deletes


def test_a_merge_moves_the_old_paper_s_draft_to_the_keeper(session):
    keeper = _upload("1001")
    old = _upload("1002")
    draft = build_draft(old)
    db.session.commit()

    merge_base_study(db.session.get(BaseStudy, keeper), db.session.get(BaseStudy, old))
    db.session.commit()

    assert db.session.get(OutreachDraft, draft.id).base_study_id == keeper


@pytest.mark.anyio
async def test_a_paper_in_outreach_is_not_deleted(admin_client, session):
    base_study_id = _upload()
    build_draft(base_study_id)
    db.session.commit()

    response = await admin_client.delete(f"/api/base-studies/{base_study_id}")

    assert response.status_code == 409
    assert response.json()["in_outreach"] == 1
    assert db.session.get(BaseStudy, base_study_id) is not None


def test_the_migrated_outreach_tables_match_the_models(db):
    def in_scope(obj, name, type_, reflected, compare_to):
        table = name if type_ == "table" else obj.table.name
        return table.startswith("outreach_")

    with db.engine.connect() as conn:
        context = MigrationContext.configure(
            conn,
            opts={"compare_type": True, "compare_server_default": True,
                  "include_object": in_scope},
        )
        assert compare_metadata(context, db.metadata) == []


# the admin API


@pytest.fixture
def outreach_settings(app, monkeypatch):
    monkeypatch.setitem(app.config, "OUTREACH_ADMINS", "admin-user-id")
    monkeypatch.setitem(app.config, "OUTREACH_DEV_PASSWORD", "dev-secret")
    monkeypatch.setitem(app.config, "OUTREACH_SHARE_URL", "https://neurostore.org/share/")
    return app.config


async def _client(app, token=None, headers=None):
    client = AsyncClient(token=token, asgi_app=app.asgi_app)
    if headers:
        client.client.headers.update(headers)
    return client


def _basic(password):
    return {"Authorization": "Basic " + base64.b64encode(f"dev:{password}".encode()).decode()}


@pytest.mark.anyio
@pytest.mark.parametrize(
    "token, headers, status",
    [
        (ADMIN_TOKEN, None, 200),
        (USER_TOKEN, None, 403),  # signed in, but not an outreach admin
        (None, None, 401),
        (None, _basic("dev-secret"), 200),
        (None, _basic("wrong"), 401),
    ],
)
async def test_only_outreach_admins_get_in(app, session, outreach_settings, token, headers,
                                           status):
    client = await _client(app, token, headers)
    try:
        response = await client.client.get("/api/outreach/me", headers=client._get_headers())
    finally:
        await client.aclose()
    assert response.status_code == status


@pytest.mark.anyio
async def test_the_dev_password_is_refused_outside_development(app, session, outreach_settings,
                                                               monkeypatch):
    monkeypatch.setitem(app.config, "ENV", "production")
    client = await _client(app, headers=_basic("dev-secret"))
    try:
        response = await client.client.get("/api/outreach/me")
    finally:
        await client.aclose()
    assert response.status_code == 401


@pytest.mark.anyio
async def test_an_admin_lists_candidates_and_builds_and_lists_drafts(app, session,
                                                                     outreach_settings):
    base_study_id = _upload()
    db.session.commit()
    client = await _client(app, ADMIN_TOKEN)
    headers = client._get_headers()
    try:
        listed = await client.client.get(
            "/api/outreach/candidates/", params={"since_year": 2026}, headers=headers)
        built = await client.client.post(
            "/api/outreach/drafts/", json={"base_study_id": base_study_id}, headers=headers)
        again = await client.client.post(
            "/api/outreach/drafts/", json={"base_study_id": base_study_id}, headers=headers)
        drafts = await client.client.get("/api/outreach/drafts/", headers=headers)
        idle = await client.client.get(
            "/api/outreach/drafts/", params={"idle_days": 30}, headers=headers)
        detail = await client.client.get(
            f"/api/outreach/drafts/{built.json()['id']}", headers=headers)
    finally:
        await client.aclose()

    assert [r["base_study_id"] for r in listed.json()["results"]] == [base_study_id]
    assert listed.json()["results"][0]["result_analyses"] == 1
    # Both lists carry the paper's ids, so the panel can link to PubMed and PMC.
    assert listed.json()["results"][0]["pmid"] == "1001"
    assert drafts.json()["results"][0]["pmid"] == "1001"
    assert {"pmid", "pmcid"} <= set(drafts.json()["results"][0])
    assert built.status_code == 201
    assert again.status_code == 409
    assert [r["id"] for r in drafts.json()["results"]] == [built.json()["id"]]
    assert idle.json()["results"] == []  # just built, so not idle
    assert [e["kind"] for e in detail.json()["events"]] == ["built"]
    assert detail.json()["events"][0]["actor_id"] == "admin-user-id"


# admin edits, approval, invitations and sending


def test_edited_analyses_are_checked_and_new_ones_get_a_key():
    cleaned = clean_analyses([
        {"key": "a1", "name": " Gain ", "points": [{"x": 1, "y": 2, "z": 3, "space": "MNI"}]},
        {"name": "Added by hand"},
    ])
    assert cleaned[0] == {"key": "a1", "name": "Gain", "description": None,
                          "points": [{"x": 1, "y": 2, "z": 3, "space": "MNI"}]}
    assert cleaned[1]["key"].startswith("added-") and cleaned[1]["points"] == []
    for bad in (
        [{"key": "a1", "name": "x"}, {"key": "a1", "name": "y"}],  # keys repeat
        [{"key": "a1", "name": ""}],
        [{"key": "a1", "name": "x", "points": [{"x": 1, "y": "2", "z": 3}]}],
        {"key": "a1"},
    ):
        with pytest.raises(DraftError):
            clean_analyses(bad)


def test_an_approved_draft_is_not_edited(session):
    draft = build_draft(_upload())
    record_event(draft, "approved", "admin")
    with pytest.raises(DraftError, match="cannot be edited"):
        edit_draft(draft, "admin-user-id", collection={"name": "x"})


async def _admin(app):
    return await _client(app, ADMIN_TOKEN)


@pytest.mark.anyio
async def test_an_admin_checks_a_draft_then_sends_its_invitation(app, session, outreach_settings):
    first = build_draft(_upload("1001"))
    second = build_draft(_upload("1002"))  # the same corresponding author
    db.session.commit()
    client = await _admin(app)
    h = client._get_headers()
    base = "/api/outreach/drafts"
    try:
        early = await client.client.post(f"{base}/{first.id}/invitation", headers=h)
        edited = await client.client.patch(
            f"{base}/{first.id}", headers=h,
            json={"collection": {"name": "Renamed", "DOI": "10.1/x"}})
        checked = await client.client.post(f"{base}/{first.id}/check", headers=h)
        unlinked = await client.client.post(f"{base}/{first.id}/sent", headers=h, json={})
        old = await client.client.post(f"{base}/{first.id}/invitation", headers=h)
        invitation = await client.client.post(f"{base}/{first.id}/invitation", headers=h)
        sent = await client.client.post(
            f"{base}/{first.id}/sent", headers=h,
            json={"batch": "pilot-1", "template_version": "pilot-1"})
        await client.client.post(f"{base}/{second.id}/check", headers=h)
        await client.client.post(f"{base}/{second.id}/invitation", headers=h)
        twice = await client.client.post(f"{base}/{second.id}/sent", headers=h, json={})
        reminder = await client.client.post(
            f"{base}/{first.id}/sent", headers=h, json={"kind": "reminder"})
        listed = await client.client.get(base + "/", headers=h,
                                         params=[("status", "contacted"), ("status", "checked")])
        person = await client.client.get(
            f"/api/outreach/people/{first.person_id}", headers=h)
    finally:
        await client.aclose()

    assert early.status_code == 409  # not approved yet
    assert edited.json()["collection"] == {"name": "Renamed", "DOI": "10.1/x"}
    assert checked.json()["status"] == "checked"
    assert unlinked.status_code == 409  # nothing to send yet
    email = invitation.json()["email"]
    assert email["to"] == "pi@example.org"
    assert "Gain > Neutral" in email["body"]
    assert invitation.json()["url"] in email["body"]
    assert invitation.json()["url"].startswith("https://neurostore.org/share/")
    assert old.json()["url"] != invitation.json()["url"]
    links = db.session.scalars(
        sa.select(OutreachLink).where(OutreachLink.draft_id == first.id)).all()
    # A new link leaves the one already sent working.
    assert sum(link.revoked_at is None for link in links) == 2
    assert sent.json()["status"] == "contacted"
    assert twice.status_code == 409  # one email per person in the pilot
    assert "already been emailed" in twice.json()["detail"]
    assert reminder.status_code == 200
    by_id = {row["id"]: row for row in listed.json()["results"]}
    assert by_id[first.id]["person"]["messages"] == 2
    assert by_id[second.id]["status"] == "checked"
    assert [s["kind"] for s in person.json()["sent"]] == ["invite", "reminder"]
    assert {d["id"] for d in person.json()["drafts"]} == {first.id, second.id}


@pytest.mark.anyio
async def test_no_invitation_goes_to_someone_who_opted_out(app, session, outreach_settings):
    draft = build_draft(_upload())
    check_draft(draft, "admin-user-id")
    db.session.commit()
    client = await _admin(app)
    h = client._get_headers()
    try:
        opted = await client.client.post(
            f"/api/outreach/people/{draft.person_id}/suppression", headers=h,
            json={"what": "opt_out", "note": "replied no thanks"})
        invitation = await client.client.post(
            f"/api/outreach/drafts/{draft.id}/invitation", headers=h)
    finally:
        await client.aclose()

    assert opted.json()["suppressed"] is True
    assert opted.json()["notes"] == "replied no thanks"
    assert invitation.status_code == 409


# serving the panel


def test_the_outreach_panel_is_served_from_its_build_with_a_fallback_to_its_index():
    from neurostore.tests.review.test_nginx import NGINX_DIR, STORE_DIR, location

    conf = (NGINX_DIR / "nginx.conf").read_text()
    app = location(conf, "/outreach/")
    assert "alias /store/outreach-frontend/dist/" in app
    assert "try_files $uri $uri/ /outreach/index.html" in app
    assert "alias /store/outreach-frontend/dist/assets/" in location(conf, "/outreach/assets/")
    assert "base: '/outreach/'" in (STORE_DIR / "outreach-frontend/vite.config.ts").read_text()


# fixing mistakes and logging replies

# ORCID's own documentation iD (a fictional researcher), so no real person is named.
ORCID = "0000-0002-1825-0097"


async def _post(client, path, json=None):
    return await client.client.post(path, headers=client._get_headers(), json=json or {})


async def _invite(client, draft_id):
    base = f"/api/outreach/drafts/{draft_id}"
    await _post(client, f"{base}/check")
    await _post(client, f"{base}/invitation")
    return await _post(client, f"{base}/sent")


@pytest.mark.anyio
async def test_one_author_under_two_addresses_is_emailed_once(app, session, outreach_settings):
    first = build_draft(_upload("1001", authors=[_author("Ada", UT, orcid=ORCID)]))
    second = build_draft(_upload("1002", authors=[
        _author("Ada", UT, emails=("ada@other.example.org",), orcid=ORCID)]))
    db.session.commit()
    assert first.person_id != second.person_id  # two addresses, so two people
    client = await _admin(app)
    try:
        sent = await _invite(client, first.id)
        twice = await _invite(client, second.id)
        listed = await client.client.get("/api/outreach/drafts/", headers=client._get_headers())
    finally:
        await client.aclose()

    assert sent.status_code == 200
    assert twice.status_code == 409  # the same author, by ORCID
    by_id = {row["id"]: row for row in listed.json()["results"]}
    assert by_id[second.id]["person"]["messages"] == 0
    assert by_id[second.id]["person"]["author_messages"] == 1


@pytest.mark.anyio
async def test_undoing_a_send_frees_the_person_and_replays_the_status(
    app, session, outreach_settings
):
    draft = build_draft(_upload())
    db.session.commit()
    client = await _admin(app)
    base = f"/api/outreach/drafts/{draft.id}"
    try:
        await _invite(client, draft.id)
        undone = await _post(client, f"{base}/unsend")
        again = await _post(client, f"{base}/sent")
    finally:
        await client.aclose()

    assert undone.json()["status"] == "checked"
    assert undone.json()["person"]["messages"] == 0
    assert [e["kind"] for e in undone.json()["events"]][-2:] == ["sent", "send_undone"]
    assert undone.json()["events"][-2]["data"]["undone_at"]  # kept in the history, marked
    assert again.json()["status"] == "contacted"


@pytest.mark.anyio
async def test_a_send_the_author_has_acted_on_cannot_be_undone(app, session, outreach_settings):
    draft = build_draft(_upload())
    db.session.commit()
    client = await _admin(app)
    try:
        await _invite(client, draft.id)
        # A fresh transaction, so the event's now() falls after the send's.
        db.session.commit()
        db.session.refresh(draft)
        record_event(draft, "opened", "author")
        db.session.commit()
        refused = await _post(client, f"/api/outreach/drafts/{draft.id}/unsend")
    finally:
        await client.aclose()

    assert refused.status_code == 409
    assert "the author has used the link" in refused.json()["detail"]
    db.session.refresh(draft)
    assert draft.status == "opened"


@pytest.mark.anyio
async def test_an_excluded_paper_leaves_outreach_until_reopened(app, session, outreach_settings):
    draft = build_draft(_upload())
    check_draft(draft, "admin-user-id")
    db.session.commit()
    client = await _admin(app)
    base = f"/api/outreach/drafts/{draft.id}"
    try:
        bad = await _post(client, f"{base}/exclude", {"reason": "because"})
        excluded = await _post(client, f"{base}/exclude",
                               {"reason": "behavioral_only", "note": "no imaging results"})
        await _post(client, f"{base}/invitation")
        blocked = await _post(client, f"{base}/sent")
        reopened = await _post(client, f"{base}/reopen")
    finally:
        await client.aclose()

    assert bad.status_code == 409
    assert excluded.json()["status"] == "excluded"
    assert excluded.json()["events"][-1]["data"] == {
        "reason": "behavioral_only", "note": "no imaging results"}
    assert _candidates() == []  # still drafted, so not a candidate again
    assert blocked.status_code == 409
    assert reopened.json()["status"] == "checked"


@pytest.mark.anyio
async def test_replies_are_logged_and_a_decline_closes_the_draft(app, session, outreach_settings):
    draft = build_draft(_upload())
    db.session.commit()
    client = await _admin(app)
    base = f"/api/outreach/drafts/{draft.id}"
    try:
        await _invite(client, draft.id)
        no_maps = await _post(client, f"{base}/reply", {"kind": "no_maps", "note": "lost them"})
        declined = await _post(client, f"{base}/reply", {"kind": "declined"})
        listed = await client.client.get("/api/outreach/drafts/", headers=client._get_headers())
        reopened = await _post(client, f"{base}/reopen")
    finally:
        await client.aclose()

    assert no_maps.json()["status"] == "contacted"
    assert no_maps.json()["last_reply"]["kind"] == "no_maps"
    assert no_maps.json()["last_reply"]["note"] == "lost them"
    assert declined.json()["status"] == "declined"
    assert listed.json()["results"][0]["last_reply"]["kind"] == "declined"
    assert reopened.json()["status"] == "contacted"
    assert reopened.json()["last_reply"]["kind"] == "no_maps"  # the decline was taken back


@pytest.mark.anyio
async def test_links_stop_working_only_when_revoked(app, session, outreach_settings):
    draft = build_draft(_upload())
    check_draft(draft, "admin-user-id")
    db.session.commit()
    client = await _admin(app)
    base = f"/api/outreach/drafts/{draft.id}"
    try:
        await _post(client, f"{base}/invitation")
        await _post(client, f"{base}/invitation")
        revoked = await _post(client, f"{base}/links/revoke")
    finally:
        await client.aclose()

    assert revoked.json()["link_expires_at"] is None  # no live link left
    assert revoked.json()["events"][-1]["kind"] == "links_revoked"
    assert len(revoked.json()["events"][-1]["data"]["link_ids"]) == 2


@pytest.mark.anyio
async def test_a_draft_is_built_for_any_paper_by_its_pmid(app, session, outreach_settings):
    _upload("1001", links=())  # not a candidate: no data repository link
    db.session.commit()
    client = await _admin(app)
    try:
        built = await _post(client, "/api/outreach/drafts/", {"pmid": "1001"})
        unknown = await _post(client, "/api/outreach/drafts/", {"pmid": "999"})
        ambiguous = await _post(client, "/api/outreach/drafts/", {"pmid": "1001", "doi": "10.1/x"})
    finally:
        await client.aclose()

    assert built.status_code == 201
    assert built.json()["pmid"] == "1001"
    assert unknown.status_code == 404
    assert ambiguous.status_code == 422


# software


@pytest.mark.parametrize(
    "texts, expected",
    [
        (["SPM12 (Wellcome Centre for Human Neuroimaging)"], ["SPM"]),
        (["FSL 6.0.4 FEAT", "SPM 8"], ["FSL", "SPM"]),
        (["AFNI 3dttest++"], ["AFNI"]),
        (["Nilearn 0.10.1"], ["nilearn"]),
        (["FitLins 0.11"], ["FitLins"]),
        (["fMRIPrep 20.2.1"], ["fMRIPrep"]),
        (["custom MATLAB scripts"], []),
    ],
)
def test_software_texts_become_packages(texts, expected):
    assert packages(texts) == expected


def _with_software(model=None, preprocessing=None):
    record = fx.record([fx.record_analysis("a0", GAIN["key"], GAIN["name"])])
    if model is not None:
        estimation = fx.minimal(fx.defs["ModelEstimation"])
        estimation.update(local_id="me1", software=fx.extracted(model))
        record["model_estimations"] = [estimation]
    if preprocessing is not None:
        pipeline = fx.minimal(fx.defs["Preprocessing"])
        pipeline.update(local_id="pp1", software=fx.extracted([preprocessing]))
        record["preprocessings"] = [pipeline]
    return record


def test_a_paper_s_software_is_its_model_estimation_s_else_its_preprocessing_s(session):
    both = _upload("1001", record=_with_software(model="SPM12", preprocessing="fMRIPrep 20.2"))
    preprocessing_only = _upload("1002", record=_with_software(preprocessing="FSL 6.0"))
    neither = _upload("1003")
    db.session.commit()

    found = software_by_base_study([both, preprocessing_only, neither])

    assert found[both]["packages"] == ["SPM"]
    assert found[both]["source"] == "ModelEstimation"
    assert set(found[both]["texts"]) == {"SPM12", "fMRIPrep 20.2"}
    assert found[preprocessing_only] == {
        "packages": ["FSL"], "source": "Preprocessing", "texts": ["FSL 6.0"]}
    assert neither not in found


@pytest.mark.anyio
async def test_candidates_and_drafts_carry_their_software(app, session, outreach_settings):
    base_study_id = _upload(record=_with_software(model="FSL 6.0 FEAT"))
    build_draft(base_study_id)
    db.session.commit()
    client = await _client(app, ADMIN_TOKEN)
    h = client._get_headers()
    try:
        drafts = await client.client.get("/api/outreach/drafts/", headers=h)
    finally:
        await client.aclose()
    assert drafts.json()["results"][0]["software"]["packages"] == ["FSL"]
