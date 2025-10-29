import connexion
from flask import request, abort
from webargs.flaskparser import parser

from .analysis import ListView, ObjectView, _make_json_response
from ..models.auth import User
from ..schemas import UserSchema  # noqa E401
from ..database import db
from sqlalchemy import select


class UsersView(ObjectView, ListView):
    _model = User
    _schema = UserSchema

    def post(self, **kwargs):
        data = parser.parse(self.__class__._schema, request)
        record = self._model()
        # Store all models so we can atomically update in one commit
        to_commit = []

        # Update all non-nested attributes
        for k, v in data.items():
            setattr(record, k, v)

        to_commit.append(record)

        db.session.add_all(to_commit)
        db.session.commit()

        payload = self.__class__._schema().dump(record)
        return _make_json_response(payload)

    def put(self, id):
        current_user = db.session.execute(
            select(User).where(User.external_id == connexion.context.context["user"])
        ).scalar_one_or_none()
        data = parser.parse(self.__class__._schema, request)
        if id != data["id"] or id != current_user.id:
            return abort(422)

        record = db.session.execute(
            select(self._model).where(self._model.id == id)
        ).scalar_one_or_none()

        if record is None:
            abort(422)

        for k, v in data.items():
            setattr(record, k, v)

        db.session.add(record)
        db.session.commit()

        payload = self.__class__._schema().dump(record)
        return _make_json_response(payload)
