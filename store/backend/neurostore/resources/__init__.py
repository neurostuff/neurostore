from neurostore.resources.data import (
    StudysetsView,
    AnnotationsView,
    AnnotationAnalysesView,
    BaseStudiesView,
    StudiesView,
    AnalysesView,
    TablesView,
    ConditionsView,
    ImagesView,
    PointsView,
    PointValuesView,
)

from neurostore.resources.users import (
    UsersView,
)

from neurostore.resources.pipeline import (
    PipelinesView,
    PipelineConfigsView,
    PipelineStudyResultsView,
    PipelineEmbeddingsView,
)

__all__ = [
    "StudysetsView",
    "AnnotationsView",
    "AnnotationAnalysesView",
    "BaseStudiesView",
    "StudiesView",
    "AnalysesView",
    "TablesView",
    "ConditionsView",
    "ImagesView",
    "PointsView",
    "PointValuesView",
    "UsersView",
    "PipelinesView",
    "PipelineConfigsView",
    "PipelineStudyResultsView",
    "PipelineEmbeddingsView",
]


def iter_request_body_validation_skip_rules():
    for name in __all__:
        resource = globals().get(name)
        if resource is None:
            continue
        for rule in getattr(resource, "request_body_validation_skip", ()):
            yield rule
