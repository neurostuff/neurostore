from webargs import fields
from flask import abort, request
from flask_restful import Resource
from sqlalchemy.orm import noload
import sqlalchemy.sql.expression as sae

from ..core import db
from ..schemas import (StudySchema, AnalysisSchema, ConditionSchema,
                       ImageSchema, PointSchema, DatasetSchema)
from ..models import Dataset, Study, Analysis, Condition, Image, Point


__all__ = [
    'DatasetResource',
    'StudyResource',
    'AnalysisResource',
    'ConditionResource',
    'ImageResource',
    'PointResource',
    'StudyListResource',
    'AnalysisListResource'
]


class BaseResource(Resource):

    _model = None

    @property
    def schema(self):
        return globals()[self._model.__name__ + 'Schema']


class ObjectResource(BaseResource):

    def get(self, id, **kwargs):
        record = self._model.query.filter_by(id=id).first()
        if record is None:
            abort(404)
        return self.schema().dump(record).data

    def put(self, id, **kwargs):
        record = self._model.query.filter_by(id=id).first()
        if record is None:
            abort(404)
        for k, v in kwargs.items():
            setattr(record, k, v)
        db.session.add(record)
        db.session.commit()
        return self.schema().dump(record).data


class ListResource(BaseResource):

    _only = None
    _search_fields = []

    def get(self, **kwargs):

        m = self._model # for brevity
        q = m.query

        # Search
        s = request.args.get('search')
        if s is not None and self._search_fields:
            search_expr = [getattr(m, field).ilike(f"%{s}%")
                           for field in self._search_fields]
            q = q.filter(sae.or_(*search_expr))

        # Sort
        col = request.args.get('sort', 'created_at')
        desc = request.args.get('desc', 1 if col == 'created_at' else 0,
                                type=int)
        direction = sae.desc if desc else sae.asc
        q = q.order_by(direction(getattr(m, col)))

        # Pagination
        page = request.args.get('page', 1, type=int)
        page_size = request.args.get('page_size', 20, type=int)
        page_size = min([page_size, 100])

        records = q.paginate(page, page_size, False).items
        if not records:
            abort(404)
        return self.schema(only=self._only, many=True).dump(records).data

    def post(self, **kwargs):
        # TODO: check to make sure current user hasn't already created a
        # record with most/all of the same details (e.g., DOI for studies)
        record = self._model(**kwargs)
        db.session.add(record)
        db.session.commit()
        return self.schema().dump(record).data


class DatasetResource(ObjectResource):
    _model = Dataset

class StudyResource(ObjectResource):
    _model = Study

class AnalysisResource(ObjectResource):
    _model = Analysis

class ConditionResource(ObjectResource):
    _model = Condition

class ImageResource(BaseResource):
    _model = Image

class PointResource(BaseResource):
    _model = Point

class StudyListResource(ListResource):
    _model = Study
    _only = ('name', 'description', 'doi', '_type', '_id', 'created_at')
    _search_fields = ('name', 'description')

class AnalysisListResource(ListResource):
    _model = Analysis
    _search_fields = ('name', 'description')