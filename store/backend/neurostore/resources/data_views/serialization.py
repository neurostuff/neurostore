from __future__ import annotations

from collections import defaultdict

import sqlalchemy as sa
from neurostore.database import db
from neurostore.map_types import map_type_label
from neurostore.models import (
    Analysis,
    AnalysisConditions,
    Condition,
    Image,
    Point,
    PointValue,
    Study,
    Studyset,
    StudysetStudy,
)


def _serialize_dt(value):
    return value.isoformat() if value else value


def _serialize_username(user):
    if user is None:
        return None
    return getattr(user, "name", None)


def _order_sort_key(value, fallback_id):
    return (
        value is None,
        value if value is not None else 0,
        fallback_id or "",
    )


def _serialize_condition(condition):
    return {
        "id": condition.id,
        "user": condition.user_id,
        "username": _serialize_username(getattr(condition, "user", None)),
        "created_at": _serialize_dt(condition.created_at),
        "updated_at": _serialize_dt(condition.updated_at),
        "name": condition.name,
        "description": condition.description,
    }


def _serialize_point(point):
    return {
        "id": point.id,
        "user": point.user_id,
        "username": _serialize_username(getattr(point, "user", None)),
        "created_at": _serialize_dt(point.created_at),
        "updated_at": _serialize_dt(point.updated_at),
        "analysis": point.analysis_id,
        "values": [
            {"kind": point_value.kind, "value": point_value.value}
            for point_value in point.values
        ],
        "cluster_size": point.cluster_size,
        "cluster_measurement_unit": point.cluster_measurement_unit,
        "subpeak": point.subpeak,
        "deactivation": point.deactivation,
        "is_seed": point.is_seed,
        "order": point.order,
        "coordinates": [point.x, point.y, point.z],
        "kind": point.kind,
        "space": point.space,
        "image": point.image,
        "label_id": point.label_id,
    }


def _serialize_image(image, analysis_name=None):
    return {
        "id": image.id,
        "user": image.user_id,
        "username": _serialize_username(getattr(image, "user", None)),
        "created_at": _serialize_dt(image.created_at),
        "updated_at": _serialize_dt(image.updated_at),
        "analysis": image.analysis_id,
        "analysis_name": analysis_name,
        "add_date": _serialize_dt(image.add_date),
        "url": image.url,
        "filename": image.filename,
        "space": image.space,
        "value_type": map_type_label(image.value_type),
    }


def serialize_analysis_record(analysis):
    analysis_conditions = sorted(
        analysis.analysis_conditions,
        key=lambda analysis_condition: _order_sort_key(
            None,
            getattr(getattr(analysis_condition, "condition", None), "id", None),
        ),
    )
    conditions = [
        _serialize_condition(analysis_condition.condition)
        for analysis_condition in analysis_conditions
        if analysis_condition.condition is not None
    ]
    weights = [analysis_condition.weight for analysis_condition in analysis_conditions]
    points = [
        _serialize_point(point)
        for point in sorted(
            analysis.points,
            key=lambda point: _order_sort_key(point.order, point.id),
        )
    ]
    images = [
        _serialize_image(image, analysis_name=analysis.name)
        for image in sorted(analysis.images, key=lambda image: (image.id or ""))
    ]

    return {
        "id": analysis.id,
        "user": analysis.user_id,
        "username": _serialize_username(getattr(analysis, "user", None)),
        "created_at": _serialize_dt(analysis.created_at),
        "updated_at": _serialize_dt(analysis.updated_at),
        "study": analysis.study_id,
        "table_id": analysis.table_id,
        "metadata": analysis.metadata_,
        "has_coordinates": analysis.has_coordinates,
        "has_images": analysis.has_images,
        "has_z_maps": analysis.has_z_maps,
        "has_t_maps": analysis.has_t_maps,
        "has_beta_and_variance_maps": analysis.has_beta_and_variance_maps,
        "conditions": conditions,
        "order": analysis.order,
        "images": images,
        "points": points,
        "weights": weights,
        "name": analysis.name,
        "description": analysis.description,
    }


def serialize_analysis_detail(analysis):
    return serialize_analysis_record(analysis)


def serialize_study_record(study):
    analyses = [
        serialize_analysis_record(analysis)
        for analysis in sorted(
            study.analyses,
            key=lambda analysis: _order_sort_key(analysis.order, analysis.id),
        )
    ]
    return {
        "id": study.id,
        "user": study.user_id,
        "username": _serialize_username(getattr(study, "user", None)),
        "created_at": _serialize_dt(study.created_at),
        "updated_at": _serialize_dt(study.updated_at),
        "metadata": study.metadata_,
        "name": study.name,
        "description": study.description,
        "publication": study.publication,
        "doi": study.doi,
        "pmid": study.pmid,
        "pmcid": study.pmcid,
        "authors": study.authors,
        "year": study.year,
        "level": study.level,
        "analyses": analyses,
        "tables": [table.id for table in getattr(study, "tables", [])],
        "source": study.source,
        "source_id": study.source_id,
        "base_study": study.base_study_id,
        "has_coordinates": study.has_coordinates,
        "has_images": study.has_images,
        "has_z_maps": study.has_z_maps,
        "has_t_maps": study.has_t_maps,
        "has_beta_and_variance_maps": study.has_beta_and_variance_maps,
        "source_updated_at": _serialize_dt(study.source_updated_at),
    }


def serialize_study_detail(study):
    return serialize_study_record(study)


def serialize_nested_studyset(studyset_id):
    studyset_row = db.session.execute(
        sa.select(
            Studyset.id,
            Studyset.name,
            Studyset.user_id,
            Studyset.description,
            Studyset.publication,
            Studyset.doi,
            Studyset.pmid,
            Studyset.created_at,
            Studyset.updated_at,
        ).where(Studyset.id == studyset_id)
    ).one_or_none()
    if studyset_row is None:
        return None

    study_rows = db.session.execute(
        sa.select(
            StudysetStudy.study_id,
            StudysetStudy.curation_stub_uuid,
            Study.id.label("id"),
            Study.created_at,
            Study.updated_at,
            Study.user_id,
            Study.name,
            Study.description,
            Study.publication,
            Study.doi,
            Study.pmid,
            Study.authors,
            Study.year,
            Study.metadata_,
            Study.source,
            Study.source_id,
            Study.source_updated_at,
        )
        .select_from(StudysetStudy)
        .join(Study, Study.id == StudysetStudy.study_id)
        .where(StudysetStudy.studyset_id == studyset_id)
        .order_by(StudysetStudy.study_id)
    ).all()

    analyses_by_study = defaultdict(list)
    points_by_analysis = defaultdict(list)
    images_by_analysis = defaultdict(list)
    conditions_by_analysis = defaultdict(list)
    weights_by_analysis = defaultdict(list)
    values_by_point = defaultdict(list)
    study_ids = [row.study_id for row in study_rows]

    if study_ids:
        analysis_rows = db.session.execute(
            sa.select(
                Analysis.id,
                Analysis.study_id,
                Analysis.user_id,
                Analysis.name,
                Analysis.metadata_,
                Analysis.description,
                Analysis.order,
            )
            .select_from(Analysis)
            .where(Analysis.study_id.in_(study_ids))
            .order_by(
                Analysis.study_id,
                Analysis.order.is_(None),
                Analysis.order,
                Analysis.id,
            )
        ).all()
    else:
        analysis_rows = []

    analysis_ids = [row.id for row in analysis_rows]

    if analysis_ids:
        point_rows = db.session.execute(
            sa.select(
                Point.id,
                Point.analysis_id,
                Point.x,
                Point.y,
                Point.z,
                Point.kind,
                Point.space,
                Point.image,
                Point.label_id,
                Point.order,
            )
            .select_from(Point)
            .where(Point.analysis_id.in_(analysis_ids))
            .order_by(Point.analysis_id, Point.order.is_(None), Point.order, Point.id)
        ).all()

        point_ids = [row.id for row in point_rows]

        if point_ids:
            point_value_rows = db.session.execute(
                sa.select(
                    PointValue.point_id,
                    PointValue.kind,
                    PointValue.value,
                )
                .select_from(PointValue)
                .where(PointValue.point_id.in_(point_ids))
                .order_by(PointValue.point_id, PointValue.id)
            ).all()
        else:
            point_value_rows = []

        for point_id, kind, value in point_value_rows:
            values_by_point[point_id].append({"kind": kind, "value": value})

        for (
            point_id,
            analysis_id,
            x,
            y,
            z,
            kind,
            space,
            image,
            label_id,
            _order,
        ) in point_rows:
            points_by_analysis[analysis_id].append(
                {
                    "id": point_id,
                    "coordinates": [x, y, z],
                    "kind": kind,
                    "space": space,
                    "image": image,
                    "label_id": label_id,
                    "values": values_by_point.get(point_id, []),
                }
            )

        image_rows = db.session.execute(
            sa.select(
                Image.analysis_id,
                Image.id,
                Image.user_id,
                Image.url,
                Image.space,
                Image.value_type,
                Image.filename,
                Image.add_date,
            )
            .select_from(Image)
            .where(Image.analysis_id.in_(analysis_ids))
            .order_by(Image.analysis_id, Image.id)
        ).all()
        for (
            analysis_id,
            image_id,
            user_id,
            url,
            space,
            value_type,
            filename,
            add_date,
        ) in image_rows:
            images_by_analysis[analysis_id].append(
                {
                    "id": image_id,
                    "user": user_id,
                    "url": url,
                    "space": space,
                    "value_type": map_type_label(value_type),
                    "filename": filename,
                    "add_date": add_date,
                }
            )

        condition_rows = db.session.execute(
            sa.select(
                AnalysisConditions.analysis_id,
                AnalysisConditions.weight,
                Condition.id,
                Condition.user_id,
                Condition.name,
                Condition.description,
            )
            .select_from(AnalysisConditions)
            .join(Condition, Condition.id == AnalysisConditions.condition_id)
            .where(AnalysisConditions.analysis_id.in_(analysis_ids))
            .order_by(AnalysisConditions.analysis_id, Condition.id)
        ).all()
        for (
            analysis_id,
            weight,
            condition_id,
            user_id,
            name,
            description,
        ) in condition_rows:
            conditions_by_analysis[analysis_id].append(
                {
                    "id": condition_id,
                    "user": user_id,
                    "name": name,
                    "description": description,
                }
            )
            weights_by_analysis[analysis_id].append(weight)

    for (
        analysis_id,
        study_id,
        user_id,
        name,
        metadata,
        description,
        _order,
    ) in analysis_rows:
        analyses_by_study[study_id].append(
            {
                "id": analysis_id,
                "user": user_id,
                "name": name,
                "metadata": metadata,
                "description": description,
                "conditions": conditions_by_analysis.get(analysis_id, []),
                "weights": weights_by_analysis.get(analysis_id, []),
                "points": points_by_analysis.get(analysis_id, []),
                "images": images_by_analysis.get(analysis_id, []),
            }
        )

    studyset_studies = []
    studies_payload = []
    for (
        study_id,
        curation_stub_uuid,
        record_id,
        created_at,
        updated_at,
        user_id,
        name,
        description,
        publication,
        doi,
        pmid,
        authors,
        year,
        metadata,
        source,
        source_id,
        source_updated_at,
    ) in study_rows:
        studyset_studies.append(
            {"id": study_id, "curation_stub_uuid": curation_stub_uuid}
        )
        studies_payload.append(
            {
                "id": record_id,
                "created_at": _serialize_dt(created_at),
                "updated_at": _serialize_dt(updated_at),
                "user": user_id,
                "name": name,
                "description": description,
                "publication": publication,
                "doi": doi,
                "pmid": pmid,
                "authors": authors,
                "year": year,
                "metadata": metadata,
                "source": source,
                "source_id": source_id,
                "source_updated_at": _serialize_dt(source_updated_at),
                "analyses": analyses_by_study.get(study_id, []),
            }
        )

    return {
        "id": studyset_row.id,
        "name": studyset_row.name,
        "user": studyset_row.user_id,
        "description": studyset_row.description,
        "publication": studyset_row.publication,
        "doi": studyset_row.doi,
        "pmid": studyset_row.pmid,
        "created_at": _serialize_dt(studyset_row.created_at),
        "updated_at": _serialize_dt(studyset_row.updated_at),
        "studies": studies_payload,
        "studyset_studies": studyset_studies,
    }


def serialize_studyset_summary(record):
    study_rows = db.session.execute(
        sa.select(
            StudysetStudy.study_id,
            StudysetStudy.curation_stub_uuid,
            Study.name,
            Study.authors,
            Study.publication,
            Study.pmid,
            Study.doi,
            Study.year,
        )
        .select_from(StudysetStudy)
        .join(Study, Study.id == StudysetStudy.study_id)
        .where(StudysetStudy.studyset_id == record.id)
        .order_by(
            sa.func.lower(sa.func.coalesce(Study.name, "")),
            StudysetStudy.study_id,
        )
    ).all()

    study_ids = [row.study_id for row in study_rows]
    if study_ids:
        analysis_rows = db.session.execute(
            sa.select(
                Analysis.study_id,
                Analysis.id,
                Analysis.point_count,
            )
            .select_from(Analysis)
            .where(Analysis.study_id.in_(study_ids))
            .order_by(Analysis.study_id, Analysis.id)
        ).all()
    else:
        analysis_rows = []

    analyses_by_study = {}
    for row in analysis_rows:
        analyses_by_study.setdefault(row.study_id, []).append(
            {"id": row.id, "point_count": int(row.point_count or 0)}
        )

    studies_payload = []
    for row in study_rows:
        studies_payload.append(
            {
                "id": row.study_id,
                "name": row.name,
                "authors": row.authors,
                "publication": row.publication,
                "pmid": row.pmid,
                "doi": row.doi,
                "year": row.year,
                "analyses": analyses_by_study.get(row.study_id, []),
            }
        )

    studyset_studies = sorted(
        [
            {"id": row.study_id, "curation_stub_uuid": row.curation_stub_uuid}
            for row in study_rows
        ],
        key=lambda assoc: assoc["id"] or "",
    )

    return {
        "id": record.id,
        "name": record.name,
        "user": record.user_id,
        "description": record.description,
        "publication": record.publication,
        "doi": record.doi,
        "pmid": record.pmid,
        "created_at": _serialize_dt(record.created_at),
        "updated_at": _serialize_dt(record.updated_at),
        "studies": studies_payload,
        "studyset_studies": studyset_studies,
    }
