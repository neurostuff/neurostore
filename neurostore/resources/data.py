import re

import connexion
from flask import abort, request, jsonify
from flask.views import MethodView

# from sqlalchemy.ext.associationproxy import ColumnAssociationProxyInstance
import sqlalchemy.sql.expression as sae
from sqlalchemy import func
from webargs.flaskparser import parser
from webargs import fields

from ..core import db
from ..models import Dataset, Study, Analysis, Condition, Image, Point, PointValue, AnalysisConditions, User, AnnotationAnalysis, Annotation  # noqa E401


from ..schemas import (  # noqa E401
    DatasetSchema,
    AnnotationSchema,
    StudySchema,
    AnalysisSchema,
    ConditionSchema,
    ImageSchema,
    PointSchema,
    PointValueSchema,
    AnalysisConditionSchema,
    AnnotationAnalysisSchema,
)


__all__ = [
    "DatasetView",
    "AnnotationView",
    "StudyView",
    "AnalysisView",
    "ConditionView",
    "ImageView",
    "PointView",
    "PointListView",
    "PointValueView",
    "StudyListView",
    "AnnotationListView",
    "AnalysisListView",
    "ImageListView",
    "DatasetListView",
    "ConditionListView",
]

PARENT_RESOURCES = {'study': Study, 'analysis': Analysis, 'dataset': Dataset}

# https://www.geeksforgeeks.org/python-split-camelcase-string-to-individual-strings/
def camel_case_split(str):
    return re.findall(r'[A-Z](?:[a-z]+|[A-Z]*(?=[A-Z]|$))', str)


def get_current_user():
    user = connexion.context.get('user')
    if user:
        return User.query.filter_by(external_id=connexion.context['user']).first()
    return None


def view_maker(cls):
    basename = camel_case_split(cls.__name__)[0]

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
            if k in PARENT_RESOURCES:
                # DO NOT WANT PEOPLE TO BE ABLE TO ADD ANALYSES TO STUDIES UNLESS THEY OWN THE STUDY
                v = PARENT_RESOURCES[k].query.filter_by(id=v).first()
            if k not in cls._nested and k not in ["id", "user"]:
                setattr(record, k, v)

        to_commit.append(record)

        # Update nested attributes recursively
        for field, res_name in cls._nested.items():
            ResCls = globals()[res_name]
            if data.get(field):
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
        current_user = get_current_user()
        user_id = None if not current_user else current_user.external_id

        if hasattr(record, 'public') and not record.public and record.user_id != user_id:
            abort(403)

        nested = request.args.get("nested")
        return self.__class__._schema(context={'nested': nested}).dump(record)

    def put(self, id):
        data = parser.parse(self.__class__._schema, request)

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data, id)

        return self.__class__._schema().dump(record)


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
        # (only pertinant for studies currently)
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

        if args.get('unique'):
            if hasattr(m, 'source_id'):
                q = q.filter((Study.source != 'neurostore') | (Study.source_id == None))  # noqa E711
            elif hasattr(m, 'study'):
                q = q.join(Study).filter(
                    (Study.source != 'neurostore') | (Study.source_id == None)  # noqa E711
                )
            elif hasattr(m, 'analysis'):
                q = q.join(Analysis).join(Study).filter(
                    (Study.source != 'neurostore') | (Study.source_id == None)  # noqa E711
                )
            else:
                # nothing to do here
                pass
            unique_count = count = q.count()
        else:
            # unique_count may need to represent user clones
            # instead of original studies
            # (e.g., a clone may have a different number of points
            # than the original)
            count = q.count()
            if hasattr(m, 'source_id'):
                unique_count = q.filter_by(source_id=None).count()
            elif hasattr(m, 'study'):
                unique_count = q.join(Study).filter_by(source_id=None).count()
            elif hasattr(m, 'analysis'):
                unique_count = q.join(Analysis).join(Study).filter_by(source_id=None).count()
            else:
                unique_count = count

        records = q.paginate(args["page"], args["page_size"], False).items
        # check if results should be nested
        nested = True if args.get("nested") else False
        content = self.__class__._schema(
            only=self._only, many=True, context={'nested': nested}
        ).dump(records)
        response = {
            'metadata': {'total_count': count, 'unique_count': unique_count},
            'results': content,
        }
        return jsonify(response), 200

    def post(self):
        # TODO: check to make sure current user hasn't already created a
        # record with most/all of the same details (e.g., DOI for studies)

        # Parse arguments using webargs
        args = parser.parse(self._user_args, request, location="query")
        source_id = args.get('source_id')
        source = args.get('source') or 'neurostore'
        if source_id:
            data = self._load_from_source(source, source_id)
        else:
            data = parser.parse(self.__class__._schema, request)

        nested = bool(request.args.get("nested") or request.args.get("source_id"))
        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data)
        return self.__class__._schema(context={'nested': nested}).dump(record)

# Individual resource views


@view_maker
class DatasetView(ObjectView):
    _nested = {
        "studies": "StudyView",
        "annotations": "AnnotationView",
    }


@view_maker
class AnnotationView(ObjectView):
    _nested = {
        "annotation_analyses": "AnnotationAnalysisResource"
    }


@view_maker
class StudyView(ObjectView):
    _nested = {
        "analyses": "AnalysisView",
    }


@view_maker
class AnalysisView(ObjectView):
    _nested = {
        "images": "ImageView",
        "points": "PointView",
        "analysis_conditions": "AnalysisConditionResource"
    }


@view_maker
class ConditionView(ObjectView):
    pass


@view_maker
class ImageView(ObjectView):
    pass


@view_maker
class PointView(ObjectView):
    _nested = {
        "values": "PointValueView",
    }


@view_maker
class PointValueView(ObjectView):
    pass


# List resource views

@view_maker
class DatasetListView(ListView):
    _nested = {
        "studies": "StudyView"
    }
    _search_fields = ("name", "description", "publication", "doi", "pmid")


@view_maker
class AnnotationListView(ListView):
    _nested = {
        "annotation_analyses": "AnnotationAnalysisResource",
        "dataset": "DatasetView",
    }
    _search_fields = ("name", "description")

    @classmethod
    def _load_from_source(cls, source, source_id):
        if source == "neurostore":
            return cls.load_from_neurostore(source_id)

    @classmethod
    def load_from_neurostore(cls, source_id):
        annotation = cls._model.query.filter_by(id=source_id).first_or_404()
        parent_source_id = annotation.source_id
        parent_source = annotation.source
        while parent_source_id is not None and parent_source == 'neurostore':
            source_id = parent_source_id
            parent = cls._model.query.filter_by(
                id=source_id
            ).first_or_404()
            parent_source = parent.source
            parent_source_id = parent.source_id

        schema = cls._schema(copy=True)
        data = schema.load(schema.dump(annotation))
        data['source'] = "neurostore"
        data['source_id'] = source_id
        data['source_updated_at'] = annotation.updated_at or annotation.created_at
        return data


@view_maker
class StudyListView(ListView):
    _nested = {
        "analyses": "AnalysisView",
    }
    _search_fields = ("name", "description", "source_id", "source", "authors", "publication")

    @classmethod
    def _load_from_source(cls, source, source_id):
        if source == "neurostore":
            return cls.load_from_neurostore(source_id)
        elif source == "neurovault":
            return cls.load_from_neurovault(source_id)
        elif source == "pubmed":
            return cls.load_from_pubmed(source_id)

    @classmethod
    def load_from_neurostore(cls, source_id):
        study = cls._model.query.filter_by(id=source_id).first_or_404()
        parent_source_id = study.source_id
        parent_source = study.source
        while parent_source_id is not None and parent_source == 'neurostore':
            source_id = parent_source_id
            parent = cls._model.query.filter_by(
                id=source_id
            ).first_or_404()
            parent_source = parent.source
            parent_source_id = parent.source_id

        schema = cls._schema(copy=True)
        data = schema.load(schema.dump(study))
        data['source'] = "neurostore"
        data['source_id'] = source_id
        data['source_updated_at'] = study.updated_at or study.created_at
        return data

    @classmethod
    def load_from_neurovault(cls, source_id):
        pass

    @classmethod
    def load_from_pubmed(cls, source_id):
        pass


@view_maker
class AnalysisListView(ListView):
    _nested = {
        "images": "ImageView",
        "points": "PointView",
        "analysis_conditions": "AnalysisConditionResource"
    }

    _search_fields = ("name", "description")


@view_maker
class ConditionListView(ListView):
    _search_fields = ("name", "description")


@view_maker
class ImageListView(ListView):
    _search_fields = ("filename", "space", "value_type", "analysis_name")


@view_maker
class PointListView(ListView):
    _nested = {
        "values": "PointValueView"
    }


# Utility resources for updating data
class AnalysisConditionResource(BaseView):
    _nested = {'condition': 'ConditionView'}
    _model = AnalysisConditions
    _schema = AnalysisConditionSchema


class AnnotationAnalysisResource(BaseView):
    _nested = {
        'analysis': "AnalysisView",
        'study': 'StudyView',
    }
    _model = AnnotationAnalysis
    _schema = AnnotationAnalysisSchema
