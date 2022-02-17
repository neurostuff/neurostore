from marshmallow import (
    fields,
    Schema,
)


class BaseSchema(Schema):
    id = fields.String()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()
    user = fields.String(attribute="user_id")


class MetaAnalysisSchema(BaseSchema):

    type = fields.String()
    estimator = fields.Dict()
    contrast = fields.Dict()
    corrector = fields.Dict()

    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")


class StudySetSchema(BaseSchema):
    studyset = fields.Dict()
    neurostore_id = fields.String()


class AnnotationSchema(BaseSchema):
    annotation = fields.Dict()
    neurostore_id = fields.String()


class BundleSchema(BaseSchema):
    meta_analysis = fields.String()
    studyset = fields.String()
    annotation = fields.String()
