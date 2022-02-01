from marshmallow import (
    fields,
    Schema,
    SchemaOpts,
    post_dump,
    pre_dump,
    pre_load,
)
from flask import request
from marshmallow.decorators import post_load
from pyld import jsonld
import pandas as pd


class StringOrNested(fields.Nested):
    """Custom Field that serializes a nested object as either a string
    or a full object, depending on "nested" or "source" request argument"""

    def __init__(self, nested, **kwargs):
        super().__init__(nested, **kwargs)
        self.use_nested = kwargs.get('use_nested', True)

    def _serialize(self, value, attr, obj, **ser_kwargs):
        if value is None:
            return None
        if (
            self.use_nested and
            (self.context.get('nested') or self.context.get('copy'))
        ):
            nested_schema = self.nested(context=self.context)
            return nested_schema.dump(value, many=self.many)
        else:
            return [v.id for v in value] if self.many else value.id

    def _deserialize(self, value, attr, data, **ser_kwargs):
        if isinstance(value, list):
            if self.context.get("copy"):
                return self.schema.load(
                    [v for v in value if not isinstance(v, str)], many=True
                )
            return self.schema.load(
                [{"id": v} if isinstance(v, str) else v for v in value], many=True
            )
        elif isinstance(value, str):
            if self.context.get("copy"):
                return None
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
    user = fields.String(attribute="user_id", dump_only=True, db_only=True)


class ConditionSchema(BaseDataSchema):
    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")


class ImageSchema(BaseDataSchema):

    # serialization
    analysis = StringOrNested("AnalysisSchema", use_nested=False)
    analysis_name = fields.Function(
        lambda image: image.analysis.name, dump_only=True, db_only=True
    )
    metadata = fields.Dict(attribute="metadata_", dump_only=True)
    add_date = fields.DateTime(dump_only=True, db_only=True)

    # deserialization
    metadata_ = fields.Dict(data_key="metadata", load_only=True, allow_none=True)

    class Meta:
        additional = ("url", "filename", "space", "value_type")
        allow_none = ("url", "filename", "space", "value_type")


class PointValueSchema(BaseDataSchema):
    class Meta:
        additional = allow_none = ("kind", "value")


class PointSchema(BaseDataSchema):
    # serialization
    analysis = StringOrNested("AnalysisSchema", use_nested=False)
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


class DatasetStudySchema(BaseDataSchema):

    @pre_load
    def process_values(self, data, **kwargs):
        pass


class AnalysisSchema(BaseDataSchema):

    # serialization
    study = StringOrNested("StudySchema", use_nested=False)
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
    studies = StringOrNested(StudySchema, many=True)  # This needs to be nested, but not cloned

    class Meta:
        additional = ("name", "description", "publication", "doi", "pmid")
        allow_none = ("name", "description", "publication", "doi", "pmid")


class AnnotationAnalysisSchema(BaseDataSchema):
    note = fields.Dict()
    annotation = StringOrNested("AnnotationSchema", use_nested=False, load_only=True)
    analysis_id = fields.String(data_key="analysis")
    study_id = fields.String(data_key="study")
    dataset_id = fields.String(data_key="dataset", load_only=True)
    dataset_study = fields.Nested(DatasetStudySchema)
    study_name = fields.Function(lambda aa: aa.dataset_study.study.name, dump_only=True)
    analysis_name = fields.Function(lambda aa: aa.analysis.name, dump_only=True)

    @post_load
    def add_id(self, data, **kwargs):
        if isinstance(data['analysis_id'], str):
            data['analysis'] = {'id': data.pop('analysis_id')}
        if isinstance(data.get('study_id'), str) and isinstance(data.get('dataset_id'), str):
            data['dataset_study'] = {
                'study': {'id': data.pop('study_id')},
                'dataset': {'id': data.pop('dataset_id')}
            }

        return data


class AnnotationSchema(BaseDataSchema):
    # serialization
    dataset_id = fields.String(data_key='dataset')
    annotation_analyses = fields.Nested(AnnotationAnalysisSchema, data_key="notes", many=True)
    annotation = fields.String(dump_only=True)
    annotation_csv = fields.String(dump_only=True)
    source = fields.String(dump_only=True, db_only=True, allow_none=True)
    source_id = fields.String(dump_only=True, db_only=True, allow_none=True)
    source_updated_at = fields.DateTime(dump_only=True, db_only=True, allow_none=True)

    metadata = fields.Dict(attribute="metadata_", dump_only=True)
    # deserialization
    metadata_ = fields.Dict(data_key="metadata", load_only=True, allow_none=True)

    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")

    @pre_load
    def add_dataset_id(self, data, **kwargs):
        if data.get("dataset"):
            for note in data['notes']:
                note['dataset'] = data['dataset']

        return data

    @pre_dump
    def export_annotations(self, data, **kwargs):
        if getattr(data, "annotation_analyses") and self.context.get('export'):
            annotations = pd.DataFrame.from_records(
                [
                    {
                        "study_id": aa.study_id,
                        "analysis_id": aa.analysis_id,
                        **aa.note
                    } for aa in data.annotation_analyses
                ]
            ).to_csv(index=False)
            metadata = {
                "dataset_id": data.dataset_id,
                "annotation_id": data.id,
                "created_at": data.created_at,
            }
            metadata = {**metadata, **data.metadata_} if data.metadata_ else metadata
            export_data = {
                "metadata_": metadata,
                "annotation_csv": annotations
            }

            return export_data

        return data

    @post_load
    def add_id(self, data, **kwargs):
        if isinstance(data.get('dataset_id'), str):
            data['dataset'] = {'id': data.pop('dataset_id')}
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
