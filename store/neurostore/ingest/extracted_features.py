"""Ingest extracted features into the database."""

import json
import os.path as op
from pathlib import Path
import hashlib
from dateutil.parser import parse as parse_date

from neurostore.database import db
from neurostore.models import (
    Pipeline,
    PipelineConfig,
    PipelineRun,
    PipelineRunResult,
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
            Pipeline.version == pipeline_info["version"],
        )
        .first()
    )
    # create a pipeline if it does not exist
    if not pipeline:
        pipeline = Pipeline(
            name=pipeline_info["name"],
            version=pipeline_info["version"],
            description=pipeline_info.get("description"),
            study_dependent=pipeline_info.get("study_dependent", False),
            ace_compatible=pipeline_info.get("ace_compatible", False),
            pubget_compatible=pipeline_info.get("pubget_compatible", False),
            derived_from=pipeline_info.get("derived_from", None),
        )
        db.session.add(pipeline)

    # search within the pipeline and see if there are any existing pipeline configs
    # that match the "arguements" field in the pipeline_info.json
    # create a hash of the config arguments
    config_hash = hashlib.sha256(
        json.dumps(pipeline_info["arguments"]).encode()
    ).hexdigest()
    pipeline_config = (
        db.session.query(PipelineConfig)
        .filter(
            PipelineConfig.pipeline_id == pipeline.id,
            PipelineConfig.config_hash == config_hash,
        )
        .first()
    )
    # create a pipeline config if it does not exist
    if not pipeline_config:
        pipeline_config = PipelineConfig(
            pipeline_id=pipeline.id,
            config=pipeline_info["arguments"],
            config_hash=config_hash,
        )
        db.session.add(pipeline_config)

    # create a new pipeline run
    pipeline_run = PipelineRun(
        pipeline_id=pipeline.id,
        config_id=pipeline_config.id,
    )

    # get a list of all the paper directories in the feature directory
    paper_dirs = [d for d in Path(feature_directory).iterdir() if d.is_dir()]

    # for each subject directory, read the results.json file and the info.json file
    pipeline_run_results = []
    for paper_dir in paper_dirs:
        with open(op.join(paper_dir, "results.json")) as f:
            results = json.load(f)

        with open(op.join(paper_dir, "info.json")) as f:
            info = json.load(f)

        # use the directory name as the base_study_id
        base_study_id = paper_dir.name
        # create a new result record
        pipeline_run_results.append(
            PipelineRunResult(
                base_study_id=base_study_id,
                data=results,
                date_executed=parse_date(info["date"]),
                file_inputs=info["inputs"],
                run=pipeline_run,
            )
        )

    db.session.add(pipeline_run)
    db.session.add_all(pipeline_run_results)

    db.session.commit()
