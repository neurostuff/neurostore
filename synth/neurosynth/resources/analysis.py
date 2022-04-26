import connexion
from flask import abort, request, jsonify
from flask.views import MethodView

# from sqlalchemy.ext.associationproxy import ColumnAssociationProxyInstance
import sqlalchemy.sql.expression as sae
from sqlalchemy import func
from webargs.flaskparser import parser
from webargs import fields

from ..database import db
from ..models.analysis import (   # noqa E401
    Studyset, Annotation, MetaAnalysis, Specification,
    StudysetReference, AnnotationReference
)
from ..models.auth import User

from ..schemas import (  # noqa E401
    MetaAnalysisSchema,
    AnnotationSchema,
    StudysetSchema,
    SpecificationSchema,
    AnnotationReferenceSchema,
    StudysetReferenceSchema,

)
from .singular import singularize


def get_current_user():
    user = connexion.context.get('user')
    if user:
        return User.query.filter_by(external_id=connexion.context['user']).first()
    return None


def view_maker(cls):
    proc_name = cls.__name__.removesuffix('View').removesuffix('Resource')
    basename = singularize(proc_name, custom={"MetaAnalyses": 'MetaAnalysis'})

    class ClassView(cls):
        _model = globals()[basename]
        _schema = globals()[basename + "Schema"]

    ClassView.__name__ = cls.__name__

    return ClassView


class BaseView(MethodView):

    _model = None
    _nested = {}

    @classmethod
    def update_or_create(cls, data, id=None, commit=True):
        # Store all models so we can atomically update in one commit
        to_commit = []

        current_user = get_current_user()
        if not current_user:
            # user signed up with auth0, but has not made any queries yet...
            # should have endpoint to "create user" after sign on with auth0
            current_user = User(external_id=connexion.context['user'])
            db.session.add(current_user)
            db.session.commit()

        id = id or data.get("id", None)  # want to handle case of {"id": "asdfasf"}

        only_ids = set(data.keys()) - set(['id']) == set()

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
                    db.session.commit()

                return record

        # Update all non-nested attributes
        for k, v in data.items():
            if k not in cls._nested and k not in ["id", "user"]:
                setattr(record, k, v)

        to_commit.append(record)

        # Update nested attributes recursively
        for field, res_name in cls._nested.items():
            ResCls = globals()[res_name]
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
            db.session.commit()

        return record


class ObjectView(BaseView):
    def get(self, id):
        record = self._model.query.filter_by(id=id).first_or_404()
        args = parser.parse(self._user_args, request, location="query")

        return self.__class__._schema(context={'nested': args.get("nested")}).dump(record)

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
    "page_size": fields.Int(missing=20, validate=lambda val: val < 100),
    "source_id": fields.String(missing=None),
    "source": fields.String(missing=None),
    "unique": fields.Boolean(missing=False),
    "nested": fields.Boolean(missing=False),
    "user_id": fields.String(missing=None),
    "dataset_id": fields.String(missing=None),
    "export": fields.Boolean(missing=False),
    "data_type": fields.String(missing=None),
}


class ListView(BaseView):

    _only = None
    _search_fields = []
    _multi_search = None

    def __init__(self):
        # Initialize expected arguments based on class attributes
        self._fulltext_fields = self._multi_search or self._search_fields
        self._user_args = {
            **LIST_USER_ARGS,
            **{f: fields.Str() for f in self._fulltext_fields},
        }

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
        if hasattr(m, 'public'):
            current_user = get_current_user()
            q = q.filter(sae.or_(m.public == True, m.user == current_user))  # noqa E712

        # query annotations for a specific dataset
        if args.get('dataset_id'):
            q = q.filter(m.dataset_id == args.get('dataset_id'))

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

        records = q.paginate(args["page"], args["page_size"], False).items
        # check if results should be nested
        nested = True if args.get("nested") else False
        content = self.__class__._schema(
            only=self._only, many=True, context={'nested': nested}
        ).dump(records)
        response = {
            'metadata': {},
            'results': content,
        }
        return jsonify(response), 200

    def post(self):
        # TODO: check to make sure current user hasn't already created a
        # record with most/all of the same details (e.g., DOI for studies)

        # Parse arguments using webargs
        # args = parser.parse(self._user_args, request, location="query")

        data = parser.parse(self.__class__._schema, request)

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data)
        return self.__class__._schema().dump(record)


# Individual resource views


@view_maker
class MetaAnalysesView(ObjectView, ListView):
    _search_fields = ("name", "description")


@view_maker
class AnnotationsView(ObjectView, ListView):
    _nested = {"annotation_reference": "AnnotationReferenceResource"}


@view_maker
class StudysetsView(ObjectView, ListView):
    _nested = {"studyset_reference": "StudysetReferenceResource"}


@view_maker
class SpecificationsView(ObjectView, ListView):
    pass


@view_maker
class StudysetReferencesResource(ObjectView):
    pass


@view_maker
class AnnotationReferencesResource(ObjectView):
    pass
