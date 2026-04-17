from __future__ import annotations

from neurosynth_compose.models.analysis import SpecificationCondition  # noqa: F401
from neurosynth_compose.resources.view_core import ObjectView, view_maker
from neurosynth_compose.schemas import SpecificationConditionSchema  # noqa: F401


@view_maker
class SpecificationConditionsResource(ObjectView):
    _nested = {"condition": "ConditionsResource"}
