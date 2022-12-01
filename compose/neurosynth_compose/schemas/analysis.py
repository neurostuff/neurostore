from marshmallow import (
    fields,
    Schema,
    utils,
    post_load,
    pre_dump,
    ValidationError
)


class BytesField(fields.Field):
    def _deserialize(self, value, attr, data, **kwargs):
        if isinstance(value, str):
            return bytes(value, encoding='latin1')
        return value

    def _serialize(self, value, obj, **kwargs):
        if isinstance(value, bytes):
            return value.decode(encoding='latin1')
        return value

class PGSQLString(fields.String):
    # https://www.commandprompt.com/blog/null-characters-workarounds-arent-good-enough/
    # null character workarounds are good enough for me
    def _deserialize(self, value, attr, data, **kwargs):
        result = super()._deserialize(value, attr, data, **kwargs)
        if result is not None:
            return result.replace("\x00", "\uFFFD")


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
            if self.many:
                return [utils.ensure_text_type(v) for v in value]
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
                return utils.ensure_text_type(value).replace("\x00", "\uFFFD")
            except UnicodeDecodeError as error:
                raise self.make_error("invalid_utf8") from error


class BaseSchema(Schema):
    id = PGSQLString()
    created_at = fields.DateTime()
    updated_at = fields.DateTime(allow_none=True)
    user_id = fields.String(data_key="user")


class EstimatorSchema(Schema):
    type = fields.String()
    args = fields.Dict()

class StudysetReferenceSchema(Schema):
    id = PGSQLString()


class AnnotationReferenceSchema(Schema):
    id = PGSQLString()


class SpecificationSchema(BaseSchema):
    type = PGSQLString()
    mask = PGSQLString(allow_none=True)
    transformer = PGSQLString(allow_none=True)
    estimator = fields.Dict()
    contrast = PGSQLString(allow_none=True)
    filter = PGSQLString(allow_none=True)
    corrector = fields.Dict(allow_none=True)

    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")


class StudysetSchema(BaseSchema):
    snapshot = fields.Dict()
    neurostore_id = fields.Pluck(
        StudysetReferenceSchema,
        "id",
        attribute="studyset_reference"
    )


class AnnotationSchema(BaseSchema):
    snapshot = fields.Dict()
    neurostore_id = fields.Pluck(
        AnnotationReferenceSchema,
        "id",
        attribute="annotation_reference"
    )
    studyset = fields.Pluck(StudysetSchema, "neurostore_id", dump_only=True)
    internal_studyset_id = fields.Pluck(
        StudysetSchema, "id", load_only=True, attribute="studyset"
    )


class MetaAnalysisResultSchema(BaseSchema):
    meta_analysis_id = fields.String()
    cli_version = fields.String()
    estimator = fields.Nested(EstimatorSchema)
    neurovault_collection = fields.Nested("NeurovaultCollectionSchema")

    @post_load
    def propagate_meta_analysis_id(self, data, **kwargs):
        if data.get("neurovault_collection", None):
            data['neurovault_collection']['meta_analysis_id'] = data['meta_analysis_id']
        
        return data
    
    @pre_dump
    def test_fnc(self, data, **kwargs):
        return data



class MetaAnalysisSchema(BaseSchema):
    name = fields.String(allow_none=True)
    description = fields.String(allow_none=True)
    specification_id = StringOrNested(SpecificationSchema, data_key="specification")
    studyset = StringOrNested(StudysetSchema, metadata={'pluck': 'neurostore_id'}, dump_only=True)
    annotation = StringOrNested(
        AnnotationSchema, metadata={'pluck': 'neurostore_id'}, dump_only=True
    )
    internal_studyset_id = fields.Pluck(
        StudysetSchema, "id", load_only=True, attribute="studyset"
    )
    internal_annotation_id = fields.Pluck(
        AnnotationSchema, "id", load_only=True, attribute="annotation"
    )
    results = StringOrNested(MetaAnalysisResultSchema, many=True)


class NeurovaultFileSchema(BaseSchema):
    collection_id = fields.String()
    image_id = fields.String()
    path = fields.String()
    exception = fields.String()
    status = fields.String()
    file = BytesField()
    name = fields.String()
    map_type = fields.String()
    cognitive_contrast_cogatlas = fields.String()
    cognitive_contrast_cogatlas_id = fields.String()
    cognitive_paradigm_cogatlas = fields.String()
    cognitive_paradigm_cogatlas_id = fields.String()


class NeurovaultCollectionSchema(BaseSchema):
    collection_id = fields.String()
    meta_analysis_id = fields.String()
    files = fields.Nested(NeurovaultFileSchema, many=True)
    result = fields.String(attribute="result_id", dump_only=True)

    @pre_dump
    def test_fnc(self, data, **kwargs):
        return data
