from .analysis import (
    ConditionsResource,
    SpecificationConditionsResource,
    MetaAnalysesView,
    MetaAnalysisResultsView,
    NeurovaultCollectionsView,
    NeurovaultFilesView,
    AnnotationsView,
    StudysetsView,
    SpecificationsView,
    StudysetReferencesView,
    AnnotationReferencesResource,
    NeurostoreStudiesView,
    ProjectsView,
)

from .users import UsersView

# Function wrappers for connexion operationId resolution
def studysets_get():
    """Wrapper for StudysetsView.get"""
    view = StudysetsView()
    return view.get()

def studysets_post():
    """Wrapper for StudysetsView.post"""
    view = StudysetsView()
    return view.post()

def studysets_put():
    """Wrapper for StudysetsView.put"""
    view = StudysetsView()
    return view.put()

__all__ = [
    "ConditionsResource",
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
    # Function wrappers
    "studysets_get",
    "studysets_post", 
    "studysets_put",
]
