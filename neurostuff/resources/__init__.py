from webargs import fields
from flask_apispec import use_kwargs, marshal_with, MethodResource

from ..schemas import StudySchema
from ..models import Dataset, Study


def bind_resources(app):
    resources = {
        'studies/<id>': StudyResource
    }
    for route, resource in resources.items():
        name = resource.__name__.lower()
        app.add_url_rule('/api/' + route, view_func=resource.as_view(name))


class StudyResource(MethodResource):

    @marshal_with(StudySchema)
    def get(self, id):
        return Study.query.filter_by(id=id).first()
