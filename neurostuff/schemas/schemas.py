from marshmallow import fields, Schema, post_dump
from flask import request
from pyld import jsonld

from ..models import Dataset, Study, Analysis, Condition, Image, Point


class StringOrNested(fields.Field):
    """ Custom Field that serializes a nested object as either an IRI string
    or a full object, depending on "nested" request argument. """

    def __init__(self, nested, **kwargs):
        self.many = kwargs.pop('many', False)
        self.kwargs = kwargs
        self.schema = fields.Nested(nested, **self.kwargs).schema
        super().__init__(self, **kwargs)

    def _serialize(self, value, attr, obj, **ser_kwargs):
        if value is None:
            return None
        nested = bool(int(request.args.get('nested', False)))
        if nested:
            return self.schema.dump(value, many=self.many).data
        else:
            return [v.IRI for v in value] if self.many else value.IRI

    def _deserialize(self, value, attr, data, **ser_kwargs):
        res = self.schema.load([value], many=self.many).data
        return res


class BaseSchema(Schema):

    # Serialization fields
    context = fields.Constant({"@vocab": "http://neurostuff.org/nimads/"},
                              dump_to="@context", dump_only=True)
    _id = fields.String(attribute='IRI', dump_to="@id", dump_only=True)
    _type = fields.Function(lambda model: model.__class__.__name__,
                            dump_to="@type", dump_only=True)

    # De-serialization fields
    id = fields.Method(None, '_extract_id', load_from='@id')

    def _extract_id(self, iri):
        return int(iri.strip('/').split('/')[-1])

    @post_dump
    def process_jsonld(self, data):
        method = request.args.get('process', 'compact')
        context = {"@context": {"@vocab": "http://neurostuff.org/nimads/"}}
        if method == 'flatten':
            return jsonld.flatten(data, context)
        elif method == 'expand':
            return jsonld.expand(data)
        else:
            return jsonld.compact(data, context)


class ConditionSchema(BaseSchema):

    class Meta:
        additional = ("name", "description")


class ImageSchema(BaseSchema):

    analysis = fields.Function(lambda image: image.analysis.IRI,
                               dump_only=True)
    metadata = fields.Dict(attribute="data", dump_only=True)

    analysis_id = fields.Method(None, '_extract_id', load_from='analysis')
    data = fields.Dict(attribute='metadata', load_only=True)

    class Meta:
        additional = ("path", "space", "value_type")


class PointValueSchema(BaseSchema):

    class Meta:
        additional = ("kind", "value")


class PointSchema(BaseSchema):

    analysis = fields.Function(lambda image: image.analysis.IRI)
    value = fields.Nested(PointValueSchema, attribute='values')
    class Meta:
        additional = ("kind", "space", "coordinates", "image", "label_id")


class AnalysisSchema(BaseSchema):

    study = fields.Function(lambda analysis: analysis.study.IRI)
    condition = fields.Nested(ConditionSchema, attribute='conditions',
                              many=True)
    image = StringOrNested(ImageSchema, attribute='images', many=True)
    point = StringOrNested(PointSchema, attribute='points', many=True)
    weight = fields.List(fields.Float(), attribute='weights')
    class Meta:
        additional = ("name", "description")


class StudySchema(BaseSchema):

    metadata = fields.Dict(attribute="metadata_", dump_only=True)
    analysis = StringOrNested(AnalysisSchema, attribute='analyses', many=True,
                              dump_only=True)

    metadata_ = fields.Dict(attribute='metadata', load_only=True)
    analyses = fields.Nested(AnalysisSchema, attribute='analysis', many=True,
                      load_only=True)

    class Meta:
        additional = ("name", "description", "publication", "doi", "pmid")


class DatasetSchema(BaseSchema):

    data = fields.Dict(attribute="nimads_data")
    analysis = StringOrNested(AnalysisSchema, attribute='analyses', many=True)
    user = fields.Function(lambda user: user.username)
    class Meta:
        additional = ("name", "description", "publication", "doi", "pmid")
