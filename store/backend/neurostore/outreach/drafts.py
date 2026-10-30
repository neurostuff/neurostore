"""Drafts: our copy of a paper's analyses, and the events that say where its outreach is.

A draft is built once from the paper's current coordinate parse (the study_schema
ingester's Study version) and never refreshed from it: one fixed record per paper for the
pilot. Its status and last activity follow from its events, through ``record_event``.
"""

from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from sqlalchemy.orm import selectinload

from neurostore.database import db
from neurostore.models import (
    Analysis,
    BaseStudy,
    BaseStudyAuthor,
    BaseStudyLink,
    CorrespondingAuthorEmail,
    LinkDomain,
    OutreachDraft,
    OutreachEvent,
    OutreachLink,
    OutreachPerson,
    Study,
)
from neurostore.models.data import STUDY_SOURCE, result_analysis_clause
from neurostore.models.outreach import OUTCOME_STATUSES, PROGRESS_STATUSES

LINK_DAYS = 90
NEUROVAULT = "NeuroVault"

#: The status an event puts a draft in; events not named here leave it as it is.
EVENT_STATUS = {
    "built": "draft",
    "checked": "checked",
    "sent": "contacted",
    "opened": "opened",
    "file_uploaded": "uploading",
    "submitted": "submitted",
    "approved": "approved",
    "published": "published",
    "publish_retried": "approved",
    "declined": "declined",
    "rejected": "rejected",
    "publish_failed": "failed",
    "files_deleted": "files_deleted",
}
_RANK = {status: rank for rank, status in enumerate(PROGRESS_STATUSES)}


class DraftError(ValueError):
    """A draft cannot be built or changed as asked."""


def outreach_draft_count(session, base_study_id):
    """How many outreach drafts the base study has."""
    return session.scalar(
        sa.select(sa.func.count(OutreachDraft.id)).where(
            OutreachDraft.base_study_id == base_study_id
        )
    )


def next_status(current, kind):
    """The status a draft in ``current`` is in after an event of ``kind``.

    Outcomes (declined, rejected, failed, files deleted) apply whatever the draft was.
    Progress only moves forward, so a link opened again after an upload leaves the draft
    uploading. From an outcome, only an author's upload or later progress moves it on: a
    declined author who uploads after all is uploading, but opening the link is not enough.
    """
    target = EVENT_STATUS.get(kind)
    if target is None:
        return current
    if target in OUTCOME_STATUSES:
        return target
    if current in OUTCOME_STATUSES:
        return target if _RANK[target] >= _RANK["uploading"] else current
    return target if _RANK[target] > _RANK[current] else current


def record_event(draft, kind, actor, actor_id=None, data=None):
    """Add an event to ``draft`` and move its status and last activity with it."""
    event = OutreachEvent(draft_id=draft.id, kind=kind, actor=actor, actor_id=actor_id, data=data)
    db.session.add(event)
    draft.status = next_status(draft.status, kind)
    draft.last_activity_at = datetime.now(timezone.utc)
    return event


def _canonical_sha256(document):
    text = json.dumps(document, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(text.encode()).hexdigest()


def _analysis_copy(analysis):
    points = sorted(analysis.points, key=lambda p: (p.order is None, p.order, p.id))
    return {
        "key": analysis.id,
        "name": analysis.name,
        "description": analysis.description,
        "points": [
            {"x": p.x, "y": p.y, "z": p.z, "space": p.space}
            for p in points
            if None not in (p.x, p.y, p.z)
        ],
    }


def _dataset_url(base_study_id):
    """The first data repository link the paper gives, other than NeuroVault."""
    return db.session.scalar(
        sa.select(BaseStudyLink.url)
        .join(LinkDomain, LinkDomain.matches(BaseStudyLink, LinkDomain))
        .where(
            BaseStudyLink.base_study_id == base_study_id,
            LinkDomain.kind == "data_repository",
            LinkDomain.repository != NEUROVAULT,
        )
        .order_by(BaseStudyLink.created_at, BaseStudyLink.id)
        .limit(1)
    )


def _collection(base_study):
    """The NeuroVault collection fields we propose for the paper."""
    fields = {
        "name": base_study.name,
        "DOI": base_study.doi,
        "authors": base_study.authors,
        "journal_name": base_study.publication,
        "paper_url": f"https://doi.org/{base_study.doi}" if base_study.doi else None,
        "full_dataset_url": _dataset_url(base_study.id),
    }
    return {key: value for key, value in fields.items() if value}


def _contact(base_study_id):
    """The address to write to: the corresponding author listed first, else the first held."""
    rows = db.session.execute(
        sa.select(CorrespondingAuthorEmail, BaseStudyAuthor)
        .outerjoin(
            BaseStudyAuthor,
            BaseStudyAuthor.id == CorrespondingAuthorEmail.base_study_author_id,
        )
        .where(CorrespondingAuthorEmail.base_study_id == base_study_id)
    ).all()
    if not rows:
        return None, None

    def order(row):
        email, author = row
        position = author.position if author is not None else None
        return (position is None, position, email.created_at, email.id)

    return min(rows, key=order)


def person_for(email_row, author=None):
    """The person an address belongs to, added the first time it is seen."""
    person = db.session.scalar(
        sa.select(OutreachPerson).where(OutreachPerson.email_index == email_row.email_index)
    )
    if person is None:
        person = OutreachPerson(email_index=email_row.email_index)
        db.session.add(person)
    if person.author_id is None and author is not None:
        person.author_id = author.author_id
    return person


def build_draft(base_study_id, actor="admin", actor_id=None):
    """Copy the paper's result analyses from its coordinate parse into a new draft.

    Refused if the paper already has a draft, has no coordinate parse, or the parse has no
    result analyses. A paper whose corresponding authors give no address gets a draft with
    no person, which cannot be sent.
    """
    base_study = db.session.get(BaseStudy, base_study_id)
    if base_study is None or not base_study.is_active:
        raise DraftError(f"no active base study {base_study_id}")
    if outreach_draft_count(db.session, base_study_id):
        raise DraftError(f"base study {base_study_id} already has an outreach draft")
    study = db.session.scalar(
        sa.select(Study).where(Study.base_study_id == base_study_id, Study.source == STUDY_SOURCE)
    )
    if study is None:
        raise DraftError(f"base study {base_study_id} has no coordinate parse")
    analyses = db.session.scalars(
        sa.select(Analysis)
        .where(Analysis.study_id == study.id, result_analysis_clause())
        .options(selectinload(Analysis.points))
        .order_by(Analysis.order.is_(None), Analysis.order, Analysis.name, Analysis.id)
    ).all()
    if not analyses:
        raise DraftError(f"base study {base_study_id} has no result analyses")

    copies = [_analysis_copy(analysis) for analysis in analyses]
    email_row, author = _contact(base_study_id)
    draft = OutreachDraft(
        base_study_id=base_study_id,
        person=person_for(email_row, author) if email_row is not None else None,
        source_study_id=study.id,
        source_sha256=_canonical_sha256({"study_id": study.id, "analyses": copies}),
        analyses=copies,
        collection=_collection(base_study),
    )
    db.session.add(draft)
    db.session.flush()
    record_event(draft, "built", actor, actor_id, {"analyses": len(copies)})
    return draft


def token_sha256(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_link(draft, actor_id=None, days=LINK_DAYS):
    """A new link to ``draft``: the row, and the token, which is not kept anywhere."""
    token = secrets.token_urlsafe(32)
    link = OutreachLink(
        draft_id=draft.id,
        token_sha256=token_sha256(token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=days),
        created_by=actor_id,
    )
    db.session.add(link)
    db.session.flush()
    record_event(draft, "link_created", "admin", actor_id, {"link_id": link.id})
    return link, token
