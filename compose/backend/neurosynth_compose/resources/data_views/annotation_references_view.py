from __future__ import annotations

from neurosynth_compose.models.analysis import AnnotationReference  # noqa: F401
from neurosynth_compose.resources.view_core import ObjectView, view_maker
from neurosynth_compose.schemas import AnnotationReferenceSchema  # noqa: F401


@view_maker
class AnnotationReferencesResource(ObjectView):
    pass
