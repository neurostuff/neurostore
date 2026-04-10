"""
Base Classes/functions for constructing views
"""

import json
import re

import sqlalchemy as sa
import sqlalchemy.sql.expression as sae
from flask import current_app, request  # jsonify
from flask.views import MethodView
from marshmallow import ValidationError
from neurostore.cache_versioning import (bump_cache_versions,
                                         get_cache_version_for_path)
from neurostore.database import db
from neurostore.exceptions.utils.error_helpers import (abort_not_found,
                                                       abort_permission,
                                                       abort_unprocessable,
                                                       abort_validation)
from neurostore.extensions import cache
from neurostore.models import (Analysis, Annotation, AnnotationAnalysis,
                               StudysetStudy, User)
from neurostore.note_keys import resolve_note_key_default
from neurostore.resources import data as viewdata
from neurostore.resources.common import merge_unique_ids
from neurostore.resources.mutation_core import (DefaultMutationPolicy,
                                                MutationContext,
                                                MutationExecutor)
from neurostore.resources.utils import (get_current_user, is_user_admin,
                                        pubmed_to_tsquery,
                                        validate_search_query)
from neurostore.services.base_study_metadata_enrichment import \
    enqueue_base_study_metadata_updates
from neurostore.services.has_media_flags import (
    enqueue_base_study_flag_updates, recompute_media_flags)
from psycopg2 import errors
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import raiseload, selectinload
from webargs import fields
from webargs.flaskparser import parser


@parser.error_handler
def handle_parser_error(err, req, schema, *, error_status_code, error_headers):
    abort_schema_validation(err.messages)


def abort_schema_validation(messages):
    detail = json.dumps(messages)
    abort_unprocessable(f"input does not conform to specification: {detail}")


def load_schema_or_abort(schema, payload, *args, **kwargs):
    try:
        return schema.load(payload, *args, **kwargs)
    except ValidationError as err:
        abort_schema_validation(err.messages)


class DefaultObjectViewPolicy:
    def __init__(self, view):
        self.view = view

    def get_payload(self, id, args):
        return None

    def build_put_eager_load_args(self, data):
        args = {}
        if set(self.view._o2m.keys()).intersection(set(data.keys())):
            args["nested"] = True
        return args

    def should_refresh_annotations(self):
        return True

    def get_record(self, id, args):
        query = self.view._model.query
        query = self.view.eager_load(query, args)
        record = query.filter_by(id=id).first()
        if record is None:
            abort_not_found(self.view._model.__name__, id)
        return record


class BaseView(MethodView):
    _model = None
    _o2m = {}
    _m2o = {}
    _nested = {}
    _parent = {}
    _linked = {}
    _composite_key = {}
    _view_fields = {}
    mutation_policy_cls = DefaultMutationPolicy
    object_view_policy_cls = DefaultObjectViewPolicy
    request_body_validation_skip = ()
    # _default_exclude = None

    @classmethod
    def check_duplicate(cls, data, record):
        return False

    def get_affected_ids(self, ids):
        """
        Get all the ids that are affected by a change to a record..
        Affected meaning the output from that endpoint would change.
        """
        return {"base-studies": []}

    @staticmethod
    def merge_unique_ids(*unique_ids_dicts):
        return merge_unique_ids(*unique_ids_dicts)

    def update_annotations(self, annotations):
        if not annotations:
            return

        # Identify only missing annotation-analysis links. This avoids materializing
        # existing links and removes a costly join pattern on large studysets.
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
            .where(Annotation.id.in_(annotations))
            .where(AnnotationAnalysis.annotation_id.is_(None))
        )

        results = db.session.execute(query).all()

        if not results:
            return

        default_notes = {}
        create_annotation_analyses = []
        for result in results:
            annotation_id = result.annotation_id
            if annotation_id not in default_notes:
                note_payload = self._build_default_note(result.note_keys)
                default_notes[annotation_id] = (
                    note_payload if note_payload is not None else {}
                )

            params = {
                "analysis_id": result.analysis_id,
                "annotation_id": annotation_id,
                "note": default_notes[annotation_id],
                "user_id": result.user_id,
                "study_id": result.study_id,
                "studyset_id": result.studyset_id,
            }
            create_annotation_analyses.append(params)

        if create_annotation_analyses:
            db.session.execute(
                sa.insert(AnnotationAnalysis),
                create_annotation_analyses,
            )

    def update_base_studies(self, base_studies):
        if not base_studies:
            return

        base_studies = {id_ for id_ in base_studies if id_}
        if not base_studies:
            return

        if current_app.config.get("BASE_STUDY_FLAGS_ASYNC", True):
            reason = f"{self.__class__.__name__}.update_base_studies"
            enqueue_base_study_flag_updates(base_studies, reason=reason)
        else:
            recompute_media_flags(base_studies)

        if current_app.config.get("BASE_STUDY_METADATA_ASYNC", True):
            reason = f"{self.__class__.__name__}.update_base_studies"
            enqueue_base_study_metadata_updates(base_studies, reason=reason)

    def eager_load(self, q, args):
        return q

    @staticmethod
    def _build_default_note(note_keys):
        if not note_keys:
            return None
        if not isinstance(note_keys, dict):
            return {key: None for key in note_keys}

        defaults = {}
        for key, descriptor in note_keys.items():
            if isinstance(descriptor, dict):
                default_value = resolve_note_key_default(
                    key,
                    descriptor.get("type"),
                    default_provided="default" in descriptor,
                    default_value=descriptor.get("default"),
                )
            else:
                default_value = resolve_note_key_default(key, descriptor)
            defaults[key] = default_value
        return defaults

    def db_validation(self, record, data):
        """
        Custom validation for database constraints.
        """
        pass

    @staticmethod
    def pre_nested_record_update(record):
        """
        Processing of a record before updating nested components (defined in specific classes).
        """
        return record

    @classmethod
    def load_nested_records(cls, data, record=None):
        return data

    @classmethod
    def resolve_related_resource(cls, resource_name):
        return getattr(viewdata, resource_name)

    @classmethod
    def build_mutation_policy(cls, context):
        return cls.mutation_policy_cls(context)

    def build_object_view_policy(self):
        return self.object_view_policy_cls(self)

    @classmethod
    def update_or_create(cls, data, id=None, user=None, record=None, flush=True):
        mutation_context = MutationContext(
            resource_cls=cls,
            data=data,
            id=id,
            user=user,
            record=record,
            flush=flush,
        )
        mutation_policy = cls.build_mutation_policy(mutation_context)
        return MutationExecutor(mutation_context, mutation_policy).execute()


CAMEL_CASE_MATCH = re.compile(r"(?<!^)(?=[A-Z])")


# to clear a cache, I want to invalidate all the o2m of the current class
# and then every m2o of every class above it
def clear_cache(unique_ids):
    bump_cache_versions(unique_ids)


def cache_key_creator(*args, **kwargs):
    # relevant pieces of information
    # 1. the query arguments (including extra_args if present)
    # 2. the path
    # 3. the user
    path = request.path
    user = get_current_user().id if get_current_user() else ""

    # Get query args from request
    query_items = list(request.args.items(multi=True))

    # If extra_args is present, merge into query_items
    extra_args = kwargs.get("extra_args")
    if extra_args:
        for k, v in extra_args.items():
            # Support both single values and lists
            if isinstance(v, list):
                for item in v:
                    query_items.append((k, item))
            else:
                query_items.append((k, v))

    args_as_sorted_tuple = tuple(sorted(query_items))
    query_args = str(args_as_sorted_tuple)
    version = get_cache_version_for_path(path)
    cache_key = "_".join([path, query_args, user, f"v={version}"])

    return cache_key


class ObjectView(BaseView):
    @cache.cached(
        60 * 60, query_string=True, make_cache_key=cache_key_creator, key_prefix=None
    )
    def get(self, id):
        object_view_policy = self.build_object_view_policy()
        args = parser.parse(self._view_fields, request, location="query")
        if args.get("nested") is None:
            args["nested"] = request.args.get("nested", False) == "true"
        if args.get("summary") is None:
            args["summary"] = request.args.get("summary", False) == "true"

        payload = object_view_policy.get_payload(id, args)
        if payload is not None:
            return payload, 200, {"Content-Type": "application/json"}

        q = self._model.query
        q = self.eager_load(q, args)
        record = q.filter_by(id=id).first()
        if record is None:
            abort_not_found(self._model.__name__, id)

        return (
            self._schema(
                context=dict(args),
            ).dump(record),
            200,
            {"Content-Type": "application/json"},
        )

    def put(self, id):
        object_view_policy = self.build_object_view_policy()
        request_data = self.insert_data(id, request.json)
        schema = self.__class__._schema()
        data = load_schema_or_abort(schema, request_data, partial=True)

        args = object_view_policy.build_put_eager_load_args(data)
        q = self._model.query.filter_by(id=id)
        q = self.eager_load(q, args)
        input_record = q.one()
        pre_unique_ids = self.get_affected_ids([id])
        self.db_validation(input_record, data)

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data, id, record=input_record)

        # clear relevant caches
        # clear the cache for this endpoint
        with db.session.no_autoflush:
            post_unique_ids = self.get_affected_ids([id])
            unique_ids = self.merge_unique_ids(pre_unique_ids, post_unique_ids)
            clear_cache(unique_ids)

        try:
            self.update_base_studies(unique_ids.get("base-studies"))
            if object_view_policy.should_refresh_annotations():
                self.update_annotations(unique_ids.get("annotations"))
        except SQLAlchemyError as e:
            db.session.rollback()
            abort_validation(str(e))

        db.session.flush()

        response = schema.dump(record)

        db.session.commit()

        return response

    def delete(self, id):
        q = self.__class__._model.query.filter_by(id=id)
        q = q.options(raiseload("*", sql_only=True))
        record = q.one()

        current_user = get_current_user()
        is_admin = is_user_admin(current_user)
        if record.user_id != current_user.external_id and not is_admin:
            abort_permission(
                "You do not have permission to delete this record. "
                "Only the owner or an admin can delete records."
            )
        else:
            payload = {"id": record.id}
            db.session.delete(record)
            # clear relevant caches
            with db.session.no_autoflush:
                unique_ids = self.get_affected_ids([record.id])
                clear_cache(unique_ids)

            db.session.flush()  # flush the deletion

            self.update_base_studies(unique_ids.get("base-studies"))

            try:
                self.update_annotations(unique_ids.get("annotations"))
            except SQLAlchemyError as e:
                db.session.rollback()
                abort_validation(str(e))

            db.session.commit()

        # Maintain API contract (OpenAPI/test expectations) for delete responses.
        return payload, 200, {"Content-Type": "application/json"}

    def insert_data(self, id, data):
        return data

    def post_delete(self, record):
        pass


LIST_USER_ARGS = {
    "search": fields.String(load_default=None),
    "sort": fields.String(load_default=None),
    "page": fields.Int(load_default=1),
    "desc": fields.Boolean(load_default=True),
    "page_size": fields.Int(load_default=20, validate=lambda val: val < 30000),
    "user_id": fields.String(load_default=None),
    "paginate": fields.Boolean(load_default=True),
}


class ListView(BaseView):
    _search_fields = []
    _multi_search = None
    # _view_fields = {}

    def __init__(self):
        # Initialize expected arguments based on class attributes
        self._fulltext_fields = self._multi_search
        self._user_args = {
            **LIST_USER_ARGS,
            **self._view_fields,
        }
        if self._fulltext_fields:
            self._user_args.update({f: fields.Str() for f in self._fulltext_fields})

        if self._search_fields:
            self._user_args.update({f: fields.Str() for f in self._search_fields})

    def view_search(self, q, args):
        return q

    def join_tables(self, q, args):
        if self._model is User:
            return q
        return q.options(selectinload(self._model.user))

    def should_hydrate_records(self, args):
        return True

    def serialize_records(self, records, args, exclude=None):
        schema_many = self._schema(exclude=exclude, many=True, context=args)

        try:
            # Fast path
            return schema_many.dump(records)
        except Exception as e:
            # Fall back to manual loop to isolate the problem
            schema = self._schema(exclude=exclude, many=False, context=args)
            for idx, record in enumerate(records):
                try:
                    schema.dump(record)
                except Exception as rec_err:
                    raise ValueError(
                        f"Serialization failed on record #{idx}: {record}. Error: {rec_err}"
                    ) from rec_err

            # If somehow we didn't catch the failing record, re-raise the original error
            raise e

    def create_metadata(self, q, total):
        return {"total_count": total}

    @cache.cached(60 * 60, query_string=True, make_cache_key=cache_key_creator)
    def search(self, extra_args=None):
        args = parser.parse(self._user_args, request, location="query")
        if extra_args:
            args.update(extra_args)

        m = self._model  # for brevity
        q = m.query

        # query items that are owned by a user_id
        if args.get("user_id"):
            q = q.filter(m.user_id == args.get("user_id"))

        # query items that are public and/or you own them
        if hasattr(m, "public"):
            current_user = get_current_user()
            is_admin = is_user_admin(current_user)
            # Admins can see all records, others see public or their own
            if not is_admin:
                q = q.filter(
                    sae.or_(m.public == True, m.user == current_user)  # noqa E712
                )

        # Search
        s = args["search"]
        rank_col = None

        # For multi-column search, default to using search fields
        # temporary fix for pmid search
        if s is not None and s.isdigit():
            q = q.filter_by(pmid=s)
        elif s is not None and self._fulltext_fields:
            try:
                validate_search_query(s)
            except errors.SyntaxError as e:
                abort_validation(e.args[0])
            tsquery = func.to_tsquery("english", pubmed_to_tsquery(s))
            rank_col = func.ts_rank(m._ts_vector, tsquery).label("rank")
            q = q.filter(m._ts_vector.op("@@")(tsquery))

        # Alternatively (or in addition), search on individual fields.
        for field in self._search_fields:
            s = args.get(field, None)
            if s is not None:
                q = q.filter(getattr(m, field).ilike(f"%{s}%"))

        q = self.view_search(q, args)

        # Determine sort column based on context
        desc = args["desc"]
        desc = {False: "asc", True: "desc"}[desc]

        # If no sort specified, use ts_rank for search queries, otherwise created_at
        sort_col = args["sort"]
        if sort_col is None:
            if rank_col is not None:
                rank_sort = rank_col.desc() if desc == "desc" else rank_col.asc()
                q = q.order_by(rank_sort, m.id.desc())
            else:
                # Default to created_at when no search
                q = q.order_by(m.created_at.desc(), m.id.desc())
        else:
            # Use user-specified sort column
            attr = getattr(m, sort_col)
            # Case-insensitive sorting
            if sort_col not in ("created_at", "updated_at"):
                attr = func.lower(attr)
            q = q.order_by(getattr(attr, desc)(), m.id.desc())

        if args["paginate"]:
            pagination_query = q.paginate(
                page=args["page"],
                per_page=args["page_size"],
                error_out=False,
            )
            records = pagination_query.items
            total = pagination_query.total
        else:
            records = q.all()
            total = len(records)

        if records and self.should_hydrate_records(args):
            record_ids = [record.id for record in records]
            hydrated_query = self._model.query.filter(self._model.id.in_(record_ids))
            hydrated_query = self.eager_load(hydrated_query, args)
            hydrated_records = hydrated_query.all()
            records_by_id = {record.id: record for record in hydrated_records}
            records = [
                records_by_id[record_id]
                for record_id in record_ids
                if record_id in records_by_id
            ]

        content = self.serialize_records(records, args)
        metadata = self.create_metadata(q, total)
        response = {
            "metadata": metadata,
            "results": content,
        }
        return response, 200

    def post(self, body):
        # TODO: check to make sure current user hasn't already created a
        # record with most/all of the same details (e.g., DOI for studies)

        # Parse arguments using webargs
        args = parser.parse(self._user_args, request, location="query")
        source_id = args.get("source_id")
        source = args.get("source") or "neurostore"

        unknown = self.__class__._schema.opts.unknown
        schema = self.__class__._schema(exclude=("id",))
        data = load_schema_or_abort(schema, body, unknown=unknown)

        if source_id:
            data = self._load_from_source(source, source_id, data)

        args["nested"] = bool(args.get("nested") or request.args.get("source_id"))

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data)

        # clear the cache for this endpoint
        with db.session.no_autoflush:
            unique_ids = self.get_affected_ids([record.id])
            clear_cache(unique_ids)

        db.session.flush()  # flush the deletion

        self.update_base_studies(unique_ids.get("base-studies"))

        try:
            self.update_annotations(unique_ids.get("annotations"))
        except SQLAlchemyError as e:
            db.session.rollback()
            abort_validation(str(e))

        # dump done before commit to prevent invalidating
        # the orm object and sending unnecessary queries
        response = self.__class__._schema(context=args).dump(record)

        db.session.commit()

        return response
