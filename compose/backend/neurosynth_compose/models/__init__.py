from neurosynth_compose.models.analysis import (
    SnapshotAnnotation,
    NeurostoreAnnotation,
    MetaAnalysis,
    MetaAnalysisResult,
    NeurostoreAnalysis,
    NeurostoreStudy,
    NeurovaultCollection,
    NeurovaultFile,
    Project,
    Specification,
    SnapshotStudyset,
    NeurostoreStudyset,
    Tag,
)
from neurosynth_compose.models.auth import Role, User

Studyset = SnapshotStudyset
StudysetReference = NeurostoreStudyset
Annotation = SnapshotAnnotation
AnnotationReference = NeurostoreAnnotation

__all__ = [
    "Condition",
    "SpecificationCondition",
    "Tag",
    "Specification",
    "Studyset",
    "StudysetReference",
    "Annotation",
    "AnnotationReference",
    "SnapshotStudyset",
    "NeurostoreStudyset",
    "SnapshotAnnotation",
    "NeurostoreAnnotation",
    "MetaAnalysis",
    "MetaAnalysisResult",
    "NeurovaultCollection",
    "NeurovaultFile",
    "NeurostoreStudy",
    "NeurostoreAnalysis",
    "Project",
    "User",
    "Role",
]
