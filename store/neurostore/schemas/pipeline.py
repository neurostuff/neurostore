"""Pipeline schemas"""

from marshmallow import fields, post_dump

from neurostore.models import PipelineStudyResult, Pipeline, PipelineConfig
from neurostore.schemas.data import BaseStudySchema, BaseSchema


class PipelineSchema(BaseSchema):
    name = fields.Str(required=True)
    description = fields.Str()
    study_dependent = fields.Bool()
    ace_compatible = fields.Bool()
    pubget_compatible = fields.Bool()
    derived_from = fields.Str()

    class Meta:
        model = Pipeline


class PipelineConfigSchema(BaseSchema):
    version = fields.Str(required=True)
    config = fields.Dict()
    executed_at = fields.DateTime()
    config_hash = fields.Str()
    pipeline = fields.Nested(PipelineSchema)

    class Meta:
        model = PipelineConfig


class PipelineStudyResultSchema(BaseSchema):
    """Schema for pipeline study results."""

    config = fields.Nested(PipelineConfigSchema)
    base_study = fields.Nested(BaseStudySchema)
    date_executed = fields.DateTime()
    result_data = fields.Dict()
    file_inputs = fields.Dict()
    status = fields.Str()

    class Meta:
        model = PipelineStudyResult

    @post_dump
    def remove_none(self, data, **kwargs):
        """Remove null values from serialized output."""
        return {key: value for key, value in data.items() if value is not None}


# Register schemas
pipeline_schema = PipelineSchema()
pipeline_schemas = PipelineSchema(many=True)
pipeline_config_schema = PipelineConfigSchema()
pipeline_config_schemas = PipelineConfigSchema(many=True)
pipeline_study_result_schema = PipelineStudyResultSchema()
pipeline_study_result_schemas = PipelineStudyResultSchema(many=True)
