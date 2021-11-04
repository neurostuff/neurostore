from marshmallow import (
    fields,
    Schema,
    SchemaOpts,
    post_dump,
    pre_load,
)
from flask import request
from pyld import jsonld


class StringOrNested(fields.Nested):
    """Custom Field that serializes a nested object as either a string
    or a full object, depending on "nested" or "source" request argument"""

    def __init__(self, nested, **kwargs):
        super().__init__(nested, **kwargs)

    def _serialize(self, value, attr, obj, **ser_kwargs):
        if value is None:
            return None
        if self.context.get('nested') or self.context.get('copy'):
            nested_schema = self.nested(context=self.context)
            return nested_schema.dump(value, many=self.many)
        else:
            return [v.id for v in value] if self.many else value.id

    def _deserialize(self, value, attr, data, **ser_kwargs):
        if isinstance(value, list):
            return self.schema.load(
                [{"id": v} if isinstance(v, str) else v for v in value], many=True
            )
        elif isinstance(value, str):
            return self.schema.load({"id": value})
        else:
            return self.schema.load(value)


# https://github.com/marshmallow-code/marshmallow/issues/466#issuecomment-285342071
class BaseSchemaOpts(SchemaOpts):
    def __init__(self, meta, **kwargs):
        super().__init__(meta)
        self.allow_none = getattr(meta, "allow_none", ())


class BaseSchema(Schema):

    def __init__(self, copy=None, *args, **kwargs):
        exclude = list(kwargs.pop("exclude", []))
        if copy is None and kwargs.get('context') and kwargs.get('context').get('copy'):
            copy = kwargs.get('context').get('copy')

        if kwargs.get('context'):
            kwargs['context']['copy'] = copy
        else:
            kwargs['context'] = {'copy': copy}
        if copy:
            exclude.extend([
                field for field, f_obj in self._declared_fields.items()
                if f_obj.metadata.get("db_only")
            ])
        super().__init__(*args, exclude=exclude, **kwargs)

    OPTIONS_CLASS = BaseSchemaOpts
    # normal return key
    id_key = "id"

    _id = fields.String(attribute="id", data_key=id_key, dump_only=True, db_only=True)
    created_at = fields.DateTime(dump_only=True, db_only=True)

    id = fields.String(load_only=True)

    def on_bind_field(self, field_name, field_obj):
        super().on_bind_field(field_name, field_obj)
        if field_name in self.opts.allow_none:
            field_obj.allow_none = True


class BaseDataSchema(BaseSchema):
    user = fields.Function(lambda user: user.user_id, dump_only=True, db_only=True)


class ConditionSchema(BaseDataSchema):
    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")


class ImageSchema(BaseDataSchema):

    # serialization
    analysis = fields.Function(lambda image: image.analysis.id, dump_only=True, db_only=True)
    analysis_name = fields.Function(
        lambda image: image.analysis.name, dump_only=True, db_only=True
    )
    metadata = fields.Dict(attribute="data", dump_only=True)
    add_date = fields.DateTime(dump_only=True, db_only=True)

    # deserialization
    data = fields.Dict(data_key="metadata", load_only=True, allow_none=True)

    class Meta:
        additional = ("url", "filename", "space", "value_type")
        allow_none = ("url", "filename", "space", "value_type")


class PointValueSchema(BaseDataSchema):
    class Meta:
        additional = allow_none = ("kind", "value")


class PointSchema(BaseDataSchema):
    # serialization
    analysis = fields.Function(lambda image: image.analysis.id, dump_only=True, db_only=True)
    value = fields.Nested(PointValueSchema, attribute="values", many=True)

    # deserialization
    x = fields.Float(load_only=True)
    y = fields.Float(load_only=True)
    z = fields.Float(load_only=True)

    class Meta:
        additional = ("kind", "space", "coordinates", "image", "label_id")
        allow_none = ("kind", "space", "coordinates", "image", "label_id")

    @pre_load
    def process_values(self, data, **kwargs):
        # PointValues need special handling
        if data.get("coordinates"):
            coords = [float(c) for c in data.pop("coordinates")]
            data["x"], data["y"], data["z"] = coords
        return data


class AnalysisConditionSchema(BaseDataSchema):
    weight = fields.Float()
    condition = fields.Nested(ConditionSchema)
    analysis = fields.Function(lambda analysis: analysis.id, dump_only=True, db_only=True)


class AnalysisSchema(BaseDataSchema):

    # serialization
    study = fields.Function(lambda analysis: analysis.study.id, dump_only=True, db_only=True)
    conditions = StringOrNested(ConditionSchema, many=True, dump_only=True)
    weights = fields.List(fields.Float(), dump_only=True)

    analysis_conditions = fields.Nested(AnalysisConditionSchema, many=True, load_only=True)
    images = StringOrNested(ImageSchema, many=True)
    points = StringOrNested(PointSchema, many=True)
    weights = fields.List(fields.Float())

    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")

    @pre_load
    def process_values(self, data, **kwargs):
        # conditions/weights need special processing
        if data.get("conditions") is not None and data.get("weights") is not None:
            assert len(data.get("conditions")) == len(data.get("weights"))
            data['analysis_conditions'] = [
                {"condition": c, "weight": w} for c, w in
                zip(data.get("conditions"), data.get("weights"))
            ]
        elif data.get("conditions") is not None:
            data['analysis_conditions'] = [{"condition": cond} for cond in data.get("conditions")]

        data.pop("conditions", None)
        data.pop("weights", None)
        return data


class StudySchema(BaseDataSchema):

    metadata = fields.Dict(attribute="metadata_", dump_only=True)

    metadata_ = fields.Dict(data_key="metadata", load_only=True, allow_none=True)
    analyses = StringOrNested(AnalysisSchema, many=True)
    source = fields.String(dump_only=True, db_only=True, allow_none=True)
    source_id = fields.String(dump_only=True, db_only=True, allow_none=True)
    source_updated_at = fields.DateTime(dump_only=True, db_only=True, allow_none=True)

    class Meta:
        additional = ("name", "description", "publication", "doi", "pmid", "authors")
        allow_none = ("name", "description", "publication", "doi", "pmid", "authors")


class DatasetSchema(BaseDataSchema):
    # serialize
    user = fields.Function(lambda user: user.user_id, dump_only=True, db_only=True)
    studies = StringOrNested(StudySchema, many=True)

    class Meta:
        additional = ("name", "description", "publication", "doi", "pmid")
        allow_none = ("name", "description", "publication", "doi", "pmid")


class AnnotationAnalysisSchema(BaseDataSchema):
    note = fields.Dict()
    annotation = fields.Function(
        lambda annot_anal: annot_anal.annotation.id, dump_only=True, db_only=True
    )
    analysis = fields.Function(lambda annot_anal: annot_anal.analysis.id, dump_only=True)
    study = fields.Function(lambda annot_anal: annot_anal.study.id, dump_only=True)

    _analysis = StringOrNested(
        AnalysisSchema, load_only=True, attribute='analysis', data_key="analysis"
    )
    _annotation = fields.String(load_only=True, attribute='annotation', data_key='annotation')
    _study = StringOrNested(StudySchema, load_only=True, attribute='study', data_key='study')


class AnnotationSchema(BaseDataSchema):
    # serialization
    dataset = fields.Function(
        lambda dataset: dataset.id, dump_only=True, db_only=True
        )
    annotation_analyses = fields.Nested(AnnotationAnalysisSchema, many=True)

    source = fields.String(dump_only=True, db_only=True, allow_none=True)
    source_id = fields.String(dump_only=True, db_only=True, allow_none=True)
    source_updated_at = fields.DateTime(dump_only=True, db_only=True, allow_none=True)

    # deserialization
    # annotation_analyses = fields.Nested(AnnotationAnalysisSchema, many=True, load_only=True)

    _dataset = StringOrNested(
        DatasetSchema, data_key='dataset', attribute='dataset', load_only=True
    )

    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")

    @pre_load
    def process_values(self, data, **kwargs):
        if data.get("notes") is not None:
            data['annotation_analyses'] = data.pop('notes')
        return data

    @post_dump
    def post_values(self, data, **kwargs):
        if data.get("annotation_analyses") is not None:
            data['notes'] = data.pop('annotation_analyses')
        return data


class JSONLDBaseSchema(BaseSchema):
    id_key = "@id"
    # Serialization fields
    context = fields.Constant(
        {"@vocab": "http://neurostore.org/nimads/"}, data_key="@context", dump_only=True
    )
    _type = fields.Function(
        lambda model: model.__class__.__name__, data_key="@type", dump_only=True
    )

    # De-serialization fields
    id = fields.Method(None, "_extract_id", data_key=id_key, load_only=True)

    def _extract_id(self, iri):
        return iri.strip("/").split("/")[-1]

    @post_dump(pass_original=True)
    def process_jsonld(self, data, original, **kwargs):
        if isinstance(original, (list, tuple)):
            return data
        method = request.args.get("process", "compact")
        context = {"@context": {"@vocab": "http://neurostore.org/nimads/"}}
        if method == "flatten":
            return jsonld.flatten(data, context)
        elif method == "expand":
            return jsonld.expand(data)
        else:
            return jsonld.compact(data, context)


class JSONLDPointSchema(PointSchema):
    # serialization
    analysis = fields.Function(lambda image: image.analysis.IRI, dump_only=True)


class JSONLDImageSchema(ImageSchema):
    # serialization
    analysis = fields.Function(lambda image: image.analysis.IRI, dump_only=True)


class JSONLSAnalysisSchema(AnalysisSchema):
    # serialization
    study = fields.Function(lambda analysis: analysis.study.IRI, dump_only=True)
