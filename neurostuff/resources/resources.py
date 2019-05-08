from webargs import fields
from flask import abort, request
from flask_restful import Resource
from sqlalchemy.orm import noload

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

    def get(self, **kwargs):
        # TODO: Add filtering constraints
        page = request.args.get('page', 1, type=int)
        page_size = request.args.get('page_size', 20, type=int)
        page_size = min([page_size, 100])
        records = self._model.query.paginate(page, page_size, False).items
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
    _only = ('name', 'description', 'doi', '_type', '_id')

class AnalysisListResource(ListResource):
    _model = Analysis
    # _only = ('name', 'description', 'doi', '_type', '_id')