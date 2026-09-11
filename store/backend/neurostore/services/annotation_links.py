"""Repair annotation_analyses rows that were never created.

`AnnotationAnalysis` rows are normally created by the resource layer when a
study joins a studyset or gains an analysis. Ingest paths write `Analysis` rows
straight through SQLAlchemy, so an ingest that adds a table to a study already
sitting in an annotated studyset leaves that analysis with no note (issue #1740).
"""

import sqlalchemy as sa

from neurostore.database import db
from neurostore.models import Analysis, Annotation, AnnotationAnalysis
from neurostore.models.data import StudysetStudy
from neurostore.note_keys import build_default_note


def _missing_link_query(study_ids=None):
    query = (
        sa.select(
            Annotation.id.label("annotation_id"),
            Annotation.note_keys,
            Annotation.user_id,
            StudysetStudy.studyset_id,
            StudysetStudy.study_id,
            Analysis.id.label("analysis_id"),
        )
        .select_from(Annotation)
        .join(StudysetStudy, StudysetStudy.studyset_id == Annotation.studyset_id)
        .join(Analysis, Analysis.study_id == StudysetStudy.study_id)
        .outerjoin(
            AnnotationAnalysis,
            sa.and_(
                AnnotationAnalysis.annotation_id == Annotation.id,
                AnnotationAnalysis.analysis_id == Analysis.id,
            ),
        )
        .where(AnnotationAnalysis.annotation_id.is_(None))
    )
    if study_ids is not None:
        study_ids = [study_id for study_id in study_ids if study_id]
        if not study_ids:
            return None
        query = query.where(StudysetStudy.study_id.in_(study_ids))
    return query


def count_missing_annotation_analyses(study_ids=None):
    """Number of studyset analyses that have no note on their annotation."""
    query = _missing_link_query(study_ids)
    if query is None:
        return 0
    return db.session.execute(
        sa.select(sa.func.count()).select_from(query.subquery())
    ).scalar_one()


def backfill_annotation_analyses(study_ids=None, batch_size=1000, commit=True):
    """Create the missing annotation_analyses rows and return how many.

    Rows are created with the annotation's default note, the same payload the
    resource layer would have used had the analysis been added through the API.
    """
    query = _missing_link_query(study_ids)
    if query is None:
        return 0

    results = db.session.execute(query).all()
    if not results:
        return 0

    default_notes = {}
    mappings = []
    for result in results:
        annotation_id = result.annotation_id
        if annotation_id not in default_notes:
            note = build_default_note(result.note_keys)
            default_notes[annotation_id] = note if note is not None else {}
        mappings.append(
            {
                "analysis_id": result.analysis_id,
                "annotation_id": annotation_id,
                "note": dict(default_notes[annotation_id]),
                "user_id": result.user_id,
                "study_id": result.study_id,
                "studyset_id": result.studyset_id,
            }
        )

    for start in range(0, len(mappings), batch_size):
        db.session.execute(
            sa.insert(AnnotationAnalysis), mappings[start : start + batch_size]
        )
        if commit:
            db.session.commit()

    if not commit:
        db.session.flush()

    return len(mappings)
