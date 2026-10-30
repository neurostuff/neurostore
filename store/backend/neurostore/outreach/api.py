"""Outreach's admin API: a Starlette app mounted at ``/api/outreach``, outside the spec.

Every route needs an outreach admin (``neurostore.outreach.auth``). Database work runs in
the threadpool, in the request's session.
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
from neurostore.models import BaseStudy, OutreachDraft, OutreachEvent
from neurostore.models.outreach import DRAFT_STATUSES
from neurostore.outreach.auth import outreach_admin
from neurostore.outreach.candidates import candidates_query
from neurostore.outreach.drafts import DraftError, build_draft

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


def _draft_summary(draft, base_study):
    return {
        "id": draft.id,
        "base_study_id": draft.base_study_id,
        "name": base_study.name,
        "year": base_study.year,
        "doi": base_study.doi,
        "status": draft.status,
        "last_activity_at": _iso(draft.last_activity_at),
        "analyses": len(draft.analyses),
        "person_id": draft.person_id,
    }


def _event(event):
    return {
        "kind": event.kind,
        "actor": event.actor,
        "actor_id": event.actor_id,
        "data": event.data,
        "created_at": _iso(event.created_at),
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
    status = request.query_params.get("status")
    if status is not None and status not in DRAFT_STATUSES:
        raise HTTPException(422, f"status must be one of {', '.join(DRAFT_STATUSES)}")
    idle_days = _int(request, "idle_days", minimum=0)
    limit = _int(request, "limit", default=DEFAULT_LIMIT, minimum=1, maximum=MAX_LIMIT)

    def _run():
        query = sa.select(OutreachDraft, BaseStudy).join(
            BaseStudy, BaseStudy.id == OutreachDraft.base_study_id
        )
        if status is not None:
            query = query.where(OutreachDraft.status == status)
        if idle_days is not None:
            idle_since = sa.func.now() - sa.func.make_interval(0, 0, 0, idle_days)
            query = query.where(OutreachDraft.last_activity_at <= idle_since)
        # Oldest activity first: the in-progress drafts most likely to be forgotten.
        query = query.order_by(OutreachDraft.last_activity_at, OutreachDraft.id).limit(limit)
        return [_draft_summary(d, b) for d, b in db.session.execute(query).all()]

    return JSONResponse({"results": await run_in_threadpool(_run)})


async def _build(request, actor):
    try:
        body = await request.json()
    except ValueError:
        raise HTTPException(422, "the body must be JSON")
    base_study_id = body.get("base_study_id") if isinstance(body, dict) else None
    if not isinstance(base_study_id, str):
        raise HTTPException(422, "base_study_id is required")

    def _run():
        try:
            draft = build_draft(base_study_id, actor="admin", actor_id=actor)
        except DraftError as exc:
            db.session.rollback()
            raise HTTPException(409, str(exc))
        db.session.commit()
        return _detail(draft)

    return JSONResponse(await run_in_threadpool(_run), status_code=201)


def _detail(draft):
    base_study = db.session.get(BaseStudy, draft.base_study_id)
    events = db.session.scalars(
        sa.select(OutreachEvent)
        .where(OutreachEvent.draft_id == draft.id)
        .order_by(OutreachEvent.created_at, OutreachEvent.id)
    ).all()
    return {
        **_draft_summary(draft, base_study),
        "source_study_id": draft.source_study_id,
        "source_sha256": draft.source_sha256,
        "analyses": draft.analyses,
        "collection": draft.collection,
        "events": [_event(event) for event in events],
    }


async def draft(request: Request):
    await outreach_admin(request)
    draft_id = request.path_params["draft_id"]

    def _run():
        found = db.session.get(OutreachDraft, draft_id)
        if found is None:
            raise HTTPException(404, f"no outreach draft {draft_id}")
        return _detail(found)

    return JSONResponse(await run_in_threadpool(_run))


async def _http_error(request, exc):
    return JSONResponse({"detail": exc.detail, "status": exc.status_code}, exc.status_code)


def outreach_app():
    return Starlette(
        routes=[
            Route("/me", me),
            Route("/candidates/", candidates),
            Route("/drafts/", drafts, methods=["GET", "POST"]),
            Route("/drafts/{draft_id}", draft),
        ],
        exception_handlers={HTTPException: _http_error},
    )
