from marshmallow import fields, Schema


class BaseSchema(Schema):
    context = fields.Constant({"@vocab": "http://neurostuff.org/nimads/"},
                              dump_to="@context", dump_only=True)
    id = fields.String(attribute='IRI', dump_to="@id")
    type = fields.Function(lambda model: model.__class__.__name__,
                           dump_to="@type")


class StudySchema(BaseSchema):

    metadata = fields.Dict(attribute="metadata_")
    class Meta:
        additional = ("name", "description", "publication", "doi", "pmid")


class ConditionSchema(BaseSchema):

    class Meta:
        additional = ("name", "description")


class AnalysisSchema(BaseSchema):

    study = fields.Function(lambda analysis: analysis.study.IRI)
    condition = fields.Nested(ConditionSchema, attribute='conditions',
                              many=True)
    weight = fields.List(fields.Float(), attribute='weights')
    class Meta:
        additional = ("name", "description")
