from flask import request
from neurostore.models.data import (
    Pipeline,
    PipelineConfig,
    PipelineStudyResult,
)
from neurostore.schemas.pipeline import (
    PipelineSchema,
    PipelineConfigSchema,
    PipelineStudyResultSchema,

)
from neurostore.database import db
from .base import ObjectView, ListView


class PipelinesView(ObjectView, ListView):
    model = Pipeline
    schema = PipelineSchema

    def get(self, id=None):
        if id:
            pipeline = self.model.query.get(id)
            return self.schema().dump(pipeline)
        pipelines = self.model.query.all()
        return self.schema(many=True).dump(pipelines)

    def post(self):
        data = request.get_json()
        pipeline = self.schema().load(data)
        db.session.add(pipeline)
        db.session.commit()
        return self.schema().dump(pipeline), 201

    def put(self, id):
        data = request.get_json()
        pipeline = self.model.query.get(id)
        for key, value in data.items():
            setattr(pipeline, key, value)
        db.session.commit()
        return self.schema().dump(pipeline)

    def delete(self, id):
        pipeline = self.model.query.get(id)
        db.session.delete(pipeline)
        db.session.commit()
        return "", 204


class PipelineConfigsView(ObjectView, ListView):
    model = PipelineConfig
    schema = PipelineConfigSchema

    def get(self, id=None):
        if id:
            pipeline_config = self.model.query.get(id)
            return self.schema().dump(pipeline_config)
        pipeline_configs = self.model.query.all()
        return self.schema(many=True).dump(pipeline_configs)

    def post(self):
        data = request.get_json()
        pipeline_config = self.schema().load(data)
        db.session.add(pipeline_config)
        db.session.commit()
        return self.schema().dump(pipeline_config), 201

    def put(self, id):
        data = request.get_json()
        pipeline_config = self.model.query.get(id)
        for key, value in data.items():
            setattr(pipeline_config, key, value)
        db.session.commit()
        return self.schema().dump(pipeline_config)

    def delete(self, id):
        pipeline_config = self.model.query.get(id)
        db.session.delete(pipeline_config)
        db.session.commit()
        return "", 204



class PipelineStudyResultsView(ObjectView, ListView):
    model = PipelineStudyResult
    schema = PipelineStudyResultSchema
    def list(self):
        """query function that searches for pipeline run results
            based on the query parameters provided in the request.
            I want to search for results from a specific pipeline run
            and be able to return a select list of results from that pipeline
            run looking into the json stored in the data column.
            """

    def get(self, pipeline_study_result_id=None):
        query_params = request.args
        if pipeline_study_result_id:
            pipeline_study_result = self.model.query.get(pipeline_study_result_id)
            return self.schema().dump(pipeline_study_result)
        pipeline_study_results = self.model.query.all()
        # filter results based on query parameters

        return self.schema(many=True).dump(pipeline_study_results)

    def post(self):
        data = request.get_json()
        pipeline_study_result = self.schema().load(data)
        db.session.add(pipeline_study_result)
        db.session.commit()
        return self.schema().dump(pipeline_study_result), 201

    def put(self, pipeline_study_result_id):
        data = request.get_json()
        pipeline_study_result = self.model.query.get(pipeline_study_result_id)
        for key, value in data.items():
            setattr(pipeline_study_result, key, value)
        db.session.commit()
        return self.schema().dump(pipeline_study_result)

    def delete(self, pipeline_study_result_id):
        pipeline_study_result = self.model.query.get(pipeline_study_result_id)
        db.session.delete(pipeline_study_result)
        db.session.commit()
        return "", 204
