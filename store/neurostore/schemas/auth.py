from marshmallow import (
    fields,
    EXCLUDE,
)

from .data import BaseSchema


class UserSchema(BaseSchema):
    name = fields.Str(description="User full name")
    external_id = fields.Str(description="External authentication service user ID")

    class Meta:
        unknown = EXCLUDE
