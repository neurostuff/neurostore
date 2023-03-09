"""
Base Classes/functions for constructing views
"""
import connexion
from flask import abort, request  # jsonify
from flask.views import MethodView

# from sqlalchemy.ext.associationproxy import ColumnAssociationProxyInstance
# from flask import make_response
import sqlalchemy.sql.expression as sae
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func
from webargs.flaskparser import parser
from webargs import fields

from ..database import db
from .utils import get_current_user
from .nested import nested_load
from ..models import Studyset, User, Annotation
from ..schemas.data import StudysetSnapshot
from . import data as viewdata


class BaseView(MethodView):
    _model = None
    _nested = {}
    _parent = {}
    _linked = {}
    _composite_key = {}

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

        if id is None:
            record = cls._model()
            record.user = current_user
        else:
            record = cls._model.query.filter_by(id=id).first()
            if record is None:
                abort(422)
            elif record.user_id != current_user.external_id and not only_ids:
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
                if current_user != v.user:
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


class ObjectView(BaseView):
    def get(self, id):
        nested = request.args.get("nested")
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

        return self.__class__._schema().dump(record)

    def delete(self, id):
        record = self.__class__._model.query.filter_by(id=id).first()

        current_user = get_current_user()
        if record.user_id != current_user.external_id:
            abort(403)
        else:
            db.session.delete(record)

        db.session.commit()

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
        self._fulltext_fields = self._multi_search or self._search_fields
        self._user_args = {
            **LIST_USER_ARGS,
            **self._view_fields,
            **{f: fields.Str() for f in self._fulltext_fields},
        }

    def view_search(self, q, args):
        return q

    def serialize_records(self, records, args):
        """serialize records from search"""
        content = self.__class__._schema(
                only=self._only, many=True,
            ).dump(records)
        return content

    def create_metadata(self, q):
        count = q.count()
        return {'total_count': count}

    def search(self):
        # Parse arguments using webargs
        args = parser.parse(self._user_args, request, location="query")

        m = self._model  # for brevity
        q = m.query

        # Search
        s = args["search"]

        # query items that are owned by a user_id
        if args.get("user_id"):
            q = q.filter(m.user_id == args.get("user_id"))

        # query items that are public and/or you own them
        if hasattr(m, "public"):
            current_user = get_current_user()
            q = q.filter(sae.or_(m.public == True, m.user == current_user))  # noqa E712

        # For multi-column search, default to using search fields
        if s is not None and self._fulltext_fields:
            search_expr = [
                getattr(m, field).ilike(f"%{s}%") for field in self._fulltext_fields
            ]
            q = q.filter(sae.or_(*search_expr))

        # Alternatively (or in addition), search on individual fields.
        for field in self._search_fields:
            s = args.get(field, None)
            if s is not None:
                q = q.filter(getattr(m, field).ilike(f"%{s}%"))

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

        records = q.paginate(
            page=args["page"], per_page=args["page_size"], error_out=False
        ).items
        content = self.serialize_records(records, args)
        metadata = self.create_metadata(q)
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

        nested = bool(request.args.get("nested") or request.args.get("source_id"))
        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data)
        return self.__class__._schema(context={"nested": nested}).dump(record)
