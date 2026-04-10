from neurostore.models import Entity
from neurostore.resources.base import BaseView
from neurostore.schemas import EntitySchema


class EntitiesResource(BaseView):
    _m2o = {
        "image": "ImagesView",
        "point": "PointsView",
    }
    _parent = {
        "image": "ImagesView",
        "point": "PointsView",
    }
    _model = Entity
    _schema = EntitySchema
