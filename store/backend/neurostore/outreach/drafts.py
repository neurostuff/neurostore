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
    OutreachMessage,
    OutreachPerson,
    Study,
)
from neurostore.models.data import STUDY_SOURCE, result_analysis_clause
from neurostore.models.outreach import MESSAGE_KINDS, OUTCOME_STATUSES, PROGRESS_STATUSES

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


def live_links(draft_id):
    """The draft's links that are neither revoked nor expired."""
    return db.session.scalars(
        sa.select(OutreachLink).where(
            OutreachLink.draft_id == draft_id,
            OutreachLink.revoked_at.is_(None),
            OutreachLink.expires_at > sa.func.now(),
        )
    ).all()


def create_link(draft, actor_id=None, days=LINK_DAYS):
    """A new link to ``draft``: the row, and the token, which is not kept anywhere.

    The draft's earlier links stop working, so only the newest one sent is live.
    """
    now = datetime.now(timezone.utc)
    revoked = []
    for earlier in live_links(draft.id):
        earlier.revoked_at = now
        revoked.append(earlier.id)
    token = secrets.token_urlsafe(32)
    link = OutreachLink(
        draft_id=draft.id,
        token_sha256=token_sha256(token),
        expires_at=now + timedelta(days=days),
        created_by=actor_id,
    )
    db.session.add(link)
    db.session.flush()
    record_event(
        draft, "link_created", "admin", actor_id, {"link_id": link.id, "revoked": revoked}
    )
    return link, token


# admin edits

COLLECTION_FIELDS = (
    "name",
    "DOI",
    "authors",
    "journal_name",
    "paper_url",
    "full_dataset_url",
    "description",
)
#: Statuses whose draft an admin can no longer change: its collection is being made or made.
FROZEN = ("approved", "published")


def _number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _clean_point(point):
    if not isinstance(point, dict) or not all(_number(point.get(axis)) for axis in "xyz"):
        raise DraftError("each point needs numeric x, y and z")
    space = point.get("space")
    if space is not None and not isinstance(space, str):
        raise DraftError("a point's space must be text")
    return {"x": point["x"], "y": point["y"], "z": point["z"], "space": space}


def clean_analyses(analyses):
    """``analyses`` as a draft keeps them, or a DraftError naming what is wrong.

    An analysis with no key is new and gets one; keys must be unique.
    """
    if not isinstance(analyses, list):
        raise DraftError("analyses must be a list")
    cleaned, keys = [], set()
    for analysis in analyses:
        if not isinstance(analysis, dict):
            raise DraftError("each analysis must be an object")
        name = analysis.get("name")
        if not isinstance(name, str) or not name.strip():
            raise DraftError("each analysis needs a name")
        key = analysis.get("key") or f"added-{secrets.token_hex(6)}"
        if not isinstance(key, str) or key in keys:
            raise DraftError(f"analysis key {key!r} is not unique")
        keys.add(key)
        description = analysis.get("description")
        if description is not None and not isinstance(description, str):
            raise DraftError("an analysis's description must be text")
        points = analysis.get("points") or []
        if not isinstance(points, list):
            raise DraftError("an analysis's points must be a list")
        cleaned.append({
            "key": key,
            "name": name.strip(),
            "description": description,
            "points": [_clean_point(point) for point in points],
        })
    return cleaned


def clean_collection(collection):
    if not isinstance(collection, dict):
        raise DraftError("collection must be an object")
    unknown = set(collection) - set(COLLECTION_FIELDS)
    if unknown:
        raise DraftError(f"unknown collection fields: {', '.join(sorted(unknown))}")
    cleaned = {}
    for field, value in collection.items():
        if value is None or value == "":
            continue
        if not isinstance(value, str):
            raise DraftError(f"collection field {field} must be text")
        cleaned[field] = value.strip()
    return cleaned


def edit_draft(draft, actor_id, analyses=None, collection=None):
    """Replace the draft's analyses and/or collection fields; never the paper's records."""
    if draft.status in FROZEN:
        raise DraftError(f"a draft that is {draft.status} cannot be edited")
    changed = []
    if analyses is not None:
        draft.analyses = clean_analyses(analyses)
        changed.append("analyses")
    if collection is not None:
        draft.collection = clean_collection(collection)
        changed.append("collection")
    if changed:
        record_event(draft, "edited", "admin", actor_id, {"fields": changed})
    return draft


def check_draft(draft, actor_id):
    """An admin approves the draft's analyses and fields, so its link can be sent."""
    if not draft.analyses:
        raise DraftError("a draft with no analyses cannot be approved")
    if draft.status != "draft":
        raise DraftError(f"the draft is already {draft.status}")
    record_event(draft, "checked", "admin", actor_id)
    return draft


def mark_sent(draft, actor_id, kind="invite", batch=None, template_version=None):
    """Record that the draft's email went out, by hand for now.

    Refused for an unchecked draft, one with no person or no live link, a suppressed
    person, and an invite to anyone already written to: the pilot sends each person one
    email.
    """
    if kind not in MESSAGE_KINDS:
        raise DraftError(f"kind must be one of {', '.join(MESSAGE_KINDS)}")
    if draft.status == "draft":
        raise DraftError("approve the draft before sending it")
    if draft.person_id is None:
        raise DraftError("the draft has no one to write to")
    person = db.session.get(OutreachPerson, draft.person_id)
    if person.suppressed:
        raise DraftError("this person opted out or their address bounced")
    if not live_links(draft.id):
        raise DraftError("the draft has no live link to send")
    if kind == "invite" and messages_to(person.id):
        raise DraftError("this person has already been emailed")
    message = OutreachMessage(
        draft_id=draft.id,
        person_id=person.id,
        kind=kind,
        mode="manual",
        batch=batch,
        template_version=template_version,
        sent_by=actor_id,
    )
    db.session.add(message)
    db.session.flush()
    record_event(draft, "sent", "admin", actor_id, {"message_id": message.id, "kind": kind})
    return message


def messages_to(person_id):
    return db.session.scalars(
        sa.select(OutreachMessage)
        .where(OutreachMessage.person_id == person_id)
        .order_by(OutreachMessage.sent_at, OutreachMessage.id)
    ).all()
