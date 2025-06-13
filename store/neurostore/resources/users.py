import connexion
from flask import request, abort
from webargs.flaskparser import parser

from .data import ListView, ObjectView
from ..models.auth import User
from ..schemas import UserSchema  # noqa E401
from ..database import db


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

        return self.__class__._schema().dump(record)

    def put(self, id):
        current_user = User.query.filter_by(
            external_id=connexion.context["user"]
        ).first()
        data = parser.parse(self.__class__._schema, request)
        if id != data["id"] or id != current_user.id:
            return abort(
                422,
                description=(
                    f"User ID mismatch. "
                    f"URL ID: {id}, Data ID: {data['id']}, "
                    f"Current User ID: {current_user.id}"
                ),
            )

        record = self._model.query.filter_by(id=id).first()

        if record is None:
            abort(422, description=f"User record not found with ID: {id}")

        for k, v in data.items():
            setattr(record, k, v)

        db.session.add(record)
        db.session.commit()

        return self.__class__._schema().dump(record)
