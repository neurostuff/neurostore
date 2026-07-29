from neurosynth_compose.models.analysis import (MetaAnalysis,
                                                MetaAnalysisResult,
                                                NeurostoreAnalysis,
                                                NeurostoreAnnotation,
                                                NeurostoreStudy,
                                                NeurostoreStudyset,
                                                NeurovaultCollection,
                                                NeurovaultFile, Project,
                                                SnapshotAnnotation,
                                                SnapshotStudyset,
                                                Specification, Tag)
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
