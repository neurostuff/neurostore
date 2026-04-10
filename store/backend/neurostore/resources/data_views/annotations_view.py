from collections import Counter, OrderedDict
from datetime import datetime
from types import SimpleNamespace

from flask import request
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import defaultload, joinedload, raiseload, selectinload
from webargs import fields

from neurostore.database import db
from neurostore.exceptions.factories import make_field_error
from neurostore.exceptions.utils.error_helpers import (
    abort_unprocessable,
    abort_validation,
)
from neurostore.models import (
    Analysis,
    Annotation,
    AnnotationAnalysis,
    Pipeline,
    PipelineConfig,
    PipelineStudyResult,
    Study,
    Studyset,
    User,
)
from neurostore.models.data import StudysetStudy, _check_type
from neurostore.note_keys import canonicalize_note_keys, ordered_note_key_names
from neurostore.resources.base import (
    DefaultObjectViewPolicy,
    ListView,
    ObjectView,
    clear_cache,
    load_schema_or_abort,
)
from neurostore.resources.data_views.cloning import (
    build_annotation_clone_payload,
    load_annotation_clone_source,
)
from neurostore.resources.data_views.common import LIST_CLONE_ARGS
from neurostore.resources.mutation_core import (
    DefaultMutationPolicy,
    resolve_current_user,
)
from neurostore.resources.utils import get_current_user, view_maker
from neurostore.schemas import PipelineStudyResultSchema


class AnnotationMutationPolicy(DefaultMutationPolicy):
    @staticmethod
    def ordered_note_keys(resource_cls, note_keys):
        return resource_cls._ordered_note_keys(note_keys)

    @staticmethod
    def is_fast_note_update_candidate(data):
        if not data.get("annotation_analyses"):
            return False
        allowed = {"annotation_analyses", "note_keys", "studyset"}
        return not (set(data.keys()) - allowed)

    @staticmethod
    def is_bulk_note_update_candidate(data):
        if not data.get("annotation_analyses"):
            return False

        allowed_note_fields = {"id", "analysis", "studyset_study", "note"}
        for note in data.get("annotation_analyses", []):
            if not isinstance(note, dict):
                return False
            if set(note.keys()) - allowed_note_fields:
                return False

        return True

    def prepare(self):
        data = self.context.data
        if not isinstance(data, dict):
            data = {"id": data}

        studyset_id = data.get("studyset", {}).get("id")
        if studyset_id:
            query = Studyset.query.filter_by(id=studyset_id).options(
                joinedload(Studyset.studyset_studies)
                .joinedload(StudysetStudy.study)
                .joinedload(Study.analyses)
            )
            studyset = query.first()
            if studyset is not None:
                data["studyset"]["preloaded_data"] = studyset
                studyset_studies = {
                    (assoc.studyset_id, assoc.study_id): assoc
                    for assoc in studyset.studyset_studies
                }
                analyses = {
                    analysis.id: analysis
                    for assoc in studyset_studies.values()
                    for analysis in assoc.study.analyses
                }
                for annotation_analysis in data.get("annotation_analyses", []):
                    analysis = analyses.get(
                        annotation_analysis.get("analysis", {}).get("id")
                    )
                    if analysis is not None:
                        annotation_analysis["analysis"]["preloaded_data"] = analysis
                    studyset_study = studyset_studies.get(
                        (
                            studyset.id,
                            annotation_analysis.get("studyset_study", {})
                            .get("study", {})
                            .get("id"),
                        )
                    )
                    if studyset_study is not None:
                        annotation_analysis.setdefault("studyset_study", {})[
                            "preloaded_data"
                        ] = studyset_study

        self.context.data = data
        self.context.id = self.context.id or data.get("id")
        self.context.preloaded_nested_records = data.pop(
            "_preloaded_nested_records", None
        )
        self.context.preloaded_studies = data.pop("preloaded_studies", None)

    def attach_existing_nested_records(self, input_record, data):
        by_id = {
            annotation_analysis.id: annotation_analysis
            for annotation_analysis in input_record.annotation_analyses
        }
        by_analysis_id = {
            annotation_analysis.analysis_id: annotation_analysis.analysis
            for annotation_analysis in input_record.annotation_analyses
            if annotation_analysis.analysis is not None
        }
        by_studyset_study = {
            (
                annotation_analysis.study_id,
                annotation_analysis.studyset_id,
            ): annotation_analysis.studyset_study
            for annotation_analysis in input_record.annotation_analyses
            if annotation_analysis.studyset_study is not None
        }

        for note in data.get("annotation_analyses", []):
            if not isinstance(note, dict):
                continue

            preloaded_annotation_analysis = by_id.get(note.get("id"))
            analysis_payload = note.get("analysis")
            analysis_id = None
            if isinstance(analysis_payload, dict):
                analysis_id = analysis_payload.get("id")
            elif isinstance(analysis_payload, str):
                analysis_id = analysis_payload
                analysis_payload = {"id": analysis_id}
                note["analysis"] = analysis_payload

            if preloaded_annotation_analysis is not None:
                if not isinstance(analysis_payload, dict):
                    analysis_payload = {"id": preloaded_annotation_analysis.analysis_id}
                    note["analysis"] = analysis_payload
                if preloaded_annotation_analysis.analysis is not None:
                    analysis_payload["preloaded_data"] = (
                        preloaded_annotation_analysis.analysis
                    )
            elif isinstance(analysis_payload, dict):
                preloaded_analysis = by_analysis_id.get(analysis_id)
                if preloaded_analysis is not None:
                    analysis_payload["preloaded_data"] = preloaded_analysis

            studyset_study_payload = note.get("studyset_study")
            if not isinstance(studyset_study_payload, dict):
                studyset_study_payload = {}
                note["studyset_study"] = studyset_study_payload

            study_payload = studyset_study_payload.get("study")
            studyset_payload = studyset_study_payload.get("studyset")
            study_id = (
                study_payload.get("id") if isinstance(study_payload, dict) else None
            )
            studyset_id = (
                studyset_payload.get("id")
                if isinstance(studyset_payload, dict)
                else None
            )

            preloaded_ss = None
            if (
                preloaded_annotation_analysis is not None
                and preloaded_annotation_analysis.studyset_study is not None
            ):
                preloaded_ss = preloaded_annotation_analysis.studyset_study
            elif study_id and studyset_id:
                preloaded_ss = by_studyset_study.get((study_id, studyset_id))

            if preloaded_ss is not None:
                studyset_study_payload["preloaded_data"] = preloaded_ss

        data["_preloaded_nested_records"] = {
            "annotation_analyses": {
                annotation_analysis.id: annotation_analysis
                for annotation_analysis in input_record.annotation_analyses
            }
        }

    def sync_annotation_notes_to_note_keys(self, annotation, note_keys):
        ordered_keys = self.ordered_note_keys(self.resource_cls, note_keys)
        default_note = self.resource_cls._build_default_note(note_keys) or {}

        for annotation_analysis in annotation.annotation_analyses:
            existing_note = (
                annotation_analysis.note
                if isinstance(annotation_analysis.note, dict)
                else {}
            )
            synced_note = OrderedDict()
            for key in ordered_keys:
                if key in existing_note:
                    synced_note[key] = existing_note[key]
                else:
                    synced_note[key] = default_note.get(key)
            annotation_analysis.note = synced_note

    @staticmethod
    def resolve_note_id(annotation_id, note):
        note_id = note.get("id")
        if note_id:
            return note_id

        analysis = note.get("analysis")
        analysis_id = (
            analysis.get("id")
            if isinstance(analysis, dict)
            else analysis if isinstance(analysis, str) else None
        )
        if not analysis_id:
            return None
        return f"{annotation_id}_{analysis_id}"

    def try_fast_note_update(self, annotation, data):
        self.resource_cls.update_or_create(
            {"id": annotation.id},
            id=annotation.id,
            user=self.context.current_user,
            record=annotation,
            flush=False,
        )

        if "note_keys" in data:
            annotation.note_keys = data["note_keys"]

        notes_by_id = {
            annotation_analysis.id: annotation_analysis
            for annotation_analysis in annotation.annotation_analyses
        }
        current_user = self.context.current_user
        current_user_id = current_user.external_id if current_user else None

        for note in data.get("annotation_analyses", []):
            if not isinstance(note, dict):
                return False

            note_id = self.resolve_note_id(annotation.id, note)
            if not note_id:
                return False
            annotation_analysis_record = notes_by_id.get(note_id)
            if annotation_analysis_record is None:
                return False

            if "note" in note:
                annotation_analysis_record.note = note.get("note")
            if current_user_id:
                annotation_analysis_record.user_id = current_user_id

        return True

    def try_bulk_note_update(self, annotation, data):
        scalar_data = {
            key: value for key, value in data.items() if key != "annotation_analyses"
        }

        self.resource_cls.update_or_create(
            scalar_data or {"id": annotation.id},
            id=annotation.id,
            user=self.context.current_user,
            record=annotation,
            flush=False,
        )

        notes_by_id = {
            annotation_analysis.id: annotation_analysis
            for annotation_analysis in annotation.annotation_analyses
        }
        current_user = resolve_current_user(self.context.current_user)
        current_user_id = current_user.external_id if current_user else None
        mappings = []

        for note in data.get("annotation_analyses", []):
            if not isinstance(note, dict):
                return False

            note_id = self.resolve_note_id(annotation.id, note)
            if not note_id:
                return False
            annotation_analysis_record = notes_by_id.get(note_id)
            if annotation_analysis_record is None:
                return False

            mapping = {
                "annotation_id": annotation_analysis_record.annotation_id,
                "analysis_id": annotation_analysis_record.analysis_id,
            }
            if "note" in note:
                mapping["note"] = note.get("note")
            if current_user_id:
                mapping["user_id"] = current_user_id
            mappings.append(mapping)

        if mappings:
            db.session.bulk_update_mappings(AnnotationAnalysis, mappings)

        return True


class AnnotationObjectViewPolicy(DefaultObjectViewPolicy):
    def should_refresh_annotations(self):
        return False


@view_maker
class AnnotationsView(ObjectView, ListView):
    mutation_policy_cls = AnnotationMutationPolicy
    object_view_policy_cls = AnnotationObjectViewPolicy
    request_body_validation_skip = (
        ("POST", "/api/annotations"),
        ("PUT", "/api/annotations/<id>"),
    )
    _view_fields = {**LIST_CLONE_ARGS, "studyset_id": fields.String(load_default=None)}
    _o2m = {"annotation_analyses": "AnnotationAnalysesView"}
    _m2o = {"studyset": "StudysetsView"}
    _nested = {"annotation_analyses": "AnnotationAnalysesView"}
    _linked = {"studyset": "StudysetsView"}
    _multi_search = ("name", "description")
    _search_fields = ("name", "description")

    def get_affected_ids(self, ids):
        return {"annotations": set(ids)}

    @staticmethod
    def _ordered_note_keys(note_keys):
        return ordered_note_key_names(note_keys)

    @staticmethod
    def _normalize_note_keys(note_keys):
        if note_keys is None:
            return None
        return canonicalize_note_keys(
            note_keys,
            abort_validation,
            mapping_factory=OrderedDict,
            invalid_type_message=lambda key: (
                "Invalid `type` for note_keys entry "
                f"'{key}', choose from: ['boolean', 'number', 'string']."
            ),
            invalid_default_message=lambda key, note_type: (
                f"Invalid default for note_keys entry '{key}'; "
                f"expected a {note_type}."
            ),
        )

    @classmethod
    def _merge_note_keys(cls, existing, additions):
        base = cls._normalize_note_keys(existing or {}) or OrderedDict()
        used_orders = {v.get("order") for v in base.values() if isinstance(v, dict)}
        used_orders = {o for o in used_orders if isinstance(o, int)}
        next_order = max(used_orders, default=-1) + 1

        for key, value_type in additions.items():
            if key in base:
                descriptor = base[key] or {}
                descriptor["type"] = value_type or descriptor.get("type") or "string"
                base[key] = descriptor
                continue

            base[key] = {
                "type": value_type or "string",
                "order": next_order,
            }
            next_order += 1

        return cls._normalize_note_keys(base)

    def eager_load(self, q, args=None):
        return q.options(
            selectinload(Annotation.user)
            .load_only(User.name, User.external_id)
            .options(raiseload("*", sql_only=True)),
            selectinload(Annotation.annotation_analyses)
            .load_only(
                AnnotationAnalysis.analysis_id,
                AnnotationAnalysis.created_at,
                AnnotationAnalysis.study_id,
                AnnotationAnalysis.studyset_id,
                AnnotationAnalysis.annotation_id,
                AnnotationAnalysis.note,
                AnnotationAnalysis.user_id,
            )
            .options(
                joinedload(AnnotationAnalysis.user)
                .load_only(User.external_id)
                .options(raiseload("*", sql_only=True)),
                joinedload(AnnotationAnalysis.analysis)
                .load_only(
                    Analysis.id,
                    Analysis.name,
                    Analysis.order,
                    Analysis.created_at,
                )
                .options(raiseload("*", sql_only=True)),
                joinedload(AnnotationAnalysis.studyset_study).options(
                    joinedload(StudysetStudy.study)
                    .load_only(
                        Study.id,
                        Study.name,
                        Study.year,
                        Study.authors,
                        Study.publication,
                    )
                    .options(raiseload("*", sql_only=True))
                ),
            ),
        )

    def view_search(self, q, args):
        if args.get("studyset_id"):
            q = q.filter(self._model.studyset_id == args.get("studyset_id"))
        return q

    def insert_data(self, id, data):
        if not data.get("studyset"):
            with db.session.no_autoflush:
                data["studyset"] = (
                    self._model.query.options(selectinload(self._model.studyset))
                    .filter_by(id=id)
                    .first()
                    .studyset.id
                )
        return data

    def _load_from_source(self, source, source_id, data=None):
        if source == "neurostore":
            return self.load_from_neurostore(source_id, data)

        field_err = make_field_error("source", source, valid_options=["neurostore"])
        abort_unprocessable("invalid source, choose from: 'neurostore'", [field_err])

    def load_from_neurostore(self, source_id, data=None):
        annotation = load_annotation_clone_source(source_id, self.join_tables)
        return build_annotation_clone_payload(annotation, data)

    def join_tables(self, q, args):
        if not args.get("nested"):
            q = q.options(
                selectinload(Annotation.user),
                defaultload(Annotation.annotation_analyses).options(
                    defaultload(AnnotationAnalysis.analysis),
                    defaultload(AnnotationAnalysis.studyset_study).options(
                        selectinload(StudysetStudy.study)
                    ),
                ),
            )
        return q

    def db_validation(self, record, data):
        db_analysis_ids = {aa.analysis_id for aa in record.annotation_analyses}
        data_analysis_ids = {
            aa.get("analysis", {}).get("id", "")
            for aa in data.get("annotation_analyses", [])
        }

        if data_analysis_ids and db_analysis_ids != data_analysis_ids:
            abort_validation(
                "annotation request must contain all analyses from the studyset."
            )

    def put(self, id):
        request_data = self.insert_data(id, request.json)
        schema = self._schema()
        data = load_schema_or_abort(schema, request_data, partial=True)
        mutation_policy = self.mutation_policy_cls(
            SimpleNamespace(
                resource_cls=self.__class__, current_user=get_current_user()
            )
        )

        pipeline_payload = data.pop("pipelines", [])
        args = {}
        if set(self._o2m.keys()).intersection(set(data.keys())):
            args["nested"] = True

        q = self._model.query.filter_by(id=id)
        q = self.eager_load(q, args)
        input_record = q.one()

        if pipeline_payload:
            specs, column_counter = self._normalize_pipeline_specs(pipeline_payload)
            self._apply_pipeline_columns(input_record, data, specs, column_counter)

        fast_note_update_candidate = mutation_policy.is_fast_note_update_candidate(data)
        bulk_note_update_candidate = (
            not fast_note_update_candidate
            and mutation_policy.is_bulk_note_update_candidate(data)
        )

        if (
            data.get("annotation_analyses")
            and not fast_note_update_candidate
            and not bulk_note_update_candidate
        ):
            mutation_policy.attach_existing_nested_records(input_record, data)

        self.db_validation(input_record, data)

        with db.session.no_autoflush:
            if "note_keys" in data and "annotation_analyses" not in data:
                mutation_policy.sync_annotation_notes_to_note_keys(
                    input_record, data["note_keys"]
                )
            if fast_note_update_candidate:
                fast_path_succeeded = mutation_policy.try_fast_note_update(
                    input_record, data
                )
                if fast_path_succeeded:
                    record = input_record
                else:
                    data["_preloaded_nested_records"] = {
                        "annotation_analyses": {
                            aa.id: aa for aa in input_record.annotation_analyses
                        }
                    }
                    record = self.__class__.update_or_create(
                        data, id, record=input_record
                    )
            elif bulk_note_update_candidate:
                bulk_path_succeeded = mutation_policy.try_bulk_note_update(
                    input_record, data
                )
                if bulk_path_succeeded:
                    db.session.flush()
                    db.session.expire(input_record, ["annotation_analyses"])
                    q = self._model.query.filter_by(id=id)
                    q = self.eager_load(q, {"nested": True})
                    record = q.one()
                else:
                    mutation_policy.attach_existing_nested_records(input_record, data)
                    record = self.__class__.update_or_create(
                        data, id, record=input_record
                    )
            else:
                record = self.__class__.update_or_create(data, id, record=input_record)

        with db.session.no_autoflush:
            unique_ids = self.get_affected_ids([id])
            clear_cache(unique_ids)

        try:
            self.update_base_studies(unique_ids.get("base-studies"))
            self.update_annotations(unique_ids.get("annotations"))
        except SQLAlchemyError as e:
            db.session.rollback()
            abort_validation(str(e))

        db.session.flush()
        response = schema.dump(record)
        db.session.commit()
        return response

    @staticmethod
    def _extract_analysis_id(note):
        if not isinstance(note, dict):
            return None
        analysis = note.get("analysis")
        if isinstance(analysis, dict):
            return analysis.get("id")
        return analysis

    @staticmethod
    def _collect_column_values(data, column):
        collected = []

        def _walk(obj):
            if isinstance(obj, dict):
                if column in obj and not isinstance(obj[column], (dict, list)):
                    collected.append(obj[column])
                for value in obj.values():
                    _walk(value)
            elif isinstance(obj, list):
                dict_items = [item for item in obj if isinstance(item, dict)]
                if dict_items and all(column in item for item in dict_items):
                    for item in dict_items:
                        value = item.get(column)
                        if not isinstance(value, (dict, list)):
                            collected.append(value)
                else:
                    for item in obj:
                        _walk(item)

        _walk(data)
        return collected

    def _normalize_pipeline_specs(self, pipelines):
        specs = []
        column_counter = Counter()

        if not isinstance(pipelines, list):
            field_err = make_field_error("pipelines", pipelines, code="INVALID_FORMAT")
            abort_validation(
                "`pipelines` must be provided as a list of pipeline descriptors.",
                [field_err],
            )

        for idx, payload in enumerate(pipelines):
            if not isinstance(payload, dict):
                field_err = make_field_error(
                    f"pipelines[{idx}]", payload, code="INVALID_VALUE"
                )
                abort_validation(
                    "Each pipeline descriptor must be an object.", [field_err]
                )

            name = payload.get("name")
            if not isinstance(name, str) or not name.strip():
                field_err = make_field_error(
                    f"pipelines[{idx}].name", name, code="MISSING_VALUE"
                )
                abort_validation(
                    "Pipeline entries must include a non-empty `name`.", [field_err]
                )
            name = name.strip()

            columns = payload.get("columns")
            if not isinstance(columns, (list, tuple)) or not columns:
                field_err = make_field_error(
                    f"pipelines[{idx}].columns", columns, code="MISSING_VALUE"
                )
                abort_validation(
                    "Pipeline entries must include a non-empty `columns` list.",
                    [field_err],
                )

            normalized_columns = []
            for column in columns:
                if isinstance(column, str) and column.strip():
                    col = column.strip()
                    if col not in normalized_columns:
                        normalized_columns.append(col)
            if not normalized_columns:
                field_err = make_field_error(
                    f"pipelines[{idx}].columns", columns, code="INVALID_VALUE"
                )
                abort_validation(
                    "Columns must contain at least one non-empty string.", [field_err]
                )

            version = payload.get("version")
            if version is not None and not isinstance(version, str):
                field_err = make_field_error(
                    f"pipelines[{idx}].version", version, code="INVALID_VALUE"
                )
                abort_validation(
                    "`version` must be a string when provided.", [field_err]
                )
            config_id = payload.get("config_id")
            if config_id is not None and not isinstance(config_id, str):
                field_err = make_field_error(
                    f"pipelines[{idx}].config_id", config_id, code="INVALID_VALUE"
                )
                abort_validation(
                    "`config_id` must be a string when provided.", [field_err]
                )

            specs.append(
                {
                    "name": name,
                    "columns": normalized_columns,
                    "version": version.strip() if isinstance(version, str) else None,
                    "config_id": (
                        config_id.strip() if isinstance(config_id, str) else None
                    ),
                }
            )
            for column in normalized_columns:
                column_counter[column] += 1

        return specs, column_counter

    def _build_note_map(self, annotation, incoming_notes):
        note_map = OrderedDict()
        analysis_context = {}

        for aa in annotation.annotation_analyses:
            studyset_study = getattr(aa, "studyset_study", None)
            study = getattr(studyset_study, "study", None) if studyset_study else None
            if study is None and aa.analysis:
                study = aa.analysis.study
            base_study_id = getattr(study, "base_study_id", None)
            analysis_context[aa.analysis_id] = {
                "base_study_id": base_study_id,
                "study_id": aa.study_id,
                "studyset_id": aa.studyset_id,
            }
            note_map[aa.analysis_id] = {
                "id": aa.id,
                "analysis": {"id": aa.analysis_id},
                "studyset_study": {
                    "study": {"id": aa.study_id},
                    "studyset": {"id": aa.studyset_id},
                },
                "note": dict(aa.note or {}),
            }

        for note in incoming_notes or []:
            if not isinstance(note, dict):
                continue
            analysis_id = self._extract_analysis_id(note)
            if not analysis_id:
                continue
            if analysis_id in note_map:
                merged = note_map[analysis_id]
                if "note" in note and isinstance(note["note"], dict):
                    merged["note"] = dict(note["note"])
                if "studyset_study" in note and note["studyset_study"]:
                    merged["studyset_study"] = note["studyset_study"]
                if "analysis" in note and note["analysis"]:
                    merged["analysis"] = note["analysis"]
                if "id" in note and note["id"]:
                    merged["id"] = note["id"]
            else:
                note_map[analysis_id] = note
                analysis_context.setdefault(
                    analysis_id,
                    {"base_study_id": None, "study_id": None, "studyset_id": None},
                )

        return note_map, analysis_context

    def _fetch_pipeline_data(self, spec, base_study_ids):
        pipeline = Pipeline.query.filter_by(name=spec["name"]).first()
        if not pipeline:
            field_err = make_field_error("pipeline", spec["name"], code="NOT_FOUND")
            abort_validation(f"Pipeline '{spec['name']}' does not exist.", [field_err])

        config_query = PipelineConfig.query.filter_by(pipeline_id=pipeline.id)
        resolved_config = None
        if spec["config_id"]:
            resolved_config = config_query.filter_by(id=spec["config_id"]).first()
            if not resolved_config:
                field_err = make_field_error(
                    "config_id", spec["config_id"], code="NOT_FOUND"
                )
                abort_validation(
                    f"Pipeline '{spec['name']}' does not have config '{spec['config_id']}'.",
                    [field_err],
                )

        configs_for_version = []
        if spec["version"]:
            configs_for_version = config_query.filter_by(version=spec["version"]).all()
            if not configs_for_version:
                field_err = make_field_error(
                    "version", spec["version"], code="NOT_FOUND"
                )
                abort_validation(
                    f"Pipeline '{spec['name']}' does not have version '{spec['version']}'.",
                    [field_err],
                )
            if not resolved_config and len(configs_for_version) == 1:
                resolved_config = configs_for_version[0]

        query = (
            db.session.query(
                PipelineStudyResult.base_study_id,
                PipelineStudyResult.result_data,
                PipelineStudyResult.date_executed,
                PipelineStudyResult.created_at,
                PipelineStudyResult.config_id,
                PipelineConfig.version,
            )
            .join(PipelineConfig, PipelineStudyResult.config_id == PipelineConfig.id)
            .filter(PipelineConfig.pipeline_id == pipeline.id)
        )
        if base_study_ids:
            query = query.filter(PipelineStudyResult.base_study_id.in_(base_study_ids))
        if spec["config_id"]:
            query = query.filter(PipelineConfig.id == spec["config_id"])
        if spec["version"]:
            query = query.filter(PipelineConfig.version == spec["version"])

        rows = query.all()
        per_base = {}
        for row in rows:
            timestamp = row.date_executed or row.created_at or datetime.min
            existing = per_base.get(row.base_study_id)
            if existing is None or timestamp > existing["timestamp"]:
                result_data = (
                    row.result_data if isinstance(row.result_data, dict) else {}
                )
                flattened = (
                    PipelineStudyResultSchema.flatten_dict(result_data)
                    if isinstance(result_data, dict)
                    else {}
                )
                per_base[row.base_study_id] = {
                    "flat": flattened,
                    "raw": result_data if isinstance(result_data, dict) else {},
                    "config_id": row.config_id,
                    "version": row.version,
                    "timestamp": timestamp,
                }

        if not resolved_config and per_base:
            config_ids = {
                entry["config_id"] for entry in per_base.values() if entry["config_id"]
            }
            if len(config_ids) == 1:
                resolved_config = PipelineConfig.query.filter_by(
                    id=config_ids.pop()
                ).first()

        resolved_version = spec["version"]
        if not resolved_version:
            versions = {
                entry["version"] for entry in per_base.values() if entry["version"]
            }
            if len(versions) == 1:
                resolved_version = versions.pop()
            elif len(versions) > 1:
                resolved_version = sorted(versions)[-1]
            elif resolved_config:
                resolved_version = resolved_config.version

        resolved_config_id = spec["config_id"]
        if not resolved_config_id:
            if resolved_config:
                resolved_config_id = resolved_config.id
            else:
                config_ids = {
                    entry["config_id"]
                    for entry in per_base.values()
                    if entry["config_id"]
                }
                if len(config_ids) == 1:
                    resolved_config_id = config_ids.pop()

        return (
            per_base,
            resolved_version or "latest",
            resolved_config_id or "latest",
        )

    def _apply_pipeline_columns(self, annotation, data, specs, column_counter):
        incoming_notes = data.get("annotation_analyses") or []
        note_map, analysis_context = self._build_note_map(annotation, incoming_notes)
        base_study_ids = {
            ctx["base_study_id"]
            for ctx in analysis_context.values()
            if ctx.get("base_study_id")
        }
        column_types = {}

        for spec in specs:
            if not base_study_ids:
                continue
            pipeline_data, resolved_version, resolved_config_id = (
                self._fetch_pipeline_data(spec, base_study_ids)
            )
            version_label = str(resolved_version or "latest").replace(" ", "_")
            config_label = str(resolved_config_id or "latest").replace(" ", "_")
            suffix_label = f"{spec['name']}_{version_label}_{config_label}"

            for column in spec["columns"]:
                key_name = column
                if column_counter[column] > 1:
                    key_name = f"{column}_{suffix_label}"

                for analysis_id, payload in note_map.items():
                    context = analysis_context.get(analysis_id) or {}
                    base_study_id = context.get("base_study_id")
                    entry = pipeline_data.get(base_study_id)
                    flat_values = entry["flat"] if entry else {}
                    value = flat_values.get(column)
                    if isinstance(value, list):
                        flattened_value = ",".join(
                            str(item) for item in value if item is not None
                        )
                        value = flattened_value if flattened_value else None
                    if value is None and entry:
                        raw_values = [
                            v
                            for v in self._collect_column_values(
                                entry.get("raw", {}), column
                            )
                            if v is not None
                        ]
                        if raw_values:
                            value = (
                                str(raw_values[0])
                                if len(raw_values) == 1
                                else ",".join(str(v) for v in raw_values)
                            )

                    payload.setdefault("note", {})
                    payload["note"][key_name] = value

                    detected_type = _check_type(value)
                    existing_type = column_types.get(key_name)
                    if detected_type:
                        column_types[key_name] = (
                            "string"
                            if existing_type and existing_type != detected_type
                            else detected_type
                        )
                    elif existing_type is None:
                        column_types[key_name] = "string"

        if column_types:
            note_keys = (
                self._normalize_note_keys(annotation.note_keys or {})
                if data.get("note_keys") is None
                else self._normalize_note_keys(data["note_keys"])
            )
            data["note_keys"] = self._merge_note_keys(note_keys, column_types)

        data["annotation_analyses"] = list(note_map.values())
