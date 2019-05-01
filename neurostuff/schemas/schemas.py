from marshmallow import fields, Schema

from ..models import Study


class BaseSchema(Schema):

    id = fields.Function(lambda x:
            f"http://neurostuff.org/{x.__class__.__tablename__}/{x.id}",
            dump_to="@id")
    type = fields.Function(lambda model: model.__class__.__name__,
                           dump_to="@type")


class StudySchema(BaseSchema):

    class Meta:
        additional = ("name", "description", "publication", "doi", "pmid",
                      "data")
