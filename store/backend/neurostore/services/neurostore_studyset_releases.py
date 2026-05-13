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
from sqlalchemy.orm import selectinload

from neurostore.database import db
from neurostore.models import (
    Analysis,
    Annotation,
    AnnotationAnalysis,
    BaseStudy,
    Pipeline,
    PipelineConfig,
    PipelineStudyResult,
    Point,
    Study,
    Studyset,
    StudysetStudy,
)
from neurostore.models.data import generate_id
from neurostore.resources.data_views.serialization import serialize_study_record
from neurostore.schemas.pipeline import PipelineStudyResultSchema

STUDYSET_SOURCE_ID = "neurostore-studyset"
ANNOTATION_SOURCE_ID = "neurostore-annotation"
RELEASE_DIRNAME = "neurostore-studyset-releases"
NIGHTLY_VERSION = "nightly"
LATEST_VERSION = "latest"
FEATURE_PIPELINES = ("ParticipantDemographicsExtractor", "TaskInfoExtractor")
LOCK_KEY = "neurostore-studyset-release-build"
MONTHLY_VERSION_RE = re.compile(r"^\d{4}-\d{2}$")


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
        .subquery()
    )

    rows = db.session.execute(
        sa.select(ranked.c.base_study_id, ranked.c.study_id, ranked.c.freshness)
        .where(ranked.c.rank == 1)
        .order_by(ranked.c.study_id)
    ).all()
    return [
        {
            "base_study_id": row.base_study_id,
            "study_id": row.study_id,
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
            Analysis.name.label("analysis_name"),
            Analysis.study_id,
            Study.name.label("study_name"),
            Study.year.label("study_year"),
            Study.authors,
            Study.publication,
        )
        .select_from(Analysis)
        .join(Study, Study.id == Analysis.study_id)
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


def sync_annotation(annotation, selected, features_by_base):
    note_keys = build_note_keys(features_by_base)
    annotation.note_keys = note_keys

    study_to_base = {entry["study_id"]: entry["base_study_id"] for entry in selected}
    analysis_rows_by_study = fetch_analysis_rows(study_to_base.keys())
    all_analysis_ids = {
        row["analysis_id"] for rows in analysis_rows_by_study.values() for row in rows
    }

    if all_analysis_ids:
        db.session.execute(
            sa.delete(AnnotationAnalysis)
            .where(AnnotationAnalysis.annotation_id == annotation.id)
            .where(AnnotationAnalysis.analysis_id.not_in(all_analysis_ids))
        )
    else:
        db.session.execute(
            sa.delete(AnnotationAnalysis).where(
                AnnotationAnalysis.annotation_id == annotation.id
            )
        )

    existing = {
        analysis_id
        for (analysis_id,) in db.session.execute(
            sa.select(AnnotationAnalysis.analysis_id).where(
                AnnotationAnalysis.annotation_id == annotation.id
            )
        )
    }

    mappings_to_insert = []
    mappings_to_update = []
    for study_id, rows in analysis_rows_by_study.items():
        base_id = study_to_base[study_id]
        note = note_for_base(base_id, features_by_base, note_keys)
        for row in rows:
            mapping = {
                "annotation_id": annotation.id,
                "analysis_id": row["analysis_id"],
                "study_id": study_id,
                "studyset_id": annotation.studyset_id,
                "note": note,
                "user_id": annotation.user_id,
            }
            if row["analysis_id"] in existing:
                mappings_to_update.append(mapping)
            else:
                mappings_to_insert.append(mapping)

    if mappings_to_insert:
        db.session.execute(sa.insert(AnnotationAnalysis), mappings_to_insert)
    if mappings_to_update:
        db.session.bulk_update_mappings(AnnotationAnalysis, mappings_to_update)

    return note_keys, analysis_rows_by_study


def serialize_study_shard(study_id):
    study = (
        Study.query.filter_by(id=study_id)
        .options(
            selectinload(Study.analyses).options(
                selectinload(Analysis.images),
                selectinload(Analysis.points).options(selectinload(Point.values)),
            ),
            selectinload(Study.tables),
        )
        .one()
    )
    return serialize_study_record(study)


def build_note_shard(annotation, study_id, base_id, rows, features_by_base, note_keys):
    note = note_for_base(base_id, features_by_base, note_keys)
    notes = []
    for row in rows:
        notes.append(
            {
                "id": f"{annotation.id}_{row['analysis_id']}",
                "analysis": row["analysis_id"],
                "study": study_id,
                "study_name": row["study_name"],
                "analysis_name": row["analysis_name"],
                "study_year": row["study_year"],
                "authors": row["authors"],
                "publication": row["publication"],
                "note": note,
            }
        )
    return notes


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
        "base_study_id": base_id,
        "study_id": entry["study_id"],
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

    manifest_studies = OrderedDict()
    for entry in selected:
        base_id = entry["base_study_id"]
        study_id = entry["study_id"]
        manifest_entry = build_manifest_entry(entry, features_by_base)
        previous_entry = previous_entries.get(base_id)
        state_changed = previous_entry is None or {
            key: previous_entry.get(key)
            for key in ("study_id", "study_freshness", "features")
        } != {
            key: manifest_entry.get(key)
            for key in ("study_id", "study_freshness", "features")
        }

        study_shard_path = study_shard_dir / f"{study_id}.json"
        note_shard_path = note_shard_dir / f"{base_id}.json"
        if state_changed or not study_shard_path.exists():
            study_payload = serialize_study_shard(study_id)
            atomic_write_json(study_shard_path, study_payload)
            manifest_entry["study_checksum"] = checksum_payload(study_payload)
        else:
            manifest_entry["study_checksum"] = previous_entry.get("study_checksum")

        notes_need_refresh = (
            state_changed
            or not note_shard_path.exists()
            or previous_note_keys_checksum != note_keys_checksum
        )
        if notes_need_refresh:
            note_payload = build_note_shard(
                annotation,
                study_id,
                base_id,
                analysis_rows_by_study.get(study_id, []),
                features_by_base,
                note_keys,
            )
            atomic_write_json(note_shard_path, note_payload)
            manifest_entry["note_checksum"] = checksum_payload(note_payload)
        else:
            manifest_entry["note_checksum"] = previous_entry.get("note_checksum")

        if state_changed:
            changed_base_ids.append(base_id)
        manifest_studies[base_id] = manifest_entry

    for path in study_shard_dir.glob("*.json"):
        if path.stem not in selected_study_ids:
            path.unlink(missing_ok=True)

    return (
        manifest_studies,
        sorted(changed_base_ids),
        removed_base_ids,
        note_keys_checksum,
    )


def load_study_shards(root, selected):
    studies = []
    for entry in selected:
        study_id = entry["study_id"]
        studies.append(read_json(root / "_cache" / "studies" / f"{study_id}.json"))
    return studies


def load_note_shards(root, selected):
    notes = []
    for entry in selected:
        notes.extend(
            read_json(
                root / "_cache" / "notes" / f"{entry['base_study_id']}.json",
                default=[],
            )
            or []
        )
    return notes


def build_release_payloads(root, selected, studyset, annotation, note_keys):
    studyset_payload = {
        "id": studyset.id,
        "name": studyset.name,
        "user": studyset.user_id,
        "description": studyset.description,
        "publication": studyset.publication,
        "doi": studyset.doi,
        "pmid": studyset.pmid,
        "created_at": serialize_dt(studyset.created_at),
        "updated_at": serialize_dt(studyset.updated_at),
        "source": studyset.source,
        "source_id": studyset.source_id,
        "source_updated_at": serialize_dt(studyset.source_updated_at),
        "studies": load_study_shards(root, selected),
        "studyset_studies": [
            {"id": entry["study_id"], "curation_stub_uuid": None} for entry in selected
        ],
    }
    annotation_payload = {
        "id": annotation.id,
        "studyset": studyset.id,
        "name": annotation.name,
        "description": annotation.description,
        "source": annotation.source,
        "source_id": annotation.source_id,
        "source_updated_at": serialize_dt(annotation.source_updated_at),
        "note_keys": note_keys,
        "metadata": annotation.metadata_,
        "notes": load_note_shards(root, selected),
    }
    return studyset_payload, annotation_payload


def write_tarball(
    release_dir,
    archive_name,
    manifest,
    studyset_payload,
    annotation_payload,
):
    release_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=release_dir) as staging:
        staging_path = Path(staging)
        folder = staging_path / archive_name.removesuffix(".tar.gz")
        folder.mkdir()
        atomic_write_json(folder / "neurostore-studyset.json", studyset_payload)
        atomic_write_json(folder / "neurostore-annotation.json", annotation_payload)
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
    studyset_payload,
    annotation_payload,
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
    manifest["studyset_checksum"] = checksum_payload(studyset_payload)
    manifest["annotation_checksum"] = checksum_payload(annotation_payload)
    archive_path = write_tarball(
        release_dir,
        archive_name,
        manifest,
        studyset_payload,
        annotation_payload,
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
            "name": studyset.name,
            "source_id": studyset.source_id,
        },
        "annotation": {
            "id": annotation.id,
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

        base_ids = [entry["base_study_id"] for entry in selected]
        features_by_base = fetch_latest_feature_payloads(base_ids)
        note_keys, analysis_rows_by_study = sync_annotation(
            annotation, selected, features_by_base
        )
        db.session.flush()

        previous_manifest = previous_nightly_manifest(root)
        manifest_studies, changed, removed, note_keys_checksum = refresh_shards(
            root,
            selected,
            features_by_base,
            annotation,
            note_keys,
            analysis_rows_by_study,
            previous_manifest,
        )
        studyset_payload, annotation_payload = build_release_payloads(
            root, selected, studyset, annotation, note_keys
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
                    studyset_payload,
                    annotation_payload,
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
                    studyset_payload,
                    annotation_payload,
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
