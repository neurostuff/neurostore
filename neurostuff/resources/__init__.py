from webargs import fields
from flask import abort
from flask_apispec import use_kwargs, marshal_with, MethodResource, Ref
from sqlalchemy.orm import noload

from ..core import db
from ..schemas import (StudySchema, AnalysisSchema, ConditionSchema,
                       ImageSchema, PointSchema, DatasetSchema)
from ..models import Dataset, Study, Analysis, Condition, Image, Point


def bind_resources(app, docs):
    resources = {
        'datasets/<id>': DatasetResource,
        'studies/<id>': StudyResource,
        'analyses/<id>': AnalysisResource,
        'conditions/<id>': ConditionResource,
        'images/<id>': ImageResource,
        'points/<id>': PointResource,
    }
    for route, resource in resources.items():
        name = resource.__name__.lower()
        app.add_url_rule('/api/' + route, view_func=resource.as_view(name))
        docs.register(resource, endpoint=name)


class BaseResource(MethodResource):

    _model = None

    @use_kwargs({
        'nested': fields.Bool(missing=False,
                              description="Display mode for nested objects. If"
                              "True, nested objects are displayed in-line. If "
                              "False, JSON-LD identifiers (i.e., IRIs) are "
                              "inserted."),
        'process': fields.String(missing='compact',
                                 description="JSON-LD processing mode "
                                 "('compact', 'expand', or 'flatten').")
        }, locations=['query'])
    @marshal_with(Ref('schema'))
    def get(self, id, **kwargs):
        result = self._model.query.filter_by(id=id).first()
        if result is None:
            abort(404)
        return result

    @use_kwargs(Ref('schema'))
    def put(self, id, **kwargs):
        resource = self._model.query.filter_by(id=id).first()
        if resource is None:
            abort(404)
        resource.update(kwargs)
        db.session.add(resource)
        db.session.commit()

    @property
    def schema(self):
        return globals()[self._model.__name__ + 'Schema']


class DatasetResource(BaseResource):
    _model = Dataset

class StudyResource(BaseResource):
    _model = Study

class AnalysisResource(BaseResource):
    _model = Analysis

class ConditionResource(BaseResource):
    _model = Condition

class ImageResource(BaseResource):
    _model = Image

class PointResource(BaseResource):
    _model = Point
