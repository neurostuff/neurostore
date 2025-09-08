"""Ingest extracted features into the database."""

import json
import os.path as op
from pathlib import Path
from dateutil.parser import parse as parse_date

import hashlib
import logging
import sqlalchemy as sa
from sqlalchemy.sql import quoted_name

# numpy is optional for type compatibility; runtime checks handle absence
try:
    import numpy as np  # type: ignore
except Exception:  # pragma: no cover - numpy may not be installed in test env
    np = None  # type: ignore

from neurostore.database import db
from neurostore.models import (
    Pipeline,
    PipelineConfig,
    PipelineStudyResult,
    BaseStudy,
    PipelineEmbedding,
)
from neurostore.models.data import generate_id


def ensure_partition_for_config_local(
    session, config_id: str, dims: int, *, metric: str = "cosine"
) -> None:
    """
    Ensure partition + per-dimension CHECK for `config_id` entirely within `session`,
    and create a NON-CONCURRENT HNSW index on an expression that fixes dimensions.

    - No new connections or explicit begin/commit calls.
    - Uses session.no_autoflush to avoid premature INSERTs.
    - `metric` in {"cosine","l2","ip"} selects pgvector operator class.
    """
    opclass_map = {
        "cosine": "vector_cosine_ops",
        "l2": "vector_l2_ops",
        "ip": "vector_ip_ops",
    }
    opclass = opclass_map.get(metric)
    if not opclass:
        raise ValueError(f"metric must be one of {set(opclass_map)}")

    def _safe_suffix(s: str) -> str:
        return hashlib.sha1(s.encode("utf-8")).hexdigest()[:10]

    def _exec(sql: str, params: dict | None = None):
        return session.execute(sa.text(sql), params or {})

    def _scalar(sql: str, params: dict | None = None):
        return session.scalar(sa.text(sql), params or {})

    # Safe identifiers
    suffix = _safe_suffix(config_id)
    part_nm = f"pipeline_embeddings_{suffix}"
    chk_nm = f"pe_{suffix}_dims_chk"
    idx_nm = f"pe_{suffix}_hnsw"

    q_part = quoted_name(part_nm, quote=True)
    q_chk = quoted_name(chk_nm, quote=True)
    q_idx = quoted_name(idx_nm, quote=True)

    lock_key = f"pipeline_embeddings:{config_id}"

    with session.no_autoflush:
        # Best-effort: ensure extension exists
        try:
            _exec("CREATE EXTENSION IF NOT EXISTS vector")
        except Exception:
            pass

        # Best-effort advisory lock on same connection
        locked = False
        try:
            _exec("SELECT pg_advisory_lock(hashtext(:k))", {"k": lock_key})
            locked = True
        except Exception:
            pass

        try:
            # Partition bound must be a literal
            cfg_lit = _scalar("SELECT quote_literal(:v)", {"v": config_id})

            # Create partition (idempotent)
            _exec(
                f"""
                CREATE TABLE IF NOT EXISTS {q_part}
                PARTITION OF pipeline_embeddings
                FOR VALUES IN ({cfg_lit});
            """
            )

            # Per-dimension check (use cast; works even if column has no typmod)
            _exec(
                f"""
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint c
                JOIN pg_class r ON r.oid = c.conrelid
                WHERE c.conname = '{chk_nm}' AND r.relname = '{part_nm}'
              ) THEN
                EXECUTE 'ALTER TABLE {q_part}
                         ADD CONSTRAINT {q_chk}
                         CHECK (vector_dims(embedding::vector) = {dims})';
              END IF;
            END$$;
            """
            )

            # Per-partition HNSW index on expression with fixed dimension
            # This avoids "column does not have dimensions"
            _exec(
                f"""
            DO $$
            BEGIN
              -- Only attempt if hnsw & opclass exist
              IF EXISTS (SELECT 1 FROM pg_am WHERE amname = 'hnsw')
                 AND EXISTS (SELECT 1 FROM pg_opclass WHERE opcname = '{opclass}') THEN
                IF NOT EXISTS (
                  SELECT 1
                  FROM pg_indexes
                  WHERE schemaname = ANY (current_schemas(true))
                    AND indexname  = '{idx_nm}'
                    AND tablename  = '{part_nm}'
                ) THEN
                  EXECUTE 'CREATE INDEX {q_idx}
                           ON {q_part} USING hnsw ((embedding::vector({dims})) {opclass})
                           WITH (m = 8, ef_construction = 64)';
                END IF;
              END IF;
            END$$;
            """
            )
        finally:
            if locked:
                try:
                    _exec("SELECT pg_advisory_unlock(hashtext(:k))", {"k": lock_key})
                except Exception:
                    pass


def ingest_feature(
    feature_directory,
    overwrite: bool = False,
    save_as_embedding: bool = False,
):
    """
    Ingest demographics data or embeddings into the database.

    - If save_as_embedding=True, read an embedding from each results.json under
      "embedding" or "predictions.embedding" and create/update PipelineEmbedding.
    - Otherwise, create/update PipelineStudyResult from results/info JSONs.
    """
    # read pipeline_info.json from the base feature directory
    with open(op.join(feature_directory, "pipeline_info.json")) as f:
        pipeline_info = json.load(f)

    # search if there is an existing pipeline with the same name and version
    pipeline = (
        db.session.query(Pipeline)
        .filter(Pipeline.name == pipeline_info["extractor"])
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

    # Ensure we have PKs assigned without committing the test transaction
    db.session.flush()

    # get a list of all the paper directories in the feature directory
    paper_dirs = [d for d in Path(feature_directory).iterdir() if d.is_dir()]

    # for each subject directory, read the results.json file and the info.json file
    pipeline_study_results = []
    pipeline_embeddings = []
    # track which partitions we've already ensured in this run
    ensured_partitions = set()

    for paper_dir in paper_dirs:
        # use the directory name as the base_study_id
        base_study_id = paper_dir.name

        if BaseStudy.query.filter_by(id=base_study_id).first() is None:
            logging.warning(
                "Skipping %s as it does not correspond to a valid base_study_id",
                paper_dir,
            )
            continue
        try:
            with open(op.join(paper_dir, "results.json")) as f:
                results = json.load(f)
        except FileNotFoundError:
            logging.warning(
                "Skipping %s as it does not contain results.json", paper_dir
            )
            continue
        except json.JSONDecodeError:
            logging.warning(
                "Skipping %s due to invalid JSON in results.json", paper_dir
            )
            continue
        try:
            with open(op.join(paper_dir, "info.json")) as f:
                info = json.load(f)
        except FileNotFoundError:
            logging.warning("Skipping %s as it does not contain info.json", paper_dir)
            continue
        except json.JSONDecodeError:
            logging.warning("Skipping %s due to invalid JSON in info.json", paper_dir)
            continue

        # sometimes the model returns a boolean instead of a dict
        if isinstance(results, bool):
            results = {}

        if save_as_embedding:
            vector = results.get("embedding") or results.get("predictions", {}).get(
                "embedding"
            )
            # Validate vector
            if vector is None:
                logging.warning(
                    "No embedding found in results for base_study_id=%s, skipping",
                    base_study_id,
                )
                continue

            if np is not None and isinstance(vector, np.ndarray):
                vector_list = vector.tolist()
            elif isinstance(vector, list):
                # ensure elements are float-compatible
                try:
                    vector_list = [float(x) for x in vector]
                except Exception:
                    logging.warning(
                        "Embedding for base_study_id=%s contains non-float values, skipping",
                        base_study_id,
                    )
                    continue
            else:
                logging.warning(
                    "Embedding for base_study_id=%s is not a list, skipping",
                    base_study_id,
                )
                continue

            # Ensure partition exists for this pipeline_config
            # BEFORE ANY operation that could flush
            if pipeline_config.id not in ensured_partitions:
                pipeline_config.embedding_dimensions = len(vector_list)
                with db.session.no_autoflush:
                    try:
                        ensure_partition_for_config_local(
                            db.session,
                            pipeline_config.id,
                            len(vector_list),
                            metric="cosine",
                        )
                    except Exception as e:
                        logging.warning(
                            "Could not ensure partition for config %s: %s",
                            pipeline_config.id,
                            e,
                        )
                ensured_partitions.add(pipeline_config.id)

            # Now it's safe to run queries that might trigger autoflush
            existing_result = (
                db.session.query(PipelineEmbedding)
                .filter(
                    PipelineEmbedding.base_study_id == base_study_id,
                    PipelineEmbedding.config_id == pipeline_config.id,
                )
                .first()
            )

            if existing_result and overwrite:
                # update existing record
                existing_result.embedding = vector_list
                dt = info.get("date")
                existing_result.date_executed = parse_date(dt) if dt else None
                existing_result.file_inputs = info.get("inputs")
                existing_result.status = "SUCCESS"
                logging.info(
                    "Updated PipelineEmbedding for pipeline_id=%s base_study_id=%s",
                    pipeline.id,
                    base_study_id,
                )
                pipeline_embeddings.append(existing_result)
            elif not existing_result:
                # Create PipelineEmbedding record. Use composite-looking id that includes config_id
                dt = info.get("date")
                embedding_record = PipelineEmbedding(
                    id=f"{pipeline_config.id}_{generate_id()}",
                    config_id=pipeline_config.id,
                    base_study_id=base_study_id,
                    date_executed=parse_date(dt) if dt else None,
                    file_inputs=info.get("inputs"),
                    status="SUCCESS",
                    embedding=vector_list,
                )
                pipeline_embeddings.append(embedding_record)
                logging.info(
                    "Saved embedding for pipeline_id=%s base_study_id=%s vector_length=%d",
                    pipeline.id,
                    base_study_id,
                    len(vector_list),
                )
                # do NOT create/update PipelineStudyResult in this branch
        else:
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
                dt = info.get("date")
                existing_result.date_executed = parse_date(dt) if dt else None
                existing_result.file_inputs = info.get("inputs")
                existing_result.status = "SUCCESS"
                logging.info(
                    "Updated PipelineStudyResult for pipeline_id=%s base_study_id=%s",
                    pipeline.id,
                    base_study_id,
                )
                pipeline_study_results.append(existing_result)
            elif not existing_result:
                # create a new result record
                dt = info.get("date")
                pipeline_study_results.append(
                    PipelineStudyResult(
                        base_study_id=base_study_id,
                        result_data=results,
                        date_executed=parse_date(dt) if dt else None,
                        file_inputs=info.get("inputs"),
                        config=pipeline_config,
                        status="SUCCESS",
                    )
                )
                logging.info(
                    "Created PipelineStudyResult for pipeline_id=%s base_study_id=%s",
                    pipeline.id,
                    base_study_id,
                )

    if pipeline_study_results:
        db.session.add_all(pipeline_study_results)

    if pipeline_embeddings:
        db.session.add_all(pipeline_embeddings)
        # mark config as having embeddings and persist if we actually wrote some
        pipeline_config.has_embeddings = True
        db.session.add(pipeline_config)
        logging.info(
            "Marked pipeline_config=%s has_embeddings=True", pipeline_config.id
        )

    db.session.commit()
