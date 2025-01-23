"""
Base Classes/functions for constructing views
"""

import re

from connexion.context import context
from flask import abort, request, current_app  # jsonify
from flask.views import MethodView

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
from ..database import db
from .utils import get_current_user, validate_search_query, pubmed_to_tsquery
from ..models import (
    StudysetStudy,
    AnnotationAnalysis,
    Studyset,
    BaseStudy,
    Study,
    Analysis,
    Point,
    Image,
    User,
    Annotation,
)
from ..schemas.data import StudysetSnapshot
from . import data as viewdata


def create_user():
    from auth0.v3.authentication.users import Users

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
                params = {
                    "analysis_id": result.analysis_id,
                    "annotation_id": result.id,
                    "note": result.note or {},
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
        # See if any base_studies are affected
        if not base_studies:
            return

        # Subquery for new_has_coordinates
        new_has_coordinates_subquery = (
            sa.select(
                sa.func.coalesce(
                    sa.func.bool_and(Point.analysis_id != None), False  # noqa E711
                )  # noqa E711
            )
            .where(Point.analysis_id == Analysis.id)
            .correlate(Study)
            .scalar_subquery()
        )

        # Subquery for new_has_images
        new_has_images_subquery = (
            sa.select(
                sa.func.coalesce(
                    sa.func.bool_and(Image.analysis_id != None), False  # noqa E711
                )  # noqa E711
            )
            .where(Image.analysis_id == Analysis.id)
            .correlate(Study)
            .scalar_subquery()
        )

        # Main query
        query = (
            sa.select(
                BaseStudy.id,
                BaseStudy.has_images,
                BaseStudy.has_coordinates,
                new_has_coordinates_subquery.label("new_has_coordinates"),
                new_has_images_subquery.label("new_has_images"),
            )
            .distinct()
            .select_from(BaseStudy)
            .join(Study, Study.base_study_id == BaseStudy.id)
            .outerjoin(Analysis, Analysis.study_id == Study.id)
            .where(
                BaseStudy.id.in_(base_studies),
            )
        )

        affected_base_studies = db.session.execute(query).fetchall()
        update_base_studies = []
        for bs in affected_base_studies:
            if (
                bs.new_has_images != bs.has_images
                or bs.new_has_coordinates != bs.has_coordinates
            ):
                update_base_studies.append(
                    {
                        "id": bs.id,
                        "has_images": bs.new_has_images,
                        "has_coordinates": bs.new_has_coordinates,
                    }
                )

        if update_base_studies:
            db.session.execute(
                sa.update(BaseStudy),
                update_base_studies,
            )

    def eager_load(self, q, args):
        return q

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
                abort(422)

        data = cls.load_nested_records(data, record)

        if (
            not sa.inspect(record).pending
            and record.user != current_user
            and not only_ids
            and current_user.external_id != compose_bot
        ):
            abort(403)
        elif only_ids:
            to_commit.append(record)

            if flush:
                db.session.add_all(to_commit)
                try:
                    db.session.flush()
                except SQLAlchemyError:
                    db.session.rollback()
                    abort(400)

            return record

        data["user_id"] = current_user.external_id
        if hasattr(record, "id"):
            data["id"] = record.id
        # check to see if duplicate
        duplicate = cls.check_duplicate(data, record)
        if duplicate:
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
                elif current_user != v.user and current_user.external_id != compose_bot:
                    abort(403)
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
                    abort(400)

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
            except SQLAlchemyError:
                db.session.rollback()
                abort(400)

        return record


CAMEL_CASE_MATCH = re.compile(r"(?<!^)(?=[A-Z])")


# to clear a cache, I want to invalidate all the o2m of the current class
# and then every m2o of every class above it
def clear_cache(unique_ids):
    for resource, ids in unique_ids.items():
        base_path = f"/api/{resource}/"
        base_keys = cache.cache._write_client.keys(f"*{base_path}/_*")
        base_keys = [k.decode("utf8") for k in base_keys]
        cache.delete_many(*base_keys)

        for id in ids:
            path = f"{base_path}{id}"
            keys = cache.cache._write_client.keys(f"*{path}*")
            keys = [k.decode("utf8") for k in keys]
            cache.delete_many(*keys)


def cache_key_creator(*args, **kwargs):
    # relevant pieces of information
    # 1. the query arguments
    # 2. the path
    # 3. the user
    path = request.path
    user = get_current_user().id if get_current_user() else ""
    args_as_sorted_tuple = tuple(
        sorted(pair for pair in request.args.items(multi=True))
    )
    query_args = str(args_as_sorted_tuple)

    cache_key = "_".join([path, query_args, user])

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

        record = q.filter_by(id=id).first_or_404()
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
        self.db_validation(input_record, data)

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data, id, record=input_record)

        # clear relevant caches
        # clear the cache for this endpoint
        with db.session.no_autoflush:
            # unique_ids = self.get_affected_ids([record.id])
            unique_ids = self.get_affected_ids([id])
            clear_cache(unique_ids)

        try:
            self.update_base_studies(unique_ids.get("base-studies"))
            if self._model is not Annotation and self._model is not AnnotationAnalysis:
                self.update_annotations(unique_ids.get("annotations"))
        except SQLAlchemyError as e:
            db.session.rollback()
            abort(400, description=str(e))

        db.session.flush()

        response = schema.dump(record)

        db.session.commit()

        return response

    def delete(self, id):
        q = self.__class__._model.query.filter_by(id=id)
        q = q.options(raiseload("*", sql_only=True))
        record = q.one()

        current_user = get_current_user()
        if record.user_id != current_user.external_id:
            abort(403)
        else:
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
                abort(400, description=str(e))

            db.session.commit()

        return 204

    def insert_data(self, id, data):
        return data

    def post_delete(self, record):
        pass


LIST_USER_ARGS = {
    "search": fields.String(load_default=None),
    "sort": fields.String(load_default="created_at"),
    "page": fields.Int(load_default=1),
    "desc": fields.Boolean(load_default=True),
    "page_size": fields.Int(load_default=20, validate=lambda val: val < 30000),
    "user_id": fields.String(load_default=None),
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

    def serialize_records(self, records, args, exclude=tuple()):
        """serialize records from search"""
        content = self._schema(
            exclude=exclude,
            many=True,
            context=args,
        ).dump(records)
        return content

    def create_metadata(self, q, total):
        return {"total_count": total}

    @cache.cached(60 * 60, query_string=True, make_cache_key=cache_key_creator)
    def search(self):
        # Parse arguments using webargs
        args = parser.parse(self._user_args, request, location="query")

        m = self._model  # for brevity
        q = m.query
        # q = q.options(raiseload("*", sql_only=True))

        # query items that are owned by a user_id
        if args.get("user_id"):
            q = q.filter(m.user_id == args.get("user_id"))

        # query items that are public and/or you own them
        if hasattr(m, "public"):
            current_user = get_current_user()
            q = q.filter(sae.or_(m.public == True, m.user == current_user))  # noqa E712

        # Search
        s = args["search"]

        # For multi-column search, default to using search fields
        # temporary fix for pmid search
        if s is not None and s.isdigit():
            q = q.filter_by(pmid=s)
        elif s is not None and self._fulltext_fields:
            try:
                validate_search_query(s)
            except errors.SyntaxError as e:
                abort(400, description=e.args[0])
            tsquery = func.to_tsquery("english", pubmed_to_tsquery(s))
            q = q.filter(m._ts_vector.op("@@")(tsquery))

        # Alternatively (or in addition), search on individual fields.
        for field in self._search_fields:
            s = args.get(field, None)
            if s is not None:
                q = q.filter(getattr(m, field).ilike(f"%{s}%"))

        q = self.view_search(q, args)
        # Sort
        sort_col = args["sort"]
        desc = args["desc"]
        desc = {False: "asc", True: "desc"}[desc]

        attr = getattr(m, sort_col)

        # Case-insensitive sorting
        if sort_col != "created_at" and sort_col != "updated_at":
            attr = func.lower(attr)

        # TODO: if the sort field is proxied, bad stuff happens. In theory
        # the next two lines should address this by joining the proxied model,
        # but weird things are happening. look into this as time allows.
        # if isinstance(attr, ColumnAssociationProxyInstance):
        #     q = q.join(*attr.attr)
        q = q.order_by(getattr(attr, desc)(), getattr(m.id, desc)())

        # join the relevant tables for output
        q = self.eager_load(q, args)

        pagination_query = q.paginate(
            page=args["page"],
            per_page=args["page_size"],
            error_out=False,
        )
        records = pagination_query.items
        content = self.serialize_records(records, args)
        metadata = self.create_metadata(q, pagination_query.total)
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
            abort(400, description=str(e))

        # dump done before commit to prevent invalidating
        # the orm object and sending unnecessary queries
        response = self.__class__._schema(context=args).dump(record)

        db.session.commit()

        return response
