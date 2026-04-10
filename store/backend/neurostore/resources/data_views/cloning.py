from __future__ import annotations

from copy import deepcopy

from neurostore.database import db
from neurostore.exceptions.utils.error_helpers import abort_not_found
from neurostore.models import (
    Analysis,
    AnalysisConditions,
    Annotation,
    AnnotationAnalysis,
    Point,
    Study,
    Studyset,
)
from sqlalchemy.orm import raiseload, selectinload


def resolve_neurostore_origin(record):
    source_id = record.id
    parent_source_id = record.source_id
    parent_source = getattr(record, "source", None)
    model_cls = type(record)

    invalid_source_chain = False
    while parent_source_id is not None and parent_source == "neurostore":
        parent = model_cls.query.filter_by(id=parent_source_id).first()
        if parent is None:
            invalid_source_chain = True
            break
        source_id = parent_source_id
        parent_source_id = parent.source_id
        parent_source = getattr(parent, "source", None)

    if invalid_source_chain:
        return None
    return source_id


def _clone_image_payload(image):
    return {
        "url": image.url,
        "filename": image.filename,
        "space": image.space,
        "value_type": image.value_type,
        "add_date": image.add_date,
    }


def _clone_point_payload(point):
    return {
        "x": point.x,
        "y": point.y,
        "z": point.z,
        "space": point.space,
        "kind": point.kind,
        "image": point.image,
        "label_id": point.label_id,
        "cluster_size": point.cluster_size,
        "cluster_measurement_unit": point.cluster_measurement_unit,
        "subpeak": point.subpeak,
        "deactivation": point.deactivation,
        "is_seed": point.is_seed,
        "order": point.order,
        "values": [
            {
                "kind": point_value.kind,
                "value": point_value.value,
            }
            for point_value in point.values
        ],
    }


def _clone_analysis_condition_payload(analysis_condition):
    return {
        "weight": analysis_condition.weight,
        "condition": {"id": analysis_condition.condition_id},
    }


def _normalize_link_reference(value):
    if isinstance(value, str):
        return {"id": value}
    if isinstance(value, dict) and value.get("id"):
        return {"id": value["id"]}
    return value


def _sorted_analyses(analyses):
    return sorted(
        analyses,
        key=lambda analysis: (
            analysis.order is None,
            analysis.order if analysis.order is not None else 0,
            analysis.id or "",
        ),
    )


def _sorted_points(points):
    return sorted(
        points,
        key=lambda point: (
            point.order is None,
            point.order if point.order is not None else 0,
            point.id or "",
        ),
    )


def _sorted_annotation_notes(annotation_analyses):
    def _sort_key(note):
        analysis = getattr(note, "analysis", None)
        order = getattr(analysis, "order", None)
        if isinstance(order, bool) or not isinstance(order, int):
            order = None

        study_id = note.study_id or ""
        if order is not None:
            return (study_id, 0, order, note.analysis_id or "")

        created_at = getattr(analysis, "created_at", None) or getattr(
            note, "created_at", None
        )
        created_ts = created_at.timestamp() if created_at else 0
        return (study_id, 1, created_ts, note.analysis_id or "")

    return sorted(annotation_analyses, key=_sort_key)


def build_studyset_clone_payload(source_record, override_data=None):
    payload = {
        "name": source_record.name,
        "description": source_record.description,
        "publication": source_record.publication,
        "doi": source_record.doi,
        "pmid": source_record.pmid,
        "authors": source_record.authors,
        "metadata_": (
            deepcopy(source_record.metadata_)
            if source_record.metadata_ is not None
            else None
        ),
        "public": source_record.public,
        "studies": [{"id": study.id} for study in source_record.studies],
        "source": "neurostore",
        "source_id": resolve_neurostore_origin(source_record),
        "source_updated_at": source_record.updated_at or source_record.created_at,
    }
    if payload.get("metadata_") is None:
        payload.pop("metadata_", None)
    if override_data:
        payload.update(override_data)
    return payload


def clone_annotations_to_studyset(source_record, cloned_record):
    if not source_record.annotations:
        return

    owner_id = cloned_record.user_id

    for annotation in source_record.annotations:
        clone_annotation = Annotation(
            name=annotation.name,
            description=annotation.description,
            source="neurostore",
            source_id=resolve_neurostore_origin(annotation),
            source_updated_at=annotation.updated_at or annotation.created_at,
            user_id=owner_id,
            metadata_=deepcopy(annotation.metadata_) if annotation.metadata_ else None,
            public=annotation.public,
            note_keys=deepcopy(annotation.note_keys) if annotation.note_keys else {},
        )
        clone_annotation.studyset = cloned_record
        db.session.add(clone_annotation)
        db.session.flush()

        analyses_to_create = [
            AnnotationAnalysis(
                annotation_id=clone_annotation.id,
                analysis_id=annotation_analysis.analysis_id,
                note=(
                    deepcopy(annotation_analysis.note)
                    if annotation_analysis.note
                    else {}
                ),
                user_id=owner_id,
                study_id=annotation_analysis.study_id,
                studyset_id=cloned_record.id,
            )
            for annotation_analysis in annotation.annotation_analyses
        ]
        if analyses_to_create:
            db.session.add_all(analyses_to_create)


def build_annotation_clone_payload(annotation, override_data=None):
    payload = {
        "studyset": {"id": annotation.studyset_id},
        "annotation_analyses": [
            {
                "analysis": {"id": note.analysis_id},
                "studyset_study": {
                    "study": {"id": note.study_id},
                    "studyset": {"id": note.studyset_id},
                },
                "note": deepcopy(note.note) if note.note else {},
            }
            for note in _sorted_annotation_notes(annotation.annotation_analyses)
        ],
        "name": annotation.name,
        "description": annotation.description,
        "metadata_": deepcopy(annotation.metadata_) if annotation.metadata_ else None,
        "note_keys": deepcopy(annotation.note_keys) if annotation.note_keys else {},
        "source": "neurostore",
        "source_id": resolve_neurostore_origin(annotation),
        "source_updated_at": annotation.updated_at or annotation.created_at,
    }
    if payload.get("metadata_") is None:
        payload.pop("metadata_", None)
    if override_data:
        payload.update(override_data)
    payload["studyset"] = _normalize_link_reference(payload.get("studyset"))
    for note in payload.get("annotation_analyses") or []:
        if isinstance(note, dict):
            note.pop("id", None)
            note["analysis"] = _normalize_link_reference(note.get("analysis"))
    return payload


def _clone_analysis_payload(analysis):
    return {
        "metadata_": deepcopy(analysis.metadata_) if analysis.metadata_ else None,
        "order": analysis.order,
        "analysis_conditions": [
            _clone_analysis_condition_payload(analysis_condition)
            for analysis_condition in analysis.analysis_conditions
        ],
        "images": [_clone_image_payload(image) for image in analysis.images],
        "points": [
            _clone_point_payload(point) for point in _sorted_points(analysis.points)
        ],
        "name": analysis.name,
        "description": analysis.description,
    }


def _normalize_analysis_clone_payload(payload):
    if not isinstance(payload, dict):
        return payload

    normalized = dict(payload)
    normalized.pop("id", None)
    normalized.pop("study_id", None)
    normalized.pop("table_id", None)
    if normalized.get("table"):
        normalized["table"] = _normalize_link_reference(normalized.get("table"))

    normalized_conditions = []
    for analysis_condition in normalized.get("analysis_conditions") or []:
        if not isinstance(analysis_condition, dict):
            normalized_conditions.append(analysis_condition)
            continue
        normalized_condition = dict(analysis_condition)
        normalized_condition["condition"] = _normalize_link_reference(
            normalized_condition.get("condition")
        )
        normalized_conditions.append(normalized_condition)
    if normalized_conditions:
        normalized["analysis_conditions"] = normalized_conditions

    normalized_images = []
    for image in normalized.get("images") or []:
        if not isinstance(image, dict):
            normalized_images.append(image)
            continue
        normalized_image = dict(image)
        normalized_image.pop("id", None)
        normalized_image.pop("analysis_id", None)
        normalized_images.append(normalized_image)
    if normalized_images:
        normalized["images"] = normalized_images

    normalized_points = []
    for point in normalized.get("points") or []:
        if not isinstance(point, dict):
            normalized_points.append(point)
            continue
        normalized_point = dict(point)
        normalized_point.pop("id", None)
        normalized_point.pop("analysis_id", None)
        normalized_points.append(normalized_point)
    if normalized_points:
        normalized["points"] = normalized_points

    return normalized


def build_study_clone_payload(study, override_data=None):
    payload = {
        "metadata_": deepcopy(study.metadata_) if study.metadata_ else None,
        "name": study.name,
        "description": study.description,
        "publication": study.publication,
        "doi": study.doi,
        "pmid": study.pmid,
        "pmcid": study.pmcid,
        "authors": study.authors,
        "year": study.year,
        "level": study.level,
        "analyses": [
            _clone_analysis_payload(analysis)
            for analysis in _sorted_analyses(study.analyses)
        ],
        "source": "neurostore",
        "source_id": resolve_neurostore_origin(study),
        "source_updated_at": study.updated_at or study.created_at,
    }

    payload.pop("id", None)
    payload.pop("base_study_id", None)
    if study.base_study_id:
        payload["base_study"] = {"id": study.base_study_id}
    if payload.get("metadata_") is None:
        payload.pop("metadata_", None)
    if override_data:
        payload.update(override_data)
    payload["base_study"] = _normalize_link_reference(payload.get("base_study"))
    payload["analyses"] = [
        _normalize_analysis_clone_payload(analysis)
        for analysis in payload.get("analyses") or []
    ]
    return payload


def load_studyset_clone_source(studyset_id):
    source_record = (
        Studyset.query.filter_by(id=studyset_id)
        .options(
            selectinload(Studyset.studies),
            selectinload(Studyset.annotations).options(
                selectinload(Annotation.annotation_analyses)
            ),
        )
        .first()
    )
    if source_record is None:
        abort_not_found(Studyset.__name__, studyset_id)
    return source_record


def load_study_clone_source(study_id, eager_load=None):
    study = (
        Study.query.filter_by(id=study_id)
        .options(
            raiseload("*", sql_only=True),
            selectinload(Study.analyses).options(
                raiseload("*", sql_only=True),
                selectinload(Analysis.analysis_conditions).options(
                    raiseload("*", sql_only=True),
                    selectinload(AnalysisConditions.condition).options(
                        raiseload("*", sql_only=True)
                    ),
                ),
                selectinload(Analysis.images).options(raiseload("*", sql_only=True)),
                selectinload(Analysis.points).options(
                    raiseload("*", sql_only=True),
                    selectinload(Point.values).options(raiseload("*", sql_only=True)),
                ),
            ),
        )
        .first()
    )
    if study is None:
        abort_not_found(Study.__name__, study_id)
    return study


def load_annotation_clone_source(annotation_id, join_tables):
    annotation = join_tables(Annotation.query.filter_by(id=annotation_id), {}).first()
    if annotation is None:
        abort_not_found(Annotation.__name__, annotation_id)
    return annotation
