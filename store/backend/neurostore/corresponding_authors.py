"""The emails papers print for their corresponding authors, kept per base study.

An address is added once per base study and never removed by an upload: its
`contacted`, `responded` and `shared` marks are ours, not the paper's. A merge
moves a duplicate's addresses to the base study it is merged into, keeping any
mark either one had.
"""

from __future__ import annotations

from typing import Iterable

import sqlalchemy as sa

from neurostore import encryption
from neurostore.database import db
from neurostore.models import CorrespondingAuthorEmail

MARKS = ("contacted", "responded", "shared")


def emails_in(parsed_paper) -> list:
    """The emails a parsed paper's bibliography gives its corresponding authors."""
    bibliography = (parsed_paper or {}).get("bibliography") or {}
    return [
        author["email"]
        for author in bibliography.get("corresponding_authors") or []
        if author.get("email")
    ]


def add_emails(base_study_id: str, emails: Iterable[str]) -> int:
    """Store each address the base study does not hold yet; how many were new."""
    held = set(
        db.session.scalars(
            sa.select(CorrespondingAuthorEmail.email_index).where(
                CorrespondingAuthorEmail.base_study_id == base_study_id
            )
        )
    )
    added = 0
    for email in emails:
        index = encryption.email_index(email)
        if index in held:
            continue
        held.add(index)
        db.session.add(CorrespondingAuthorEmail(base_study_id=base_study_id, email=email))
        added += 1
    return added


def move_emails(from_id: str, to_id: str) -> None:
    """Give `to_id` every address `from_id` holds; one both hold keeps either's marks."""
    rows = db.session.scalars(
        sa.select(CorrespondingAuthorEmail).where(
            CorrespondingAuthorEmail.base_study_id.in_([from_id, to_id])
        )
    ).all()
    kept = {row.email_index: row for row in rows if row.base_study_id == to_id}
    for row in (row for row in rows if row.base_study_id == from_id):
        same = kept.get(row.email_index)
        if same is None:
            row.base_study_id = to_id
            kept[row.email_index] = row
            continue
        for mark in MARKS:
            setattr(same, mark, getattr(same, mark) or getattr(row, mark))
        db.session.delete(row)
    db.session.flush()
