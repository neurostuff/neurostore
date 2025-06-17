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
    BaseStudy,
)


def ingest_feature(feature_directory, overwrite=False):
    """Ingest demographics data into the database."""
    # read pipeline_info.json from the base feature directory
    with open(op.join(feature_directory, "pipeline_info.json")) as f:
        pipeline_info = json.load(f)

    # search if there is an existing pipeline with the same name and version
    pipeline = (
        db.session.query(Pipeline)
        .filter(
            Pipeline.name == pipeline_info["extractor"],
        )
        .first()
    )
    # create a pipeline if it does not exist
    if not pipeline:
        pipeline = Pipeline(
            name=pipeline_info["extractor"],
            description=pipeline_info.get("description"),
            study_dependent=None,
            ace_compatible=True,
            pubget_compatible=True,
            derived_from=pipeline_info.get("input_pipelines", None),
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
            "extractor_kwargs": pipeline_info.get("extractor_kwargs", {}),
            "transform_kwargs": pipeline_info.get("transform_kwargs", {}),
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
        # use the directory name as the base_study_id
        base_study_id = paper_dir.name

        if BaseStudy.query.filter_by(id=base_study_id).first() is None:
            print(f"Skipping {paper_dir} as it does not correspond to a valid base_study_id")
            continue
        try:
            with open(op.join(paper_dir, "results.json")) as f:
                results = json.load(f)
        except FileNotFoundError:
            print(f"Skipping {paper_dir} as it does not contain results.json")
            continue
        except json.JSONDecodeError:
            print(f"Skipping {paper_dir} as it contains invalid JSON in results.json")
            continue
        try:
            with open(op.join(paper_dir, "info.json")) as f:
                info = json.load(f)
        except FileNotFoundError:
            print(f"Skipping {paper_dir} as it does not contain info.json")
            continue
        except json.JSONDecodeError:
            print(f"Skipping {paper_dir} as it contains invalid JSON in info.json")
            continue

        # sometimes the model returns a boolean instead of a dict
        if isinstance(results, bool):
            results = {}

        # check for existing result
        existing_result = (
            db.session.query(PipelineStudyResult)
            .filter(
                PipelineStudyResult.base_study_id == base_study_id,
                PipelineStudyResult.config_id == pipeline_config.id,
            )
            .first()
        )

        if existing_result and overwrite:
            # update existing record
            existing_result.result_data = results
            existing_result.date_executed = parse_date(info["date"])
            existing_result.file_inputs = info["inputs"]
            existing_result.status = "SUCCESS"
        elif not existing_result:
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

    if pipeline_study_results:
        db.session.add_all(pipeline_study_results)

    db.session.commit()
