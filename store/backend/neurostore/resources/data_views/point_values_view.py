from neurostore.resources.base import ListView, ObjectView
from neurostore.resources.utils import view_maker


@view_maker
class PointValuesView(ObjectView, ListView):
    _m2o = {"point": "PointsView"}
