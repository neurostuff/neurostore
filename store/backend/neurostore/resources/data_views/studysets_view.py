import sqlalchemy as sa
from flask import request
from neurostore.database import db
from neurostore.exceptions.factories import make_field_error
from neurostore.exceptions.utils.error_helpers import (abort_not_found,
                                                       abort_unprocessable,
                                                       abort_validation)
from neurostore.models import (Analysis, AnalysisConditions, Annotation, Point,
                               Study, Studyset, User)
from neurostore.models.data import StudysetStudy
from neurostore.resources.base import (ListView, ObjectView, clear_cache,
                                       load_schema_or_abort)
from neurostore.resources.data_views.cloning import (
    build_studyset_clone_payload, clone_annotations_to_studyset,
    load_studyset_clone_source, resolve_neurostore_origin)
from neurostore.resources.data_views.common import (LIST_CLONE_ARGS,
                                                    LIST_NESTED_ARGS,
                                                    LIST_SUMMARY_ARGS)
from neurostore.resources.data_views.serialization import (
    serialize_nested_studyset, serialize_studyset_summary)
from neurostore.resources.mutation_core import DefaultMutationPolicy
from neurostore.resources.utils import view_maker
from neurostore.schemas.data import StudysetSnapshot
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import load_only, raiseload, selectinload
from webargs import fields
from webargs.flaskparser import parser


class StudysetMutationPolicy(DefaultMutationPolicy):
    def __init__(self, context):
        super().__init__(context)
        self.membership_only_payload = False
        self.study_link_only_payload = False
        self.current_ids = None
        self.stub_map = {}

    @staticmethod
    def is_membership_only_payload(data):
        if not isinstance(data, dict):
            return False

        allowed_top_level = {"studies", "curation_stub_map"}
        if set(data.keys()) - allowed_top_level:
            return False

        studies = data.get("studies")
        if not isinstance(studies, list):
            return False

        for item in studies:
            if isinstance(item, str):
                continue
            if isinstance(item, dict) and set(item.keys()) <= {"id"} and item.get("id"):
                continue
            return False

        return True

    @staticmethod
    def is_study_link_only_payload(data):
        if not isinstance(data, dict):
            return False

        studies = data.get("studies")
        if not isinstance(studies, list):
            return False

        for item in studies:
            if isinstance(item, str):
                continue
            if isinstance(item, dict) and set(item.keys()) <= {"id"} and item.get("id"):
                continue
            return False

        return True

    @staticmethod
    def canonicalize_study_ids(study_ids):
        return sorted({study_id for study_id in study_ids if study_id})

    @classmethod
    def resolve_current_ids(cls, studies):
        current_ids = []
        for item in studies or []:
            if isinstance(item, dict):
                study_id = item.get("id")
            elif isinstance(item, str):
                study_id = item
            else:
                study_id = None
            if study_id:
                current_ids.append(study_id)

        if not current_ids:
            return []

        found_ids = {
            study_id
            for (study_id,) in db.session.execute(
                sa.select(Study.id).where(Study.id.in_(current_ids))
            ).all()
        }
        missing_ids = [study_id for study_id in current_ids if study_id not in found_ids]
        if missing_ids:
            abort_not_found(Study.__name__, missing_ids[0])

        return cls.canonicalize_study_ids(current_ids)

    @staticmethod
    def preload_studies(data, membership_only_payload):
        studies = data.get("studies")
        if not studies or membership_only_payload:
            return None

        existing_studies = []
        for study_payload in studies:
            if isinstance(study_payload, dict) and study_payload.get("id"):
                existing_studies.append(study_payload.get("id"))
            elif isinstance(study_payload, str):
                existing_studies.append(study_payload)

        query = Study.query.filter(Study.id.in_(existing_studies))
        if membership_only_payload:
            query = query.options(load_only(Study.id))
        else:
            query = query.options(
                selectinload(Study.analyses),
                selectinload(Study.user),
            )
        return {study.id: study for study in query.all()}

    def prepare(self):
        data = self.context.data
        if not isinstance(data, dict):
            data = {"id": data}

        self.membership_only_payload = self.is_membership_only_payload(data)
        self.study_link_only_payload = self.is_study_link_only_payload(data)
        self.stub_map = data.pop("curation_stub_map", {}) or {}
        self.context.preloaded_studies = self.preload_studies(
            data,
            self.membership_only_payload or self.study_link_only_payload,
        )

        if (self.membership_only_payload or self.study_link_only_payload) and isinstance(
            data.get("studies"), list
        ):
            self.current_ids = self.resolve_current_ids(data["studies"])
            data = {key: value for key, value in data.items() if key != "studies"}

        self.context.data = data
        self.context.id = self.context.id or data.get("id")

    def post_nested_record_update(self):
        record = self.context.record
        if getattr(record, "studyset_studies", None) is None:
            return record

        studies = getattr(record, "studies", []) or []
        if self.context.flush and (
            record.id is None or any(getattr(study, "id", None) is None for study in studies)
        ):
            db.session.add_all(self.context.to_commit)
            try:
                db.session.flush()
            except Exception as exc:
                db.session.rollback()
                abort_validation(
                    "Database error occurred during nested record update: " + str(exc)
                )

        if self.current_ids is None:
            self.current_ids = self.canonicalize_study_ids(
                [
                    study.id
                    for study in getattr(record, "studies", [])
                    if getattr(study, "id", None)
                ]
            )

        current_id_set = set(self.current_ids)
        existing = {assoc.study_id: assoc for assoc in record.studyset_studies}

        stale_ids = sorted(set(existing) - current_id_set)
        stale_assocs = []
        for study_id in stale_ids:
            assoc = existing.pop(study_id, None)
            if assoc is not None:
                stale_assocs.append(assoc)

        if stale_assocs:
            record.studyset_studies = [existing[study_id] for study_id in sorted(existing)]

        missing_ids = [
            study_id for study_id in self.current_ids if study_id not in existing
        ]
        if self.study_link_only_payload:
            if stale_assocs or record.id is None:
                db.session.flush()

            if missing_ids:
                db.session.execute(
                    sa.insert(StudysetStudy),
                    [
                        {
                            "study_id": study_id,
                            "studyset_id": record.id,
                            "curation_stub_uuid": self.stub_map.get(study_id),
                        }
                        for study_id in missing_ids
                    ],
                )

            if self.current_ids:
                refreshed = (
                    StudysetStudy.query.filter(
                        StudysetStudy.studyset_id == record.id,
                        StudysetStudy.study_id.in_(self.current_ids),
                    )
                    .order_by(StudysetStudy.study_id)
                    .all()
                )
                existing = {assoc.study_id: assoc for assoc in refreshed}
                record.studyset_studies = [existing[study_id] for study_id in self.current_ids]
            else:
                record.studyset_studies = []
            return record

        if missing_ids and stale_assocs:
            stale_stub_uuids = {
                assoc.curation_stub_uuid for assoc in stale_assocs if assoc.curation_stub_uuid
            }
            incoming_stub_uuids = {
                self.stub_map.get(study_id)
                for study_id in missing_ids
                if self.stub_map.get(study_id)
            }
            if stale_stub_uuids.intersection(incoming_stub_uuids):
                db.session.flush()

        for study_id in self.current_ids:
            assoc = existing.get(study_id)
            if not assoc:
                assoc = StudysetStudy(
                    study_id=study_id,
                    studyset_id=record.id,
                    curation_stub_uuid=None,
                )
                db.session.add(assoc)
                existing[study_id] = assoc
            if study_id in self.stub_map:
                assoc.curation_stub_uuid = self.stub_map[study_id]

        record.studyset_studies = [existing[study_id] for study_id in self.current_ids]
        return record


class StudysetObjectViewPolicy:
    def __init__(self, view):
        self.view = view

    def get_payload(self, id, args):
        if args.get("nested") and args.get("summary"):
            abort_validation("query parameters 'nested' and 'summary' are incompatible")

        if args.get("summary"):
            query = self.view._model.query
            query = self.view.eager_load(query, args)
            record = query.filter_by(id=id).first()
            if record is None:
                abort_not_found(self.view._model.__name__, id)
            return self.view.serialize_studyset_summary(record)

        if args.get("nested"):
            payload = self.view.serialize_nested_studyset(id)
            if payload is None:
                abort_not_found(self.view._model.__name__, id)
            return payload

        return None

    def build_put_eager_load_args(self, data):
        args = {}
        if set(self.view._o2m.keys()).intersection(set(data.keys())):
            if self.view.mutation_policy_cls.is_membership_only_payload(data):
                args["membership_only"] = True
            else:
                args["nested"] = True
        args["load_annotations"] = True
        return args

    def should_refresh_annotations(self):
        return True


@view_maker
class StudysetsView(ObjectView, ListView):
    mutation_policy_cls = StudysetMutationPolicy
    object_view_policy_cls = StudysetObjectViewPolicy
    request_body_validation_skip = (("POST", "/api/studysets"),)
    _view_fields = {
        **LIST_CLONE_ARGS,
        **LIST_NESTED_ARGS,
        **LIST_SUMMARY_ARGS,
        "copy_annotations": fields.Boolean(load_default=True),
    }
    _o2m = {"studies": "StudiesView", "annotations": "AnnotationsView"}
    _nested = {"studies": "StudiesView"}
    _linked = {"annotations": "AnnotationsView"}
    _multi_search = ("name", "description")
    _search_fields = ("name", "description", "publication", "doi", "pmid")

    def get_affected_ids(self, ids):
        query = (
            select(Annotation.id)
            .select_from(Studyset)
            .outerjoin(Annotation, Annotation.studyset_id == Studyset.id)
            .where(Studyset.id.in_(ids))
        )
        result = db.session.execute(query).fetchall()

        unique_ids = {
            "studysets": set(ids),
            "annotations": set(),
        }
        for (annotation_id,) in result:
            if annotation_id:
                unique_ids["annotations"].add(annotation_id)
        return unique_ids

    def eager_load(self, q, args=None):
        args = args or {}
        if args.get("summary"):
            if args.get("load_annotations"):
                q = q.options(selectinload(Studyset.annotations))
            return q

        q = q.options(
            selectinload(Studyset.studyset_studies).options(
                load_only(
                    StudysetStudy.study_id,
                    StudysetStudy.studyset_id,
                    StudysetStudy.curation_stub_uuid,
                )
            )
        )
        if args.get("membership_only"):
            q = q.options(
                selectinload(Studyset.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
            )
            return q

        if args.get("nested"):
            q = q.options(
                selectinload(Studyset.studies).options(
                    raiseload("*", sql_only=True),
                    selectinload(Study.analyses).options(
                        raiseload("*", sql_only=True),
                        selectinload(Analysis.images).options(
                            raiseload("*", sql_only=True),
                        ),
                        selectinload(Analysis.points).options(
                            raiseload("*", sql_only=True),
                            selectinload(Point.values).options(
                                raiseload("*", sql_only=True)
                            ),
                        ),
                        selectinload(Analysis.analysis_conditions).options(
                            raiseload("*", sql_only=True),
                            selectinload(AnalysisConditions.condition).options(
                                raiseload("*", sql_only=True)
                            ),
                        ),
                    ),
                ),
            )
        else:
            q = q.options(
                selectinload(Studyset.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
            )

        if args.get("load_annotations"):
            q = q.options(selectinload(Studyset.annotations))

        return q

    def serialize_records(self, records, args):
        if args.get("nested"):
            snapshot = StudysetSnapshot()
            return [snapshot.dump(r) for r in records]
        return super().serialize_records(records, args)

    def serialize_nested_studyset(self, studyset_id):
        return serialize_nested_studyset(studyset_id)

    def serialize_studyset_summary(self, record):
        return serialize_studyset_summary(record)

    def post(self, body):
        args = parser.parse(self._user_args, request, location="query")
        copy_annotations = args.pop("copy_annotations", True)
        source_id = args.get("source_id")

        if not source_id:
            return super().post(body)

        source = args.get("source") or "neurostore"
        if source != "neurostore":
            field_err = make_field_error("source", source, valid_options=["neurostore"])
            abort_unprocessable(
                "invalid source, choose from: 'neurostore'", [field_err]
            )

        unknown = self.__class__._schema.opts.unknown
        schema = self.__class__._schema(exclude=("id",))
        data = load_schema_or_abort(schema, body, unknown=unknown)

        clone_payload, source_record = self._build_clone_payload(source_id, data)
        args["nested"] = bool(args.get("nested") or request.args.get("source_id"))

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(clone_payload)

        unique_ids = self.get_affected_ids([record.id])
        clear_cache(unique_ids)

        db.session.flush()
        self.update_base_studies(unique_ids.get("base-studies"))

        try:
            if copy_annotations:
                self._clone_annotations(source_record, record)
            self.update_annotations(unique_ids.get("annotations"))
        except SQLAlchemyError as e:
            db.session.rollback()
            abort_validation(str(e))

        response = self.__class__._schema(context=dict(args)).dump(record)
        db.session.commit()
        return response

    def _build_clone_payload(self, source_id, override_data):
        source_record = load_studyset_clone_source(source_id)
        return build_studyset_clone_payload(source_record, override_data), source_record

    def _clone_annotations(self, source_record, cloned_record):
        clone_annotations_to_studyset(source_record, cloned_record)

    @staticmethod
    def _resolve_neurostore_origin(record):
        return resolve_neurostore_origin(record)
