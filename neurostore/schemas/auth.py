from marshmallow import (
    fields,
    EXCLUDE,
)

from .data import BaseSchema


class UserSchema(BaseSchema):
    name = fields.Str(description='User full name')
    neuroid = fields.Str(description="universal id")

    class Meta:
        unknown = EXCLUDE
