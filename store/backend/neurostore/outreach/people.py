"""People: one email address each, their history with us, and whether we may write."""

from __future__ import annotations

from datetime import datetime, timezone

import sqlalchemy as sa

from neurostore.database import db
from neurostore.models import (
    BaseStudy,
    OutreachDraft,
    OutreachEvent,
    OutreachMessage,
    OutreachPerson,
)
from neurostore.outreach.drafts import DraftError

SUPPRESSIONS = {"opt_out": "opted_out_at", "bounced": "bounced_at"}
SUPPRESSION_LABELS = {"opt_out": "opt-out", "bounced": "bounce"}


def history(person):
    """Every draft addressed to the person and every message sent to them."""
    drafts = db.session.execute(
        sa.select(OutreachDraft, BaseStudy)
        .join(BaseStudy, BaseStudy.id == OutreachDraft.base_study_id)
        .where(OutreachDraft.person_id == person.id)
        .order_by(OutreachDraft.created_at, OutreachDraft.id)
    ).all()
    messages = db.session.scalars(
        sa.select(OutreachMessage)
        .where(OutreachMessage.person_id == person.id)
        .order_by(OutreachMessage.sent_at, OutreachMessage.id)
    ).all()
    return drafts, messages


def suppress(person, what, note=None):
    """Mark the person opted out or bounced; nothing is sent to them after."""
    column = SUPPRESSIONS.get(what)
    if column is None:
        raise DraftError(f"suppression must be one of {', '.join(SUPPRESSIONS)}")
    if getattr(person, column) is None:
        setattr(person, column, datetime.now(timezone.utc))
    if note:
        person.notes = f"{person.notes}\n{note}" if person.notes else note
    return person


def asked_to_stop(person):
    """Whether the author asked to stop on their own page, which no admin takes back."""
    events = db.session.scalars(
        sa.select(OutreachEvent)
        .join(OutreachDraft, OutreachDraft.id == OutreachEvent.draft_id)
        .where(OutreachDraft.person_id == person.id, OutreachEvent.kind == "declined")
    ).all()
    return any((event.data or {}).get("unsubscribed") for event in events)


def unsuppress(person, what, actor_id=None):
    """Take back an opt-out or bounce an admin recorded by mistake, noting who did."""
    column = SUPPRESSIONS.get(what)
    if column is None:
        raise DraftError(f"suppression must be one of {', '.join(SUPPRESSIONS)}")
    if getattr(person, column) is None:
        raise DraftError(f"there is no {SUPPRESSION_LABELS[what]} to undo")
    if what == "opt_out" and asked_to_stop(person):
        raise DraftError("the author asked to stop on their own page: that opt-out stands")
    setattr(person, column, None)
    day = datetime.now(timezone.utc).date().isoformat()
    line = f"{SUPPRESSION_LABELS[what]} undone {day} by {actor_id or 'an admin'}"
    person.notes = f"{person.notes}\n{line}" if person.notes else line
    return person


def message_counts(person_ids):
    """{person id: messages sent to them}."""
    if not person_ids:
        return {}
    rows = db.session.execute(
        sa.select(OutreachMessage.person_id, sa.func.count(OutreachMessage.id))
        .where(OutreachMessage.person_id.in_(person_ids))
        .group_by(OutreachMessage.person_id)
    ).all()
    return dict(rows)


def author_message_counts(found):
    """{person id: messages sent to their author under any address} for the people in
    ``found`` ({person id: person}). A person with no author counts their own address."""
    if not found:
        return {}
    author_ids = {person.author_id for person in found.values() if person.author_id}
    rows = db.session.execute(
        sa.select(OutreachPerson.id, OutreachPerson.author_id, sa.func.count(OutreachMessage.id))
        .outerjoin(OutreachMessage, OutreachMessage.person_id == OutreachPerson.id)
        .where(
            sa.or_(OutreachPerson.id.in_(list(found)), OutreachPerson.author_id.in_(author_ids))
        )
        .group_by(OutreachPerson.id, OutreachPerson.author_id)
    ).all()
    own = {person_id: count for person_id, _, count in rows}
    by_author = {}
    for _, author_id, count in rows:
        if author_id:
            by_author[author_id] = by_author.get(author_id, 0) + count
    return {
        person_id: by_author[person.author_id] if person.author_id else own.get(person_id, 0)
        for person_id, person in found.items()
    }


def people(person_ids):
    """{person id: person}."""
    if not person_ids:
        return {}
    rows = db.session.scalars(
        sa.select(OutreachPerson).where(OutreachPerson.id.in_(person_ids))
    ).all()
    return {person.id: person for person in rows}
