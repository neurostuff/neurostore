from __future__ import annotations

from neurosynth_compose.models.analysis import NeurostoreStudyset  # noqa: F401
from neurosynth_compose.resources.view_core import ListView, ObjectView, view_maker
from neurosynth_compose.schemas import NeurostoreStudysetSchema  # noqa: F401


@view_maker
class NeurostoreStudysetsView(ObjectView, ListView):
    pass
