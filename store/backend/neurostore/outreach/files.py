"""What authors uploaded and reported, for the admin panel: per-draft counts, the issues
inbox, and deleting a stale draft's files by hand."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import sqlalchemy as sa

from neurostore.database import db
from neurostore.models import OutreachIssue, OutreachUpload
from neurostore.outreach.drafts import FROZEN, DraftError, record_event


def uploads_of(draft_id, deleted=True):
    """The draft's uploads, oldest first; those deleted too unless ``deleted`` is False."""
    query = sa.select(OutreachUpload).where(OutreachUpload.draft_id == draft_id)
    if not deleted:
        query = query.where(OutreachUpload.deleted_at.is_(None))
    return db.session.scalars(query.order_by(OutreachUpload.created_at, OutreachUpload.id)).all()


def issues_of(draft_id):
    return db.session.scalars(
        sa.select(OutreachIssue)
        .where(OutreachIssue.draft_id == draft_id)
        .order_by(OutreachIssue.created_at, OutreachIssue.id)
    ).all()


def file_counts(draft_ids):
    """{draft id: files still kept}."""
    if not draft_ids:
        return {}
    return dict(db.session.execute(
        sa.select(OutreachUpload.draft_id, sa.func.count(OutreachUpload.id))
        .where(OutreachUpload.draft_id.in_(draft_ids), OutreachUpload.deleted_at.is_(None))
        .group_by(OutreachUpload.draft_id)
    ).all())


def open_issue_counts(draft_ids):
    """{draft id: issues not yet resolved}."""
    if not draft_ids:
        return {}
    return dict(db.session.execute(
        sa.select(OutreachIssue.draft_id, sa.func.count(OutreachIssue.id))
        .where(OutreachIssue.draft_id.in_(draft_ids), OutreachIssue.state == "open")
        .group_by(OutreachIssue.draft_id)
    ).all())


def resolve_issue(draft, issue_id, actor_id, resolution=None):
    issue = db.session.get(OutreachIssue, issue_id)
    if issue is None or issue.draft_id != draft.id:
        raise DraftError(f"no issue {issue_id} on this draft")
    if issue.state == "resolved":
        raise DraftError("this issue is already resolved")
    issue.state, issue.resolution = "resolved", (resolution or "").strip()[:4000] or None
    issue.resolved_by, issue.resolved_at = actor_id, datetime.now(timezone.utc)
    record_event(draft, "issue_resolved", "admin", actor_id, {"issue_id": issue.id})
    return issue


def delete_files(draft, actor_id):
    """Delete every file the draft still keeps; the rows, the draft and its history stay.
    Refused once a submission is approved, since publishing needs the files."""
    if draft.status in FROZEN:
        raise DraftError(f"a draft that is {draft.status} keeps its files")
    kept = uploads_of(draft.id, deleted=False)
    if not kept:
        raise DraftError("this draft has no files to delete")
    now = datetime.now(timezone.utc)
    for upload in kept:
        if upload.path:
            Path(upload.path).unlink(missing_ok=True)
        upload.path, upload.deleted_at, upload.deleted_by = None, now, actor_id
    record_event(draft, "files_deleted", "admin", actor_id, {"files": len(kept)})
    return len(kept)
