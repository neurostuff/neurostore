# import datetime

from flask import jsonify, request
from flask.views import MethodView
from flask_security.utils import verify_password
from flask_jwt_extended import get_jwt_identity, jwt_required, create_access_token
from webargs.flaskparser import parser

from ..models.auth import User  # , user_datastore
from ..schemas import UserSchema # noqa E401
from ..database import db
from ..core import jwt


# Register a callback function that takes whatever object is passed in as the
# identity when creating JWTs and converts it to a JSON serializable format.
@jwt.user_identity_loader
def user_identity_lookup(user):
    return user.id


# Register a callback function that loades a user from your database whenever
# a protected route is accessed. This should return any python object on a
# successful lookup, or None if the lookup failed for any reason (for example
# if the user has been deleted from the database).
@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    identity = jwt_data["sub"]
    return User.query.filter_by(id=identity).one_or_none()


class RegisterView(MethodView):
    _model = User

    @property
    def schema(self):
        return globals()[self._model.__name__ + 'Schema']

    @jwt_required
    def get(self):
        return get_jwt_identity()

    def post(self, **kwargs):
        data = parser.parse(self.schema, request)
        record = self._model()
        # Store all models so we can atomically update in one commit
        to_commit = []

        # Update all non-nested attributes
        for k, v in data.items():
            setattr(record, k, v)

        to_commit.append(record)

        db.session.add_all(to_commit)
        db.session.commit()

        return self.schema().dump(record)


class LoginView(MethodView):
    _model = User

    @property
    def schema(self):
        return globals()[self._model.__name__ + 'Schema']

    def post(self, **kwargs):
        login_schema = self.schema(only=('email', 'password'))
        data = login_schema.load(request.json)
        # do not want the encrypted password
        data['password'] = request.json.get('password')
        user = self._model.query.filter_by(email=data['email']).one_or_none()
        if not user or not verify_password(data['password'], user.password):
            abort(403, 'incorrect email or password')

        user.access_token = create_access_token(identity=user)

        return self.schema(only=('access_token',)).dump(user)


def abort(code, message=''):
    """ JSONified abort """
    from flask import abort, make_response
    abort(make_response(jsonify(message=message), code))
