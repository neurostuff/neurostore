import wrapt
from flask_restful import Resource, Api

from .resources import *


def bind_resources(app):
    api = Api(app)
    resources = {
        'datasets/<string:id>': DatasetResource,
        'studies/<string:id>': StudyResource,
        'analyses/<string:id>': AnalysisResource,
        'conditions/<string:id>': ConditionResource,
        'images/<string:id>': ImageResource,
        'points/<string:id>': PointResource,
        'studies/': StudyListResource,
        'analyses/': AnalysisListResource,
        'images/': ImageListResource,
    }
    for route, resource in resources.items():
        api.add_resource(resource, '/api/' + route)
