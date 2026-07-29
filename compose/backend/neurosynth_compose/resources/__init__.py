from neurosynth_compose.resources.analysis import (
    ConditionsResource,
    NeurostoreAnnotationsView,
    NeurostoreStudysetsView,
    SnapshotAnnotationsView,
    SnapshotStudysetsView,
    SpecificationConditionsResource,
    SpecificationsView,
    TagsView,
)

# Expose module for tests and external monkeypatching that import
# neurosynth_compose.resources.meta_analysis_jobs
from neurosynth_compose.resources.data_views import (  # noqa: F401
    MetaAnalysesView,
    MetaAnalysisResultsView,
    NeurostoreStudiesView,
    NeurovaultCollectionsView,
    NeurovaultFilesView,
    ProjectsView,
    meta_analysis_jobs_view,
)
from neurosynth_compose.resources.data_views.meta_analysis_jobs_view import (
    MetaAnalysisJobsView,
)
from neurosynth_compose.resources.users import UsersView

__all__ = [
    "ConditionsResource",
    "TagsView",
    "SpecificationConditionsResource",
    "MetaAnalysesView",
    "MetaAnalysisResultsView",
    "NeurovaultCollectionsView",
    "NeurovaultFilesView",
    "NeurostoreStudysetsView",
    "NeurostoreAnnotationsView",
    "SpecificationsView",
    "UsersView",
    "NeurostoreStudiesView",
    "ProjectsView",
    "SnapshotStudysetsView",
    "SnapshotAnnotationsView",
    "MetaAnalysisJobsView",
]
