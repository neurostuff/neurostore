"""
Base Classes/functions for constructing views
"""

import re

from connexion.context import context
from flask import abort, request, current_app  # jsonify
from flask.views import MethodView

# from sqlalchemy.ext.associationproxy import ColumnAssociationProxyInstance
# from flask import make_response
import sqlalchemy as sa
import sqlalchemy.sql.expression as sae
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func
from webargs.flaskparser import parser
from webargs import fields

from ..core import cache
from ..database import db
from .utils import get_current_user
from .nested import nested_load
from ..models import (
    StudysetStudy,
    AnnotationAnalysis,
    Studyset,
    BaseStudy,
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
    _nested = {}
    _parent = {}
    _linked = {}
    _composite_key = {}
    _view_fields = {}
    # _default_exclude = None

    def db_validation(self, data):
        """
        Custom validation for database constraints.
        """
        pass

    def pre_nested_record_update(record):
        """
        Processing of a record before updating nested components (defined in specific classes).
        """
        return record

    def post_nested_record_update(record):
        """
        Processing of a record after updating nested components (defined in specific classes).
        """
        return record

    def after_update_or_create(self, record):
        """
        Processing of a record after updating or creating (defined in specific classes).
        """
        q = self._model.query.filter_by(id=record.id)
        q = self.join_tables(q, {})
        return q.one()

    @classmethod
    def load_nested_records(cls, data, record=None):
        return data

    def join_tables(self, q, args):
        if self._model is User:
            return q
        return q.options(joinedload("user"))

    @classmethod
    def update_or_create(cls, data, id=None, user=None, record=None, commit=True):
        """
        scenerios:
        1. cloning a study
          a. clone everything, a study is an object
        2. cloning a studyset
          a. studies are linked to a studyset, so create a new studyset with same links
        3. cloning an annotation
          a. annotations are linked to studysets, update when studyset updates
        4. creating an analysis
          a. I should have to own all (relevant) parent objects
        5. creating an annotation
            a. I should not have to own the studyset to create an annotation
        """

        # Store all models so we can atomically update in one commit
        to_commit = []

        current_user = user or get_current_user()
        if not current_user:
            current_user = create_user()

            db.session.add(current_user)
            db.session.commit()

        id = id or data.get("id", None)  # want to handle case of {"id": "asdfasf"}

        only_ids = set(data.keys()) - set(["id"]) == set()

        # allow compose bot to make changes
        compose_bot = current_app.config["COMPOSE_AUTH0_CLIENT_ID"] + "@clients"
        if id is None and record is None:
            record = cls._model()
            record.user = current_user
        elif record is None:
            if cls._model is User:
                q = cls._model.query.filter_by(id=id)
            else:
                q = cls._model.query.options(joinedload(cls._model.user)).filter_by(id=id)
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

            if commit:
                db.session.add_all(to_commit)
                try:
                    db.session.commit()
                except SQLAlchemyError:
                    db.session.rollback()
                    abort(400)

            return record

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
                                commit=False,
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
                        rec, user=current_user, record=nested_record, commit=False
                    )
                    to_commit.append(nested)

                setattr(record, field, nested)

        # add other custom update after the nested attributes are handled...
        record = cls.post_nested_record_update(record)
        if commit:
            db.session.add_all(to_commit)
            try:
                db.session.commit()
            except SQLAlchemyError:
                db.session.rollback()
                abort(400)

        return record


CAMEL_CASE_MATCH = re.compile(r"(?<!^)(?=[A-Z])")


def clear_cache(cls, record, path, previous_cls=None):
    # redis cache get keys
    if path.count("/") >= 3:
        keys = cache.cache._write_client.keys(f"*{path}*")
        keys = [k.decode("utf8") for k in keys]
        cache.delete_many(*keys)
        base_path = "/".join(path.split("/")[:-1]) + "/"
    else:
        base_path = path

    base_keys = cache.cache._write_client.keys(f"*{base_path}/_*")
    base_keys = [k.decode("utf8") for k in base_keys]
    cache.delete_many(*base_keys)

    # clear cache for all parent objects
    for parent, parent_view_name in cls._parent.items():
        parent_record = getattr(record, parent)
        if parent_record:
            parent_path = (
                "/api/"
                + CAMEL_CASE_MATCH.sub("-", parent_view_name.rstrip("View")).lower()
                + f"/{parent_record.id}"
            )
            parent_class = getattr(viewdata, parent_view_name)
            if previous_cls and parent_class in previous_cls:
                return
            if previous_cls is None:
                previous_cls = [cls]
            else:
                previous_cls.append(cls)
            clear_cache(
                parent_class,
                parent_record,
                parent_path,
                previous_cls=previous_cls,
            )

    # clear cache for all linked objects
    for link, link_view_name in cls._linked.items():
        # attributes I want to pre-empt a database query for:
        # annotations
        # studyset_studies
        # current hacky solution
        # if link == "annotations":
        #     linked_class = getattr(viewdata, link_view_name)
        #     if previous_cls and linked_class in previous_cls:
        #         return


        linked_records = getattr(record, link)
        linked_records = (
            [linked_records] if not isinstance(linked_records, list) else linked_records
        )

        for linked_record in linked_records:
            if isinstance(linked_record, StudysetStudy):
                linked_record = linked_record.studyset
                link_view_name = "StudysetsView"
            if isinstance(linked_record, AnnotationAnalysis):
                linked_record = linked_record.annotation
                link_view_name = "AnnotationsView"
            linked_path = (
                "/api/"
                + CAMEL_CASE_MATCH.sub("-", link_view_name.rstrip("View")).lower()
                + f"/{linked_record.id}"
            )
            linked_class = getattr(viewdata, link_view_name)
            if previous_cls and linked_class in previous_cls:
                return
            if previous_cls is None:
                previous_cls = [cls]
            else:
                previous_cls.append(cls)
            clear_cache(
                linked_class,
                linked_record,
                linked_path,
                previous_cls=previous_cls,
            )


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
        if args["nested"] or self._model is Annotation:
            q = q.options(nested_load(self))
        # if self._model is Annotation:
        #     q = q.options(
        #         joinedload(Annotation.user),
        #         joinedload(Annotation.annotation_analyses).options(
        #             joinedload(AnnotationAnalysis.analysis),
        #             joinedload(AnnotationAnalysis.studyset_study).options(
        #                 joinedload(StudysetStudy.study)
        #             ),
        #         )
        #     )
        q = self.join_tables(q, args)

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
        data = self.__class__._schema().load(request_data)
        self.db_validation(data)

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data, id)

        record = self.after_update_or_create(record)
        # clear relevant caches
        clear_cache(self.__class__, record, request.path)

        return self.__class__._schema().dump(record)

    def delete(self, id):
        q = self.__class__._model.query.filter_by(id=id)
        if self._model is Annotation:
            q = self.join_tables(q, {})
        else:
            q = q.options(nested_load(self))

        record = q.one()

        current_user = get_current_user()
        if record.user_id != current_user.external_id:
            abort(403)
        else:
            db.session.delete(record)
            db.session.commit()

        # clear relevant caches
        clear_cache(self.__class__, record, request.path)

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
            tsquery = sa.func.websearch_to_tsquery(s, postgresql_regconfig="english")
            q = q.filter(m.__ts_vector__.op("@@")(tsquery))

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
        q = self.join_tables(q, args)
        # if self._model is Annotation:
        #     q = q.options(
        #         joinedload(Annotation.user),
        #         joinedload(Annotation.annotation_analyses).options(
        #             joinedload(AnnotationAnalysis.analysis),
        #             joinedload(AnnotationAnalysis.studyset_study).options(
        #                 joinedload(StudysetStudy.study)
        #             ),
        #         )
        #     )

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

        record = self.after_update_or_create(record)

        # clear the cache for this endpoint
        clear_cache(self.__class__, record, request.path)

        return self.__class__._schema(context=args).dump(record)
