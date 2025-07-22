from marshmallow import fields, Schema, utils, post_load, post_dump, pre_load


# neurovault api base URL
NV_BASE = "https://neurovault.org/api"

# neurostore api base URL
NS_BASE = "https://neurostore.org/api"


class BytesField(fields.Field):
    def _deserialize(self, value, attr, data, **kwargs):
        if isinstance(value, str):
            return bytes(value, encoding="latin1")
        return value

    def _serialize(self, value, obj, **kwargs):
        if isinstance(value, bytes):
            return value.decode(encoding="latin1")
        return value


class PGSQLString(fields.String):
    # https://www.commandprompt.com/blog/null-characters-workarounds-arent-good-enough/
    # null character workarounds are good enough for me
    def _deserialize(self, value, attr, data, **kwargs):
        result = super()._deserialize(value, attr, data, **kwargs)
        if result is not None:
            return result.replace("\x00", "\uFFFD")


class ResultInitSchema(Schema):
    meta_analysis_id = fields.String(load_only=True)
    meta_analysis = fields.Pluck(
        "MetaAnalysisSchema", "id", attribute="meta_analysis", dump_only=True
    )
    studyset_snapshot = fields.Dict()
    annotation_snapshot = fields.Dict()
    specification_snapshot = fields.Dict()


class ResultUploadSchema(Schema):
    statistical_maps = fields.Raw(metadata={"many": True})
    cluster_tables = fields.Raw(metadata={"many": True})
    diagnostic_tables = fields.Raw(metadata={"many": True})
    method_description = fields.String()


class IDOrNested(fields.Field):
    """
    Marshmallow field that serializes/deserializes either a string ID or a nested object,
    depending on the 'nested' parameter in the schema context.
    """
    def __init__(self, nested_schema, id_field="id", many=False, **kwargs):
        super().__init__(**kwargs)
        self.nested_schema = nested_schema
        self.id_field = id_field
        self.many = many

    def _serialize(self, value, attr, obj, **kwargs):
        nested = self.parent.context.get("nested") if self.parent and hasattr(self.parent, "context") else False
        if nested:
            schema = self.nested_schema(many=self.many, context=self.parent.context if self.parent else None)
            return schema.dump(value)
        else:
            if self.many:
                return [getattr(v, self.id_field, v) for v in value]
            return getattr(value, self.id_field, value)

    def _deserialize(self, value, attr, data, **kwargs):
        nested = self.parent.context.get("nested") if self.parent and hasattr(self.parent, "context") else False
        schema = self.nested_schema(many=self.many, context=self.parent.context if self.parent else None)
        if nested:
            return schema.load(value)
        else:
            if self.many:
                return value if isinstance(value, list) else [value]
            return value
# StringOrNested replaced by IDOrNested (see above)


class BaseSchema(Schema):
    id = PGSQLString(metadata={"info_field": True})
    created_at = fields.DateTime()
    updated_at = fields.DateTime(allow_none=True)
    user_id = fields.String(data_key="user")
    username = fields.String(
        attribute="user.name", dump_only=True, metadata={"info_field": True}
    )


class ConditionSchema(Schema):
    id = PGSQLString()
    created_at = fields.DateTime()
    updated_at = fields.DateTime(allow_none=True)
    name = PGSQLString()
    description = PGSQLString()


class SpecificationConditionSchema(BaseSchema):
    condition = fields.Pluck(ConditionSchema, "name")
    weight = fields.Float()


class EstimatorSchema(Schema):
    type = fields.String()
    args = fields.Dict()


class StudysetReferenceSchema(Schema):
    id = PGSQLString()
    created_at = fields.DateTime()
    updated_at = fields.DateTime(allow_none=True)
    studysets = IDOrNested(
        "StudysetSchema",
        exclude=("snapshot",),
        metadata={"pluck": "id", "many": True},
        dump_only=True,
    )


class AnnotationReferenceSchema(Schema):
    id = PGSQLString()


class SpecificationSchema(BaseSchema):
    type = PGSQLString()
    mask = PGSQLString(allow_none=True)
    transformer = PGSQLString(allow_none=True)
    estimator = fields.Nested("EstimatorSchema")
    database_studyset = PGSQLString(allow_none=True)
    contrast = PGSQLString(allow_none=True)
    filter = PGSQLString(allow_none=True)
    corrector = fields.Dict(allow_none=True)
    _conditions = fields.List(
        fields.Pluck(
            SpecificationConditionSchema,
            "condition",
            allow_none=True,
        ),
        load_only=True,
        # attribute="conditions",
        data_key="conditions",
    )
    conditions = fields.List(
        fields.Pluck(ConditionSchema, "name", allow_none=True, dump_only=True)
    )
    weights = fields.List(
        fields.Float(),
        allow_none=True,
        dump_only=True,
    )
    _weights = fields.List(
        fields.Pluck(
            SpecificationConditionSchema,
            "weight",
            many=True,
            allow_none=True,
        ),
        load_only=True,
        data_key="weights",
        attribute="weights",
    )

    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")

    @post_dump
    def to_bool(self, data, **kwargs):
        conditions = data.get("conditions", None)
        if conditions:
            output_conditions = conditions[:]
            for i, cond in enumerate(conditions):
                if cond.lower() == "true":
                    output_conditions[i] = True
                elif cond.lower() == "false":
                    output_conditions[i] = False
            data["conditions"] = output_conditions

        return data

    @pre_load
    def to_string(self, data, **kwargs):
        conditions = data.get("conditions", None)
        if conditions:
            output_conditions = conditions[:]
            for i, cond in enumerate(conditions):
                if cond is True:
                    output_conditions[i] = "true"
                elif cond is False:
                    output_conditions[i] = "false"
            data["conditions"] = output_conditions

        return data


class StudysetSchema(BaseSchema):
    snapshot = fields.Dict()
    neurostore_id = fields.Pluck(
        StudysetReferenceSchema, "id", attribute="studyset_reference"
    )
    version = fields.String(allow_none=True)
    url = fields.String(dump_only=True)

    @post_dump
    def create_neurostore_url(self, data, **kwargs):
        if data.get("neurostore_id", None):
            data["url"] = "/".join([NS_BASE, "studysets", data["neurostore_id"]])
        else:
            data["url"] = None
        return data


class AnnotationSchema(BaseSchema):
    snapshot = fields.Dict()
    neurostore_id = fields.Pluck(
        AnnotationReferenceSchema, "id", attribute="annotation_reference"
    )
    studyset = fields.Pluck(StudysetSchema, "neurostore_id", dump_only=True)
    cached_studyset_id = fields.Pluck(
        StudysetSchema, "id", load_only=True, attribute="studyset"
    )
    url = fields.String(dump_only=True)

    @post_dump
    def create_neurostore_url(self, data, **kwargs):
        if data.get("neurostore_id", None):
            data["url"] = "/".join([NS_BASE, "annotations", data["neurostore_id"]])
        else:
            data["url"] = None
        return data


class MetaAnalysisResultSchema(BaseSchema):
    meta_analysis_id = fields.String()
    cli_version = fields.String()
    cli_args = fields.Dict()
    estimator = fields.Nested(EstimatorSchema)
    neurovault_collection = fields.Nested("NeurovaultCollectionSchema", exclude=("id",))
    studyset_snapshot = fields.Pluck("StudysetSchema", "snapshot", load_only=True)
    annotation_snapshot = fields.Pluck("AnnotationSchema", "snapshot", load_only=True)
    diagnostic_table = fields.String(dump_only=True)
    status = fields.String()

    @post_load
    def process_data(self, data, **kwargs):
        # propagate meta-analysis id to the neurovault collection
        if data.get("neurovault_collection", None):
            data["neurovault_collection"]["meta_analysis_id"] = data["meta_analysis_id"]

        return data


class MetaAnalysisSchema(BaseSchema):
    name = fields.String(allow_none=True, metadata={"info_field": True})
    description = fields.String(allow_none=True, metadata={"info_field": True})
    provenance = fields.Dict(allow_none=True)
    specification_id = IDOrNested(SpecificationSchema, id_field="id", data_key="specification")
    neurostore_analysis = fields.Nested("NeurostoreAnalysisSchema", dump_only=True)
    studyset = IDOrNested(StudysetSchema, id_field="neurostore_id", dump_only=True)
    annotation = IDOrNested(AnnotationSchema, id_field="neurostore_id", dump_only=True)
    project_id = IDOrNested(ProjectSchema, id_field="id", data_key="project")
    cached_studyset_id = fields.Pluck(
        StudysetSchema, "id", load_only=True, attribute="studyset"
    )
    cached_annotation_id = fields.Pluck(
        AnnotationSchema, "id", load_only=True, attribute="annotation"
    )
    cached_studyset = fields.Pluck(
        StudysetSchema,
        "id",
        dump_only=True,
        attribute="studyset",
    )
    cached_annotation = fields.Pluck(
        AnnotationSchema,
        "id",
        dump_only=True,
        attribute="annotation",
    )
    run_key = fields.String(dump_only=True)
    results = fields.Nested(
        MetaAnalysisResultSchema, only=("id", "created_at", "updated_at"), metadata={"many": True}
    )
    neurostore_url = fields.String(dump_only=True)

    @post_dump
    def create_neurostore_url(self, data, **kwargs):
        if self.context.get("info"):
            return data
        if data.get("neurostore_analysis", None) and data["neurostore_analysis"].get(
            "neurostore_id", None
        ):
            data["neurostore_url"] = "/".join(
                [NS_BASE, "analyses", data["neurostore_analysis"]["neurostore_id"]]
            )
        else:
            data["neurostore_url"] = None

        return data


class NeurovaultFileSchema(BaseSchema):
    collection_id = fields.String()
    image_id = fields.String()
    path = fields.String()
    exception = fields.String()
    status = fields.String()
    file = BytesField()
    name = fields.String()
    map_type = fields.String()
    url = fields.String(dump_only=True)
    cognitive_contrast_cogatlas = fields.String()
    cognitive_contrast_cogatlas_id = fields.String()
    cognitive_paradigm_cogatlas = fields.String()
    cognitive_paradigm_cogatlas_id = fields.String()

    @post_dump
    def create_neurovault_url(self, data, **kwargs):
        if data.get("image_id", None):
            data["url"] = "/".join([NV_BASE, "images", data["image_id"]])
        else:
            data["url"] = None
        return data


class NeurovaultCollectionSchema(BaseSchema):
    collection_id = fields.String()
    url = fields.String(dump_only=True)
    files = fields.Nested(
        NeurovaultFileSchema, exclude=("collection_id", "id"), metadata={"many": True}
    )

    @post_dump
    def create_neurovault_url(self, data, **kwargs):
        if data.get("collection_id", None):
            data["url"] = "/".join([NV_BASE, "collections", data["collection_id"]])
        return data


class NeurostoreStudySchema(BaseSchema):
    neurostore_id = fields.String()
    exception = fields.String()
    traceback = fields.String()
    status = fields.String()
    analyses = fields.Nested("NeurostoreAnalysisSchema", exclude=("id",), metadata={"many": True})


class NeurostoreAnalysisSchema(BaseSchema):
    neurostore_id = fields.String()
    exception = fields.String()
    traceback = fields.String()
    status = fields.String()


class ProjectSchema(BaseSchema):
    name = fields.String(allow_none=True)
    description = fields.String(allow_none=True)
    provenance = fields.Dict(allow_none=True)
    public = fields.Boolean()
    draft = fields.Boolean()
    meta_analyses = IDOrNested(MetaAnalysisSchema, id_field="id", many=True, dump_only=True)
    _meta_analyses = fields.Pluck(
        MetaAnalysisSchema,
        "id",
        data_key="meta_analyses",
        attribute="meta_analyses",
        load_only=True,
        metadata={"many": True},
    )
    neurostore_study = fields.Nested("NeurostoreStudySchema", exclude=("id",))
    neurostore_url = fields.String(dump_only=True)

    @post_dump
    def create_neurostore_url(self, data, **kwargs):
        if data.get("neurostore_study", None) and data["neurostore_study"].get(
            "neurostore_id", None
        ):
            data["neurostore_url"] = "/".join(
                [NS_BASE, "studies", data["neurostore_study"]["neurostore_id"]]
            )
        else:
            data["neurostore_url"] = None
        return data
