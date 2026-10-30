"""The author's page: a link's cookie, uploads and their checks, matching, issues,
replies and submitting, and that previews and plain GETs record nothing."""

import httpx
import nibabel as nib
import pytest
import sqlalchemy as sa

from neurostore.database import db
from neurostore.ingest.study_schema import ingest_upload
from neurostore.models import OutreachEvent, OutreachIssue, OutreachPerson, OutreachUpload
from neurostore.outreach import map_sets
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
    assert again.json()["limits"]["max_files"] == 6  # a t/z, effect and variance map each
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
    for index in range(5):
        await _upload(author, f"map{index}.nii.gz", good)
    too_many = await _upload(author, "one-more.nii.gz", good)

    assert wrong_type.status_code == 422
    assert empty.status_code == 422
    assert unreadable.status_code == 201  # kept, but flagged for the author
    flagged = unreadable.json()["uploads"][0]
    assert (flagged["check_status"], flagged["problem"]) == (
        "problem", "This is not a readable NIfTI file.")
    assert too_many.status_code == 409  # three files per analysis: six here


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


# map sets: each effect and variance map goes with its t/z map


@pytest.mark.parametrize(
    "name, expected",
    [
        ("cope1.feat/stats/zstat1.nii.gz", "z"),
        ("cope1.feat/stats/tstat1.nii.gz", "t"),
        ("cope1.feat/stats/cope1.nii.gz", "effect"),
        ("cope1.feat/stats/varcope1.nii.gz", "variance"),
        ("con_0003.nii", "effect"),
        ("spmT_0003.nii", "t"),
        ("faces_effect_size.nii.gz", "effect"),
        ("faces_effect_variance.nii.gz", "variance"),
        ("faces_z_score.nii.gz", "z"),
        ("sub-group_contrast-faces_stat-effect_statmap.nii.gz", "effect"),
        ("sub-group_contrast-faces_stat-t_statmap.nii.gz", "t"),
        ("resting_state_component.nii.gz", None),
    ],
)
def test_a_map_s_kind_is_read_from_its_name(name, expected):
    assert map_sets.type_from_name(name) == expected


def test_a_header_s_statement_wins_over_the_name():
    image = synthetic_map(PEAKS_A)
    image.header["descrip"] = b"SPM{T_[20.0]} - contrast 1: faces > houses"
    assert map_sets.detect_type(image, "con_0001.nii") == ("t", "header")
    image.header.set_intent("z score")
    assert map_sets.detect_type(image, "anything.nii") == ("z", "header")


def _maps(*rows):
    return [{"id": name, "filename": name.rsplit("/", 1)[-1], "path": name, "map_type": kind}
            for name, kind in rows]


def test_effect_maps_pair_with_the_statistic_map_beside_them_that_they_track():
    maps = _maps(
        ("cope1.feat/stats/zstat1.nii.gz", "z"),
        ("cope1.feat/stats/cope1.nii.gz", "effect"),
        ("cope1.feat/stats/varcope1.nii.gz", "variance"),
        ("cope2.feat/stats/zstat1.nii.gz", "z"),
        ("cope2.feat/stats/cope1.nii.gz", "effect"),
    )
    r = {("cope1.feat/stats/cope1.nii.gz", "cope1.feat/stats/zstat1.nii.gz"): 0.97,
         ("cope2.feat/stats/cope1.nii.gz", "cope2.feat/stats/zstat1.nii.gz"): 0.95}
    pairs = map_sets.pair(maps, lambda a, b: r.get((a, b), 0.1))

    assert pairs["cope1.feat/stats/cope1.nii.gz"]["partner_id"] == "cope1.feat/stats/zstat1.nii.gz"
    assert pairs["cope2.feat/stats/cope1.nii.gz"]["partner_id"] == "cope2.feat/stats/zstat1.nii.gz"
    assert pairs["cope1.feat/stats/cope1.nii.gz"]["by"] == "name+correlation"
    assert pairs["cope1.feat/stats/varcope1.nii.gz"]["by"] == "name"  # variance: names only


def test_an_effect_map_named_like_a_statistic_map_it_does_not_track_stays_unpaired():
    maps = _maps(("con_0001.nii", "effect"), ("spmT_0001.nii", "t"))
    assert map_sets.pair(maps, lambda a, b: 0.2) == {}  # ask the author
    reversed_ = map_sets.pair(maps, lambda a, b: -0.9)["con_0001.nii"]
    assert reversed_["reversed"] is True


def test_with_no_name_to_go_by_only_one_clear_correlation_pairs():
    maps = _maps(("a.nii", "effect"), ("b.nii", "z"), ("c.nii", "z"))
    one = map_sets.pair(maps, lambda a, b: {"b.nii": 0.93}.get(b, 0.3))
    two = map_sets.pair(maps, lambda a, b: 0.9)  # near-identical contrasts: unsure
    assert one["a.nii"]["by"] == "correlation" and one["a.nii"]["partner_id"] == "b.nii"
    assert two == {}


def _effect_of(image, scale=2.5, noise=0.2, seed=7):
    import numpy as np

    rng = np.random.default_rng(seed)
    data = image.get_fdata() * scale + noise * rng.standard_normal(image.shape)
    return nib.Nifti1Image(data.astype("float32"), image.affine)


def _variance_like(image, seed=8):
    import numpy as np

    rng = np.random.default_rng(seed)
    return nib.Nifti1Image((1 + np.abs(rng.standard_normal(image.shape))).astype("float32"),
                           image.affine)


async def _upload_at(author, path, content):
    return await author.post("/api/share/uploads", content=content,
                             params={"filename": path.rsplit("/", 1)[-1], "path": path})


async def test_a_chosen_folder_s_sets_are_matched_through_their_statistic_maps(
    author, session, share_settings
):
    draft, token = _sent_draft()
    tmp = share_settings
    await author.post("/api/share/session", json={"token": token})
    faces, houses = synthetic_map(PEAKS_A), synthetic_map(PEAKS_B, seed=1)
    files = {
        "group.gfeat/cope1.feat/stats/zstat1.nii.gz": faces,
        "group.gfeat/cope1.feat/stats/cope1.nii.gz": _effect_of(faces),
        "group.gfeat/cope1.feat/stats/varcope1.nii.gz": _variance_like(faces),
        "group.gfeat/cope2.feat/stats/zstat1.nii.gz": houses,
        "group.gfeat/cope2.feat/stats/cope1.nii.gz": _effect_of(houses, seed=9),
    }
    for index, (path, image) in enumerate(files.items()):
        view = (await _upload_at(author, path, _nifti(tmp, f"{index}.nii.gz", image))).json()

    by_path = {u["path"]: u for u in view["uploads"]}
    faces_key, houses_key = _key(draft, "Faces > Houses"), _key(draft, "Houses > Scrambled")
    stats1, stats2 = by_path["group.gfeat/cope1.feat/stats/zstat1.nii.gz"], \
        by_path["group.gfeat/cope2.feat/stats/zstat1.nii.gz"]
    assert stats1["analysis_keys"] == [faces_key] and stats2["analysis_keys"] == [houses_key]
    effect1 = by_path["group.gfeat/cope1.feat/stats/cope1.nii.gz"]
    effect2 = by_path["group.gfeat/cope2.feat/stats/cope1.nii.gz"]
    variance1 = by_path["group.gfeat/cope1.feat/stats/varcope1.nii.gz"]
    assert (effect1["kind"], effect1["partner_id"], effect1["analysis_keys"]) == (
        "effect", stats1["id"], [faces_key])
    assert effect1["partner_by"] == "name+correlation" and effect1["partner_r"] > 0.9
    assert (effect2["partner_id"], effect2["analysis_keys"]) == (stats2["id"], [houses_key])
    assert (variance1["kind"], variance1["partner_id"]) == ("variance", stats1["id"])
    assert effect1["assigned_by"] == "set"


async def test_the_author_can_pair_or_unpair_a_map_themselves(author, session, share_settings):
    draft, token = _sent_draft()
    tmp = share_settings
    await author.post("/api/share/session", json={"token": token})
    faces = synthetic_map(PEAKS_A)
    await _upload(author, "zstat1.nii.gz", _nifti(tmp, "a.nii.gz", faces))
    renamed = _nifti(tmp, "b.nii.gz", _effect_of(faces))
    view = (await _upload(author, "renamed.nii.gz", renamed)).json()
    by_name = {u["filename"]: u for u in view["uploads"]}

    typed = await author.patch(f"/api/share/uploads/{by_name['renamed.nii.gz']['id']}",
                               json={"map_type": "effect"})
    unpaired = await author.patch(f"/api/share/uploads/{by_name['renamed.nii.gz']['id']}",
                                  json={"partner_id": None})
    bad = await author.patch(f"/api/share/uploads/{by_name['zstat1.nii.gz']['id']}",
                             json={"partner_id": by_name["renamed.nii.gz"]["id"]})

    renamed = {u["filename"]: u for u in typed.json()["uploads"]}["renamed.nii.gz"]
    # Told it is an effect map, it pairs by correlation though its name says nothing.
    assert (renamed["partner_id"], renamed["partner_by"]) == (
        by_name["zstat1.nii.gz"]["id"], "correlation")
    after = {u["filename"]: u for u in unpaired.json()["uploads"]}["renamed.nii.gz"]
    assert (after["partner_id"], after["partner_by"]) == (None, "author")
    assert bad.status_code == 409  # a map goes with a statistic map, not an effect map


# what the admin panel sees of it


async def test_admins_see_the_uploads_and_issues_and_can_clean_up(author, app, session,
                                                                  share_settings):
    from neurostore.tests.request_utils import AsyncClient
    from neurostore.tests.test_outreach import ADMIN_TOKEN

    draft, token = _sent_draft()
    tmp = share_settings
    await author.post("/api/share/session", json={"token": token})
    content = _nifti(tmp, "a.nii.gz", synthetic_map(PEAKS_A))
    await _upload(author, "faces.nii.gz", content)
    await _upload(author, "other.nii.gz", _nifti(tmp, "b.nii.gz", synthetic_map(PEAKS_C)))
    await author.post("/api/share/issues", json={"kind": "help", "note": "Which template?"})

    admin = AsyncClient(token=ADMIN_TOKEN, asgi_app=app.asgi_app)
    h, base = admin._get_headers(), f"/api/outreach/drafts/{draft.id}"
    try:
        detail = (await admin.client.get(base, headers=h)).json()
        listed = (await admin.client.get("/api/outreach/drafts/", headers=h)).json()["results"]
        faces = next(u for u in detail["uploads"] if u["filename"] == "faces.nii.gz")
        downloaded = await admin.client.get(f"{base}/uploads/{faces['id']}/file", headers=h)
        resolved = await admin.client.post(
            f"{base}/issues/{detail['issues'][0]['id']}/resolve", headers=h,
            json={"resolution": "Replied: MNI152 2 mm"})
        deleted = await admin.client.post(f"{base}/files/delete", headers=h, json={})
        again = await admin.client.post(f"{base}/files/delete", headers=h, json={})
        gone = await admin.client.get(f"{base}/uploads/{faces['id']}/file", headers=h)
        anonymous = await author.get(f"{base}/uploads/{faces['id']}/file")
    finally:
        await admin.aclose()

    assert (detail["files"], detail["open_issues"]) == (2, 1)
    assert (listed[0]["files"], listed[0]["open_issues"]) == (2, 1)
    assert faces["analysis_keys"] == [_key(draft, "Faces > Houses")]
    assert faces["fits"][_key(draft, "Faces > Houses")]["outcome"] == "match"
    assert detail["issues"][0]["note"] == "Which template?"
    assert detail["submitter_name"] is None  # not submitted yet
    assert downloaded.content == content
    assert resolved.json()["issues"][0]["state"] == "resolved"
    assert resolved.json()["open_issues"] == 0
    assert deleted.json()["status"] == "files_deleted"
    assert deleted.json()["files"] == 0
    assert all(u["deleted_at"] for u in deleted.json()["uploads"])  # rows and history stay
    assert not list((tmp / "uploads").rglob("*.nii.gz"))
    assert again.status_code == 409
    assert gone.status_code == 404
    assert anonymous.status_code == 401
