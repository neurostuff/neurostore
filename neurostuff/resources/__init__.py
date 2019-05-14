import wrapt
from flask_restful import Resource, Api

from .resources import *


def bind_resources(app):
    api = Api(app)
    resources = {
        'datasets/<int:id>': DatasetResource,
        'studies/<int:id>': StudyResource,
        'analyses/<int:id>': AnalysisResource,
        'conditions/<int:id>': ConditionResource,
        'images/<int:id>': ImageResource,
        'points/<int:id>': PointResource,
        'studies/': StudyListResource,
        'analyses/': AnalysisListResource,
        'images/': ImageListResource,
    }
    for route, resource in resources.items():
        api.add_resource(resource, '/api/' + route)
