from marshmallow import EXCLUDE, fields

from neurosynth_compose.schemas.analysis import BaseSchema


class UserSchema(BaseSchema):
    name = fields.Str(metadata={"description": "User full name"})
    external_id = fields.Str(
        metadata={"description": "External authentication service user ID"}
    )

    class Meta:
        unknown = EXCLUDE
