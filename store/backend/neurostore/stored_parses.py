"""Finding the coordinate parses stored for a paper. Read-only: nothing is created."""

import sqlalchemy as sa

from neurostore.models import Pipeline, PipelineConfig, PipelineStudyResult
from neurostore.models.data import PARSE_PIPELINE


def stored_parse_result(session, base_study_id, parse_id):
    """The PipelineStudyResult holding the parse ``parse_id`` of the base study; None when
    it is not stored."""
    return session.scalar(
        sa.select(PipelineStudyResult)
        .join(PipelineConfig, PipelineStudyResult.config_id == PipelineConfig.id)
        .join(Pipeline, PipelineConfig.pipeline_id == Pipeline.id)
        .where(
            Pipeline.name == PARSE_PIPELINE,
            PipelineStudyResult.base_study_id == base_study_id,
            PipelineStudyResult.result_data["parse_id"].astext == parse_id,
        )
        .limit(1)
    )


def stored_parse(session, base_study_id, parse_id):
    result = stored_parse_result(session, base_study_id, parse_id)
    return result.result_data if result is not None else None


def parse_chain(session, base_study_id, parse_id):
    """The stored parse ``parse_id`` and the parses it revises, the original first; empty when
    one of them is not stored."""
    chain = []
    while parse_id is not None:
        parse = stored_parse(session, base_study_id, parse_id)
        if parse is None:
            return []
        chain.append(parse)
        parse_id = parse.get("revision_of")
    return list(reversed(chain))
