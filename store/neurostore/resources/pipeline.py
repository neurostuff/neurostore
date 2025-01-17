from flask import request, jsonify
from neurostore.models.data import Pipeline, PipelineConfig, PipelineRun, PipelineRunResult, PipelineRunResultVote
from neurostore.schemas.pipeline import PipelineSchema, PipelineConfigSchema, PipelineRunSchema, PipelineRunResultSchema, PipelineRunResultVoteSchema
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
        return '', 204


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
        return '', 204


class PipelineRunsView(ObjectView, ListView):
    model = PipelineRun
    schema = PipelineRunSchema

    def get(self, pipeline_run_id=None):
        if pipeline_run_id:
            pipeline_run = self.model.query.get(pipeline_run_id)
            return self.schema().dump(pipeline_run)
        pipeline_runs = self.model.query.all()
        return self.schema(many=True).dump(pipeline_runs)

    def post(self):
        data = request.get_json()
        pipeline_run = self.schema().load(data)
        db.session.add(pipeline_run)
        db.session.commit()
        return self.schema().dump(pipeline_run), 201

    def put(self, pipeline_run_id):
        data = request.get_json()
        pipeline_run = self.model.query.get(pipeline_run_id)
        for key, value in data.items():
            setattr(pipeline_run, key, value)
        db.session.commit()
        return self.schema().dump(pipeline_run)

    def delete(self, pipeline_run_id):
        pipeline_run = self.model.query.get(pipeline_run_id)
        db.session.delete(pipeline_run)
        db.session.commit()
        return '', 204


class PipelineRunResultsView(ObjectView, ListView):
    model = PipelineRunResult
    schema = PipelineRunResultSchema

    def get(self, pipeline_run_result_id=None):
        if pipeline_run_result_id:
            pipeline_run_result = self.model.query.get(pipeline_run_result_id)
            return self.schema().dump(pipeline_run_result)
        pipeline_run_results = self.model.query.all()
        return self.schema(many=True).dump(pipeline_run_results)

    def post(self):
        data = request.get_json()
        pipeline_run_result = self.schema().load(data)
        db.session.add(pipeline_run_result)
        db.session.commit()
        return self.schema().dump(pipeline_run_result), 201

    def put(self, pipeline_run_result_id):
        data = request.get_json()
        pipeline_run_result = self.model.query.get(pipeline_run_result_id)
        for key, value in data.items():
            setattr(pipeline_run_result, key, value)
        db.session.commit()
        return self.schema().dump(pipeline_run_result)

    def delete(self, pipeline_run_result_id):
        pipeline_run_result = self.model.query.get(pipeline_run_result_id)
        db.session.delete(pipeline_run_result)
        db.session.commit()
        return '', 204


class PipelineRunResultVotesView(ObjectView, ListView):
    model = PipelineRunResultVote
    schema = PipelineRunResultVoteSchema

    def get(self, pipeline_run_result_vote_id=None):
        if pipeline_run_result_vote_id:
            pipeline_run_result_vote = self.model.query.get(pipeline_run_result_vote_id)
            return self.schema().dump(pipeline_run_result_vote)
        pipeline_run_result_votes = self.model.query.all()
        return self.schema(many=True).dump(pipeline_run_result_votes)

    def post(self):
        data = request.get_json()
        pipeline_run_result_vote = self.schema().load(data)
        db.session.add(pipeline_run_result_vote)
        db.session.commit()
        return self.schema().dump(pipeline_run_result_vote), 201

    def put(self, pipeline_run_result_vote_id):
        data = request.get_json()
        pipeline_run_result_vote = self.model.query.get(pipeline_run_result_vote_id)
        for key, value in data.items():
            setattr(pipeline_run_result_vote, key, value)
        db.session.commit()
        return self.schema().dump(pipeline_run_result_vote)

    def delete(self, pipeline_run_result_vote_id):
        pipeline_run_result_vote = self.model.query.get(pipeline_run_result_vote_id)
        db.session.delete(pipeline_run_result_vote)
        db.session.commit()
        return '', 204
