from .resources import (
    DatasetsView, StudiesView, AnalysesView,
    ConditionsView, ImagesView, PointsView, StudiesListView,
    AnalysesListView, ImagesListView
    )


def bind_resources(app):
    resources = {
        'datasets/<string:id>': DatasetsView,
        'studies/<string:id>': StudiesView,
        'analyses/<string:id>': AnalysesView,
        'conditions/<string:id>': ConditionsView,
        'images/<string:id>': ImagesView,
        'points/<string:id>': PointsView,
        'studies/': StudiesListView,
        'analyses/': AnalysesListView,
        'images/': ImagesListView,
    }
    for route, resource in resources.items():
        with app.app_context():
            app.add_url_rule(
                '/api/' + route,
                view_func=getattr(resource, 'as_view')(route)
                )
