from flask import abort, request, jsonify
from flask.views import MethodView
# from sqlalchemy.ext.associationproxy import ColumnAssociationProxyInstance
import sqlalchemy.sql.expression as sae
from sqlalchemy import func
from webargs.flaskparser import parser
from webargs import fields

from ..core import db
from ..models import (Dataset, Study, Analysis, Condition, Image, Point,
                      PointValue)
from ..schemas import (StudySchema, AnalysisSchema, ConditionSchema,
                       ImageSchema, PointSchema, DatasetSchema)

__all__ = [
    'DatasetsView',
    'StudiesView',
    'AnalysesView',
    'ConditionsView',
    'ImagesView',
    'PointsView',
    'PointValueView',
    'StudiesListView',
    'AnalysesListView',
    'ImagesListView',
]


class BaseView(MethodView):

    _model = None
    _nested = {}

    @property
    def schema(self):
        return globals()[self._model.__name__ + 'Schema']

    @classmethod
    def update_or_create(cls, data, id=None, commit=True):

        # Store all models so we can atomically update in one commit
        to_commit = []

        id = id or data.get('id')

        if id is None:
            # TODO: associate with user
            record = cls._model()
        else:
            record = cls._model.query.filter_by(id=id).first()
            if record is None:
                abort(422)

        # Update all non-nested attributes
        for k, v in data.items():
            if k not in cls._nested and k != 'id':
                setattr(record, k, v)

        to_commit.append(record)

        # Update nested attributes recursively
        for field, res_name in cls._nested.items():
            ResCls = globals()[res_name]
            if data.get(field):
                nested = [ResCls.update_or_create(rec, commit=False)
                        for rec in data.get(field)]
                setattr(record, field, nested)
                to_commit.extend(nested)

        if commit:
            db.session.add_all(to_commit)
            db.session.commit()

        return record


class ObjectView(BaseView):

    def get(self, id):
        record = self._model.query.filter_by(id=id).first_or_404()
        return self.schema().dump(record)

    def put(self, id):
        data = parser.parse(self.schema, request)
        if id != data['id']:
            return abort(422)

        record = self.__class__.update_or_create(data, id)

        return self.schema().dump(record)


LIST_USER_ARGS = {
    'search': fields.String(missing=None),
    'sort': fields.String(missing='created_at'),
    'page': fields.Int(missing=1),
    'desc': fields.Boolean(missing=True),
    'page_size': fields.Int(missing=20, validate=lambda val: val < 100)
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
            **{f: fields.Str() for f in self._fulltext_fields}
            }

    def search(self):
        # Parse arguments using webargs
        args = parser.parse(self._user_args, request, location='query')

        m = self._model  # for brevity
        q = m.query

        # Search
        s = args['search']

        # For multi-column search, default to using search fields
        if s is not None and self._fulltext_fields:
            search_expr = [getattr(m, field).ilike(f"%{s}%")
                           for field in self._fulltext_fields]
            q = q.filter(sae.or_(*search_expr))

        # Alternatively (or in addition), search on individual fields.
        for field in self._search_fields:
            s = args.get(field, None)
            if s is not None:
                q = q.filter(getattr(m, field).ilike(f"%{s}%"))

        # Sort
        sort_col = args['sort']
        desc = False if sort_col != 'created_at' else args['desc']
        desc = {False: 'asc', True: 'desc'}[desc]

        attr = getattr(m, sort_col)

        # Case-insensitive sorting
        if sort_col != 'created_at':
            attr = func.lower(attr)

        # TODO: if the sort field is proxied, bad stuff happens. In theory
        # the next two lines should address this by joining the proxied model,
        # but weird things are happening. look into this as time allows.
        # if isinstance(attr, ColumnAssociationProxyInstance):
        #     q = q.join(*attr.attr)
        q = q.order_by(getattr(attr, desc)())

        count = q.count()

        records = q.paginate(args['page'], args['page_size'], False).items
        content = self.schema(only=self._only, many=True).dump(records)
        return jsonify(content), 200, {'X-Total-Count': count}

    def post(self):
        # TODO: check to make sure current user hasn't already created a
        # record with most/all of the same details (e.g., DOI for studies)
        data = parser.parse(self.schema, request)
        record = self.__class__.update_or_create(data, id)
        return self.schema().dump(record)


class DatasetsView(ObjectView):
    _model = Dataset


class StudiesView(ObjectView):
    _model = Study
    _nested = {
        'analyses': 'AnalysesView',
    }


class AnalysesView(ObjectView):
    _model = Analysis
    _nested = {
        'images': 'ImagesView',
        'points': 'PointsView',
    }


class ConditionsView(ObjectView):
    _model = Condition


class ImagesView(ObjectView):
    _model = Image


class PointsView(ObjectView):
    _model = Point
    _nested = {
        'values': 'PointValueView',
    }


class PointValueView(ObjectView):
    _model = PointValue


class StudiesListView(ListView):
    _model = Study
    # _only = ('name', 'description', 'doi', '_type', '_id', 'created_at')
    _search_fields = ('name', 'description')


class AnalysesListView(ListView):
    _model = Analysis
    _search_fields = ('name', 'description')


class ImagesListView(ListView):
    _model = Image
    _search_fields = ('filename', 'space', 'value_type', 'analysis_name')
