from .resources import (
    DatasetResource, StudyResource, AnalysisResource,
    ConditionResource, ImageResource, PointResource, StudyListResource,
    AnalysisListResource, ImageListResource
    )


def bind_resources(app):
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
        with app.app_context():
            app.add_url_rule(
                '/api/' + route,
                view_func=getattr(resource, 'as_view')(route)
                )
