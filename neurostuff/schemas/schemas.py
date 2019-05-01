from marshmallow import fields, Schema, post_dump
from flask import request
from pyld import jsonld


class BaseSchema(Schema):
    context = fields.Constant({"@vocab": "http://neurostuff.org/nimads/"},
                              dump_to="@context", dump_only=True)
    id = fields.String(attribute='IRI', dump_to="@id")
    type = fields.Function(lambda model: model.__class__.__name__,
                           dump_to="@type")

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

    analysis = fields.Function(lambda image: image.analysis.IRI)
    metadata = fields.Dict(attribute="data")
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
    image = fields.Nested(ImageSchema, attribute='images', many=True)
    point = fields.Nested(PointSchema, attribute='points', many=True)
    weight = fields.List(fields.Float(), attribute='weights')
    class Meta:
        additional = ("name", "description")


class StudySchema(BaseSchema):

    metadata = fields.Dict(attribute="metadata_")
    analysis = fields.Nested(AnalysisSchema, attribute='analyses', many=True)
    class Meta:
        additional = ("name", "description", "publication", "doi", "pmid")

