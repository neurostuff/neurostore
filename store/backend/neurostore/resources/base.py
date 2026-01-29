"""
Base Classes/functions for constructing views
"""

import json
import re

from connexion.context import context
from flask import request, current_app  # jsonify
from flask.views import MethodView
from ..exceptions.utils.error_helpers import (
    abort_permission,
    abort_validation,
    abort_not_found,
    abort_unprocessable,
)

from psycopg2 import errors

import sqlalchemy as sa
import sqlalchemy.sql.expression as sae
from sqlalchemy.orm import (
    raiseload,
    selectinload,
)
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy import func
from webargs.flaskparser import parser
from webargs import fields

from ..core import cache
from ..cache_versioning import bump_cache_versions, get_cache_version_for_path
from ..database import db
from .utils import (
    get_current_user,
    is_user_admin,
    validate_search_query,
    pubmed_to_tsquery,
)
from ..models import (
    StudysetStudy,
    AnnotationAnalysis,
    Studyset,
    BaseStudy,
    Analysis,
    User,
    Annotation,
)
from ..schemas.data import StudysetSnapshot
from . import data as viewdata
from ..services.has_media_flags import (
    enqueue_base_study_flag_updates,
    recompute_media_flags,
)


@parser.error_handler
def handle_parser_error(err, req, schema, *, error_status_code, error_headers):
    detail = json.dumps(err.messages)
    abort_unprocessable(f"input does not conform to specification: {detail}")


def create_user():
    from auth0.authentication.users import Users

    auth = request.headers.get("Authorization", None)
    token = auth.split()[1]
    profile_info = Users(
        current_app.config["AUTH0_BASE_URL"].removeprefix("https://")
    ).userinfo(access_token=token)

    # user signed up with auth0, but has not made any queries yet...
    # should have endpoint to "create user" after sign on with auth0
    name = profile_info.get("name", "Unknown")
    if "@" in name:
        name = profile_info.get("nickname", "Unknown")

    current_user = User(external_id=context["user"], name=name)

    return current_user


class BaseView(MethodView):
    _model = None
    _o2m = {}
    _m2o = {}
    _nested = {}
    _parent = {}
    _linked = {}
    _composite_key = {}
    _view_fields = {}
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
        merged = {}
        for unique_ids in unique_ids_dicts:
            if not unique_ids:
                continue
            for key, values in unique_ids.items():
                if not values:
                    continue
                if isinstance(values, set):
                    vals = values
                elif isinstance(values, (list, tuple)):
                    vals = {v for v in values if v}
                else:
                    vals = {values}
                merged.setdefault(key, set()).update(vals)
        return merged

    def update_annotations(self, annotations):
        if not annotations:
            return

        query = (
            sa.select(
                Annotation.id,
                Annotation.note_keys,
                Annotation.user_id,
                AnnotationAnalysis.analysis_id.label("annotation_analysis_id"),
                AnnotationAnalysis.annotation_id.label("annotation_id"),
                AnnotationAnalysis.note,
                StudysetStudy.studyset_id,
                StudysetStudy.study_id,
                Analysis.id.label("analysis_id"),
            )
            .select_from(Annotation)
            .join(Studyset, Studyset.id == Annotation.studyset_id)
            .join(StudysetStudy, StudysetStudy.studyset_id == Studyset.id)
            .join(Analysis, Analysis.study_id == StudysetStudy.study_id)
            .outerjoin(
                AnnotationAnalysis,
                sa.and_(
                    AnnotationAnalysis.annotation_id == Annotation.id,
                    sa.or_(
                        AnnotationAnalysis.analysis_id == Analysis.id,
                        AnnotationAnalysis.analysis_id == None,  # noqa E711
                    ),
                ),
            )
            .where(Annotation.id.in_(annotations))
        )

        results = db.session.execute(query).fetchall()

        if not results:
            return

        create_annotation_analyses = []
        for result in results:
            if result.analysis_id and not result.annotation_analysis_id:
                note_payload = result.note or self._build_default_note(result.note_keys)
                if note_payload is None:
                    note_payload = {}
                params = {
                    "analysis_id": result.analysis_id,
                    "annotation_id": result.id,
                    "note": note_payload,
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
            default_value = None
            if isinstance(descriptor, dict):
                if "default" in descriptor:
                    default_value = descriptor.get("default")
            elif descriptor == "boolean":
                default_value = None
            defaults[key] = default_value
        return defaults

    def db_validation(self, record, data):
        """
        Custom validation for database constraints.
        """
        pass

    def pre_nested_record_update(record):
        """
        Processing of a record before updating nested components (defined in specific classes).
        """
        return record

    @classmethod
    def load_nested_records(cls, data, record=None):
        return data

    @classmethod
    def update_or_create(cls, data, id=None, user=None, record=None, flush=True):
        """
        Scenarios:
        1. Cloning a study
          a. Clone everything, a study is an object
        2. Cloning a studyset
          a. Studies are linked to a studyset, so create a new studyset with same links
        3. Cloning an annotation
          a. Annotations are linked to studysets, update when studyset updates
        4. Creating an analysis
          a. I should have to own all (relevant) parent objects
        5. Creating an annotation
            a. I should not have to own the studyset to create an annotation
        """

        # Store all models so we can atomically update in one commit
        to_commit = []

        current_user = user or get_current_user()
        if not current_user:
            current_user = create_user()
            try:
                db.session.add(current_user)
                db.session.commit()
            except (SQLAlchemyError, IntegrityError):
                db.session.rollback()
                current_user = User.query.filter_by(external_id=context["user"]).first()

        id = id or data.get("id", None)  # want to handle case of {"id": "asdfasf"}

        only_ids = set(data.keys()) - set(["id"]) == set()

        # allow compose bot to make changes
        compose_bot = current_app.config["COMPOSE_AUTH0_CLIENT_ID"] + "@clients"
        q = cls._model.query
        q = q.options(raiseload("*", sql_only=True))
        if id is None and record is None:
            record = cls._model()
            record.user = current_user
        elif record is None:
            if cls._model is User:
                q = q.filter_by(id=id)
            else:
                q = q.options(selectinload(cls._model.user)).filter_by(id=id)
            record = q.first()
            if record is None:
                abort_not_found(f"Record {id} not found in {str(cls._model)}")

        data = cls.load_nested_records(data, record)

        is_admin = is_user_admin(current_user)
        if (
            not sa.inspect(record).pending
            and record.user != current_user
            and not only_ids
            and current_user.external_id != compose_bot
            and not is_admin
        ):
            abort_permission(
                "You do not have permission to modify this record."
                " You must be the owner, the compose bot, or an admin."
            )
        elif only_ids:
            to_commit.append(record)

            if flush:
                db.session.add_all(to_commit)
                try:
                    db.session.flush()
                except SQLAlchemyError as e:
                    db.session.rollback()
                    abort_validation(
                        "Database operation failed during record creation/update: "
                        + str(e)
                    )

            return record

        data["user_id"] = current_user.external_id
        if hasattr(record, "id"):
            data["id"] = record.id
        # check to see if duplicate
        duplicate = cls.check_duplicate(data, record)
        if duplicate:
            if sa.inspect(record).transient:
                # Duplicate short-circuit: discard the transient placeholder so
                # its user backref does not leak into a later flush.
                record.user = None
            return duplicate

        # Update all non-nested attributes
        for k, v in data.items():
            if k in cls._parent and v is not None:
                PrtCls = getattr(viewdata, cls._parent[k])
                # DO NOT WANT PEOPLE TO BE ABLE TO ADD ANALYSES
                # TO STUDIES UNLESS THEY OWN THE STUDY
                v = PrtCls._model.query.filter_by(id=v["id"]).first()
                if PrtCls._model is BaseStudy:
                    pass
                elif (
                    current_user != v.user
                    and current_user.external_id != compose_bot
                    and not is_admin
                ):
                    abort_permission(
                        "You do not have permission to link to this parent "
                        "record. You must own the parent record, be the "
                        "compose bot, or be an admin."
                    )
            if k in cls._linked and v is not None:
                LnCls = getattr(viewdata, cls._linked[k])
                # this can be owned by someone else
                if LnCls._composite_key:
                    # composite key is defined in linked class, so need to lookup
                    query_args = {
                        k: v[k.rstrip("_id")]["id"] for k in LnCls._composite_key
                    }
                else:
                    query_args = {"id": v["id"]}

                if v.get("preloaded_data"):
                    v = v["preloaded_data"]
                else:
                    q = LnCls._model.query.filter_by(**query_args)
                    v = q.first()

                if v is None:
                    abort_validation(f"Linked record not found with {query_args}")

            if k not in cls._nested and k not in ["id", "user"]:
                try:
                    setattr(record, k, v)
                except AttributeError:
                    print(k)
                    raise AttributeError

        record = cls.pre_nested_record_update(record)

        to_commit.append(record)

        # Update nested attributes recursively
        for field, res_name in cls._nested.items():
            ResCls = getattr(viewdata, res_name)
            if data.get(field) is not None:
                if isinstance(data.get(field), list):
                    nested = []
                    for rec in data.get(field):
                        id = None
                        if isinstance(rec, dict) and rec.get("id"):
                            id = rec.get("id")
                        elif isinstance(rec, str):
                            id = rec
                        if data.get("preloaded_studies") and id:
                            nested_record = data["preloaded_studies"].get(id)
                        else:
                            nested_record = None
                        nested.append(
                            ResCls.update_or_create(
                                rec,
                                user=current_user,
                                record=nested_record,
                                flush=False,
                            )
                        )
                    to_commit.extend(nested)
                else:
                    id = None
                    rec = data.get(field)
                    if isinstance(rec, dict) and rec.get("id"):
                        id = rec.get("id")
                    elif isinstance(rec, str):
                        id = rec
                    if data.get("preloaded_studies") and id:
                        nested_record = data["preloaded_studies"].get(id)
                    else:
                        nested_record = None
                    nested = ResCls.update_or_create(
                        rec, user=current_user, record=nested_record, flush=False
                    )
                    to_commit.append(nested)

                setattr(record, field, nested)

        if flush:
            db.session.add_all(to_commit)
            try:
                db.session.flush()
            except SQLAlchemyError as e:
                db.session.rollback()
                abort_validation(
                    f"Database error occurred during nested record update: {str(e)}"
                )

        return record


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
        args = parser.parse(self._view_fields, request, location="query")
        if args.get("nested") is None:
            args["nested"] = request.args.get("nested", False) == "true"

        q = self._model.query
        q = self.eager_load(q, args)
        record = q.filter_by(id=id).first()
        if record is None:
            abort_not_found(self._model.__name__, id)

        if self._model is Studyset and args["nested"]:
            snapshot = StudysetSnapshot()
            return snapshot.dump(record), 200, {"Content-Type": "application/json"}
        else:
            return (
                self._schema(
                    context=dict(args),
                ).dump(record),
                200,
                {"Content-Type": "application/json"},
            )

    def put(self, id):
        request_data = self.insert_data(id, request.json)
        schema = self.__class__._schema()
        data = schema.load(request_data)

        args = {}
        if set(self._o2m.keys()).intersection(set(data.keys())):
            args["nested"] = True

        if self._model is Studyset:
            args["load_annotations"] = True

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
            if self._model is not Annotation and self._model is not AnnotationAnalysis:
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
            # Add ts_rank calculation if searching
            rank_col = func.ts_rank(m._ts_vector, tsquery).label("rank")
            q = q.add_columns(rank_col)
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
                # Using ts_rank for search results
                q = q.order_by(sa.text(f"rank {desc}"), m.id.desc())
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

        # join the relevant tables for output
        q = self.eager_load(q, args)

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

        if rank_col is not None:
            # Extract actual records when using rank
            records = [r[0] for r in records]

        content = self.serialize_records(records, args)
        metadata = self.create_metadata(q, total)
        response = {
            "metadata": metadata,
            "results": content,
        }
        return response, 200

    def post(self):
        # TODO: check to make sure current user hasn't already created a
        # record with most/all of the same details (e.g., DOI for studies)

        # Parse arguments using webargs
        args = parser.parse(self._user_args, request, location="query")
        source_id = args.get("source_id")
        source = args.get("source") or "neurostore"

        unknown = self.__class__._schema.opts.unknown
        data = parser.parse(
            self.__class__._schema(exclude=("id",)), request, unknown=unknown
        )

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
