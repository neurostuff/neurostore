from neurosynth_compose.resources.analysis import (
    NeurostoreAnnotationsView,
    SnapshotAnnotationsView,
    ConditionsResource,
    SpecificationConditionsResource,
    SpecificationsView,
    NeurostoreStudysetsView,
    SnapshotStudysetsView,
    TagsView,
)
from neurosynth_compose.resources.data_views import (
    MetaAnalysesView,
    MetaAnalysisResultsView,
    NeurostoreStudiesView,
    NeurovaultCollectionsView,
    NeurovaultFilesView,
    ProjectsView,
)
from neurosynth_compose.resources.data_views.meta_analysis_jobs_view import (
    MetaAnalysisJobsView,
)

# Expose module for tests and external monkeypatching that import
# neurosynth_compose.resources.meta_analysis_jobs
from neurosynth_compose.resources.data_views import (  # noqa: F401
    meta_analysis_jobs_view,
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
