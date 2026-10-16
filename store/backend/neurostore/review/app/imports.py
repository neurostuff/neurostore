"""Load the papers of a study_schema layout for review: each paper checked, then stored whole."""

import re

import sqlalchemy as sa
from sqlalchemy.exc import DBAPIError

from neurostore.base_studies import find_base_study
from neurostore.models import Fulltext, ReviewSource
from neurostore.models.fulltext import FULLTEXT_SOURCE_PREFERENCE
from neurostore.review.core import defs
from neurostore.review.core.entities import judgeable_keys
from neurostore.review.core.layout import (
    LayoutError,
    check_paper,
    open_layout,
    read_paper,
    read_provenance,
    study_ids,
)
from neurostore.review.errors import ReviewError
from neurostore.study_schema_tools import extracted_value, sha256_of

_POSITIONAL_KEY = re.compile(r"(prose|table)#\d+")


class PaperRefused(ReviewError):
    def __init__(self, problems):
        super().__init__("; ".join(problems), problems)


def import_layout(session, source, *, user_id, run_id=None):
    """Load every paper of ``source``, a layout directory or zip, in study-id order.

    Each paper is one savepoint, so a paper that fails loads nothing and the others still
    load. Flushes, never commits. Raises LayoutError when the source itself is unreadable.
    """
    report = {"loaded": [], "skipped": [], "failed": []}
    with open_layout(source) as root:
        for study_id in study_ids(root):
            try:
                paper = read_paper(root, study_id)
                provenance = read_provenance(root, study_id)
            except LayoutError as error:
                report["failed"].append({"study_id": study_id, "problems": error.problems})
                continue
            try:
                with session.begin_nested():
                    bucket, entry = _import_paper(
                        session, paper, provenance=provenance, user_id=user_id, run_id=run_id
                    )
            except PaperRefused as refused:
                report["failed"].append({"study_id": study_id, "problems": refused.problems})
            except DBAPIError as error:
                first_line = str(error.orig).partition("\n")[0]
                report["failed"].append({"study_id": study_id, "problems": [first_line]})
            else:
                report[bucket].append(entry)
    return report


def _import_paper(session, paper, *, provenance, user_id, run_id):
    problems = check_paper(paper)
    if problems:
        raise PaperRefused(problems)
    problems = _positional_problems(paper.record)
    if problems:
        raise PaperRefused(problems)
    identifiers = paper.parsed_paper["header"]["identifiers"]
    base_study = find_base_study(session, identifiers)
    if base_study is None:
        named = ", ".join(f"{field}={value}" for field, value in identifiers.items() if value)
        raise PaperRefused([f"no base study for {named}"])
    fulltext = _fulltext(session, base_study, paper)
    digest = _digest(paper.record, provenance)
    existing = session.scalar(
        sa.select(ReviewSource).where(
            ReviewSource.fulltext_id == fulltext.id, ReviewSource.record_sha256 == digest
        )
    )
    if existing is not None:
        return "skipped", {
            "study_id": paper.study_id,
            "source_id": existing.id,
            "reason": "already loaded",
        }
    source = ReviewSource(
        fulltext_id=fulltext.id,
        parsed_paper=paper.parsed_paper,
        coordinate_parse=paper.coordinate_parse,
        record=paper.record,
        judgeable_keys=judgeable_keys(paper.record, paper.coordinate_parse),
        label=paper.parsed_paper["bibliography"]["title"],
        schema_versions=_schema_versions(paper),
        record_sha256=digest,
        loaded_by_id=user_id,
        run_id=run_id,
    )
    session.add(source)
    session.flush()
    return "loaded", {
        "study_id": paper.study_id,
        "source_id": source.id,
        "base_study_id": base_study.id,
    }


def _names_review(provenance):
    source = provenance.get("source")
    return isinstance(source, dict) and source.get("kind") == "review"


def _digest(record, provenance):
    """The record's digest; a wrapper that names a review is part of it."""
    if provenance is None or not _names_review(provenance):
        return sha256_of(record)
    return sha256_of({"record": record, "provenance": provenance})


def _positional_problems(record):
    problems = []
    for analysis in record.get("analyses") or ():
        key = extracted_value(analysis.get("source_table_analysis"))
        if isinstance(key, str) and _POSITIONAL_KEY.fullmatch(key):
            problems.append(
                f"positional coordinate key {key}; migrate it to content keys with "
                "pondie/scripts/astra_to_study_schema.py (W21)"
            )
    return problems


def _fulltext(session, base_study, paper):
    source = paper.parsed_paper["source"]
    if source not in FULLTEXT_SOURCE_PREFERENCE:
        raise PaperRefused([f"unknown text source {source!r}"])
    digest = paper.parsed_paper["text_sha256"]
    fulltext = session.scalar(
        sa.select(Fulltext).where(
            Fulltext.base_study_id == base_study.id, Fulltext.sha256 == digest
        )
    )
    if fulltext is None:
        fulltext = Fulltext(base_study_id=base_study.id, source=source, text=paper.text)
        session.add(fulltext)
        session.flush()
    return fulltext


def _schema_versions(paper):
    return {
        "paper_parse": paper.parsed_paper["header"]["schema_version"],
        "coordinate_parse": paper.coordinate_parse["header"]["schema_version"],
        "extraction": defs.extraction_version(),
    }
