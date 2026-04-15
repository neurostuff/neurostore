from neurosynth_compose.resources.analysis import (
    AnnotationReferencesResource,
    AnnotationsView,
    ConditionsResource,
    SpecificationConditionsResource,
    SpecificationsView,
    StudysetReferencesView,
    StudysetsView,
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
from neurosynth_compose.resources.data_views.meta_analysis_jobs import (
    MetaAnalysisJobsView,
)

# Expose module for tests and external monkeypatching that import
# neurosynth_compose.resources.meta_analysis_jobs
from neurosynth_compose.resources.data_views import (
    meta_analysis_jobs as meta_analysis_jobs,
)  # noqa: F401
from neurosynth_compose.resources.users import UsersView

__all__ = [
    "ConditionsResource",
    "TagsView",
    "SpecificationConditionsResource",
    "MetaAnalysesView",
    "MetaAnalysisResultsView",
    "NeurovaultCollectionsView",
    "NeurovaultFilesView",
    "AnnotationsView",
    "StudysetsView",
    "StudysetReferencesView",
    "AnnotationReferencesResource",
    "SpecificationsView",
    "UsersView",
    "NeurostoreStudiesView",
    "ProjectsView",
    "MetaAnalysisJobsView",
]
