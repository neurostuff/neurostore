"""Ingest extracted features into the database."""

import json
import os.path as op
from pathlib import Path
from dateutil.parser import parse as parse_date

from neurostore.database import db
from neurostore.models import (
    Pipeline,
    PipelineConfig,
    PipelineStudyResult,
)


def ingest_feature(feature_directory):
    """Ingest demographics data into the database."""
    # read pipeline_info.json from the base feature directory
    with open(op.join(feature_directory, "pipeline_info.json")) as f:
        pipeline_info = json.load(f)

    # search if there is an existing pipeline with the same name and version
    pipeline = (
        db.session.query(Pipeline)
        .filter(
            Pipeline.name == pipeline_info["name"],
        )
        .first()
    )
    # create a pipeline if it does not exist
    if not pipeline:
        pipeline = Pipeline(
            name=pipeline_info["name"],
            description=pipeline_info.get("description"),
            study_dependent=(
                True if pipeline_info.get("type", False) == "dependent" else False
            ),
            ace_compatible="ace" in pipeline_info.get("input_sources", []),
            pubget_compatible="pubget" in pipeline_info.get("input_sources", []),
            derived_from=pipeline_info.get("derived_from", None),
        )
        db.session.add(pipeline)

    # search within the pipeline and see if there are any existing pipeline configs
    pipeline_config = (
        db.session.query(PipelineConfig)
        .filter(
            PipelineConfig.pipeline_id == pipeline.id,
            PipelineConfig.config_hash == pipeline_info["config_hash"],
            PipelineConfig.version == pipeline_info["version"],
        )
        .first()
    )

    # create a pipeline config if it does not exist
    if not pipeline_config:
        # Build config_args from pipeline_info
        config_args = {
            "extractor": pipeline_info.get("extractor"),
            "extractor_kwargs": pipeline_info.get("extractor_kwargs", {}),
            "transform_kwargs": pipeline_info.get("transform_kwargs", {}),
            "input_pipelines": pipeline_info.get("input_pipelines", {}),
        }

        pipeline_config = PipelineConfig(
            pipeline_id=pipeline.id,
            version=pipeline_info["version"],
            config_args=config_args,
            config_hash=pipeline_info["config_hash"],
            schema=pipeline_info.get("schema"),
        )
        db.session.add(pipeline_config)

    # get a list of all the paper directories in the feature directory
    paper_dirs = [d for d in Path(feature_directory).iterdir() if d.is_dir()]

    # for each subject directory, read the results.json file and the info.json file
    pipeline_study_results = []
    for paper_dir in paper_dirs:
        with open(op.join(paper_dir, "results.json")) as f:
            results = json.load(f)

        with open(op.join(paper_dir, "info.json")) as f:
            info = json.load(f)

        # use the directory name as the base_study_id
        base_study_id = paper_dir.name
        # create a new result record
        pipeline_study_results.append(
            PipelineStudyResult(
                base_study_id=base_study_id,
                result_data=results,
                date_executed=parse_date(info["date"]),
                file_inputs=info["inputs"],
                config=pipeline_config,
                status="SUCCESS",
            )
        )

    db.session.add_all(pipeline_study_results)

    db.session.commit()
