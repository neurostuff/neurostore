import connexion
from flask import request
from neurostore.database import db
from neurostore.exceptions.utils.error_helpers import (abort_not_found,
                                                       abort_unprocessable)
from neurostore.models.auth import User
from neurostore.resources.base import ListView, ObjectView
from neurostore.schemas import UserSchema  # noqa E401
from webargs.flaskparser import parser


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
            abort_unprocessable(
                f"User ID mismatch. URL ID: {id}, Data ID: {data['id']}, "
                f"Current User ID: {current_user.id}"
            )

        record = self._model.query.filter_by(id=id).first()

        if record is None:
            abort_not_found("User", str(id))

        for k, v in data.items():
            setattr(record, k, v)

        db.session.add(record)
        db.session.commit()

        return self.__class__._schema().dump(record)
