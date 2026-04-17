from __future__ import annotations

from neurosynth_compose.models.analysis import Condition  # noqa: F401
from neurosynth_compose.resources.view_core import ObjectView, view_maker
from neurosynth_compose.schemas import ConditionSchema  # noqa: F401


@view_maker
class ConditionsResource(ObjectView):
    pass
