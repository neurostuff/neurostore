"""Outreach's admin API: a Starlette app mounted at ``/api/outreach``, outside the spec.

Every route needs an outreach admin (``neurostore.outreach.auth``). Database work runs in
the threadpool, in the request's session; a route that writes commits its own work.
"""

from __future__ import annotations

import os
from datetime import datetime

import sqlalchemy as sa
from starlette.applications import Starlette
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse
from starlette.routing import Route

from neurostore.database import db
from neurostore.models import (
    BaseStudy,
    OutreachDraft,
    OutreachEvent,
    OutreachPerson,
    OutreachUpload,
)
from neurostore.models.outreach import DRAFT_STATUSES
from neurostore.outreach import files as outreach_files
from neurostore.outreach import people as outreach_people
from neurostore.outreach.auth import outreach_admin
from neurostore.outreach.candidates import candidates_query
from neurostore.base_studies import find_base_study
from neurostore.outreach.drafts import (
    DraftError,
    build_draft,
    check_draft,
    create_link,
    edit_draft,
    exclude_draft,
    live_links,
    log_reply,
    mark_sent,
    reopen_draft,
    revoke_links,
    undo_sent,
)
from neurostore.outreach.email import compose_email
from neurostore.outreach.share import upload_view
from neurostore.outreach.software import software_by_base_study

DEFAULT_LIMIT = 100
MAX_LIMIT = 1000


def _iso(value):
    return value.isoformat() if isinstance(value, datetime) else value


def _int(request, name, default=None, minimum=None, maximum=None):
    raw = request.query_params.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise HTTPException(422, f"{name} must be an integer")
    if minimum is not None and value < minimum:
        raise HTTPException(422, f"{name} must be at least {minimum}")
    return min(value, maximum) if maximum is not None else value


async def _body(request):
    try:
        body = await request.json()
    except ValueError:
        raise HTTPException(422, "the body must be JSON")
    if not isinstance(body, dict):
        raise HTTPException(422, "the body must be an object")
    return body


def _found(model, id_):
    row = db.session.get(model, id_)
    if row is None:
        raise HTTPException(404, f"no {model.__tablename__} row {id_}")
    return row


def _write(change):
    """Run ``change`` and commit, or roll back and answer 409 with its DraftError."""
    try:
        result = change()
    except DraftError as exc:
        db.session.rollback()
        raise HTTPException(409, str(exc))
    db.session.commit()
    return result


def _person(person, messages=0, author_messages=None):
    if person is None:
        return None
    return {
        "id": person.id,
        "author_id": person.author_id,
        "opted_out_at": _iso(person.opted_out_at),
        "bounced_at": _iso(person.bounced_at),
        "suppressed": person.suppressed,
        "messages": messages,
        # Messages to the same author under any of their addresses.
        "author_messages": messages if author_messages is None else author_messages,
        "notes": person.notes,
    }


def _people_counts(found):
    return (
        outreach_people.message_counts(list(found)),
        outreach_people.author_message_counts(found),
    )


def _draft_summary(
    draft, base_study, person=None, counts=({}, {}), software=None, files=0, open_issues=0
):
    return {
        "id": draft.id,
        "base_study_id": draft.base_study_id,
        "name": base_study.name,
        "year": base_study.year,
        "doi": base_study.doi,
        "pmid": base_study.pmid,
        "pmcid": base_study.pmcid,
        "journal": base_study.publication,
        "status": draft.status,
        "created_at": _iso(draft.created_at),
        "last_activity_at": _iso(draft.last_activity_at),
        "analyses": len(draft.analyses),
        "person_id": draft.person_id,
        "person": _person(
            person, counts[0].get(draft.person_id, 0), counts[1].get(draft.person_id, 0)
        ),
        "last_reply": None,
        "software": software,
        # Files the author uploaded and still kept, and problems they reported not yet resolved.
        "files": files,
        "open_issues": open_issues,
    }


def _event(event):
    return {
        "kind": event.kind,
        "actor": event.actor,
        "actor_id": event.actor_id,
        "data": event.data,
        "created_at": _iso(event.created_at),
    }


REPLY_EVENTS = ("reply", "declined")


def _reply(event):
    data = event.data or {}
    return {
        "kind": data.get("reply"),
        "note": data.get("note"),
        "link": data.get("link"),
        "at": _iso(event.created_at),
    }


def _last_reply(events):
    replies = [
        event for event in events
        if event.kind in REPLY_EVENTS
        and (event.data or {}).get("reply")
        and not (event.data or {}).get("undone_at")
    ]
    return _reply(replies[-1]) if replies else None


def _last_replies(draft_ids):
    """{draft id: its latest logged reply}."""
    if not draft_ids:
        return {}
    events = db.session.scalars(
        sa.select(OutreachEvent)
        .where(OutreachEvent.draft_id.in_(draft_ids), OutreachEvent.kind.in_(REPLY_EVENTS))
        .order_by(OutreachEvent.created_at, OutreachEvent.id)
    ).all()
    by_draft = {}
    for event in events:
        by_draft.setdefault(event.draft_id, []).append(event)
    latest = {draft_id: _last_reply(held) for draft_id, held in by_draft.items()}
    return {draft_id: reply for draft_id, reply in latest.items() if reply}


def _admin_upload(upload, analysis_keys):
    return {
        **upload_view(upload, analysis_keys),
        "sha256": upload.sha256,
        "created_at": _iso(upload.created_at),
        "deleted_at": _iso(upload.deleted_at),
        "deleted_by": upload.deleted_by,
    }


def _issue(issue):
    return {
        "id": issue.id,
        "kind": issue.kind,
        "analysis_key": issue.analysis_key,
        "reason": issue.reason,
        "note": issue.note,
        "state": issue.state,
        "resolution": issue.resolution,
        "resolved_by": issue.resolved_by,
        "resolved_at": _iso(issue.resolved_at),
        "created_at": _iso(issue.created_at),
    }


def _detail(draft):
    base_study = db.session.get(BaseStudy, draft.base_study_id)
    person = db.session.get(OutreachPerson, draft.person_id) if draft.person_id else None
    counts = _people_counts({person.id: person} if person else {})
    events = db.session.scalars(
        sa.select(OutreachEvent)
        .where(OutreachEvent.draft_id == draft.id)
        .order_by(OutreachEvent.created_at, OutreachEvent.id)
    ).all()
    links = live_links(draft.id)
    uploads = outreach_files.uploads_of(draft.id)
    issues = outreach_files.issues_of(draft.id)
    keys = [analysis["key"] for analysis in draft.analyses]
    return {
        **_draft_summary(
            draft, base_study, person, counts,
            software_by_base_study([draft.base_study_id]).get(draft.base_study_id),
            files=sum(upload.deleted_at is None for upload in uploads),
            open_issues=sum(issue.state == "open" for issue in issues),
        ),
        "uploads": [_admin_upload(upload, keys) for upload in uploads],
        "issues": [_issue(issue) for issue in issues],
        "submitter_name": draft.submitter_name,
        "submitter_orcid": draft.submitter_orcid,
        "submitter_orcid_verified": draft.submitter_orcid_verified,
        "last_reply": _last_reply(events),
        "source_study_id": draft.source_study_id,
        "source_sha256": draft.source_sha256,
        "analyses": draft.analyses,
        "collection": draft.collection,
        "link_expires_at": _iso(max((link.expires_at for link in links), default=None)),
        "events": [_event(event) for event in events],
    }


async def me(request: Request):
    return JSONResponse({"admin": await outreach_admin(request)})


async def candidates(request: Request):
    await outreach_admin(request)
    since_year = _int(request, "since_year", default=datetime.now().year, minimum=1900)
    limit = _int(request, "limit", default=DEFAULT_LIMIT, minimum=1, maximum=MAX_LIMIT)
    country = request.query_params.get("country", "US")

    def _run():
        rows = db.session.execute(candidates_query(since_year, country).limit(limit)).all()
        software = software_by_base_study([base_study.id for base_study, _ in rows])
        return [
            {
                "base_study_id": base_study.id,
                "name": base_study.name,
                "year": base_study.year,
                "doi": base_study.doi,
                "pmid": base_study.pmid,
                "pmcid": base_study.pmcid,
                "journal": base_study.publication,
                "result_analyses": count,
                "software": software.get(base_study.id),
            }
            for base_study, count in rows
        ]

    return JSONResponse({"results": await run_in_threadpool(_run)})


async def drafts(request: Request):
    actor = await outreach_admin(request)
    if request.method == "POST":
        return await _build(request, actor)
    statuses = request.query_params.getlist("status")
    unknown = set(statuses) - set(DRAFT_STATUSES)
    if unknown:
        raise HTTPException(422, f"status must be one of {', '.join(DRAFT_STATUSES)}")
    idle_days = _int(request, "idle_days", minimum=0)
    limit = _int(request, "limit", default=DEFAULT_LIMIT, minimum=1, maximum=MAX_LIMIT)

    def _run():
        query = sa.select(OutreachDraft, BaseStudy).join(
            BaseStudy, BaseStudy.id == OutreachDraft.base_study_id
        )
        if statuses:
            query = query.where(OutreachDraft.status.in_(statuses))
        if idle_days is not None:
            idle_since = sa.func.now() - sa.func.make_interval(0, 0, 0, idle_days)
            query = query.where(OutreachDraft.last_activity_at <= idle_since)
        # Oldest activity first: the in-progress drafts most likely to be forgotten.
        query = query.order_by(OutreachDraft.last_activity_at, OutreachDraft.id).limit(limit)
        rows = db.session.execute(query).all()
        found = outreach_people.people(sorted({d.person_id for d, _ in rows if d.person_id}))
        counts = _people_counts(found)
        replies = _last_replies([d.id for d, _ in rows])
        software = software_by_base_study(sorted({d.base_study_id for d, _ in rows}))
        draft_ids = [d.id for d, _ in rows]
        files = outreach_files.file_counts(draft_ids)
        issues = outreach_files.open_issue_counts(draft_ids)
        return [
            {
                **_draft_summary(
                    d, b, found.get(d.person_id), counts, software.get(d.base_study_id),
                    files=files.get(d.id, 0), open_issues=issues.get(d.id, 0),
                ),
                "last_reply": replies.get(d.id),
            }
            for d, b in rows
        ]

    return JSONResponse({"results": await run_in_threadpool(_run)})


PAPER_IDS = ("base_study_id", "pmid", "pmcid", "doi")


def _paper(body):
    """The active base study the body names by one of PAPER_IDS, or a 404/422."""
    given = {key: body[key].strip() for key in PAPER_IDS if isinstance(body.get(key), str)}
    given = {key: value for key, value in given.items() if value}
    if len(given) != 1:
        raise HTTPException(422, f"give exactly one of {', '.join(PAPER_IDS)}")
    ((key, value),) = given.items()
    if key == "base_study_id":
        header = {"neurostore_base_study_id": value}
    else:
        header = {"identifiers": {key: value, "publication_status": "published"}}
    found = find_base_study(db.session, header)
    if found is None:
        raise HTTPException(404, f"no paper with {key} {value}")
    return found.id


async def _build(request, actor):
    """Build a draft for the paper the body names: a candidate, or any paper by its id,
    PMID, PMCID or DOI (a personal contact, or a test paper outside the criteria)."""
    body = await _body(request)

    def _run():
        base_study_id = _paper(body)
        draft = _write(lambda: build_draft(base_study_id, actor="admin", actor_id=actor))
        return _detail(draft)

    return JSONResponse(await run_in_threadpool(_run), status_code=201)


async def draft(request: Request):
    actor = await outreach_admin(request)
    draft_id = request.path_params["draft_id"]
    body = await _body(request) if request.method == "PATCH" else None

    def _run():
        found = _found(OutreachDraft, draft_id)
        if body is not None:
            _write(lambda: edit_draft(
                found, actor, analyses=body.get("analyses"), collection=body.get("collection")
            ))
        return _detail(found)

    return JSONResponse(await run_in_threadpool(_run))


async def check(request: Request):
    actor = await outreach_admin(request)
    draft_id = request.path_params["draft_id"]

    def _run():
        found = _found(OutreachDraft, draft_id)
        _write(lambda: check_draft(found, actor))
        return _detail(found)

    return JSONResponse(await run_in_threadpool(_run))


def _action(change, *body_fields):
    """A POST route that applies ``change(draft, actor, **fields from the body)``."""

    async def route(request: Request):
        actor = await outreach_admin(request)
        draft_id = request.path_params["draft_id"]
        body = await _body(request) if body_fields else {}
        fields = {name: body.get(name) for name in body_fields}

        def _run():
            found = _found(OutreachDraft, draft_id)
            _write(lambda: change(found, actor, **fields))
            return _detail(found)

        return JSONResponse(await run_in_threadpool(_run))

    return route


async def resolve_issue(request: Request):
    actor = await outreach_admin(request)
    draft_id, issue_id = request.path_params["draft_id"], request.path_params["issue_id"]
    resolution = (await _body(request)).get("resolution")

    def _run():
        found = _found(OutreachDraft, draft_id)
        _write(lambda: outreach_files.resolve_issue(found, issue_id, actor, resolution))
        return _detail(found)

    return JSONResponse(await run_in_threadpool(_run))


async def upload_file(request: Request):
    """An uploaded map, to look at before approving: admins only."""
    await outreach_admin(request)
    draft_id, upload_id = request.path_params["draft_id"], request.path_params["upload_id"]

    def _run():
        upload = db.session.get(OutreachUpload, upload_id)
        if upload is None or upload.draft_id != draft_id or not upload.path:
            raise HTTPException(404, "no such file on this draft")
        if not os.path.exists(upload.path):
            raise HTTPException(404, "the file is gone from storage")
        return upload.path, upload.filename

    path, filename = await run_in_threadpool(_run)
    return FileResponse(path, filename=filename, media_type="application/octet-stream")


async def invitation(request: Request):
    """A new link for the draft and the email that carries it; the link is shown only here."""
    actor = await outreach_admin(request)
    draft_id = request.path_params["draft_id"]
    settings = request.state.settings

    def _run():
        found = _found(OutreachDraft, draft_id)
        if found.status == "draft":
            raise HTTPException(409, "approve the draft before making its link")
        if found.person_id is None:
            raise HTTPException(409, "the draft has no one to write to")
        person = db.session.get(OutreachPerson, found.person_id)
        if person.suppressed:
            raise HTTPException(409, "this person opted out or their address bounced")
        link, token = create_link(found, actor_id=actor)
        url = f"{settings['OUTREACH_SHARE_URL']}{token}"
        signature = (settings.get("OUTREACH_SIGNATURE") or "").replace("\\n", "\n")
        email = compose_email(found, person, url, signature or None)
        db.session.commit()
        return {"url": url, "expires_at": _iso(link.expires_at), "email": email}

    return JSONResponse(await run_in_threadpool(_run), status_code=201)


async def preview(request: Request):
    """A link that opens the author's page as they would see it, for a day, recording and
    keeping nothing: to check the page looks right for this paper."""
    actor = await outreach_admin(request)
    draft_id = request.path_params["draft_id"]
    settings = request.state.settings

    def _run():
        found = _found(OutreachDraft, draft_id)
        link, token = create_link(found, actor_id=actor, preview=True)
        db.session.commit()
        url = f"{settings['OUTREACH_SHARE_URL']}{token}"
        return {"url": url, "expires_at": _iso(link.expires_at)}

    return JSONResponse(await run_in_threadpool(_run), status_code=201)


async def sent(request: Request):
    actor = await outreach_admin(request)
    draft_id = request.path_params["draft_id"]
    body = await _body(request)

    def _run():
        found = _found(OutreachDraft, draft_id)
        _write(lambda: mark_sent(
            found,
            actor,
            kind=body.get("kind", "invite"),
            batch=body.get("batch"),
            template_version=body.get("template_version"),
        ))
        return _detail(found)

    return JSONResponse(await run_in_threadpool(_run))


def _person_detail(person):
    drafts_held, messages = outreach_people.history(person)
    return {
        **_person(
            person,
            len(messages),
            outreach_people.author_message_counts({person.id: person})[person.id],
        ),
        "asked_to_stop": outreach_people.asked_to_stop(person),
        "drafts": [
            {"id": d.id, "name": b.name, "year": b.year, "status": d.status}
            for d, b in drafts_held
        ],
        "sent": [
            {
                "draft_id": m.draft_id,
                "kind": m.kind,
                "batch": m.batch,
                "sent_at": _iso(m.sent_at),
                "sent_by": m.sent_by,
            }
            for m in messages
        ],
    }


async def person(request: Request):
    await outreach_admin(request)
    person_id = request.path_params["person_id"]

    def _run():
        return _person_detail(_found(OutreachPerson, person_id))

    return JSONResponse(await run_in_threadpool(_run))


async def suppression(request: Request):
    await outreach_admin(request)
    person_id = request.path_params["person_id"]
    body = await _body(request)

    def _run():
        found = _found(OutreachPerson, person_id)
        _write(lambda: outreach_people.suppress(found, body.get("what"), body.get("note")))
        return _person_detail(found)

    return JSONResponse(await run_in_threadpool(_run))


async def unsuppression(request: Request):
    actor = await outreach_admin(request)
    person_id = request.path_params["person_id"]
    body = await _body(request)

    def _run():
        found = _found(OutreachPerson, person_id)
        _write(lambda: outreach_people.unsuppress(found, body.get("what"), actor))
        return _person_detail(found)

    return JSONResponse(await run_in_threadpool(_run))


async def _http_error(request, exc):
    return JSONResponse({"detail": exc.detail, "status": exc.status_code}, exc.status_code)


def outreach_app():
    return Starlette(
        routes=[
            Route("/me", me),
            Route("/candidates/", candidates),
            Route("/drafts/", drafts, methods=["GET", "POST"]),
            Route("/drafts/{draft_id}", draft, methods=["GET", "PATCH"]),
            Route("/drafts/{draft_id}/check", check, methods=["POST"]),
            Route("/drafts/{draft_id}/invitation", invitation, methods=["POST"]),
            Route("/drafts/{draft_id}/sent", sent, methods=["POST"]),
            Route("/drafts/{draft_id}/preview", preview, methods=["POST"]),
            Route("/drafts/{draft_id}/unsend", _action(undo_sent), methods=["POST"]),
            Route("/drafts/{draft_id}/reply", _action(log_reply, "kind", "note", "link"),
                  methods=["POST"]),
            Route("/drafts/{draft_id}/exclude", _action(exclude_draft, "reason", "note"),
                  methods=["POST"]),
            Route("/drafts/{draft_id}/reopen", _action(reopen_draft), methods=["POST"]),
            Route("/drafts/{draft_id}/links/revoke", _action(revoke_links), methods=["POST"]),
            Route("/drafts/{draft_id}/files/delete", _action(outreach_files.delete_files),
                  methods=["POST"]),
            Route("/drafts/{draft_id}/issues/{issue_id}/resolve", resolve_issue,
                  methods=["POST"]),
            Route("/drafts/{draft_id}/uploads/{upload_id}/file", upload_file),
            Route("/people/{person_id}", person),
            Route("/people/{person_id}/suppression", suppression, methods=["POST"]),
            Route("/people/{person_id}/suppression/undo", unsuppression, methods=["POST"]),
        ],
        exception_handlers={HTTPException: _http_error},
    )
