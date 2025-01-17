from marshmallow import Schema, fields, post_load
from neurostore.models.data import (
    Pipeline,
    PipelineConfig,
    PipelineRun,
    PipelineRunResult,
    PipelineRunResultVote,
)


class PipelineSchema(Schema):
    id = fields.String(dump_only=True)
    name = fields.String(required=True)
    description = fields.String()
    version = fields.String()
    study_dependent = fields.Boolean()
    ace_compatible = fields.Boolean()
    pubget_compatible = fields.Boolean()
    derived_from = fields.String()

    @post_load
    def make_pipeline(self, data, **kwargs):
        return Pipeline(**data)


class PipelineConfigSchema(Schema):
    id = fields.String(dump_only=True)
    pipeline_id = fields.String(required=True)
    config = fields.Dict(required=True)
    config_hash = fields.String()

    @post_load
    def make_pipeline_config(self, data, **kwargs):
        return PipelineConfig(**data)


class PipelineRunSchema(Schema):
    id = fields.String(dump_only=True)
    pipeline_id = fields.String(required=True)
    config_id = fields.String(required=True)
    run_index = fields.Integer()

    @post_load
    def make_pipeline_run(self, data, **kwargs):
        return PipelineRun(**data)


class PipelineRunResultSchema(Schema):
    id = fields.String(dump_only=True)
    run_id = fields.String(required=True)
    base_study_id = fields.String()
    date_executed = fields.DateTime()
    data = fields.Dict()
    file_inputs = fields.Dict()

    @post_load
    def make_pipeline_run_result(self, data, **kwargs):
        return PipelineRunResult(**data)


class PipelineRunResultVoteSchema(Schema):
    id = fields.String(dump_only=True)
    run_result_id = fields.String(required=True)
    user_id = fields.String(required=True)
    accurate = fields.Boolean()

    @post_load
    def make_pipeline_run_result_vote(self, data, **kwargs):
        return PipelineRunResultVote(**data)
