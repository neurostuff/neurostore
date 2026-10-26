"""The emails papers print for their corresponding authors, kept per base study.

An address is added once per base study and never removed by an upload: its
`contacted`, `responded` and `shared` marks are ours, not the paper's. Each is tied to
the author on the paper it belongs to (`base_study_author_id`), when the paper says. A merge
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


def add_emails(base_study_id: str, emails: Iterable[tuple], authors=None) -> int:
    """Store each address the base study does not hold yet; how many were new.

    `emails` are (address, position of its author or None), as
    `neurostore.authors.correspondence` gives them, and `authors` the base study's author
    rows by position. Every address, new or held, is tied to its author's row.
    """
    held = {
        row.email_index: row
        for row in db.session.scalars(
            sa.select(CorrespondingAuthorEmail).where(
                CorrespondingAuthorEmail.base_study_id == base_study_id
            )
        )
    }
    added = 0
    for email, position in emails:
        index = encryption.email_index(email)
        author = (authors or {}).get(position)
        row = held.get(index)
        if row is None:
            row = CorrespondingAuthorEmail(base_study_id=base_study_id, email=email)
            db.session.add(row)
            held[index] = row
            added += 1
        if author is not None:
            row.base_study_author_id = author.id
    return added


def move_emails(from_id: str, to_id: str) -> list:
    """Give `to_id` every address `from_id` holds; one both hold keeps either's marks.

    Returns what was done, by row id and never by address: (row id, None, {}) for a row
    moved, and (row id, id of the row kept, {mark: True}) for a row deleted as the same
    address as one `to_id` holds, with the marks it set on that row.
    """
    rows = db.session.scalars(
        sa.select(CorrespondingAuthorEmail).where(
            CorrespondingAuthorEmail.base_study_id.in_([from_id, to_id])
        )
    ).all()
    kept = {row.email_index: row for row in rows if row.base_study_id == to_id}
    done = []
    for row in sorted((row for row in rows if row.base_study_id == from_id), key=lambda r: r.id):
        same = kept.get(row.email_index)
        if same is None:
            row.base_study_id = to_id
            kept[row.email_index] = row
            done.append((row.id, None, {}))
            continue
        marked = {mark: True for mark in MARKS if getattr(row, mark) and not getattr(same, mark)}
        for mark in marked:
            setattr(same, mark, True)
        db.session.delete(row)
        done.append((row.id, same.id, marked))
    db.session.flush()
    return done
