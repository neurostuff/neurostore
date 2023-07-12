"""
Base Classes/functions for constructing views
"""
import re

import connexion
from flask import abort, request, current_app  # jsonify
from flask.views import MethodView

# from sqlalchemy.ext.associationproxy import ColumnAssociationProxyInstance
# from flask import make_response
import sqlalchemy as sa
import sqlalchemy.sql.expression as sae
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


class BaseView(MethodView):
    _model = None
    _nested = {}
    _parent = {}
    _linked = {}
    _composite_key = {}

    def custom_record_update(record):
        """Custom processing of a record (defined in specific classes)"""
        return record

    @classmethod
    def update_or_create(cls, data, id=None, commit=True):
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

        current_user = get_current_user()
        if not current_user:
            # user signed up with auth0, but has not made any queries yet...
            # should have endpoint to "create user" after sign on with auth0
            current_user = User(external_id=connexion.context["user"])
            db.session.add(current_user)
            db.session.commit()

        id = id or data.get("id", None)  # want to handle case of {"id": "asdfasf"}

        only_ids = set(data.keys()) - set(["id"]) == set()

        # allow compose bot to make changes
        compose_bot = current_app.config["COMPOSE_AUTH0_CLIENT_ID"] + "@clients"
        if id is None:
            record = cls._model()
            record.user = current_user
        else:
            record = cls._model.query.filter_by(id=id).first()
            if record is None:
                abort(422)
            elif (
                record.user_id != current_user.external_id
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
                v = LnCls._model.query.filter_by(**query_args).first()
                if v is None:
                    abort(400)

            if k not in cls._nested and k not in ["id", "user"]:
                try:
                    setattr(record, k, v)
                except AttributeError:
                    print(k)
                    raise AttributeError

        record = cls.custom_record_update(record)

        to_commit.append(record)

        # Update nested attributes recursively
        for field, res_name in cls._nested.items():
            ResCls = getattr(viewdata, res_name)
            if data.get(field) is not None:
                if isinstance(data.get(field), list):
                    nested = [
                        ResCls.update_or_create(rec, commit=False)
                        for rec in data.get(field)
                    ]
                    to_commit.extend(nested)
                else:
                    nested = ResCls.update_or_create(data.get(field), commit=False)
                    to_commit.append(nested)

                setattr(record, field, nested)

        if commit:
            db.session.add_all(to_commit)
            try:
                db.session.commit()
            except SQLAlchemyError:
                db.session.rollback()
                abort(400)

        return record


CAMEL_CASE_MATCH = re.compile(r"(?<!^)(?=[A-Z])")


def clear_cache(cls, record, path, only_nested=False, previous_cls=None):
    if only_nested:
        cache_dict = cache.nested_endpoint_dict
        other_cache_dict = cache.endpoint_dict
    else:
        cache_dict = cache.endpoint_dict
        other_cache_dict = cache.nested_endpoint_dict
    # clear the cache for this endpoint
    for key in cache_dict.get(path, []):
        cache.delete(key)
        if key in cache_dict.get(path):
            cache_dict[path].remove(key)
        if key in other_cache_dict.get(path, []):
            other_cache_dict[path].remove(key)
    # clear cache for base endpoint
    endpoint_path = "/".join(path.split("/")[:-1]) + "/"
    for key in cache_dict.get(endpoint_path, []):
        cache.delete(key)
        if key in cache_dict[endpoint_path]:
            cache_dict[endpoint_path].remove(key)
        if key in other_cache_dict.get(endpoint_path, []):
            other_cache_dict[endpoint_path].remove(key)
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
            if isinstance(parent_record, Annotation):
                only_nested = False
            else:
                only_nested = True
            clear_cache(
                parent_class,
                parent_record,
                parent_path,
                only_nested=only_nested,
                previous_cls=previous_cls,
            )

    for link, link_view_name in cls._linked.items():
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
            if isinstance(linked_record, Annotation):
                only_nested = False
            else:
                only_nested = True
            clear_cache(
                linked_class,
                linked_record,
                linked_path,
                only_nested=only_nested,
                previous_cls=previous_cls,
            )


class ObjectView(BaseView):
    @cache.cached(60 * 60, query_string=True)
    def get(self, id):
        nested = request.args.get("nested") == 'true'
        export = request.args.get("export", False)
        q = self._model.query
        if nested or self._model is Annotation:
            q = q.options(nested_load(self))

        record = q.filter_by(id=id).first_or_404()
        if self._model is Studyset and nested:
            snapshot = StudysetSnapshot()
            return snapshot.dump(record)
        else:
            return self.__class__._schema(
                context={
                    "nested": nested,
                    "export": export,
                }
            ).dump(record)

    def put(self, id):
        request_data = self.insert_data(id, request.json)
        data = self.__class__._schema().load(request_data)

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data, id)

        # clear relevant caches
        clear_cache(self.__class__, record, request.path)

        return self.__class__._schema().dump(record)

    def delete(self, id):
        record = self.__class__._model.query.filter_by(id=id).one()

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


LIST_USER_ARGS = {
    "search": fields.String(missing=None),
    "sort": fields.String(missing="created_at"),
    "page": fields.Int(missing=1),
    "desc": fields.Boolean(missing=True),
    "page_size": fields.Int(missing=20, validate=lambda val: val < 30000),
    "user_id": fields.String(missing=None),
}


class ListView(BaseView):
    _only = None
    _search_fields = []
    _multi_search = None
    _view_fields = {}

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

    def join_tables(self, q):
        return q

    def serialize_records(self, records, args):
        """serialize records from search"""
        nested = args.get("nested")
        content = self.__class__._schema(
            only=self._only,
            many=True,
            context={"nested": nested},
        ).dump(records)
        return content

    def create_metadata(self, q, total):
        return {"total_count": total}

    @cache.cached(60 * 60, query_string=True)
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
        desc = False if sort_col != "created_at" else args["desc"]
        desc = {False: "asc", True: "desc"}[desc]

        attr = getattr(m, sort_col)

        # Case-insensitive sorting
        if sort_col != "created_at":
            attr = func.lower(attr)

        # TODO: if the sort field is proxied, bad stuff happens. In theory
        # the next two lines should address this by joining the proxied model,
        # but weird things are happening. look into this as time allows.
        # if isinstance(attr, ColumnAssociationProxyInstance):
        #     q = q.join(*attr.attr)
        q = q.order_by(getattr(attr, desc)())

        # join the relevant tables for output
        q = self.join_tables(q)

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
        if source_id:
            data = self._load_from_source(source, source_id)
        else:
            data = parser.parse(self.__class__._schema, request)
        nested = bool(request.args.get("nested") == 'true' or request.args.get("source_id"))
        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data)

        # clear the cache for this endpoint
        cache.delete(request.path)

        return self.__class__._schema(context={"nested": nested}).dump(record)
