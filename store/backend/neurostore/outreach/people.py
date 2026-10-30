"""People: one email address each, their history with us, and whether we may write."""

from __future__ import annotations

from datetime import datetime, timezone

import sqlalchemy as sa

from neurostore.database import db
from neurostore.models import BaseStudy, OutreachDraft, OutreachMessage, OutreachPerson
from neurostore.outreach.drafts import DraftError

SUPPRESSIONS = {"opt_out": "opted_out_at", "bounced": "bounced_at"}


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


def people(person_ids):
    """{person id: person}."""
    if not person_ids:
        return {}
    rows = db.session.scalars(
        sa.select(OutreachPerson).where(OutreachPerson.id.in_(person_ids))
    ).all()
    return {person.id: person for person in rows}
