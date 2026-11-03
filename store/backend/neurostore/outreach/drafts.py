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
    OutreachUpload,
    Study,
)
from neurostore.models.data import STUDY_SOURCE, result_analysis_clause
from neurostore.models.outreach import MESSAGE_KINDS, OUTCOME_STATUSES, PROGRESS_STATUSES

LINK_DAYS = 90
PREVIEW_DAYS = 1
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
    "excluded": "excluded",
}
_RANK = {status: rank for rank, status in enumerate(PROGRESS_STATUSES)}
#: Outcomes an admin can take back with ``reopen_draft``.
REOPENABLE = ("declined", "excluded")
#: What an author's reply said, as an admin logs it.
REPLY_KINDS = ("will_upload", "no_maps", "wrong_person", "already_shared", "declined", "other")
#: Why an admin takes a paper out of outreach.
EXCLUSION_REASONS = (
    "behavioral_only",
    "roi_only",
    "connectivity_only",
    "no_group_maps",
    "not_fmri",
    "other",
)


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


def _undone(event):
    return bool((event.data or {}).get("undone_at"))


def replay_status(kinds):
    """The status a draft ends in after events of ``kinds``, in order, from ``draft``."""
    status = "draft"
    for kind in kinds:
        status = next_status(status, kind)
    return status


def events_of(draft_id):
    return db.session.scalars(
        sa.select(OutreachEvent)
        .where(OutreachEvent.draft_id == draft_id)
        .order_by(OutreachEvent.created_at, OutreachEvent.id)
    ).all()


def undo_event(draft, event, kind, actor_id):
    """Mark ``event`` undone, record that as a ``kind`` event, and replay the draft's status
    from the events still standing. Undone events stay in the history."""
    event.data = {
        **(event.data or {}),
        "undone_at": datetime.now(timezone.utc).isoformat(),
        "undone_by": actor_id,
    }
    record_event(draft, kind, "admin", actor_id, {"event_id": event.id})
    db.session.flush()
    draft.status = replay_status(e.kind for e in events_of(draft.id) if not _undone(e))
    return draft


def _latest(draft, kinds):
    standing = [e for e in events_of(draft.id) if e.kind in kinds and not _undone(e)]
    return standing[-1] if standing else None


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
    """The draft's links that are neither revoked nor expired; previews are not links."""
    return db.session.scalars(
        sa.select(OutreachLink).where(
            OutreachLink.draft_id == draft_id,
            OutreachLink.revoked_at.is_(None),
            OutreachLink.expires_at > sa.func.now(),
            OutreachLink.preview.is_(False),
        )
    ).all()


def create_link(draft, actor_id=None, days=LINK_DAYS, preview=False):
    """A new link to ``draft``: the row, and the token, which is not kept anywhere.

    Earlier links keep working, so the link in an email already sent still opens the
    draft after a reminder carries a new one. ``revoke_links`` stops them all. A preview
    link lasts a day, records nothing, and is no link to send.
    """
    token = secrets.token_urlsafe(32)
    link = OutreachLink(
        draft_id=draft.id,
        token_sha256=token_sha256(token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=PREVIEW_DAYS if preview else days),
        created_by=actor_id,
        preview=preview,
    )
    db.session.add(link)
    db.session.flush()
    if not preview:
        record_event(draft, "link_created", "admin", actor_id, {"link_id": link.id})
    return link, token


def revoke_links(draft, actor_id):
    """Stop every live link to ``draft`` working; how many there were."""
    now = datetime.now(timezone.utc)
    revoked = live_links(draft.id)
    for link in revoked:
        link.revoked_at = now
    record_event(
        draft, "links_revoked", "admin", actor_id, {"link_ids": [link.id for link in revoked]}
    )
    return len(revoked)


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
        cleaned = clean_analyses(analyses)
        _keep_assigned(draft, {analysis["key"] for analysis in cleaned})
        draft.analyses = cleaned
        changed.append("analyses")
    if collection is not None:
        draft.collection = clean_collection(collection)
        changed.append("collection")
    if changed:
        record_event(draft, "edited", "admin", actor_id, {"fields": changed})
    return draft


def _keep_assigned(draft, keys):
    """Refuse an edit that drops an analysis one of the author's maps is on: the map would
    be left on nothing. Renaming it, or merging others into it, keeps its key."""
    names = {analysis["key"]: analysis["name"] for analysis in draft.analyses or []}
    uploads = db.session.scalars(
        sa.select(OutreachUpload).where(
            OutreachUpload.draft_id == draft.id, OutreachUpload.deleted_at.is_(None)
        )
    ).all()
    dropped = sorted({
        key
        for upload in uploads
        for key in (upload.check_details or {}).get("analysis_keys") or []
        if key in names and key not in keys
    })
    if dropped:
        listed = ", ".join(f"“{names[key]}”" for key in dropped)
        raise DraftError(f"the author's maps are on {listed}: it cannot be deleted or merged away")


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

    Refused for an unchecked, excluded or declined draft, one with no person or no live
    link, a suppressed person, and an invite to anyone already written to, under any of
    their addresses: the pilot sends each person one email.
    """
    if kind not in MESSAGE_KINDS:
        raise DraftError(f"kind must be one of {', '.join(MESSAGE_KINDS)}")
    if draft.status == "draft":
        raise DraftError("approve the draft before sending it")
    if draft.status in REOPENABLE:
        raise DraftError(f"the draft is {draft.status}")
    if draft.person_id is None:
        raise DraftError("the draft has no one to write to")
    person = db.session.get(OutreachPerson, draft.person_id)
    if person.suppressed:
        raise DraftError("this person opted out or their address bounced")
    if not live_links(draft.id):
        raise DraftError("the draft has no live link to send")
    if kind == "invite" and messages_to(person):
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


def addresses_of(person):
    """The ids of every person who is ``person``'s author under another address, theirs
    included: one person can print different addresses on different papers."""
    if person.author_id is None:
        return [person.id]
    return db.session.scalars(
        sa.select(OutreachPerson.id).where(
            sa.or_(OutreachPerson.id == person.id, OutreachPerson.author_id == person.author_id)
        )
    ).all()


def messages_to(person):
    """Every message sent to ``person``, under any of their addresses."""
    return db.session.scalars(
        sa.select(OutreachMessage)
        .where(OutreachMessage.person_id.in_(addresses_of(person)))
        .order_by(OutreachMessage.sent_at, OutreachMessage.id)
    ).all()


def undo_sent(draft, actor_id):
    """Take back the draft's last "mark as sent": its message is deleted, so the person
    counts as not emailed again, and the draft's status is replayed without it. Refused
    once the author has used the link since: then the email plainly went out."""
    sent = _latest(draft, ("sent",))
    if sent is None:
        raise DraftError("nothing was marked sent for this draft")
    events = events_of(draft.id)
    after = [e.id for e in events].index(sent.id) + 1
    if any(e.actor == "author" and not _undone(e) for e in events[after:]):
        raise DraftError("the author has used the link since it was sent, so the email went out")
    message = db.session.get(OutreachMessage, (sent.data or {}).get("message_id"))
    if message is not None:
        db.session.delete(message)
    return undo_event(draft, sent, "send_undone", actor_id)


def exclude_draft(draft, actor_id, reason, note=None):
    """Take the paper out of outreach; it stays a draft, so it is no candidate again."""
    if reason not in EXCLUSION_REASONS:
        raise DraftError(f"reason must be one of {', '.join(EXCLUSION_REASONS)}")
    if draft.status in FROZEN or draft.status == "excluded":
        raise DraftError(f"a draft that is {draft.status} cannot be excluded")
    record_event(draft, "excluded", "admin", actor_id, {"reason": reason, "note": note})
    return draft


def reopen_draft(draft, actor_id):
    """Take back the draft's last exclusion or decline; its status is replayed without it."""
    if draft.status not in REOPENABLE:
        raise DraftError(f"a draft that is {draft.status} has nothing to reopen")
    outcome = _latest(draft, REOPENABLE)
    return undo_event(draft, outcome, "reopened", actor_id)


def log_reply(draft, actor_id, kind, note=None, link=None):
    """Record what the author replied. A decline also makes the draft declined."""
    if kind not in REPLY_KINDS:
        raise DraftError(f"kind must be one of {', '.join(REPLY_KINDS)}")
    data = {"reply": kind, "note": note, "link": link}
    record_event(draft, "declined" if kind == "declined" else "reply", "admin", actor_id, data)
    return draft
