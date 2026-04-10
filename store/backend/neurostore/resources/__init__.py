from neurostore.resources import data_views
from neurostore.resources.data import *  # noqa: F401,F403
from neurostore.resources.pipeline import (
    PipelineConfigsView,
    PipelineEmbeddingsView,
    PipelineStudyResultsView,
    PipelinesView,
)
from neurostore.resources.users import UsersView

__all__ = [
    *data_views.__all__,
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
