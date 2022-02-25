from marshmallow import (
    fields,
    Schema,
)


class BaseSchema(Schema):
    id = fields.String()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()
    user_id = fields.String(data_key="user")


class SpecificationSchema(BaseSchema):

    type = fields.String()
    estimator = fields.Dict()
    contrast = fields.Dict()
    corrector = fields.Dict()

    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")


class StudysetSchema(BaseSchema):
    studyset = fields.Dict()
    neurostore_id = fields.String()


class AnnotationSchema(BaseSchema):
    annotation = fields.Dict()
    neurostore_id = fields.String()


class MetaAnalysisSchema(BaseSchema):
    specification_id = fields.String(data_key="specification")
    studyset_id = fields.String(data_key="studyset")
    annotation_id = fields.String(data_key="annotation")
