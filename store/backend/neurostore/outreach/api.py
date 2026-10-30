"""Outreach's admin API: a Starlette app mounted at ``/api/outreach``, outside the spec.

Every route needs an outreach admin (``neurostore.outreach.auth``). Database work runs in
the threadpool, in the request's session; a route that writes commits its own work.
"""

from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from starlette.applications import Starlette
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from neurostore.database import db
from neurostore.models import BaseStudy, OutreachDraft, OutreachEvent, OutreachPerson
from neurostore.models.outreach import DRAFT_STATUSES
from neurostore.outreach import people as outreach_people
from neurostore.outreach.auth import outreach_admin
from neurostore.outreach.candidates import candidates_query
from neurostore.outreach.drafts import (
    DraftError,
    build_draft,
    check_draft,
    create_link,
    edit_draft,
    live_links,
    mark_sent,
)
from neurostore.outreach.email import compose_email

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


def _person(person, messages=0):
    if person is None:
        return None
    return {
        "id": person.id,
        "author_id": person.author_id,
        "opted_out_at": _iso(person.opted_out_at),
        "bounced_at": _iso(person.bounced_at),
        "suppressed": person.suppressed,
        "messages": messages,
        "notes": person.notes,
    }


def _draft_summary(draft, base_study, person=None, messages=0):
    return {
        "id": draft.id,
        "base_study_id": draft.base_study_id,
        "name": base_study.name,
        "year": base_study.year,
        "doi": base_study.doi,
        "journal": base_study.publication,
        "status": draft.status,
        "created_at": _iso(draft.created_at),
        "last_activity_at": _iso(draft.last_activity_at),
        "analyses": len(draft.analyses),
        "person_id": draft.person_id,
        "person": _person(person, messages),
    }


def _event(event):
    return {
        "kind": event.kind,
        "actor": event.actor,
        "actor_id": event.actor_id,
        "data": event.data,
        "created_at": _iso(event.created_at),
    }


def _detail(draft):
    base_study = db.session.get(BaseStudy, draft.base_study_id)
    person = db.session.get(OutreachPerson, draft.person_id) if draft.person_id else None
    counts = outreach_people.message_counts([draft.person_id] if draft.person_id else [])
    events = db.session.scalars(
        sa.select(OutreachEvent)
        .where(OutreachEvent.draft_id == draft.id)
        .order_by(OutreachEvent.created_at, OutreachEvent.id)
    ).all()
    links = live_links(draft.id)
    return {
        **_draft_summary(draft, base_study, person, counts.get(draft.person_id, 0)),
        "pmid": base_study.pmid,
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
        return [
            {
                "base_study_id": base_study.id,
                "name": base_study.name,
                "year": base_study.year,
                "doi": base_study.doi,
                "pmid": base_study.pmid,
                "journal": base_study.publication,
                "result_analyses": count,
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
        person_ids = sorted({d.person_id for d, _ in rows if d.person_id})
        found = outreach_people.people(person_ids)
        counts = outreach_people.message_counts(person_ids)
        return [
            _draft_summary(d, b, found.get(d.person_id), counts.get(d.person_id, 0))
            for d, b in rows
        ]

    return JSONResponse({"results": await run_in_threadpool(_run)})


async def _build(request, actor):
    base_study_id = (await _body(request)).get("base_study_id")
    if not isinstance(base_study_id, str):
        raise HTTPException(422, "base_study_id is required")

    def _run():
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
        **_person(person, len(messages)),
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
            Route("/people/{person_id}", person),
            Route("/people/{person_id}/suppression", suppression, methods=["POST"]),
        ],
        exception_handlers={HTTPException: _http_error},
    )
