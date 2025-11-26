import logging
from typing import Tuple

from sqlalchemy import select

from neurosynth_compose.database import db
from neurosynth_compose.models.analysis import Project

logger = logging.getLogger(__name__)


def add_missing_extraction_ids(session=None) -> Tuple[int, int]:
    """Add null studysetId/annotationId keys to extractionMetadata when absent."""
    sess = session or db.session
    updated = 0
    skipped = 0

    projects = sess.scalars(select(Project)).all()

    for project in projects:
        provenance = project.provenance or {}
        extraction_metadata = provenance.get("extractionMetadata")

        if not isinstance(extraction_metadata, dict):
            skipped += 1
            continue

        changed = False

        if "studysetId" not in extraction_metadata:
            extraction_metadata["studysetId"] = None
            changed = True

        if "annotationId" not in extraction_metadata:
            extraction_metadata["annotationId"] = None
            changed = True

        if changed:
            provenance["extractionMetadata"] = extraction_metadata
            project.provenance = provenance
            updated += 1
        else:
            skipped += 1

    if updated:
        try:
            sess.commit()
        except Exception:
            sess.rollback()
            logger.exception(
                "Failed to commit extractionMetadata backfill for projects."
            )
            raise
    else:
        sess.rollback()

    return updated, skipped
