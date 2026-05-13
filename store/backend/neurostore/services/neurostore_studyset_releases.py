from __future__ import annotations

import hashlib
import os
import re
import tarfile
import tempfile
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path

import orjson
import sqlalchemy as sa
from flask import current_app
from sqlalchemy.orm import load_only, selectinload

from neurostore.database import db
from neurostore.models import (
    Analysis,
    AnalysisConditions,
    Annotation,
    AnnotationAnalysis,
    BaseStudy,
    Condition,
    Image,
    Pipeline,
    PipelineConfig,
    PipelineStudyResult,
    Point,
    PointValue,
    Study,
    Studyset,
    StudysetStudy,
)
from neurostore.map_types import map_type_label
from neurostore.models.data import generate_id
from neurostore.schemas.pipeline import PipelineStudyResultSchema

STUDYSET_SOURCE_ID = "neurostore-studyset"
ANNOTATION_SOURCE_ID = "neurostore-annotation"
RELEASE_DIRNAME = "neurostore-studyset-releases"
NIGHTLY_VERSION = "nightly"
LATEST_VERSION = "latest"
FEATURE_PIPELINES = ("ParticipantDemographicsExtractor", "TaskInfoExtractor")
LOCK_KEY = "neurostore-studyset-release-build"
MONTHLY_VERSION_RE = re.compile(r"^\d{4}-\d{2}$")
STUDY_SHARD_BATCH_SIZE = 500


def utcnow():
    return datetime.now(timezone.utc)


def serialize_dt(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def release_root():
    configured = os.environ.get("NEUROSTORE_STUDYSET_RELEASE_DIR")
    if configured:
        return Path(configured)
    return Path(current_app.config["FILE_DIR"]) / RELEASE_DIRNAME


def stable_json_bytes(value):
    return orjson.dumps(value, option=orjson.OPT_SORT_KEYS)


def checksum_payload(value):
    return hashlib.sha256(stable_json_bytes(value)).hexdigest()


def read_json(path, default=None):
    if not path.exists():
        return default
    with path.open("rb") as f:
        return orjson.loads(f.read())


def atomic_write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = orjson.dumps(payload, option=orjson.OPT_INDENT_2 | orjson.OPT_SORT_KEYS)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as tmp:
        tmp.write(data)
        tmp_path = Path(tmp.name)
    os.replace(tmp_path, path)


def detect_note_type(value):
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return "number"
    return "string"


def normalize_feature_value(value):
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    return orjson.dumps(value, option=orjson.OPT_SORT_KEYS).decode("utf-8")


def flatten_features(pipeline_name, result_data):
    if not isinstance(result_data, dict):
        return {}

    flattened = PipelineStudyResultSchema.flatten_dict(result_data)
    normalized = OrderedDict()
    for key in sorted(flattened):
        normalized[f"{pipeline_name}.{key}"] = normalize_feature_value(flattened[key])
    return normalized


def acquire_build_lock():
    locked = db.session.scalar(
        sa.text("SELECT pg_try_advisory_xact_lock(hashtext(:lock_key))"),
        {"lock_key": LOCK_KEY},
    )
    return bool(locked)


def select_coordinate_studies():
    freshness = sa.func.greatest(
        sa.func.coalesce(Study.updated_at, Study.created_at),
        Study.created_at,
    )
    ranked = (
        sa.select(
            BaseStudy.id.label("base_study_id"),
            Study.id.label("study_id"),
            Study.created_at.label("study_created_at"),
            Study.updated_at.label("study_updated_at"),
            freshness.label("freshness"),
            sa.func.row_number()
            .over(
                partition_by=Study.base_study_id,
                order_by=(freshness.desc(), Study.id.desc()),
            )
            .label("rank"),
        )
        .select_from(BaseStudy)
        .join(Study, Study.base_study_id == BaseStudy.id)
        .where(BaseStudy.is_active.is_(True))
        .where(BaseStudy.has_coordinates.is_(True))
        .where(Study.public.is_(True))
        .where(Study.has_coordinates.is_(True))
        .where(Study.level == "group")
        .subquery()
    )

    rows = db.session.execute(
        sa.select(
            ranked.c.base_study_id,
            ranked.c.study_id,
            ranked.c.study_created_at,
            ranked.c.study_updated_at,
            ranked.c.freshness,
        )
        .where(ranked.c.rank == 1)
        .order_by(ranked.c.study_id)
    ).all()
    return [
        {
            "base_study_id": row.base_study_id,
            "study_id": row.study_id,
            "created_at": serialize_dt(row.study_created_at),
            "updated_at": serialize_dt(row.study_updated_at),
            "freshness": serialize_dt(row.freshness),
        }
        for row in rows
    ]


def ensure_canonical_records(built_at):
    studyset = Studyset.query.filter_by(source_id=STUDYSET_SOURCE_ID).first()
    if studyset is None:
        studyset = Studyset(
            id=generate_id(),
            name=STUDYSET_SOURCE_ID,
            source="neurostore",
            source_id=STUDYSET_SOURCE_ID,
            public=True,
        )
        db.session.add(studyset)

    studyset.name = STUDYSET_SOURCE_ID
    studyset.source = "neurostore"
    studyset.source_id = STUDYSET_SOURCE_ID
    studyset.source_updated_at = built_at
    studyset.public = True
    studyset.description = (
        "Database-wide NeuroStore coordinate studyset generated from the latest "
        "coordinate-bearing study for each active base study."
    )
    studyset.metadata_ = {
        "release": STUDYSET_SOURCE_ID,
        "built_at": serialize_dt(built_at),
    }

    annotation = Annotation.query.filter_by(source_id=ANNOTATION_SOURCE_ID).first()
    if annotation is None:
        annotation = Annotation(
            id=generate_id(),
            name=ANNOTATION_SOURCE_ID,
            source="neurostore",
            source_id=ANNOTATION_SOURCE_ID,
            public=True,
            studyset=studyset,
            note_keys={},
        )
        db.session.add(annotation)

    annotation.name = ANNOTATION_SOURCE_ID
    annotation.source = "neurostore"
    annotation.source_id = ANNOTATION_SOURCE_ID
    annotation.source_updated_at = built_at
    annotation.public = True
    annotation.studyset = studyset
    annotation.description = (
        "Database-wide NeuroStore annotation generated from demographic and task "
        "feature extraction results."
    )
    annotation.metadata_ = {
        "release": ANNOTATION_SOURCE_ID,
        "built_at": serialize_dt(built_at),
        "feature_pipelines": list(FEATURE_PIPELINES),
    }
    db.session.flush()
    return studyset, annotation


def sync_studyset_membership(studyset, selected):
    selected_ids = {entry["study_id"] for entry in selected}
    existing_ids = set(
        db.session.scalars(
            sa.select(StudysetStudy.study_id).where(
                StudysetStudy.studyset_id == studyset.id
            )
        )
    )
    stale_ids = existing_ids - selected_ids
    missing_ids = selected_ids - existing_ids

    if stale_ids:
        db.session.execute(
            sa.delete(StudysetStudy)
            .where(StudysetStudy.studyset_id == studyset.id)
            .where(StudysetStudy.study_id.in_(stale_ids))
        )

    if missing_ids:
        db.session.execute(
            sa.insert(StudysetStudy),
            [
                {"studyset_id": studyset.id, "study_id": study_id}
                for study_id in sorted(missing_ids)
            ],
        )


def fetch_latest_feature_payloads(base_study_ids):
    if not base_study_ids:
        return {}

    result_ts = sa.func.coalesce(
        PipelineStudyResult.date_executed,
        PipelineStudyResult.created_at,
    )
    ranked = (
        sa.select(
            PipelineStudyResult.id.label("result_id"),
            PipelineStudyResult.base_study_id,
            PipelineStudyResult.result_data,
            result_ts.label("result_timestamp"),
            Pipeline.name.label("pipeline_name"),
            PipelineConfig.version.label("pipeline_version"),
            sa.func.row_number()
            .over(
                partition_by=(
                    PipelineStudyResult.base_study_id,
                    Pipeline.name,
                ),
                order_by=(result_ts.desc(), PipelineStudyResult.id.desc()),
            )
            .label("rank"),
        )
        .select_from(PipelineStudyResult)
        .join(PipelineConfig, PipelineStudyResult.config_id == PipelineConfig.id)
        .join(Pipeline, PipelineConfig.pipeline_id == Pipeline.id)
        .where(PipelineStudyResult.base_study_id.in_(base_study_ids))
        .where(Pipeline.name.in_(FEATURE_PIPELINES))
        .where(PipelineStudyResult.status == "SUCCESS")
        .subquery()
    )

    rows = db.session.execute(sa.select(ranked).where(ranked.c.rank == 1)).all()
    by_base = {}
    for row in rows:
        result = row._mapping
        base_id = result["base_study_id"]
        pipeline_name = result["pipeline_name"]
        result_data = result["result_data"] or {}
        by_base.setdefault(base_id, {})[pipeline_name] = {
            "result_id": result["result_id"],
            "result_timestamp": serialize_dt(result["result_timestamp"]),
            "pipeline_version": result["pipeline_version"],
            "features": flatten_features(pipeline_name, result_data),
            "checksum": checksum_payload(result_data),
        }
    return by_base


def build_note_keys(features_by_base):
    types_by_key = OrderedDict()
    for base_id in sorted(features_by_base):
        for pipeline_name in FEATURE_PIPELINES:
            entry = features_by_base.get(base_id, {}).get(pipeline_name)
            if not entry:
                continue
            for key, value in entry["features"].items():
                detected = detect_note_type(value)
                existing = types_by_key.get(key)
                if existing is None:
                    types_by_key[key] = detected
                elif existing != detected:
                    types_by_key[key] = "string"

    return OrderedDict(
        (
            key,
            {"type": types_by_key[key], "order": index},
        )
        for index, key in enumerate(types_by_key)
    )


def note_for_base(base_id, features_by_base, note_keys):
    note = OrderedDict((key, None) for key in note_keys)
    for pipeline_name in FEATURE_PIPELINES:
        entry = features_by_base.get(base_id, {}).get(pipeline_name)
        if entry:
            note.update(entry["features"])
    return note


def fetch_analysis_rows(study_ids):
    if not study_ids:
        return {}

    rows = db.session.execute(
        sa.select(
            Analysis.id.label("analysis_id"),
            Analysis.study_id,
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

    by_study = {}
    for row in rows:
        by_study.setdefault(row.study_id, []).append(dict(row._mapping))
    return by_study


def manifest_entry_changed(entry, features_by_base, previous_entries):
    manifest_entry = build_manifest_entry(entry, features_by_base)
    previous_entry = previous_entries.get(entry["base_study_id"])
    state_changed = previous_entry is None or {
        key: previous_entry.get(key)
        for key in (
            "study_id",
            "created_at",
            "updated_at",
            "study_freshness",
            "features",
        )
    } != {
        key: manifest_entry.get(key)
        for key in (
            "study_id",
            "created_at",
            "updated_at",
            "study_freshness",
            "features",
        )
    }
    return manifest_entry, state_changed


def sync_annotation(annotation, selected, features_by_base, previous_manifest):
    note_keys = build_note_keys(features_by_base)
    annotation.note_keys = note_keys

    study_to_base = {entry["study_id"]: entry["base_study_id"] for entry in selected}
    analysis_rows_by_study = fetch_analysis_rows(study_to_base.keys())
    all_analysis_ids = {
        row["analysis_id"] for rows in analysis_rows_by_study.values() for row in rows
    }

    existing = {
        analysis_id
        for (analysis_id,) in db.session.execute(
            sa.select(AnnotationAnalysis.analysis_id).where(
                AnnotationAnalysis.annotation_id == annotation.id
            )
        )
    }

    stale_existing = existing - all_analysis_ids
    if stale_existing:
        db.session.execute(
            sa.delete(AnnotationAnalysis)
            .where(AnnotationAnalysis.annotation_id == annotation.id)
            .where(AnnotationAnalysis.analysis_id.in_(stale_existing))
        )

    previous_entries = previous_manifest.get("studies", {})
    previous_note_keys_checksum = previous_manifest.get("note_keys_checksum")
    note_keys_changed = previous_note_keys_checksum != checksum_payload(note_keys)
    affected_base_ids = set()
    for entry in selected:
        _manifest_entry, state_changed = manifest_entry_changed(
            entry,
            features_by_base,
            previous_entries,
        )
        if note_keys_changed or state_changed:
            affected_base_ids.add(entry["base_study_id"])

    mappings_to_insert = []
    mappings_to_update = []
    for study_id, rows in analysis_rows_by_study.items():
        base_id = study_to_base[study_id]
        note = note_for_base(base_id, features_by_base, note_keys)
        for row in rows:
            analysis_id = row["analysis_id"]
            row_exists = analysis_id in existing
            if row_exists and base_id not in affected_base_ids:
                continue
            mapping = {
                "annotation_id": annotation.id,
                "analysis_id": analysis_id,
                "study_id": study_id,
                "studyset_id": annotation.studyset_id,
                "note": note,
                "user_id": annotation.user_id,
            }
            if row_exists:
                mappings_to_update.append(mapping)
            else:
                mappings_to_insert.append(mapping)

    if mappings_to_insert:
        db.session.execute(sa.insert(AnnotationAnalysis), mappings_to_insert)
    if mappings_to_update:
        db.session.bulk_update_mappings(AnnotationAnalysis, mappings_to_update)

    return note_keys, analysis_rows_by_study


def order_sort_key(value, fallback_id):
    return (
        value is None,
        value if value is not None else 0,
        fallback_id or "",
    )


def serialize_condition_for_nimads(analysis_condition):
    condition = analysis_condition.condition
    if condition is None:
        return None
    return OrderedDict(
        (
            ("name", condition.name),
            ("description", condition.description),
        )
    )


def serialize_point_for_nimads(point):
    return OrderedDict(
        (
            ("coordinates", [point.x, point.y, point.z]),
            ("space", point.space),
            ("kind", point.kind),
            ("label_id", point.label_id),
            ("image", point.image),
            (
                "values",
                [
                    OrderedDict((("kind", value.kind), ("value", value.value)))
                    for value in point.values
                ],
            ),
            ("analysis", point.analysis_id),
            ("cluster_size", point.cluster_size),
            ("cluster_measurement_unit", point.cluster_measurement_unit),
            ("subpeak", point.subpeak),
            ("deactivation", point.deactivation),
            ("is_seed", point.is_seed),
        )
    )


def serialize_image_for_nimads(image):
    return OrderedDict(
        (
            ("metadata", image.data),
            ("url", image.url),
            ("filename", image.filename),
            ("space", image.space),
            ("value_type", map_type_label(image.value_type)),
            ("add_date", serialize_dt(image.add_date)),
            ("analysis", image.analysis_id),
        )
    )


def serialize_analysis_for_nimads(analysis):
    analysis_conditions = sorted(
        analysis.analysis_conditions,
        key=lambda analysis_condition: order_sort_key(
            None,
            getattr(getattr(analysis_condition, "condition", None), "id", None),
        ),
    )
    conditions = [
        serialize_condition_for_nimads(analysis_condition)
        for analysis_condition in analysis_conditions
        if analysis_condition.condition is not None
    ]
    return OrderedDict(
        (
            ("name", analysis.name),
            ("description", analysis.description),
            (
                "weights",
                [
                    analysis_condition.weight
                    for analysis_condition in analysis_conditions
                ],
            ),
            ("conditions", conditions),
            (
                "images",
                [
                    serialize_image_for_nimads(image)
                    for image in sorted(
                        analysis.images,
                        key=lambda image: image.id or "",
                    )
                ],
            ),
            (
                "points",
                [
                    serialize_point_for_nimads(point)
                    for point in sorted(
                        analysis.points,
                        key=lambda point: order_sort_key(point.order, point.id),
                    )
                ],
            ),
            ("study", analysis.study_id),
            ("table_id", analysis.table_id),
            ("metadata", analysis.metadata_),
        )
    )


def serialize_study_for_nimads(study):
    return OrderedDict(
        (
            ("doi", study.doi),
            ("name", study.name),
            ("metadata", study.metadata_),
            ("description", study.description),
            ("publication", study.publication),
            ("pmid", study.pmid),
            ("authors", study.authors),
            ("year", study.year),
            ("pmcid", study.pmcid),
            (
                "analyses",
                [
                    serialize_analysis_for_nimads(analysis)
                    for analysis in sorted(
                        study.analyses,
                        key=lambda analysis: order_sort_key(
                            analysis.order,
                            analysis.id,
                        ),
                    )
                ],
            ),
        )
    )


def serialize_study_shard(study_id):
    study = (
        Study.query.filter_by(id=study_id).options(*study_shard_loader_options()).one()
    )
    return serialize_study_for_nimads(study)


def study_shard_loader_options():
    return (
        load_only(
            Study.id,
            Study.name,
            Study.description,
            Study.publication,
            Study.doi,
            Study.pmid,
            Study.pmcid,
            Study.authors,
            Study.year,
            Study.metadata_,
        ),
        selectinload(Study.analyses).options(
            load_only(
                Analysis.id,
                Analysis.study_id,
                Analysis.table_id,
                Analysis.name,
                Analysis.description,
                Analysis.metadata_,
                Analysis.order,
            ),
            selectinload(Analysis.images).options(
                load_only(
                    Image.id,
                    Image.analysis_id,
                    Image.url,
                    Image.filename,
                    Image.space,
                    Image.value_type,
                    Image.data,
                    Image.add_date,
                )
            ),
            selectinload(Analysis.points).options(
                load_only(
                    Point.id,
                    Point.analysis_id,
                    Point.x,
                    Point.y,
                    Point.z,
                    Point.space,
                    Point.kind,
                    Point.image,
                    Point.label_id,
                    Point.cluster_size,
                    Point.cluster_measurement_unit,
                    Point.subpeak,
                    Point.deactivation,
                    Point.is_seed,
                    Point.order,
                ),
                selectinload(Point.values).options(
                    load_only(PointValue.kind, PointValue.value)
                ),
            ),
            selectinload(Analysis.analysis_conditions).options(
                load_only(
                    AnalysisConditions.weight,
                    AnalysisConditions.analysis_id,
                    AnalysisConditions.condition_id,
                ),
                selectinload(AnalysisConditions.condition).options(
                    load_only(
                        Condition.id,
                        Condition.name,
                        Condition.description,
                    )
                ),
            ),
        ),
    )


def chunked(values, size):
    for index in range(0, len(values), size):
        yield values[index:index + size]


def serialize_study_shards(study_ids, batch_size=STUDY_SHARD_BATCH_SIZE):
    payloads = {}
    ordered_study_ids = list(dict.fromkeys(study_ids))
    for batch in chunked(ordered_study_ids, batch_size):
        studies = (
            Study.query.filter(Study.id.in_(batch))
            .options(*study_shard_loader_options())
            .all()
        )
        for study in studies:
            payloads[study.id] = serialize_study_for_nimads(study)

    missing_ids = set(ordered_study_ids) - set(payloads)
    if missing_ids:
        raise LookupError(
            "Could not serialize missing studies: " + ", ".join(sorted(missing_ids))
        )
    return payloads


def build_note_shard(
    annotation_id, study_id, base_id, rows, features_by_base, note_keys
):
    note = note_for_base(base_id, features_by_base, note_keys)
    notes = []
    for row in rows:
        notes.append(
            {
                "id": f"{annotation_id}_{row['analysis_id']}",
                "analysis": row["analysis_id"],
                "note": note,
            }
        )
    return notes


def build_note_shards(
    annotation_id,
    entries,
    analysis_rows_by_study,
    features_by_base,
    note_keys,
):
    return {
        entry["base_study_id"]: build_note_shard(
            annotation_id,
            entry["study_id"],
            entry["base_study_id"],
            analysis_rows_by_study.get(entry["study_id"], []),
            features_by_base,
            note_keys,
        )
        for entry in entries
    }


def previous_nightly_manifest(root):
    return read_json(root / NIGHTLY_VERSION / "manifest.json", default={}) or {}


def build_manifest_entry(entry, features_by_base):
    base_id = entry["base_study_id"]
    feature_entries = {}
    for pipeline_name in FEATURE_PIPELINES:
        feature = features_by_base.get(base_id, {}).get(pipeline_name)
        if not feature:
            continue
        feature_entries[pipeline_name] = {
            "result_id": feature["result_id"],
            "result_timestamp": feature["result_timestamp"],
            "pipeline_version": feature["pipeline_version"],
            "checksum": feature["checksum"],
        }
    return {
        "id": entry["study_id"],
        "base_study_id": base_id,
        "study_id": entry["study_id"],
        "created_at": entry["created_at"],
        "updated_at": entry["updated_at"],
        "study_freshness": entry["freshness"],
        "features": feature_entries,
    }


def refresh_shards(
    root,
    selected,
    features_by_base,
    annotation,
    note_keys,
    analysis_rows_by_study,
    previous_manifest,
):
    study_shard_dir = root / "_cache" / "studies"
    note_shard_dir = root / "_cache" / "notes"
    selected_base_ids = {entry["base_study_id"] for entry in selected}
    selected_study_ids = {entry["study_id"] for entry in selected}
    previous_entries = previous_manifest.get("studies", {})
    previous_note_keys_checksum = previous_manifest.get("note_keys_checksum")
    note_keys_checksum = checksum_payload(note_keys)

    changed_base_ids = []
    removed_base_ids = sorted(set(previous_entries) - selected_base_ids)

    for stale_base_id in removed_base_ids:
        stale_entry = previous_entries.get(stale_base_id) or {}
        stale_study_id = stale_entry.get("study_id")
        if stale_study_id:
            (study_shard_dir / f"{stale_study_id}.json").unlink(missing_ok=True)
        (note_shard_dir / f"{stale_base_id}.json").unlink(missing_ok=True)

    entries_by_base = {entry["base_study_id"]: entry for entry in selected}
    manifest_studies = OrderedDict()
    study_entries_to_refresh = []
    note_entries_to_refresh = []
    pending_entries = []

    for entry in selected:
        base_id = entry["base_study_id"]
        study_id = entry["study_id"]
        manifest_entry, state_changed = manifest_entry_changed(
            entry,
            features_by_base,
            previous_entries,
        )
        previous_entry = previous_entries.get(base_id)

        study_shard_path = study_shard_dir / f"{study_id}.json"
        note_shard_path = note_shard_dir / f"{base_id}.json"
        if state_changed or not study_shard_path.exists():
            study_entries_to_refresh.append(entry)
        else:
            manifest_entry["study_checksum"] = previous_entry.get("study_checksum")

        notes_need_refresh = (
            state_changed
            or not note_shard_path.exists()
            or previous_note_keys_checksum != note_keys_checksum
        )
        if notes_need_refresh:
            note_entries_to_refresh.append(entry)
        else:
            manifest_entry["note_checksum"] = previous_entry.get("note_checksum")

        if state_changed:
            changed_base_ids.append(base_id)
        pending_entries.append((entry, manifest_entry))

    study_checksums = {}
    if study_entries_to_refresh:
        for batch_entries in chunked(study_entries_to_refresh, STUDY_SHARD_BATCH_SIZE):
            study_payloads = serialize_study_shards(
                [entry["study_id"] for entry in batch_entries],
                batch_size=STUDY_SHARD_BATCH_SIZE,
            )
            for entry in batch_entries:
                study_id = entry["study_id"]
                study_payload = study_payloads[study_id]
                atomic_write_json(
                    study_shard_dir / f"{study_id}.json",
                    study_payload,
                )
                study_checksums[study_id] = checksum_payload(study_payload)

    note_checksums = {}
    if note_entries_to_refresh:
        note_payloads = build_note_shards(
            annotation.id,
            note_entries_to_refresh,
            analysis_rows_by_study,
            features_by_base,
            note_keys,
        )
        for entry in note_entries_to_refresh:
            base_id = entry["base_study_id"]
            note_payload = note_payloads[base_id]
            atomic_write_json(note_shard_dir / f"{base_id}.json", note_payload)
            note_checksums[base_id] = checksum_payload(note_payload)

    for entry, manifest_entry in pending_entries:
        base_id = entry["base_study_id"]
        study_id = entry["study_id"]
        if manifest_entry.get("study_checksum") is None:
            manifest_entry["study_checksum"] = study_checksums[study_id]
        if manifest_entry.get("note_checksum") is None:
            manifest_entry["note_checksum"] = note_checksums[base_id]
        manifest_studies[base_id] = manifest_entry

    for path in study_shard_dir.glob("*.json"):
        if path.stem not in selected_study_ids:
            path.unlink(missing_ok=True)
    for path in note_shard_dir.glob("*.json"):
        if path.stem not in entries_by_base:
            path.unlink(missing_ok=True)

    return (
        manifest_studies,
        sorted(changed_base_ids),
        removed_base_ids,
        note_keys_checksum,
    )


def studyset_payload_header(studyset):
    return OrderedDict(
        (
            ("name", studyset.name),
            ("description", studyset.description),
            ("publication", studyset.publication),
            ("doi", studyset.doi),
            ("pmid", studyset.pmid),
        )
    )


def annotation_payload_header(annotation, note_keys):
    return OrderedDict(
        (
            ("studyset", annotation.studyset_id),
            ("name", annotation.name),
            ("description", annotation.description),
            ("note_keys", note_keys),
            ("metadata", annotation.metadata_),
        )
    )


def write_streamed_json_object(path, scalar_fields, array_writers):
    path.parent.mkdir(parents=True, exist_ok=True)
    checksum = hashlib.sha256()

    def write_and_hash(fileobj, data):
        fileobj.write(data)
        checksum.update(data)

    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as tmp:
        tmp_path = Path(tmp.name)
        write_and_hash(tmp, b"{")
        needs_comma = False
        for key, value in scalar_fields.items():
            if needs_comma:
                write_and_hash(tmp, b",")
            write_and_hash(tmp, orjson.dumps(str(key)))
            write_and_hash(tmp, b":")
            write_and_hash(tmp, orjson.dumps(value, option=orjson.OPT_SORT_KEYS))
            needs_comma = True

        for key, write_array_items in array_writers:
            if needs_comma:
                write_and_hash(tmp, b",")
            write_and_hash(tmp, orjson.dumps(str(key)))
            write_and_hash(tmp, b":[")
            first_item = True

            def write_item(data):
                nonlocal first_item
                if not first_item:
                    write_and_hash(tmp, b",")
                write_and_hash(tmp, data)
                first_item = False

            write_array_items(write_item)
            write_and_hash(tmp, b"]")
            needs_comma = True

        write_and_hash(tmp, b"}")

    os.replace(tmp_path, path)
    return checksum.hexdigest()


def iter_json_list_items(path):
    data = path.read_bytes().strip()
    if data in (b"", b"[]"):
        return
    if not data.startswith(b"[") or not data.endswith(b"]"):
        raise ValueError(f"Expected JSON list shard at {path}")
    inner = data[1:-1].strip()
    if inner:
        yield inner


def write_studyset_payload_file(path, root, selected, studyset):
    def write_studies(write_item):
        for entry in selected:
            shard_path = root / "_cache" / "studies" / f"{entry['study_id']}.json"
            write_item(shard_path.read_bytes().strip())

    return write_streamed_json_object(
        path,
        studyset_payload_header(studyset),
        (("studies", write_studies),),
    )


def write_annotation_payload_file(path, root, selected, annotation, note_keys):
    def write_notes(write_item):
        for entry in selected:
            shard_path = root / "_cache" / "notes" / f"{entry['base_study_id']}.json"
            for item in iter_json_list_items(shard_path):
                write_item(item)

    return write_streamed_json_object(
        path,
        annotation_payload_header(annotation, note_keys),
        (("notes", write_notes),),
    )


def write_tarball(
    release_dir,
    archive_name,
    manifest,
    root,
    selected,
    studyset,
    annotation,
    note_keys,
):
    release_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=release_dir) as staging:
        staging_path = Path(staging)
        folder = staging_path / archive_name.removesuffix(".tar.gz")
        folder.mkdir()
        studyset_checksum = write_studyset_payload_file(
            folder / "neurostore-studyset.json",
            root,
            selected,
            studyset,
        )
        annotation_checksum = write_annotation_payload_file(
            folder / "neurostore-annotation.json",
            root,
            selected,
            annotation,
            note_keys,
        )
        manifest["studyset_checksum"] = studyset_checksum
        manifest["annotation_checksum"] = annotation_checksum
        atomic_write_json(folder / "manifest.json", manifest)

        tmp_archive = release_dir / f".{archive_name}.tmp"
        final_archive = release_dir / archive_name
        with tarfile.open(tmp_archive, "w:gz") as tar:
            tar.add(folder, arcname=folder.name)
        os.replace(tmp_archive, final_archive)

    return release_dir / archive_name


def write_release_files(
    root,
    version,
    release_type,
    manifest,
    selected,
    studyset,
    annotation,
    note_keys,
):
    release_dir = (
        root / NIGHTLY_VERSION
        if release_type == NIGHTLY_VERSION
        else root / "monthly" / version
    )
    archive_name = f"neurostore-studyset-{version}.tar.gz"
    manifest = dict(manifest)
    manifest["version"] = version
    manifest["release_type"] = release_type
    manifest["archive_name"] = archive_name
    manifest["download_path"] = f"/api/neurostore-studyset-releases/{version}/download"
    archive_path = write_tarball(
        release_dir,
        archive_name,
        manifest,
        root,
        selected,
        studyset,
        annotation,
        note_keys,
    )
    manifest["archive_checksum"] = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    atomic_write_json(release_dir / "manifest.json", manifest)
    return manifest


def base_manifest(
    built_at,
    studyset,
    annotation,
    manifest_studies,
    changed,
    removed,
    note_keys,
    note_keys_checksum,
):
    return {
        "built_at": serialize_dt(built_at),
        "studyset": {
            "id": studyset.id,
            "created_at": serialize_dt(studyset.created_at),
            "updated_at": serialize_dt(studyset.updated_at),
            "name": studyset.name,
            "source_id": studyset.source_id,
        },
        "annotation": {
            "id": annotation.id,
            "created_at": serialize_dt(annotation.created_at),
            "updated_at": serialize_dt(annotation.updated_at),
            "name": annotation.name,
            "source_id": annotation.source_id,
        },
        "feature_pipelines": list(FEATURE_PIPELINES),
        "study_count": len(manifest_studies),
        "note_count": sum(
            len(
                read_json(
                    release_root() / "_cache" / "notes" / f"{base_id}.json",
                    [],
                )
            )
            for base_id in manifest_studies
        ),
        "changed_base_study_ids": changed,
        "removed_base_study_ids": removed,
        "note_keys_checksum": note_keys_checksum,
        "note_keys": note_keys,
        "studies": manifest_studies,
    }


def current_month_version(now):
    return now.strftime("%Y-%m")


def validate_monthly_version(version):
    if version is not None and not MONTHLY_VERSION_RE.match(version):
        raise ValueError("Monthly release version must use YYYY-MM format.")


def build_neurostore_studyset_release(
    *,
    nightly=False,
    monthly_if_due=False,
    force_monthly=False,
    version=None,
):
    if not nightly and not monthly_if_due and not force_monthly and not version:
        nightly = True
    validate_monthly_version(version)

    if not acquire_build_lock():
        raise RuntimeError("A neurostore studyset release build is already running.")

    try:
        root = release_root()
        root.mkdir(parents=True, exist_ok=True)
        built_at = utcnow()
        selected = select_coordinate_studies()
        studyset, annotation = ensure_canonical_records(built_at)
        sync_studyset_membership(studyset, selected)
        db.session.flush()

        previous_manifest = previous_nightly_manifest(root)
        base_ids = [entry["base_study_id"] for entry in selected]
        features_by_base = fetch_latest_feature_payloads(base_ids)
        note_keys, analysis_rows_by_study = sync_annotation(
            annotation,
            selected,
            features_by_base,
            previous_manifest,
        )
        db.session.flush()

        manifest_studies, changed, removed, note_keys_checksum = refresh_shards(
            root,
            selected,
            features_by_base,
            annotation,
            note_keys,
            analysis_rows_by_study,
            previous_manifest,
        )
        manifest = base_manifest(
            built_at,
            studyset,
            annotation,
            manifest_studies,
            changed,
            removed,
            note_keys,
            note_keys_checksum,
        )

        written = []
        if nightly:
            written.append(
                write_release_files(
                    root,
                    NIGHTLY_VERSION,
                    NIGHTLY_VERSION,
                    manifest,
                    selected,
                    studyset,
                    annotation,
                    note_keys,
                )
            )

        month_version = version or current_month_version(built_at)
        monthly_dir = root / "monthly" / month_version
        monthly_exists = (monthly_dir / "manifest.json").exists()
        should_write_monthly = (
            force_monthly
            or bool(version and not nightly and not monthly_exists)
            or (monthly_if_due and not monthly_exists)
        )
        if should_write_monthly:
            written.append(
                write_release_files(
                    root,
                    month_version,
                    "monthly",
                    manifest,
                    selected,
                    studyset,
                    annotation,
                    note_keys,
                )
            )

        db.session.commit()
        return {"written": written, "root": str(root)}
    except Exception:
        db.session.rollback()
        raise


def resolve_release_version(version):
    root = release_root()
    if version == NIGHTLY_VERSION:
        release_dir = root / NIGHTLY_VERSION
        manifest = release_dir / "manifest.json"
        archive_name = f"neurostore-studyset-{NIGHTLY_VERSION}.tar.gz"
        return release_dir, manifest, release_dir / archive_name

    if version == LATEST_VERSION:
        monthly = latest_monthly_version()
        if monthly is None:
            return None, None, None
        version = monthly

    release_dir = root / "monthly" / version
    manifest = release_dir / "manifest.json"
    archive_name = f"neurostore-studyset-{version}.tar.gz"
    return release_dir, manifest, release_dir / archive_name


def latest_monthly_version():
    monthly_root = release_root() / "monthly"
    if not monthly_root.exists():
        return None
    versions = sorted(
        path.name
        for path in monthly_root.iterdir()
        if path.is_dir() and (path / "manifest.json").exists()
    )
    return versions[-1] if versions else None


def manifest_summary(manifest):
    keys = (
        "version",
        "release_type",
        "built_at",
        "study_count",
        "note_count",
        "archive_name",
        "archive_checksum",
        "download_path",
    )
    return {key: manifest.get(key) for key in keys if key in manifest}


def list_release_manifests():
    root = release_root()
    manifests = []
    nightly_manifest = read_json(root / NIGHTLY_VERSION / "manifest.json")
    if nightly_manifest:
        manifests.append(manifest_summary(nightly_manifest))

    monthly_root = root / "monthly"
    if monthly_root.exists():
        for path in sorted(monthly_root.iterdir(), reverse=True):
            manifest = read_json(path / "manifest.json")
            if manifest:
                manifests.append(manifest_summary(manifest))

    return manifests


def load_release_manifest(version):
    _release_dir, manifest_path, _archive_path = resolve_release_version(version)
    if not manifest_path or not manifest_path.exists():
        return None
    return read_json(manifest_path)


def release_archive_path(version):
    _release_dir, _manifest_path, archive_path = resolve_release_version(version)
    if not archive_path or not archive_path.exists():
        return None
    return archive_path
