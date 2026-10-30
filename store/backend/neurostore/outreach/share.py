"""The author's page: a public Starlette app at ``/api/share``, outside the spec.

An author opens ``https://neurostore.org/share/#<token>``. The token is in the URL's
fragment, which browsers never send, so it reaches no server log; the page posts it to
``/session``, which answers with an HttpOnly cookie holding it, and every later request
is that cookie's draft. Anyone holding the link can act on that draft and nothing else.

Nothing happens on a plain GET, so mail scanners that open links change nothing: the
page records "opened" only when someone clicks to start, and files arrive one request
each. A preview link (an admin's look at the page) records and keeps nothing.

Files are saved as they arrive, checked, and scored against the draft's analyses by
``neurostore.outreach.matching``; ``/match`` then suggests which file goes with which
analysis. The author confirms or changes that, may say an analysis is wrong, and
submits. Nothing reaches NeuroVault until an admin approves the submission.
"""

from __future__ import annotations

import hashlib
import os
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import sqlalchemy as sa
from starlette.applications import Starlette
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException
from starlette.requests import ClientDisconnect, Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from neurostore.database import db
from neurostore.models import (
    BaseStudy,
    OutreachDraft,
    OutreachIssue,
    OutreachLink,
    OutreachPerson,
    OutreachUpload,
)
from neurostore.outreach import map_sets, matching
from neurostore.outreach.software import software_by_base_study
from neurostore.outreach.drafts import (
    LINK_DAYS,
    DraftError,
    clean_collection,
    record_event,
    token_sha256,
)

COOKIE = "outreach_share"
MAX_FILE_BYTES = 200 * 1024 * 1024
#: client_max_body_size of location /api/share/ in store/nginx/nginx.conf.
MAX_BODY_BYTES = MAX_FILE_BYTES
EXTENSIONS = (".nii.gz", ".nii")
#: At most this many files per analysis the draft lists: its t/z, effect and variance map.
FILES_PER_ANALYSIS = 3
MAP_TYPES = map_sets.MAP_TYPES
#: Statuses whose draft the author can still upload to and change.
OPEN = ("draft", "checked", "contacted", "opened", "uploading", "declined")
CLOSED_REASONS = {
    "excluded": "This request has been withdrawn.",
    "rejected": "This submission was not accepted; we will be in touch.",
    "files_deleted": "This request has been closed.",
}
AUTHOR_REPLIES = ("no_maps", "wrong_person", "already_shared", "declined", "unsubscribe")
ISSUE_REASONS = (
    "not_an_analysis",
    "wrong_coordinates",
    "wrong_direction",
    "missing_analysis",
    "other",
)
SCORE_SECONDS = 5.0


def upload_dir(settings):
    configured = settings.get("OUTREACH_UPLOAD_DIR")
    return Path(configured) if configured else Path(settings["FILE_DIR"]) / "outreach-uploads"


def _now():
    return datetime.now(timezone.utc)


# the link and its draft


def _link(token):
    if not token:
        return None
    return db.session.scalar(
        sa.select(OutreachLink).where(
            OutreachLink.token_sha256 == token_sha256(token),
            OutreachLink.revoked_at.is_(None),
            OutreachLink.expires_at > sa.func.now(),
        )
    )


def _session(request):
    """(link, draft) for the request's cookie, or a 401 the page reads as "ask again"."""
    link = _link(request.cookies.get(COOKIE))
    if link is None:
        raise HTTPException(401, "This link has expired or no longer works.")
    return link, db.session.get(OutreachDraft, link.draft_id)


def _act(link, draft, kind, data=None):
    """Record what the author did, and keep their link alive while they are working."""
    if link.preview:
        return
    record_event(draft, kind, "author", link.id, data)
    link.expires_at = max(link.expires_at, _now() + timedelta(days=LINK_DAYS))


def _writable(link, draft):
    if link.preview:
        raise HTTPException(403, "This is a preview: nothing done here is kept.")
    if draft.status not in OPEN:
        raise HTTPException(409, CLOSED_REASONS.get(draft.status, "This draft is submitted."))


# what the page shows


def _uploads(draft_id):
    return db.session.scalars(
        sa.select(OutreachUpload)
        .where(OutreachUpload.draft_id == draft_id, OutreachUpload.deleted_at.is_(None))
        .order_by(OutreachUpload.created_at, OutreachUpload.id)
    ).all()


def _keys(upload):
    return list((upload.check_details or {}).get("analysis_keys") or [])


def _pair(upload, key):
    """The matcher's reading of ``upload`` against analysis ``key``, for the page."""
    scores = (upload.check_details or {}).get("scores") or {}
    pair = (scores.get("pairs") or {}).get(key)
    if not pair:
        return None
    return {key: pair.get(key) for key in ("outcome", "score", "reason")}


def upload_view(upload, analysis_keys):
    details = upload.check_details or {}
    return {
        "id": upload.id,
        "filename": upload.filename,
        "path": details.get("path"),
        "kind": map_sets.KIND.get(upload.map_type, map_sets.OTHER),
        "map_type_by": details.get("map_type_by"),
        "partner_id": details.get("partner_id"),
        "partner_r": details.get("partner_r"),
        "partner_by": details.get("partner_by"),
        "reversed": bool(details.get("reversed")),
        "size_bytes": upload.size_bytes,
        "check_status": upload.check_status,
        "problem": details.get("problem"),
        "thresholded": (details.get("scores") or {}).get("thresholded"),
        "analysis_keys": _keys(upload),
        "assigned_by": details.get("assigned_by"),
        "label": upload.label,
        "map_type": upload.map_type,
        "fits": {key: _pair(upload, key) for key in analysis_keys},
    }


def view(link, draft):
    base_study = db.session.get(BaseStudy, draft.base_study_id)
    analysis_keys = [analysis["key"] for analysis in draft.analyses]
    issues = db.session.scalars(
        sa.select(OutreachIssue)
        .where(OutreachIssue.draft_id == draft.id)
        .order_by(OutreachIssue.created_at, OutreachIssue.id)
    ).all()
    return {
        "preview": link.preview,
        "status": draft.status,
        "open": draft.status in OPEN,
        "closed_reason": CLOSED_REASONS.get(draft.status),
        "paper": {
            "title": base_study.name,
            "journal": base_study.publication,
            "year": base_study.year,
            "authors": base_study.authors,
            "doi": base_study.doi,
            "pmid": base_study.pmid,
            "pmcid": base_study.pmcid,
        },
        "analyses": [
            {
                "key": analysis["key"],
                "name": analysis["name"],
                "description": analysis.get("description"),
                "points": len(analysis.get("points") or []),
            }
            for analysis in draft.analyses
        ],
        "collection": draft.collection,
        # The paper's analysis software, so the page can tailor where to find the maps.
        "software": software_by_base_study([draft.base_study_id]).get(draft.base_study_id),
        "uploads": [upload_view(upload, analysis_keys) for upload in _uploads(draft.id)],
        "issues": [
            {"kind": i.kind, "analysis_key": i.analysis_key, "reason": i.reason, "note": i.note}
            for i in issues
            if i.kind in ("extraction_error", "help")
        ],
        "submitter_name": draft.submitter_name,
        "submitter_orcid": draft.submitter_orcid,
        "limits": {
            "max_files": max_files(draft),
            "max_file_bytes": MAX_FILE_BYTES,
            "extensions": list(EXTENSIONS),
            "map_types": list(MAP_TYPES),
        },
    }


def max_files(draft):
    return max(1, FILES_PER_ANALYSIS * len(draft.analyses))


# checking and scoring a file


def _extension(filename):
    lowered = filename.lower()
    return next((ext for ext in EXTENSIONS if lowered.endswith(ext)), None)


def _clean_filename(filename):
    name = os.path.basename(filename or "").strip()
    return re.sub(r"[^\w.\-+ ()]", "_", name)[:200]


def _clean_path(path):
    """Where the file sat in the folder the author chose, without any way out of it."""
    parts = [p for p in (path or "").replace("\\", "/").split("/") if p not in ("", ".", "..")]
    return "/".join(re.sub(r"[^\w.\-+ ()]", "_", p) for p in parts)[:500] or None


def check_file(path):
    """(image, problem): the loaded image, or why it is no usable group map.

    Reads the header before the data, so a file declaring more voxels than the matcher
    takes (a decompression bomb among them) is refused without being expanded.
    """
    import nibabel as nib
    import numpy as np

    try:
        image = nib.load(str(path))
    except Exception:
        return None, "This is not a readable NIfTI file."
    shape = tuple(int(n) for n in image.shape)
    if len(shape) == 4 and shape[3] == 1:
        image = image.slicer[..., 0]
        shape = shape[:3]
    if len(shape) != 3:
        return None, f"This file has {len(shape)} dimensions; a group map has 3."
    if int(np.prod(shape)) > matching.MAX_VOXELS:
        return None, "This image is larger than any group map we expect."
    try:
        data = np.asanyarray(image.dataobj, dtype=np.float32)
    except Exception:
        return None, "This file's data could not be read."
    finite = data[np.isfinite(data)]
    if finite.size == 0:
        return None, "This map holds no numbers."
    if float(finite.min()) == float(finite.max()):
        return None, "Every value in this map is the same."
    return image, None


def _analyses_for_matching(draft):
    prepared = []
    for analysis in draft.analyses:
        points = analysis.get("points") or []
        spaces = {point.get("space") for point in points if point.get("space")}
        prepared.append({
            "id": analysis["key"],
            "coordinates": [(point["x"], point["y"], point["z"]) for point in points],
            "space": spaces.pop() if len(spaces) == 1 else None,
        })
    return prepared


def score(draft, upload, image):
    deadline = time.perf_counter() + SCORE_SECONDS
    scores = matching.score_map(
        image, _analyses_for_matching(draft), map_id=upload.id, deadline=deadline
    )
    return scores.to_dict()


def suggest(draft):
    """Pair each effect and variance map with its statistic map, suggest an analysis for
    every statistic map (and unpaired map) the author has not assigned themselves, and
    give each paired map its statistic map's analyses."""
    uploads = [u for u in _uploads(draft.id) if (u.check_details or {}).get("scores")]
    stored = {u.id: matching.MapScores.from_dict(u.check_details["scores"]) for u in uploads}
    by_id = {u.id: u for u in uploads}
    automatic = map_sets.pair(
        [
            {"id": u.id, "filename": u.filename, "path": (u.check_details or {}).get("path"),
             "map_type": u.map_type}
            for u in uploads
        ],
        lambda a, b: matching.fingerprint_correlation(stored[a], stored[b]),
    )
    partners = {}
    for upload in uploads:
        details = upload.check_details or {}
        if details.get("partner_by") == "author":
            if details.get("partner_id") in by_id:
                partners[upload.id] = {"partner_id": details["partner_id"], "r": None,
                                       "by": "author", "reversed": False}
        elif upload.id in automatic:
            partners[upload.id] = automatic[upload.id]

    leaders = [u for u in uploads if u.id not in partners]
    keys = [analysis["key"] for analysis in draft.analyses]
    assignment = matching.assign([stored[u.id] for u in leaders], keys)
    taken = {key for u in leaders if (u.check_details or {}).get("assigned_by") == "author"
             for key in _keys(u)}
    for upload in leaders:
        details = dict(upload.check_details or {})
        if details.get("partner_by") != "author":
            for field in ("partner_id", "partner_r", "partner_by", "reversed"):
                details.pop(field, None)
        if details.get("assigned_by") != "author":
            suggested = [
                pair.analysis_id for pair in assignment.analyses_for(upload.id)
                if pair.analysis_id not in taken
            ]
            details["analysis_keys"] = suggested
            details["assigned_by"] = "suggestion" if suggested else None
        upload.check_details = details
        upload.analysis_key = (_keys(upload) or [None])[0]
    for upload in uploads:
        if upload.id not in partners:
            continue
        found = partners[upload.id]
        details = dict(upload.check_details or {})
        details.update(partner_id=found["partner_id"], partner_r=found["r"],
                       partner_by=found["by"], reversed=found["reversed"])
        if details.get("assigned_by") != "author":
            details["analysis_keys"] = _keys(by_id[found["partner_id"]])
            details["assigned_by"] = "set" if details["analysis_keys"] else None
        upload.check_details = details
        upload.analysis_key = (_keys(upload) or [None])[0]
    return assignment


# routes


async def _body(request):
    try:
        body = await request.json()
    except ValueError:
        raise HTTPException(422, "the body must be JSON")
    if not isinstance(body, dict):
        raise HTTPException(422, "the body must be an object")
    return body


def _cookie(response, token, settings):
    response.set_cookie(
        COOKIE,
        token,
        max_age=LINK_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=settings.get("ENV") not in ("development", "testing"),
        samesite="strict",
        path="/api/share",
    )


async def session(request: Request):
    """Trade the link's token for a cookie, and show the draft."""
    token = (await _body(request)).get("token")
    settings = request.state.settings

    def _run():
        link = _link(token if isinstance(token, str) else None)
        if link is None:
            raise HTTPException(401, "This link has expired or no longer works.")
        return view(link, db.session.get(OutreachDraft, link.draft_id))

    response = JSONResponse(await run_in_threadpool(_run))
    _cookie(response, token, settings)
    return response


def _route(change=None, *, body=False, status=200):
    """A route on the cookie's draft: ``change(link, draft, body)`` then the page's view."""

    async def handler(request: Request):
        given = await _body(request) if body else None

        def _run():
            link, draft = _session(request)
            if change is not None:
                try:
                    change(link, draft, given, request)
                except DraftError as exc:
                    db.session.rollback()
                    raise HTTPException(409, str(exc))
                db.session.commit()
            return view(link, draft)

        return JSONResponse(await run_in_threadpool(_run), status_code=status)

    return handler


def _opened(link, draft, _body, _request):
    _act(link, draft, "opened")


async def upload(request: Request):
    """One file, as the raw request body, named by ``?filename=``. Saved before it is
    checked, so an author who leaves never loses what already arrived."""
    filename = _clean_filename(request.query_params.get("filename", ""))
    path = _clean_path(request.query_params.get("path"))
    extension = _extension(filename)
    if extension is None:
        raise HTTPException(422, "Upload .nii or .nii.gz files.")
    settings = request.state.settings

    def _start():
        link, draft = _session(request)
        _writable(link, draft)
        if len(_uploads(draft.id)) >= max_files(draft):
            raise HTTPException(
                409, f"This paper takes at most {max_files(draft)} files; remove one first."
            )
        return link.id, draft.id

    link_id, draft_id = await run_in_threadpool(_start)
    folder = upload_dir(settings) / draft_id
    folder.mkdir(parents=True, exist_ok=True)
    partial = folder / f".incoming-{os.urandom(8).hex()}{extension}"
    digest, size = hashlib.sha256(), 0
    try:
        with partial.open("wb") as out:
            async for chunk in request.stream():
                size += len(chunk)
                if size > MAX_FILE_BYTES:
                    raise HTTPException(413, "Files over 200 MB are not supported.")
                digest.update(chunk)
                out.write(chunk)
    except (HTTPException, ClientDisconnect):
        partial.unlink(missing_ok=True)
        raise
    if size == 0:
        partial.unlink(missing_ok=True)
        raise HTTPException(422, "This file is empty.")

    def _finish():
        link = db.session.get(OutreachLink, link_id)
        draft = db.session.get(OutreachDraft, draft_id)
        row = OutreachUpload(
            draft_id=draft_id, filename=filename, size_bytes=size, sha256=digest.hexdigest()
        )
        db.session.add(row)
        db.session.flush()
        stored = folder / f"{row.id}{extension}"
        partial.rename(stored)
        row.path = str(stored)
        image, problem = check_file(stored)
        details = {"problem": problem, "path": path}
        if image is not None:
            details["scores"] = score(draft, row, image)
        row.map_type, details["map_type_by"] = map_sets.detect_type(image, filename, path)
        row.check_status = "ok" if problem is None else "problem"
        row.check_details = details
        _act(link, draft, "file_uploaded", {"upload_id": row.id, "filename": filename})
        suggest(draft)
        db.session.commit()
        return view(link, draft)

    try:
        return JSONResponse(await run_in_threadpool(_finish), status_code=201)
    finally:
        partial.unlink(missing_ok=True)


def _upload_of(draft, upload_id):
    row = db.session.get(OutreachUpload, upload_id)
    if row is None or row.draft_id != draft.id or row.deleted_at is not None:
        raise HTTPException(404, "No such file on this draft.")
    return row


def _assign(link, draft, body, request):
    """The author says which analyses a file is for, labels a file the paper has none
    for, says what kind of map it is, or which statistic map an effect or variance map
    goes with (null to unpair it)."""
    _writable(link, draft)
    row = _upload_of(draft, request.path_params["upload_id"])
    details = dict(row.check_details or {})
    if "analysis_keys" in body:
        keys = body["analysis_keys"] or []
        known = {analysis["key"] for analysis in draft.analyses}
        if not isinstance(keys, list) or not set(keys) <= known:
            raise DraftError("analysis_keys must name this draft's analyses")
        details["analysis_keys"] = keys
        details["assigned_by"] = "author"
        row.analysis_key = keys[0] if keys else None
    if "label" in body:
        row.label = (body["label"] or "").strip()[:300] or None
    if "map_type" in body:
        if body["map_type"] not in MAP_TYPES:
            raise DraftError(f"map_type must be one of {', '.join(MAP_TYPES)}")
        row.map_type = body["map_type"]
        details["map_type_by"] = "author"
    if "partner_id" in body:
        partner = body["partner_id"]
        if partner is not None:
            other = _upload_of(draft, partner)
            if map_sets.KIND.get(other.map_type) != map_sets.STATISTIC or other.id == row.id:
                raise DraftError("a map can only go with a t, z or F map")
        details["partner_id"], details["partner_by"] = partner, "author"
        details["partner_r"], details["reversed"] = None, False
        if details.get("assigned_by") == "set":
            details["assigned_by"] = None
    row.check_details = details
    suggest(draft)
    _act(link, draft, "file_assigned", {
        "upload_id": row.id, "analysis_keys": _keys(row), "label": row.label,
        "map_type": row.map_type, "partner_id": (row.check_details or {}).get("partner_id"),
    })


def _remove(link, draft, _body, request):
    _writable(link, draft)
    row = _upload_of(draft, request.path_params["upload_id"])
    row.deleted_at, row.deleted_by = _now(), "author"
    if row.path:
        Path(row.path).unlink(missing_ok=True)
        row.path = None
    _act(link, draft, "file_removed", {"upload_id": row.id, "filename": row.filename})
    suggest(draft)


def _rematch(link, draft, _body, _request):
    _writable(link, draft)
    suggest(draft)


def _issue(link, draft, body, _request):
    """The author says an analysis is wrong or missing, or asks for help."""
    if link.preview:
        raise HTTPException(403, "This is a preview: nothing done here is kept.")
    kind = body.get("kind")
    if kind not in ("extraction_error", "help"):
        raise DraftError("kind must be extraction_error or help")
    reason = body.get("reason")
    if kind == "extraction_error" and reason not in ISSUE_REASONS:
        raise DraftError(f"reason must be one of {', '.join(ISSUE_REASONS)}")
    key = body.get("analysis_key")
    if key is not None and key not in {analysis["key"] for analysis in draft.analyses}:
        raise DraftError("analysis_key must name this draft's analyses")
    note = (body.get("note") or "").strip()[:4000] or None
    if kind == "help" and not note:
        raise DraftError("say what you need help with")
    issue = OutreachIssue(draft_id=draft.id, kind=kind, analysis_key=key, reason=reason, note=note)
    db.session.add(issue)
    db.session.flush()
    _act(link, draft, "issue_reported", {"issue_id": issue.id, "kind": kind, "reason": reason})


def _reply(link, draft, body, _request):
    """The author's answer without uploading: no maps, wrong person, already shared,
    declined, or stop emailing me (which also opts their address out)."""
    if link.preview:
        raise HTTPException(403, "This is a preview: nothing done here is kept.")
    kind = body.get("kind")
    if kind not in AUTHOR_REPLIES:
        raise DraftError(f"kind must be one of {', '.join(AUTHOR_REPLIES)}")
    data = {
        "reply": "declined" if kind == "unsubscribe" else kind,
        "note": (body.get("note") or "").strip()[:4000] or None,
        "link": (body.get("link") or "").strip()[:1000] or None,
    }
    if kind == "unsubscribe":
        data["unsubscribed"] = True
        person = db.session.get(OutreachPerson, draft.person_id) if draft.person_id else None
        if person is not None and person.opted_out_at is None:
            person.opted_out_at = _now()
    _act(link, draft, "declined" if kind in ("declined", "unsubscribe") else "reply", data)


def _metadata(link, draft, body, _request):
    """The author's optional corrections: the collection's fields, and the names and
    descriptions of the analyses. Which analyses there are is said with an issue."""
    _writable(link, draft)
    changed = []
    if "collection" in body:
        draft.collection = clean_collection({**draft.collection, **(body["collection"] or {})})
        changed.append("collection")
    edits = body.get("analyses")
    if edits is not None:
        if not isinstance(edits, dict):
            raise DraftError("analyses must map analysis keys to their name and description")
        updated = []
        for analysis in draft.analyses:
            edit = edits.get(analysis["key"]) or {}
            name = (edit.get("name") or analysis["name"]).strip()
            description = edit.get("description", analysis.get("description"))
            updated.append({**analysis, "name": name, "description": description or None})
        draft.analyses = updated
        changed.append("analyses")
    if changed:
        _act(link, draft, "edited", {"fields": changed})


def _submit(link, draft, body, _request):
    _writable(link, draft)
    if not any(row.check_status == "ok" for row in _uploads(draft.id)):
        raise DraftError("Upload at least one usable map before submitting.")
    name = (body.get("name") or "").strip()
    if not name:
        raise DraftError("Tell us who is submitting.")
    orcid = (body.get("orcid") or "").strip() or None
    if orcid is not None and not re.fullmatch(r"\d{4}-\d{4}-\d{4}-\d{3}[\dX]", orcid):
        raise DraftError("An ORCID iD looks like 0000-0002-1825-0097.")
    draft.submitter_name, draft.submitter_orcid = name[:300], orcid
    draft.submitter_orcid_verified = False
    _act(link, draft, "submitted", {"files": len(_uploads(draft.id))})


async def _http_error(request, exc):
    return JSONResponse({"detail": exc.detail, "status": exc.status_code}, exc.status_code)


def share_app():
    return Starlette(
        routes=[
            Route("/session", session, methods=["POST"]),
            Route("/draft", _route()),
            Route("/opened", _route(_opened), methods=["POST"]),
            Route("/uploads", upload, methods=["POST"]),
            Route("/uploads/{upload_id}", _route(_assign, body=True), methods=["PATCH"]),
            Route("/uploads/{upload_id}/remove", _route(_remove), methods=["POST"]),
            Route("/match", _route(_rematch), methods=["POST"]),
            Route("/issues", _route(_issue, body=True), methods=["POST"]),
            Route("/reply", _route(_reply, body=True), methods=["POST"]),
            Route("/metadata", _route(_metadata, body=True), methods=["PATCH"]),
            Route("/submit", _route(_submit, body=True), methods=["POST"]),
        ],
        exception_handlers={HTTPException: _http_error},
    )
