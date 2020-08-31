import json


from flask import abort, request
from flask_restful import Resource
# from sqlalchemy.ext.associationproxy import ColumnAssociationProxyInstance
import sqlalchemy.sql.expression as sae
from sqlalchemy import func

from ..core import db
from ..models import (Dataset, Study, Analysis, Condition, Image, Point,
                      PointValue)
from ..schemas import (StudySchema, AnalysisSchema, ConditionSchema,
                       ImageSchema, PointSchema, DatasetSchema)

__all__ = [
    'DatasetResource',
    'StudyResource',
    'AnalysisResource',
    'ConditionResource',
    'ImageResource',
    'PointResource',
    'PointValueResource',
    'StudyListResource',
    'AnalysisListResource',
    'ImageListResource',
]


class BaseResource(Resource):

    _model = None
    _nested = {}

    @property
    def schema(self):
        return globals()[self._model.__name__ + 'Schema']

    @classmethod
    def update_or_create(cls, data, id=None, commit=True):

        # Store all models so we can atomically update in one commit
        to_commit = []

        # TODO: do further validation
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
            nested = [ResCls.update_or_create(rec, commit=False)
                      for rec in data[field]]
            setattr(record, field, nested)
            to_commit.extend(nested)

        if commit:
            db.session.add_all(to_commit)
            db.session.commit()

        return record


class ObjectResource(BaseResource):

    def get(self, id):
        record = self._model.query.filter_by(id=id).first()
        if record is None:
            abort(404)
        return self.schema().dump(record)

    def put(self, id):
        json_data = json.loads(request.get_data())
        data, errors = self.schema().load(json_data)
        if errors:
            return errors, 422
        if id != data['id']:
            return 422

        record = self.__class__.update_or_create(data, id)

        return self.schema().dump(record)


class ListResource(BaseResource):

    _only = None
    _search_fields = []
    _multi_search = None

    def get(self):
        m = self._model  # for brevity
        q = m.query

        # Search
        s = request.args.get('search')

        # For multi-column search, default to using search fields
        fulltext_fields = self._multi_search or self._search_fields
        if s is not None and fulltext_fields:
            search_expr = [getattr(m, field).ilike(f"%{s}%")
                           for field in fulltext_fields]
            q = q.filter(sae.or_(*search_expr))

        # Alternatively (or in addition), search on individual fields.
        for field in self._search_fields:
            s = request.args.get(field)
            if s is not None:
                q = q.filter(getattr(m, field).ilike(f"%{s}%"))

        # Sort
        col = request.args.get('sort', 'created_at')
        desc = request.args.get('desc', 1 if col == 'created_at' else 0,
                                type=int)
        desc = {0: 'asc', 1: 'desc'}[desc]

        attr = getattr(m, col)

        # Case-insensitive sorting
        if col != 'created_at':
            attr = func.lower(attr)

        # TODO: if the sort field is proxied, bad stuff happens. In theory
        # the next two lines should address this by joining the proxied model,
        # but weird things are happening. look into this as time allows.
        # if isinstance(attr, ColumnAssociationProxyInstance):
        #     q = q.join(*attr.attr)
        q = q.order_by(getattr(attr, desc)())

        count = q.count()

        # Pagination
        page = request.args.get('page', 1, type=int)
        page_size = request.args.get('page_size', 20, type=int)
        page_size = min([page_size, 100])

        records = q.paginate(page, page_size, False).items
        content = self.schema(only=self._only, many=True).dump(records)
        return content, 200, {'X-Total-Count': count}

    def post(self):
        # TODO: check to make sure current user hasn't already created a
        # record with most/all of the same details (e.g., DOI for studies)
        json_data = json.loads(request.get_data())
        data = self.schema().load(json_data)
        record = self._model(**data)
        db.session.add(record)
        db.session.commit()
        return self.schema().dump(record)


class DatasetResource(ObjectResource):
    _model = Dataset


class StudyResource(ObjectResource):
    _model = Study
    _nested = {
        'analyses': 'AnalysisResource',
    }


class AnalysisResource(ObjectResource):
    _model = Analysis
    _nested = {
        'images': 'ImageResource',
        'points': 'PointResource',
    }


class ConditionResource(ObjectResource):
    _model = Condition


class ImageResource(ObjectResource):
    _model = Image


class PointResource(ObjectResource):
    _model = Point
    _nested = {
        'values': 'PointValueResource',
    }


class PointValueResource(ObjectResource):
    _model = PointValue


class StudyListResource(ListResource):
    _model = Study
    _only = ('name', 'description', 'doi', '_type', '_id', 'created_at')
    _search_fields = ('name', 'description')


class AnalysisListResource(ListResource):
    _model = Analysis
    _search_fields = ('name', 'description')


class ImageListResource(ListResource):
    _model = Image
    _search_fields = ('filename', 'space', 'value_type', 'analysis_name')
