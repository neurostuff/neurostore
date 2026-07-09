from neurostore.models import AnalysisConditions
from neurostore.resources.base import BaseView
from neurostore.schemas import AnalysisConditionSchema


class AnalysisConditionsResource(BaseView):
    _m2o = {
        "analysis": "AnalysesView",
        "condition": "ConditionsView",
    }
    _nested = {"condition": "ConditionsView"}
    _parent = {"analysis": "AnalysesView"}
    _model = AnalysisConditions
    _schema = AnalysisConditionSchema
    _composite_key = {}
