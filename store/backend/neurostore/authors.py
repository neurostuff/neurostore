"""A paper's authors and the universities they give, from a parsed paper's bibliography.

An upload whose parsed paper lists authors replaces the base study's list: the paper
says who wrote it. Each author is one person across papers by their ORCID iD, else by
their OpenAlex author id; an author with neither is a person of this paper alone, kept
across uploads while the paper lists them at the same place under the same name.
Universities are ROR organizations, one row per ROR id. An affiliation is the paper's
text, tied to a university only when the parsed paper names its ROR id.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional

import sqlalchemy as sa
from sqlalchemy.orm import selectinload

from neurostore.database import db
from neurostore.models import (
    Author,
    BaseStudyAuthor,
    BaseStudyAuthorAffiliation,
    University,
)


def store_authors(base_study_id: str, parsed_paper) -> Optional[Dict[int, BaseStudyAuthor]]:
    """Replace the base study's authors with the parsed paper's; the new rows by position.

    None, and nothing changed, when the parsed paper lists no authors.
    """
    listed = ((parsed_paper or {}).get("bibliography") or {}).get("authors")
    if not listed:
        return None
    held = db.session.scalars(
        sa.select(BaseStudyAuthor)
        .where(BaseStudyAuthor.base_study_id == base_study_id)
        .options(selectinload(BaseStudyAuthor.author))
    ).all()
    alone = {(row.position, row.name): row.author for row in held
             if row.author.orcid is None and row.author.openalex_id is None}
    authors = [_author(position, entry, alone) for position, entry in enumerate(listed)]
    for row in held:
        db.session.delete(row)
    db.session.flush()

    universities: Dict[str, University] = {}
    stored = {}
    for position, (entry, author) in enumerate(zip(listed, authors)):
        row = BaseStudyAuthor(
            base_study_id=base_study_id,
            author=author,
            position=position,
            name=entry["name"],
            corresponding=entry.get("corresponding"),
        )
        row.affiliations = [
            BaseStudyAuthorAffiliation(
                position=place,
                text=_without_addresses(affiliation["text"]),
                university=university,
            )
            for place, affiliation in enumerate(entry.get("affiliations") or [])
            for university in (
                [_university(i, universities) for i in affiliation.get("institutions") or []]
                or [None]
            )
        ]
        db.session.add(row)
        stored[position] = row
    db.session.flush()
    _drop_unlisted({row.author_id for row in held} - {a.id for a in authors})
    return stored


_EMAIL = re.compile(r"[\w.+'-]+@[\w-]+(?:\.[\w-]+)+")


def _without_addresses(text: str) -> str:
    """An affiliation's text with any email address taken out: addresses are kept only
    encrypted (`corresponding_author_emails`), never as plain text beside them."""
    return re.sub(r"\s+", " ", _EMAIL.sub("", text)).strip() or text


def _author(position: int, entry, alone) -> Author:
    orcid, openalex_id = entry.get("orcid"), entry.get("openalex_id")
    found = None
    if orcid:
        found = db.session.scalar(sa.select(Author).where(Author.orcid == orcid))
    if found is None and openalex_id:
        found = db.session.scalar(sa.select(Author).where(Author.openalex_id == openalex_id))
    if found is None and not (orcid or openalex_id):
        found = alone.get((position, entry["name"]))
    if found is None:
        found = Author(name=entry["name"], orcid=orcid, openalex_id=openalex_id)
        db.session.add(found)
        db.session.flush()
        return found
    # An id the person lacks is theirs unless another row holds it; one held stays.
    if orcid and not found.orcid and not _held(Author.orcid, orcid):
        found.orcid = orcid
    if openalex_id and not found.openalex_id and not _held(Author.openalex_id, openalex_id):
        found.openalex_id = openalex_id
    return found


def _held(column, value) -> bool:
    return db.session.scalar(sa.select(sa.func.count()).where(column == value)) > 0


def _university(institution, seen: Dict[str, University]) -> University:
    ror = institution["ror"]
    if ror not in seen:
        found = db.session.scalar(sa.select(University).where(University.ror == ror))
        if found is None:
            found = University(ror=ror)
            db.session.add(found)
        found.name = found.name or institution.get("name")
        found.country = found.country or institution.get("country")
        seen[ror] = found
    return seen[ror]


def _drop_unlisted(author_ids) -> None:
    """Delete the authors of this paper alone that it no longer lists: with no ORCID iD or
    OpenAlex id they are on no other paper."""
    if not author_ids:
        return
    db.session.execute(
        sa.delete(Author).where(
            Author.id.in_(author_ids),
            Author.orcid.is_(None),
            Author.openalex_id.is_(None),
            ~sa.exists().where(BaseStudyAuthor.author_id == Author.id),
        )
    )


def correspondence(parsed_paper) -> List[tuple]:
    """(email, position of the author it is theirs, or None) for every address the
    parsed paper prints for correspondence."""
    bibliography = (parsed_paper or {}).get("bibliography") or {}
    pairs = [(email, position)
             for position, author in enumerate(bibliography.get("authors") or [])
             for email in author.get("emails") or []]
    pairs += [(email, None) for email in bibliography.get("correspondence_emails") or []]
    return pairs


def move_authors(from_id: str, to_id: str) -> List[tuple]:
    """Carry the author list of `from_id` to `to_id`.

    With no list of its own, `to_id` takes the rows. Otherwise its list is the paper's and
    stays: where `from_id` lists the same person at the same place, `to_id`'s row gains
    the affiliations (so the universities) and corresponding mark it lacks, and each
    correspondence address `to_id` holds is tied to its own author rows.

    Returns (table, row id, field, before, after) for each row changed.
    """
    from neurostore.models import CorrespondingAuthorEmail

    def rows(base_study_id):
        return db.session.scalars(
            sa.select(BaseStudyAuthor)
            .where(BaseStudyAuthor.base_study_id == base_study_id)
            .options(selectinload(BaseStudyAuthor.affiliations))
        ).all()

    kept, old = rows(to_id), rows(from_id)
    done = []
    if not kept:
        for row in old:
            row.base_study_id = to_id
            done.append(("base_study_authors", row.id, "base_study_id", from_id, to_id))
        db.session.flush()
        return done
    by_place = {row.position: row for row in kept}
    for row in old:
        same = by_place.get(row.position)
        same = same if same is not None and same.author_id == row.author_id else None
        target = same.id if same is not None else None
        retied = db.session.scalars(
            sa.update(CorrespondingAuthorEmail)
            .where(CorrespondingAuthorEmail.base_study_id == to_id,
                   CorrespondingAuthorEmail.base_study_author_id == row.id)
            .values(base_study_author_id=target)
            .returning(CorrespondingAuthorEmail.id)
        ).all()
        done += [("corresponding_author_emails", email_id, "base_study_author_id", None, target)
                 for email_id in retied]
        if same is None:
            continue
        if not same.affiliations:
            for affiliation in row.affiliations:
                affiliation.base_study_author_id = same.id
                done.append(("base_study_author_affiliations", affiliation.id,
                             "base_study_author_id", row.id, same.id))
        if same.corresponding is None and row.corresponding is not None:
            same.corresponding = row.corresponding
            done.append(("base_study_authors", same.id, "corresponding", None, row.corresponding))
    db.session.flush()
    return done
