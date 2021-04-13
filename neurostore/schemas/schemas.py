from marshmallow import fields, Schema, SchemaOpts, post_dump, pre_load, post_load, pre_dump
from flask import request
from pyld import jsonld

from ..models import Dataset, Study, Analysis, Condition, Image, Point, PointValue


class StringOrNested(fields.Field):
    """ Custom Field that serializes a nested object as either an IRI string
    or a full object, depending on "nested" request argument. """

    def __init__(self, nested, **kwargs):
        self.many = kwargs.pop('many', False)
        self.kwargs = kwargs
        self.schema = fields.Nested(nested, **self.kwargs).schema
        super().__init__(**kwargs)

    def _serialize(self, value, attr, obj, **ser_kwargs):
        if value is None:
            return None
        nested = bool(request.args.get('nested', False))
        if nested:
            return self.schema.dump(value, many=self.many)
        else:
            return [v.id for v in value] if self.many else value.id

    def _deserialize(self, value, attr, data, **ser_kwargs):

        return self.schema.load(
            [{'id': v} if isinstance(v, str) else v for v in value],
            many=True
        )


# https://github.com/marshmallow-code/marshmallow/issues/466#issuecomment-285342071
class BaseSchemaOpts(SchemaOpts):

    def __init__(self, meta, **kwargs):
        super().__init__(meta)
        self.allow_none = getattr(meta, 'allow_none', ())


class BaseSchema(Schema):

    OPTIONS_CLASS = BaseSchemaOpts
    # normal return key
    id_key = 'id'
    # Serialization fields
    _id = fields.String(attribute='id', data_key=id_key, dump_only=True)
    created_at = fields.DateTime(dump_only=True)

    # De-serialization fields
    id = fields.Method(None, '_extract_id', data_key=id_key, load_only=True)

    def _extract_id(self, iri):
        return iri.strip('/').split('/')[-1]

    def on_bind_field(self, field_name, field_obj):
        super().on_bind_field(field_name, field_obj)
        if field_name in self.opts.allow_none:
            field_obj.allow_none = True


class JSONLDBaseSchema(BaseSchema):
    id_key = '@id'
    # Serialization fields
    context = fields.Constant({"@vocab": "http://neurostore.org/nimads/"},
                              data_key="@context", dump_only=True)
    _type = fields.Function(lambda model: model.__class__.__name__,
                            data_key="@type", dump_only=True)

    @post_dump(pass_original=True)
    def process_jsonld(self, data, original, **kwargs):
        if isinstance(original, (list, tuple)):
            return data
        method = request.args.get('process', 'compact')
        context = {"@context": {"@vocab": "http://neurostore.org/nimads/"}}
        if method == 'flatten':
            return jsonld.flatten(data, context)
        elif method == 'expand':
            return jsonld.expand(data)
        else:
            return jsonld.compact(data, context)


class ConditionSchema(BaseSchema):
    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")


class ImageSchema(BaseSchema):

    # serialization
    analysis = fields.Function(lambda image: image.analysis.id,
                               dump_only=True)
    metadata = fields.Dict(attribute="data", dump_only=True)
    add_date = fields.DateTime(dump_only=True)

    # deserialization
    data = fields.Dict(data_key='metadata', load_only=True, allow_none=True)

    class Meta:
        additional = ("url", "filename", "space", "value_type", "analysis_name")
        allow_none = ("url", "filename", "space", "value_type", "analysis_name")


class PointValueSchema(BaseSchema):

    class Meta:
        additional = allow_none = ("kind", "value")


class PointSchema(BaseSchema):
    # serialization
    analysis = fields.Function(lambda image: image.analysis.id,
                               dump_only=True)
    value = fields.Nested(PointValueSchema, attribute='values', many=True)

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
        if data.get('coordinates'):
            coords = [float(c) for c in data.pop('coordinates')]
            data['x'], data['y'], data['z'] = coords
        return data


class AnalysisSchema(BaseSchema):

    # serialization
    study = fields.Function(lambda analysis: analysis.study.id,
                            dump_only=True)
    condition = fields.Nested(ConditionSchema, attribute='conditions',
                              many=True, dump_only=True)
    image = StringOrNested(ImageSchema, attribute='images', many=True,
                           dump_only=True)
    point = StringOrNested(PointSchema, attribute='points', many=True,
                           dump_only=True)
    weight = fields.List(fields.Float(), attribute='weights', dump_only=True)

    # deserialization
    conditions = fields.Nested(ConditionSchema, data_key='condition',
                               many=True, load_only=True)
    images = fields.Nested(ImageSchema, data_key='image', many=True,
                           load_only=True)
    points = fields.Nested(PointSchema, data_key='point', many=True,
                           load_only=True)
    weights = fields.List(fields.Float(), data_key='weight', load_only=True)

    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")


class StudySchema(BaseSchema):

    metadata = fields.Dict(attribute="metadata_", dump_only=True)
    analysis = StringOrNested(AnalysisSchema, attribute='analyses',
                              many=True, dump_only=True)

    metadata_ = fields.Dict(data_key='metadata', load_only=True, allow_none=True)
    analyses = StringOrNested(AnalysisSchema, data_key='analysis', many=True,
                              load_only=True)

    class Meta:
        additional = ("name", "description", "publication", "doi", "pmid")
        allow_none = ("name", "description", "publication", "doi", "pmid")


class DatasetSchema(BaseSchema):
    # serialize
    user = fields.Function(lambda user: user.user, dump_only=True)
    nimads_data = fields.Dict()

    class Meta:
        additional = ("name", "description", "publication", "doi", "pmid")
        allow_none = ("name", "description", "publication", "doi", "pmid")


class JSONLDPointSchema(PointSchema):
    # serialization
    analysis = fields.Function(lambda image: image.analysis.IRI,
                               dump_only=True)


class JSONLDImageSchema(ImageSchema):

    # serialization
    analysis = fields.Function(lambda image: image.analysis.IRI,
                               dump_only=True)


class JSONLSAnalysisSchema(AnalysisSchema):

    # serialization
    study = fields.Function(lambda analysis: analysis.study.IRI,
                            dump_only=True)