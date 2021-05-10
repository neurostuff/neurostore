from marshmallow import (
    fields,
    post_load,
    validates,
    ValidationError,
    EXCLUDE
)
from flask_security.utils import encrypt_password

from .data import BaseSchema


class UserSchema(BaseSchema):
    email = fields.Email(required=True)
    name = fields.Str(required=True, description='User full name')
    username = fields.Str(description='User name', dump_only=True)
    password = fields.Str(load_only=True,
                          description='Password. Minimum 6 characters.')
    access_token = fields.Str(dump_only=True)

    @validates('password')
    def validate_pass(self, value):
        if len(value) < 6:
            raise ValidationError('Password must be at least 6 characters.')

    @post_load()
    def encrypt_password(self, in_data, **kwargs):
        if 'password' in in_data:
            in_data['password'] = encrypt_password(in_data['password'])
        return in_data

    class Meta:
        unknown = EXCLUDE
