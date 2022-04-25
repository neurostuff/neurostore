from marshmallow import (
    fields,
    Schema,
    utils
)


class StringOrNested(fields.Nested):

    #: Default error messages.
    default_error_messages = {
        "invalid": "Not a valid string.",
        "invalid_utf8": "Not a valid utf-8 string.",
    }

    def _serialize(self, value, attr, obj, **kwargs):
        if value is None:
            return None
        nested = self.context.get("nested")
        nested_attr = self.metadata.get('pluck')
        if nested:
            many = self.schema.many or self.many
            nested_obj = getattr(obj, self.data_key or self.name)
            return self.schema.dump(nested_obj, many=many)
        elif nested_attr:
            return getattr(value, nested_attr)
        else:
            return utils.ensure_text_type(value)

    def _deserialize(self, value, attr, data, **kwargs):
        nested = self.context.get("nested")
        if nested:
            self._test_collection(value)
            return self._load(value, data)
        else:
            if not isinstance(value, (str, bytes)):
                raise self.make_error("invalid")
            try:
                return utils.ensure_text_type(value)
            except UnicodeDecodeError as error:
                raise self.make_error("invalid_utf8") from error


class BaseSchema(Schema):
    id = fields.String()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()
    user_id = fields.String(data_key="user")


class StudysetReferenceSchema(Schema):
    neurostore_id = fields.String()


class AnnotationReferenceSchema(Schema):
    neurostore_id = fields.String()


class SpecificationSchema(BaseSchema):
    type = fields.String()
    estimator = fields.Dict()
    contrast = fields.String()
    filter = fields.String()
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
    studyset = fields.Pluck(StudysetSchema, "neurostore_id")


class MetaAnalysisSchema(BaseSchema):
    specification_id = StringOrNested(SpecificationSchema, data_key="specification")
    studyset = StringOrNested(StudysetSchema, metadata={'pluck': 'neurostore_id'})
    annotation = StringOrNested(AnnotationSchema, metadata={'pluck': 'neurostore_id'})
