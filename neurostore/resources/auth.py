from flask.views import MethodView
from ..models import User

class UserView(MethodView):
    _model = User
    _nested = {}

    @property
    def schema(self):
        return globals()[self._model.__name__ + 'Schema']
