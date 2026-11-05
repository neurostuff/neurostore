"""Data sources linked to analyses, and the lists computed from them for (base) studies."""

import sqlalchemy as sa

from neurostore.database import db
from neurostore.models import (
    Analysis,
    AnalysisDataSource,
    BaseStudy,
    BaseStudyDataSource,
    DataSource,
    Study,
    StudyDataSource,
)
from neurostore.resources.common import normalize_ids


def data_sources_of(record):
    """The data sources of an analysis, study or base study, by name."""
    if isinstance(record, Analysis):
        link, column = AnalysisDataSource.__table__, AnalysisDataSource.analysis_id
    elif isinstance(record, Study):
        link, column = StudyDataSource, StudyDataSource.c.study_id
    elif isinstance(record, BaseStudy):
        link, column = BaseStudyDataSource, BaseStudyDataSource.c.base_study_id
    else:
        raise TypeError(f"{type(record).__name__} has no data sources")
    return db.session.scalars(
        sa.select(DataSource)
        .join(link, link.c.data_source_id == DataSource.id)
        .where(column == record.id)
        .order_by(DataSource.name)
    ).all()


def recompute_data_source_links(base_study_ids):
    """Rebuild the study and base-study data source lists from their analyses' links."""
    base_study_ids = normalize_ids(base_study_ids)
    if not base_study_ids:
        return
    study_ids = sa.select(Study.id).where(Study.base_study_id.in_(base_study_ids))

    db.session.execute(
        sa.delete(StudyDataSource).where(StudyDataSource.c.study_id.in_(study_ids))
    )
    db.session.execute(
        sa.insert(StudyDataSource).from_select(
            ["study_id", "data_source_id"],
            sa.select(Analysis.study_id, AnalysisDataSource.data_source_id)
            .join(Analysis, Analysis.id == AnalysisDataSource.analysis_id)
            .join(Study, Study.id == Analysis.study_id)
            .where(Study.base_study_id.in_(base_study_ids))
            .distinct(),
        )
    )
    db.session.execute(
        sa.delete(BaseStudyDataSource).where(
            BaseStudyDataSource.c.base_study_id.in_(base_study_ids)
        )
    )
    db.session.execute(
        sa.insert(BaseStudyDataSource).from_select(
            ["base_study_id", "data_source_id"],
            sa.select(Study.base_study_id, StudyDataSource.c.data_source_id)
            .join(Study, Study.id == StudyDataSource.c.study_id)
            .where(Study.base_study_id.in_(base_study_ids))
            .distinct(),
        )
    )

    # Core statements leave loaded instances with the lists they were read with
    for instance in list(db.session.identity_map.values()):
        if (isinstance(instance, BaseStudy) and instance.id in base_study_ids) or (
            isinstance(instance, Study) and instance.base_study_id in base_study_ids
        ):
            db.session.expire(instance, ["data_sources"])
