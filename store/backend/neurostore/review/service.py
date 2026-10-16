"""The /review API's reads and writes: bundles, progress, the hidden set and the op log."""

from collections import defaultdict
from datetime import datetime, timezone
from typing import NamedTuple

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import joinedload

from neurostore.exceptions.utils.error_helpers import (
    abort_conflict,
    abort_not_found,
    abort_permission,
    abort_unprocessable,
)
from neurostore.exceptions.utils.errors import ErrorDetail
from neurostore.models import (
    BaseStudy,
    Fulltext,
    Review,
    ReviewAssignment,
    ReviewOp,
    ReviewSource,
    Role,
    User,
)
from neurostore.models.review import SET_ASIDE_REASONS
from neurostore.review.bundle import bundle, hidden, source_summary
from neurostore.review.entities import index_rows
from neurostore.review.ops import NO_INVERSE, OpError, ReviewState, apply_batch, inverse_ops
from neurostore.review.validation import document_problems

#: Provenance states that count as a change in the paper list.
CHANGED_STATES = ("edited", "added", "removed")
#: Provenance states that count as reviewed: a value verified or changed by the reviewer.
#: Reviewed is counted only over the source's judgeable_keys.
REVIEWED_STATES = ("verified", *CHANGED_STATES)
#: The state changes a review's owner may make.
OWNER_TRANSITIONS = {
    ("in_progress", "submitted"),
    ("submitted", "in_progress"),
    ("in_progress", "set_aside"),
    ("set_aside", "in_progress"),
}


#: The role a user needs to be assigned a paper, and to be listed among the reviewers.
REVIEWER_ROLE = "admin-reviewer"


class Caller(NamedTuple):
    id: str
    lead: bool


def list_sources(
    session, user_id, *, page=1, page_size=20, base_study_id=None, mine=False, assigned=None
):
    """A page of sources, newest first, each with its paper's assignees and every review's
    progress.

    ``mine`` keeps the sources the caller has reviewed; ``assigned="me"`` keeps the sources
    whose paper is assigned to the caller. The two filters are independent.
    """
    query = sa.select(
        ReviewSource.id,
        Fulltext.base_study_id,
        ReviewSource.label,
        ReviewSource.origin,
        ReviewSource.created_at,
        ReviewSource.judgeable_keys,
    ).join(Fulltext, ReviewSource.fulltext_id == Fulltext.id)
    if base_study_id is not None:
        query = query.where(Fulltext.base_study_id == base_study_id)
    if mine:
        query = query.where(
            sa.exists().where(Review.source_id == ReviewSource.id, Review.user_id == user_id)
        )
    if assigned == "me":
        query = query.where(
            sa.exists().where(
                ReviewAssignment.base_study_id == Fulltext.base_study_id,
                ReviewAssignment.user_id == user_id,
            )
        )
    total = session.scalar(sa.select(sa.func.count()).select_from(query.subquery()))
    rows = session.execute(
        query.order_by(ReviewSource.created_at.desc(), ReviewSource.id)
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    judgeable = {row.id: row.judgeable_keys for row in rows}
    by_base_study = _assignment_rows(session, list({row.base_study_id for row in rows}))
    progress = defaultdict(list)
    for review in _review_rows(session, [row.id for row in rows]):
        states = [entry.get("state") for entry in review.provenance.values()]
        progress[review.source_id].append({
            "user_id": review.user_id,
            "user_name": review.user_name,
            "state": review.state,
            **_set_aside(review),
            "last_seq": review.last_seq,
            "updated_at": _iso(review.updated_at),
            "op_count": review.op_count,
            "last_edit_at": _iso(review.last_edit_at),
            "edited": sum(state in CHANGED_STATES for state in states),
            "verified": states.count("verified"),
            "reviewed": sum(
                review.provenance.get(key, {}).get("state") in REVIEWED_STATES
                for key in judgeable[review.source_id]
            ),
        })
    return {
        "metadata": {"total_count": total},
        "results": [
            {
                "id": row.id,
                "base_study_id": row.base_study_id,
                "label": row.label,
                "origin": row.origin,
                "created_at": _iso(row.created_at),
                "total": len(judgeable[row.id]),
                "assignees": by_base_study.get(row.base_study_id, []),
                "reviews": progress[row.id],
            }
            for row in rows
        ],
    }


def get_bundle(session, source_id, user_id):
    """The bundle of ``source_id`` for the reviewer ``user_id``."""
    source = get_source(session, source_id)
    review = _review_of(session, source_id, user_id)
    if review is None:
        state = ReviewState(record=source.record, coordinate_parse=source.coordinate_parse)
        summary, ops = None, []
    else:
        state = _state(review, source)
        summary = {
            "id": review.id,
            "user_id": review.user_id,
            "state": review.state,
            **_set_aside(review),
        }
        ops = _stored_ops(session, review)
    return bundle(
        source=source_summary(source),
        text=source.fulltext.text,
        parsed_paper=source.parsed_paper or {},
        original=source.record,
        state=state,
        review=summary,
        ops=ops,
        reviewers=_reviewers(session, source_id),
    )


def start_review(session, source_id, user_id):
    """``(review summary, created)``: the reviewer's review of the source, started if new.

    Raises:
        ConflictError (409) with each problem of the source's documents, code source_invalid,
        when a new review would start from documents that no longer validate.
    """
    source = _get_or_404(session, ReviewSource, source_id, "review source")
    if _review_of(session, source_id, user_id) is None:
        _check_source(source)
    inserted_id = session.scalar(
        insert(Review)
        .values(
            source_id=source_id,
            user_id=user_id,
            state="in_progress",
            record=source.record,
            provenance={},
            annotations={},
            last_seq=0,
        )
        .on_conflict_do_nothing(constraint="uq_reviews_source_user")
        .returning(Review.id)
    )
    return summary(_review_of(session, source_id, user_id)), inserted_id is not None


def _check_source(source):
    problems = document_problems("extraction-record", source.record)
    if source.coordinate_parse is not None:
        problems += document_problems("coordinate-parse", source.coordinate_parse)
    if problems:
        abort_conflict(
            "The source no longer validates against study_schema; re-import the source.",
            errors=[
                ErrorDetail(code="source_invalid", message=problem).to_dict()
                for problem in problems
            ],
        )


def get_review(session, review_id):
    review = _get_or_404(session, Review, review_id, "review")
    return {
        **summary(review),
        "record": review.record,
        "coordinate_revision": review.coordinate_revision,
        "provenance": review.provenance,
        "annotations": review.annotations,
        "ops": _stored_ops(session, review),
    }


def post_ops(session, review_id, user_id, body):
    """Apply a batch of the owner's ops under a lock on the review, or return the stored ops
    of a full replay; flushes, never commits.

    Raises:
        PermissionError (403) when the caller does not own the review.
        NotFoundError (404) when the review does not exist.
        ConflictError (409) for a closed review, a stale expected_last_seq or a partial replay.
        UnprocessableEntityError (422) naming each op the core refuses.
    """
    review = _locked(session, review_id)
    if review.user_id != user_id:
        abort_permission("Only the review's owner can edit it.")
    source = get_source(session, review.source_id)
    ops = body["ops"]
    client_op_ids = {op.get("client_op_id") for op in ops}
    stored = session.scalars(
        sa.select(ReviewOp)
        .where(ReviewOp.review_id == review_id, ReviewOp.client_op_id.in_(client_op_ids))
        .order_by(ReviewOp.seq)
    ).all()
    if stored and len(stored) == len(client_op_ids):
        return _op_result(
            review, [_stored(row, review.user_id) for row in stored], source.coordinate_parse
        )
    if stored:
        abort_conflict("Some of the batch's ops are stored and some are not.")
    if review.state != "in_progress":
        abort_conflict(f"The review is {review.state}; only in_progress takes ops.")
    if body["expected_last_seq"] != review.last_seq:
        abort_conflict(
            "The review has changed since the batch was made.", last_seq=review.last_seq
        )
    now = datetime.now(timezone.utc)
    try:
        state, applied = apply_batch(
            _state(review, source),
            {"ops": ops},
            text=source.fulltext.text,
            user_id=user_id,
            at=_iso(now),
        )
    except OpError as error:
        abort_unprocessable(
            str(error), [_refusal(ops, index, problem) for index, problem in error.failures]
        )
    inserted = [
        ReviewOp(
            review_id=review.id,
            seq=entry["seq"],
            client_op_id=entry["op"]["client_op_id"],
            op=entry["op"],
            before=entry["before"],
            after=entry["after"],
            created_at=now,
        )
        for entry in applied
    ]
    session.add_all(inserted)
    _save_state(review, state)
    session.flush()
    return _op_result(review, [_stored(row, user_id) for row in inserted], source.coordinate_parse)


def set_state(session, review_id, user_id, new_state, *, lead, reason=None, note=None):
    """Move a review to ``new_state``; flushes, never commits.

    ``set_aside`` takes a ``reason`` and an optional ``note`` (required with ``other``), kept
    until the review leaves that state; no other state takes either.

    Raises:
        NotFoundError (404) when the review does not exist.
        PermissionError (403) when a non-admin marks a reference, or a caller who does not
        own the review changes any other state.
        ConflictError (409) when the review is already the reference, another review of its
        source is, or the transition is not allowed.
        UnprocessableEntityError (422) when a set_aside lacks its reason or note, or another
        state is given one.
    """
    review = _locked(session, review_id)
    if new_state == "reference":
        if not lead:
            abort_permission("Only an admin can mark the reference review.")
        if review.state == "reference":
            abort_conflict("The review is already the reference review.")
        if review.state == "set_aside":
            abort_conflict("A set-aside review cannot be the reference review.")
        session.execute(
            sa.select(ReviewSource.id).where(ReviewSource.id == review.source_id).with_for_update()
        )
        references_of_source = session.scalar(
            sa.select(sa.func.count(Review.id)).where(
                Review.source_id == review.source_id, Review.state == "reference"
            )
        )
        if references_of_source:
            abort_conflict("The paper already has a reference review.")
    else:
        if review.user_id != user_id:
            abort_permission("Only the review's owner can change its state.")
        if (review.state, new_state) not in OWNER_TRANSITIONS:
            abort_conflict(f"A review cannot go from {review.state} to {new_state}.")
    _check_set_aside(new_state, reason, note)
    review.state = new_state
    review.set_aside_reason = reason
    review.set_aside_note = note
    session.flush()
    return summary(review)


def _check_set_aside(new_state, reason, note):
    if new_state != "set_aside":
        if reason is not None or note is not None:
            abort_unprocessable(f"Only set_aside takes a reason or a note, not {new_state}.")
    elif reason not in SET_ASIDE_REASONS:
        abort_unprocessable(f"A review is set aside for one of {', '.join(SET_ASIDE_REASONS)}.")
    elif reason == "other" and not (note or "").strip():
        abort_unprocessable("A review set aside for another reason needs a note.")


def _set_aside(review):
    """The reason and note of a set-aside review, as its summary carries them; {} otherwise."""
    if review.state != "set_aside":
        return {}
    return {"set_aside": {"reason": review.set_aside_reason, "note": review.set_aside_note}}


def assign(session, base_study_id, user_id, caller):
    """``(assignment, created)``: the paper assigned to ``user_id`` by ``caller``; flushes,
    never commits. Assigning an assigned user again changes nothing.

    Raises:
        NotFoundError (404) when the base study does not exist.
        PermissionError (403) when a caller who is not a lead names another user.
        UnprocessableEntityError (422) when the user does not hold the admin-reviewer role.
    """
    _base_study_or_404(session, base_study_id)
    _may_name(user_id, caller)
    if not _is_reviewer(session, user_id):
        abort_unprocessable(f"{user_id} is not an admin-reviewer, so cannot be assigned a paper.")
    created = session.scalar(
        insert(ReviewAssignment)
        .values(base_study_id=base_study_id, user_id=user_id, assigned_by_id=caller.id)
        .on_conflict_do_nothing(constraint="uq_review_assignments_base_study_user")
        .returning(ReviewAssignment.id)
    )
    session.flush()
    row = session.execute(
        sa.select(ReviewAssignment.assigned_by_id, User.name)
        .join(User, User.external_id == ReviewAssignment.user_id)
        .where(
            ReviewAssignment.base_study_id == base_study_id,
            ReviewAssignment.user_id == user_id,
        )
    ).one()
    assignment = {
        "base_study_id": base_study_id,
        "user_id": user_id,
        "name": row.name,
        "assigned_by_id": row.assigned_by_id,
    }
    return assignment, created is not None


def release(session, base_study_id, user_id, caller):
    """Remove ``user_id``'s assignment to the paper, if any; flushes, never commits.

    Raises:
        NotFoundError (404) when the base study does not exist.
        PermissionError (403) when a caller who is not a lead names another user.
    """
    _base_study_or_404(session, base_study_id)
    _may_name(user_id, caller)
    session.execute(
        sa.delete(ReviewAssignment).where(
            ReviewAssignment.base_study_id == base_study_id, ReviewAssignment.user_id == user_id
        )
    )
    session.flush()


def assignees(session, base_study_id):
    """The users the paper is assigned to, oldest assignment first.

    Raises:
        NotFoundError (404) when the base study does not exist.
    """
    _base_study_or_404(session, base_study_id)
    return _assignment_rows(session, [base_study_id]).get(base_study_id, [])


def reviewers(session):
    """Every admin-reviewer, by name."""
    rows = session.execute(
        sa.select(User.external_id, User.name)
        .where(User.roles.any(Role.id == REVIEWER_ROLE))
        .order_by(User.name, User.external_id)
    ).all()
    return [{"user_id": row.external_id, "name": row.name} for row in rows]


def _may_name(user_id, caller):
    if user_id != caller.id and not caller.lead:
        abort_permission("Only a lead reviewer can assign or release another user's paper.")


def _is_reviewer(session, user_id):
    return session.scalar(
        sa.select(
            sa.exists().where(
                User.external_id == user_id, User.roles.any(Role.id == REVIEWER_ROLE)
            )
        )
    )


def _base_study_or_404(session, base_study_id):
    if session.get(BaseStudy, base_study_id) is None:
        abort_not_found("base study", base_study_id)


def _assignment_rows(session, base_study_ids):
    """``{base_study_id: [{"user_id", "name"}]}`` for the base studies, oldest assignment first."""
    rows = (
        session.execute(
            sa.select(
                ReviewAssignment.base_study_id,
                ReviewAssignment.user_id,
                User.name,
            )
            .join(User, User.external_id == ReviewAssignment.user_id)
            .where(ReviewAssignment.base_study_id.in_(base_study_ids))
            .order_by(ReviewAssignment.created_at, ReviewAssignment.user_id)
        ).all()
        if base_study_ids
        else []
    )
    by_base_study = defaultdict(list)
    for row in rows:
        by_base_study[row.base_study_id].append({"user_id": row.user_id, "name": row.name})
    return by_base_study


def review_source_count(session, base_study_id):
    """How many review sources read one of the base study's full texts."""
    return session.scalar(
        sa.select(sa.func.count(ReviewSource.id))
        .join(Fulltext, ReviewSource.fulltext_id == Fulltext.id)
        .where(Fulltext.base_study_id == base_study_id)
    )


def summary(review):
    return {
        "id": review.id,
        "source_id": review.source_id,
        "user_id": review.user_id,
        "state": review.state,
        **_set_aside(review),
        "last_seq": review.last_seq,
        "created_at": _iso(review.created_at),
        "updated_at": _iso(review.updated_at),
    }


def _get_or_404(session, model, id, name):
    row = session.get(model, id)
    if row is None:
        abort_not_found(name, id)
    return row


def _review_of(session, source_id, user_id):
    return session.scalar(
        sa.select(Review).where(Review.source_id == source_id, Review.user_id == user_id)
    )


def get_source(session, source_id):
    source = session.scalar(
        sa.select(ReviewSource)
        .options(joinedload(ReviewSource.fulltext))
        .where(ReviewSource.id == source_id)
    )
    if source is None:
        abort_not_found("review source", source_id)
    return source


def _locked(session, review_id):
    review = session.scalar(
        sa.select(Review)
        .where(Review.id == review_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if review is None:
        abort_not_found("review", review_id)
    return review


def _save_state(review, state):
    review.record = state.record
    review.coordinate_revision = state.coordinate_revision
    review.provenance = state.provenance
    review.annotations = state.annotations
    review.last_seq = state.last_seq


def _state(review, source):
    return ReviewState(
        record=review.record,
        coordinate_parse=source.coordinate_parse,
        coordinate_revision=review.coordinate_revision,
        provenance=review.provenance,
        annotations=review.annotations,
        last_seq=review.last_seq,
    )


def _refusal(ops, index, problem):
    """The 422 error of one refused op, or of the batch as a whole when ``index`` is None."""
    if index is None:
        return ErrorDetail(field="ops", code="REJECTED", message=problem)
    return ErrorDetail(
        field=f"ops/{index}",
        code="REJECTED",
        message=problem,
        context={"op_index": index, "client_op_id": ops[index].get("client_op_id")},
    )


def _review_rows(session, source_ids):
    """Every review of the sources, with its user's name, op count and last edit time."""
    edits = (
        sa.select(
            ReviewOp.review_id,
            sa.func.count(ReviewOp.id).label("op_count"),
            sa.func.max(ReviewOp.created_at).label("last_edit_at"),
        )
        .group_by(ReviewOp.review_id)
        .subquery()
    )
    return session.execute(
        sa.select(
            Review.id,
            Review.source_id,
            Review.user_id,
            User.name.label("user_name"),
            Review.state,
            Review.set_aside_reason,
            Review.set_aside_note,
            Review.last_seq,
            Review.updated_at,
            Review.provenance,
            sa.func.coalesce(edits.c.op_count, 0).label("op_count"),
            edits.c.last_edit_at,
        )
        .outerjoin(User, User.external_id == Review.user_id)
        .outerjoin(edits, edits.c.review_id == Review.id)
        .where(Review.source_id.in_(source_ids))
        .order_by(Review.created_at, Review.id)
    ).all()


def _reviewers(session, source_id):
    rows = sorted(
        _review_rows(session, [source_id]),
        key=lambda row: row.last_edit_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    return [
        {
            "user_id": row.user_id,
            "name": row.user_name,
            "state": row.state,
            "op_count": row.op_count,
            "last_edit_at": _iso(row.last_edit_at),
        }
        for row in rows
    ]


def _stored_ops(session, review):
    rows = session.scalars(
        sa.select(ReviewOp).where(ReviewOp.review_id == review.id).order_by(ReviewOp.seq)
    )
    return [_stored(row, review.user_id) for row in rows]


def _stored(row, user_id):
    return {
        "seq": row.seq,
        "op": row.op,
        "before": row.before,
        "after": row.after,
        "user_id": user_id,
        "created_at": _iso(row.created_at),
    }


def _undoable(stored):
    """``stored`` with ``inverse``, the ops that undo it, unless no op undoes its type."""
    if stored["op"]["type"] in NO_INVERSE:
        return stored
    return {**stored, "inverse": inverse_ops(stored)}


def _op_result(review, ops, coordinate_parse):
    return {
        "ops": [_undoable(stored) for stored in ops],
        "last_seq": review.last_seq,
        "record": review.record,
        "coordinate_revision": review.coordinate_revision,
        "provenance": review.provenance,
        "annotations": review.annotations,
        "hidden": hidden(review.record, coordinate_parse, review.coordinate_revision,
                         provenance=review.provenance),
        "entities": index_rows(review.record),
    }


def _iso(moment):
    return None if moment is None else moment.astimezone(timezone.utc).isoformat()
