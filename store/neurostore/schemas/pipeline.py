from marshmallow import Schema, fields, post_load
from neurostore.models.data import (
    Pipeline,
    PipelineConfig,
    PipelineStudyResult,
)


class PipelineSchema(Schema):
    id = fields.String(dump_only=True)
    name = fields.String(required=True)
    description = fields.String()
    study_dependent = fields.Boolean()
    ace_compatible = fields.Boolean()
    pubget_compatible = fields.Boolean()
    derived_from = fields.String()

    @post_load
    def make_pipeline(self, data, **kwargs):
        return Pipeline(**data)


class PipelineConfigSchema(Schema):
    id = fields.String(dump_only=True)
    version = fields.String(required=True)
    pipeline_id = fields.String(required=True)
    config = fields.Dict(required=True)
    executed_at = fields.DateTime()
    config_hash = fields.String()

    @post_load
    def make_pipeline_config(self, data, **kwargs):
        return PipelineConfig(**data)


class PipelineStudyResultSchema(Schema):
    id = fields.String(dump_only=True)
    config_id = fields.String(required=True)
    base_study_id = fields.String()
    executed_at = fields.DateTime()
    result_data = fields.Dict()
    file_inputs = fields.Dict()

    @post_load
    def make_pipeline_study_result(self, data, **kwargs):
        return PipelineStudyResult(**data)
