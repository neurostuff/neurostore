from __future__ import annotations

from neurosynth_compose.models.analysis import StudysetReference  # noqa: F401
from neurosynth_compose.resources.view_core import ListView, ObjectView, view_maker
from neurosynth_compose.schemas import StudysetReferenceSchema  # noqa: F401


@view_maker
class StudysetReferencesView(ObjectView, ListView):
    pass
