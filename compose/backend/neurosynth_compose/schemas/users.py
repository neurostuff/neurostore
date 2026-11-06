from marshmallow import EXCLUDE, fields

from neurosynth_compose.owners import owner_id
from neurosynth_compose.schemas.analysis import BaseSchema


class UserSchema(BaseSchema):
    name = fields.Str(metadata={"description": "User full name"})
    external_id = fields.Function(
        lambda user: owner_id(user.external_id),
        deserialize=str,
        metadata={"description": "External authentication service user ID"},
    )

    class Meta:
        unknown = EXCLUDE
