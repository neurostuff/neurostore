"""Pipeline schemas"""

from marshmallow import fields, post_dump

from neurostore.models import PipelineStudyResult, Pipeline, PipelineConfig
from neurostore.schemas.data import BaseStudySchema, BaseSchema, StringOrNested


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
    pipeline_id = fields.String(attribute="pipeline.id")
    _pipeline = fields.Nested(PipelineSchema, load_only=True, data_key="pipeline")

    class Meta:
        model = PipelineConfig


class PipelineStudyResultSchema(BaseSchema):
    """Schema for pipeline study results."""

    # Configuration relationship
    config_id = fields.String(attribute="config.id")
    _config = fields.Nested(PipelineConfigSchema, load_only=True, data_key="config")

    # Base study relationship
    base_study_id = fields.String(attribute="base_study.id")
    _base_study = fields.Nested(BaseStudySchema, load_only=True, data_key="base_study")

    # Execution metadata
    date_executed = fields.DateTime(dump_only=True, description="Timestamp of pipeline execution",
                                 allow_none=True)

    # Result and input data
    result_data = fields.Dict(description="Pipeline execution results", allow_none=True)
    file_inputs = fields.Dict(description="Files used as input for the pipeline", allow_none=True)

    # Pipeline execution status
    status = fields.Str(validate=lambda x: x in ['pending', 'running', 'completed', 'failed'],
                      required=True, description="Current status of the pipeline execution")

    class Meta:
        model = PipelineStudyResult

    @classmethod
    def flatten_dict(cls, d, parent_key="", sep="."):
        """Flatten nested dictionaries and arrays containing dictionaries."""
        items = []
        for k, v in d.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k

            if isinstance(v, dict):
                items.extend(cls.flatten_dict(v, new_key, sep=sep).items())
            elif isinstance(v, list):
                if v and all(isinstance(item, dict) for item in v):
                    # For arrays of dictionaries, include index in the key
                    for idx, dict_item in enumerate(v):
                        array_key = f"{new_key}[{idx}]"
                        flattened = cls.flatten_dict(dict_item)
                        for sub_key, sub_value in flattened.items():
                            items.append((f"{array_key}.{sub_key}", sub_value))
                else:
                    # Keep non-dictionary arrays intact
                    items.append((new_key, v))
            else:
                items.append((new_key, v))
        return dict(items)

    @post_dump
    def remove_none_and_flatten(self, data, **kwargs):
        """Remove null values and flatten nested dictionaries in result_data."""
        # Remove None values
        data = {key: value for key, value in data.items() if value is not None}

        # Flatten result_data if it exists
        if "result_data" in data and isinstance(data["result_data"], dict):
            # Get predictions section which contains our nested data
            result_data = data["result_data"]
            data["result_data"] = self.flatten_dict(result_data)

        return data


# Register schemas
pipeline_schema = PipelineSchema()
pipeline_schemas = PipelineSchema(many=True)
pipeline_config_schema = PipelineConfigSchema()
pipeline_config_schemas = PipelineConfigSchema(many=True)
pipeline_study_result_schema = PipelineStudyResultSchema()
pipeline_study_result_schemas = PipelineStudyResultSchema(many=True)
