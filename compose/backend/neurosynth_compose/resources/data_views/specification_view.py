from __future__ import annotations

from neurosynth_compose.models.analysis import Specification  # noqa: F401
from neurosynth_compose.resources.view_core import ListView, ObjectView, view_maker
from neurosynth_compose.schemas import SpecificationSchema  # noqa: F401


@view_maker
class SpecificationsView(ObjectView, ListView):
    _nested = {("conditions", "weights"): "SpecificationConditionsResource"}
    _attribute_name = "specification_conditions"
