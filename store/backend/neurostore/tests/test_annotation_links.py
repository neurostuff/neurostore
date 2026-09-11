"""Regression tests for issue #1740: analyses added outside the resource layer."""

import pytest

from neurostore.database import db
from neurostore.models import Analysis, AnnotationAnalysis, Study
from neurostore.services.annotation_links import (
    backfill_annotation_analyses,
    count_missing_annotation_analyses,
)

pytestmark = pytest.mark.anyio


async def _annotated_studyset(auth_client):
    study = Study.query.join(Analysis).first()
    studyset = await auth_client.post(
        "/api/studysets/", data={"name": "links", "studies": [study.id]}
    )
    assert studyset.status_code == 200
    annotation = await auth_client.post(
        "/api/annotations/",
        data={
            "studyset": studyset.json()["id"],
            "note_keys": {"included": {"type": "boolean", "order": 0}},
            "name": "links",
        },
    )
    assert annotation.status_code == 200
    return study, annotation.json()["id"]


async def test_ingested_analysis_has_no_note_until_backfilled(
    auth_client, ingest_neurosynth, session
):
    study, annotation_id = await _annotated_studyset(auth_client)

    # an ingest adds an analysis straight through SQLAlchemy, bypassing the
    # resource layer that normally creates the annotation note
    analysis = Analysis(name="tbl3", study_id=study.id)
    db.session.add(analysis)
    db.session.commit()

    # the study also belongs to the studyset the ingest fixture built, so every
    # annotation covering it is short one note
    missing = count_missing_annotation_analyses(study_ids=[study.id])
    assert missing >= 1
    assert (
        AnnotationAnalysis.query.filter_by(
            annotation_id=annotation_id, analysis_id=analysis.id
        ).count()
        == 0
    )

    assert backfill_annotation_analyses(study_ids=[study.id]) == missing

    link = AnnotationAnalysis.query.filter_by(
        annotation_id=annotation_id, analysis_id=analysis.id
    ).one()
    assert link.study_id == study.id
    # the note carries the annotation's declared defaults
    assert link.note == {"included": True}
    assert count_missing_annotation_analyses(study_ids=[study.id]) == 0


async def test_backfill_is_idempotent(auth_client, ingest_neurosynth, session):
    study, _ = await _annotated_studyset(auth_client)

    db.session.add(Analysis(name="tbl4", study_id=study.id))
    db.session.commit()

    assert backfill_annotation_analyses(study_ids=[study.id]) >= 1
    assert backfill_annotation_analyses(study_ids=[study.id]) == 0
    assert count_missing_annotation_analyses() == 0


async def test_backfill_scoped_to_study_ids(auth_client, ingest_neurosynth, session):
    study, _ = await _annotated_studyset(auth_client)
    db.session.add(Analysis(name="tbl5", study_id=study.id))
    db.session.commit()

    assert backfill_annotation_analyses(study_ids=[]) == 0
    assert count_missing_annotation_analyses(study_ids=[study.id]) >= 1
