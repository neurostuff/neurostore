"""Export reviews as study_schema layouts: one review, or many as one tree per reviewer."""

from collections import defaultdict
from datetime import timezone
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy.orm import joinedload, selectinload

from neurostore.exceptions.utils.error_helpers import abort_not_found
from neurostore.models import Fulltext, Review, ReviewSource
from neurostore.review import ReviewError, service
from neurostore.review.layout import _dumped, paper_from_documents, write_export

UNREVIEWED_DIR = "unreviewed"
BATCH_SIZE = 100
PROVENANCE_DIR = "run/provenance"
PROVENANCE_SCHEMA = Path(__file__).parent / "schema" / "record-provenance.schema.json"


def export_review(session, review_id, out):
    """Write the plain layout of one review under ``out``; returns its manifest."""
    review = session.get(Review, review_id)
    if review is None:
        abort_not_found("review", review_id)
    source = service.get_source(session, review.source_id)
    path = _write_review(Path(out), source, review, set())
    return [_entry(path, source.id, review)]


def export_bulk(
    session,
    out,
    *,
    source_ids=None,
    base_study_ids=None,
    user_ids=None,
    states=None,
    include_unreviewed=False,
):
    """Write one layout tree per reviewer under ``out``, and each source with no review as
    loaded under ``unreviewed/`` when ``include_unreviewed``; returns the manifest.

    An empty filter list means no filter.
    """
    source_ids, base_study_ids, user_ids, states = (
        values or None for values in (source_ids, base_study_ids, user_ids, states)
    )
    if include_unreviewed and (user_ids or states):
        raise ReviewError(
            "include_unreviewed cannot be combined with a reviewer or state filter"
        )
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    manifest = []
    taken = defaultdict(set)
    for review, source in _reviews(session, source_ids, base_study_ids, user_ids, states):
        path = _write_review(out / review.user_id, source, review, taken[review.user_id])
        manifest.append(_entry(f"{review.user_id}/{path}", source.id, review))
        session.expunge(review)
        if sa.inspect(source).persistent:
            session.expunge(source)
    if include_unreviewed:
        for source in _unreviewed(session, source_ids, base_study_ids):
            path = _write_review(out / UNREVIEWED_DIR, source, None, taken[UNREVIEWED_DIR])
            manifest.append(_entry(f"{UNREVIEWED_DIR}/{path}", source.id))
            session.expunge(source)
    return manifest


def _reviews(session, source_ids, base_study_ids, user_ids, states):
    """Each matching (review, source) pair, by source load order then reviewer, streamed."""
    filters = _source_filters(source_ids, base_study_ids)
    if user_ids is not None:
        filters.append(Review.user_id.in_(user_ids))
    if states is not None:
        filters.append(Review.state.in_(states))
    query = (
        sa.select(Review, ReviewSource)
        .join(ReviewSource, Review.source_id == ReviewSource.id)
        .join(Fulltext, ReviewSource.fulltext_id == Fulltext.id)
        .options(joinedload(ReviewSource.fulltext), selectinload(Review.ops))
        .where(*filters)
        .order_by(ReviewSource.created_at, ReviewSource.id, Review.user_id)
        .execution_options(yield_per=BATCH_SIZE)
    )
    return session.execute(query)


def _unreviewed(session, source_ids, base_study_ids):
    """Each source that no review has, streamed in load order."""
    query = (
        sa.select(ReviewSource)
        .join(Fulltext, ReviewSource.fulltext_id == Fulltext.id)
        .options(joinedload(ReviewSource.fulltext))
        .where(
            ~sa.exists().where(Review.source_id == ReviewSource.id),
            *_source_filters(source_ids, base_study_ids),
        )
        .order_by(ReviewSource.created_at, ReviewSource.id)
        .execution_options(yield_per=BATCH_SIZE)
    )
    return session.scalars(query)


def _source_filters(source_ids, base_study_ids):
    filters = []
    if source_ids is not None:
        filters.append(ReviewSource.id.in_(source_ids))
    if base_study_ids is not None:
        filters.append(Fulltext.base_study_id.in_(base_study_ids))
    return filters


def _write_review(root, source, review, taken):
    """Write a source as loaded (``review`` None) or one review of it under ``root``; returns
    the record's path under ``root``. ``taken`` holds the paper ids already written there.
    """
    paper_id = _paper_id(source, taken)
    if review is None:
        record, revision, ops = source.record, None, None
    else:
        ops = _ops(review)
        record = review.record
        revision = review.coordinate_revision
    paper = paper_from_documents(
        paper_id,
        source.parsed_paper,
        source.coordinate_parse,
        source.record,
        source.fulltext.text,
    )
    record_path = write_export(root, paper, record, revision, ops)
    _write_provenance(root, paper_id, record_path, source, review, ops)
    return record_path


def _paper_id(source, taken):
    """The article id, or ``<article id>~<source id>`` when an earlier source took it."""
    article_id = source.parsed_paper["header"].get("article_id") or source.fulltext.base_study_id
    paper_id = article_id if article_id not in taken else f"{article_id}~{source.id}"
    taken.add(paper_id)
    return paper_id


def _ops(review):
    return [
        {
            "seq": op.seq,
            "op": op.op,
            "before": op.before,
            "after": op.after,
            "user_id": review.user_id,
            "created_at": op.created_at.astimezone(timezone.utc).isoformat(),
        }
        for op in review.ops
    ]


def _write_provenance(root, paper_id, record_path, source, review, ops):
    """The wrapper beside a paper's record: what the record is and where it came from."""
    edited = review is not None and review.record != source.record
    document = {
        "record_path": record_path,
        "source": _provenance_source(source, review),
        "derived_from": {"source_id": source.id, "record_sha256": source.record_sha256},
        "edited": edited,
        "last_edit_at": ops[-1]["created_at"] if edited else None,
        "producer": {"name": "neurostore-review", "version": 1},
    }
    path = root / PROVENANCE_DIR / f"{paper_id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(_dumped(document))


def _provenance_source(source, review):
    if review is None:
        return {
            "kind": "source",
            "source_id": source.id,
            "origin": source.origin,
            "run_id": source.run_id,
        }
    return {
        "kind": "review",
        "review_id": review.id,
        "user_id": review.user_id,
        "state": review.state,
    }


def _entry(path, source_id, review=None):
    if review is None:
        return {
            "path": path,
            "source_id": source_id,
            "review_id": None,
            "user_id": None,
            "state": None,
        }
    return {
        "path": path,
        "source_id": source_id,
        "review_id": review.id,
        "user_id": review.user_id,
        "state": review.state,
    }
