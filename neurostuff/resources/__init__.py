from webargs import fields
from flask import abort, request
from flask_apispec import use_kwargs, marshal_with, MethodResource, Ref
from sqlalchemy.orm import noload

from ..schemas import (StudySchema, AnalysisSchema, ConditionSchema,
                       ImageSchema, PointSchema)
from ..models import Dataset, Study, Analysis, Condition, Image, Point


def bind_resources(app, docs):
    resources = {
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

    @marshal_with(Ref('schema'))
    def get(self, id):
        result = self._model.query.filter_by(id=id).first()
        if result is None:
            abort(404)
        return result

    @property
    def schema(self):
        return globals()[self._model.__name__ + 'Schema']


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
