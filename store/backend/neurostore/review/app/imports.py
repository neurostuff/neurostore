"""Load the papers of a study_schema layout for review: each paper checked, then stored whole."""

import hashlib
import re
from functools import partial

import sqlalchemy as sa
from sqlalchemy.exc import DBAPIError

from neurostore.base_studies import find_base_study
from neurostore.models import (
    ExtractionEntityLink,
    Fulltext,
    Pipeline,
    PipelineConfig,
    PipelineStudyResult,
    ReviewSource,
    StudyEntity,
)
from neurostore.models.data import PARSE_PIPELINE, generate_stable_id
from neurostore.models.fulltext import FULLTEXT_SOURCE_PREFERENCE
from neurostore.review.core import coordinates, defs
from neurostore.review.core.entities import (
    judgeable_keys,
    shared_stable_ids,
    with_stable_ids,
    without_stable_ids,
)
from neurostore.review.core.layout import (
    LayoutError,
    check_paper,
    open_layout,
    paper_from_documents,
    parsed_paper_ids,
    read_paper,
    read_parsed_paper,
    read_provenance,
    study_ids,
)
from neurostore.review.errors import NotFound, ReviewError, Unprocessable
from neurostore.stored_parses import parse_chain
from neurostore.study_schema_tools import extracted_value, sha256_of

_POSITIONAL_KEY = re.compile(r"(prose|table)#\d+")


class PaperRefused(ReviewError):
    def __init__(self, problems):
        super().__init__("; ".join(problems), problems)


def import_layout(session, source, *, user_id, run_id=None):
    """Load every paper of ``source``, a layout directory or zip, in study-id order.

    Each paper is one savepoint, so a paper that fails loads nothing and the others still
    load. Flushes, never commits. Raises LayoutError when the source itself is unreadable.
    """
    report = {"loaded": [], "skipped": [], "failed": []}
    with open_layout(source) as root:
        for study_id in study_ids(root):
            try:
                paper = read_paper(root, study_id)
                provenance = read_provenance(root, study_id)
            except LayoutError as error:
                report["failed"].append({"study_id": study_id, "problems": error.problems})
                continue
            build = partial(
                _build_source,
                session,
                paper,
                wrapper=_wrapper(provenance),
                user_id=user_id,
                run_id=run_id,
            )
            _load(session, report, study_id, build)
    return report


def import_pipeline_run(session, *, config_id, run_id, user_id, papers):
    """Load each record the run ``run_id`` of ``config_id`` stored, with the coordinate parse it
    read and the parsed paper and text of its base study from ``papers``.

    ``papers`` is a layout directory or zip; only each paper's parsed paper and text are read.
    A record read from a revision loads the original parse with the pipeline's revision of it.
    Each record is one savepoint, as in import_layout; flushes, never commits.

    Raises:
        NotFound when the config is unknown or the run stored no record under it.
        Unprocessable when the config is the coordinate-parse pipeline's.
        LayoutError when ``papers`` is not a layout.
    """
    config = session.get(PipelineConfig, config_id)
    if config is None:
        raise NotFound("pipeline config", config_id)
    if config.pipeline.name == PARSE_PIPELINE:
        raise Unprocessable(
            f"pipeline config {config_id} stores coordinate parses, not extraction records"
        )
    rows = session.scalars(
        sa.select(PipelineStudyResult)
        .where(PipelineStudyResult.config_id == config_id, PipelineStudyResult.run_id == run_id)
        .order_by(PipelineStudyResult.base_study_id)
    ).all()
    if not rows:
        raise NotFound("pipeline run", run_id)
    report = {"loaded": [], "skipped": [], "failed": []}
    with open_layout(papers) as root:
        uploaded = _uploaded_papers(session, root, report)
        for row in rows:
            parse_id, text_sha256 = _fingerprints(row.file_inputs)
            chain = parse_chain(session, row.base_study_id, parse_id)
            upload = uploaded.get(row.base_study_id)
            if upload is None:
                # The chain is empty only when the parse the record read is gone; the base
                # study's id is then all that names the paper.
                study_id = chain[0]["header"].get("article_id") if chain else row.base_study_id
                report["failed"].append({
                    "study_id": study_id,
                    "problems": [f"no uploaded paper for base study {row.base_study_id}"],
                })
                continue
            build = partial(
                _build_run_source,
                session, row, upload, chain, text_sha256, config_id=config_id, user_id=user_id,
            )
            _load(session, report, upload[0], build)
    return report


def _load(session, report, study_id, build):
    """Run ``build`` in a savepoint and file what it returns, or why it failed, in ``report``."""
    try:
        with session.begin_nested():
            bucket, entry = build()
    except PaperRefused as refused:
        report["failed"].append({"study_id": study_id, "problems": refused.problems})
    except DBAPIError as error:
        first_line = str(error.orig).partition("\n")[0]
        report["failed"].append({"study_id": study_id, "problems": [first_line]})
    else:
        report[bucket].append(entry)


def _uploaded_papers(session, root, report):
    """``{base_study_id: (study_id, parsed_paper, text)}`` for the papers under ``root``; one
    that cannot be read, has no base study, or has the base study of one before it is filed as
    failed in ``report``."""
    uploaded = {}
    for study_id in parsed_paper_ids(root):
        try:
            parsed_paper, text = read_parsed_paper(root, study_id)
        except LayoutError as error:
            report["failed"].append({"study_id": study_id, "problems": error.problems})
            continue
        identifiers = (parsed_paper.get("header") or {}).get("identifiers") or {}
        base_study = find_base_study(session, identifiers)
        if base_study is None:
            problem = _no_base_study(identifiers)
        elif base_study.id in uploaded:
            first = uploaded[base_study.id][0]
            problem = f"{first} is already the uploaded paper of the same base study"
        else:
            uploaded[base_study.id] = (study_id, parsed_paper, text)
            continue
        report["failed"].append({"study_id": study_id, "problems": [problem]})
    return uploaded


def _no_base_study(identifiers):
    named = ", ".join(f"{field}={value}" for field, value in identifiers.items() if value)
    return f"no base study for {named}"


def _fingerprints(file_inputs):
    """The parse id and the text sha256 a record's inputs name."""
    by_kind = {entry.get("artifact_kind"): entry.get("fingerprint") for entry in file_inputs or ()}
    return by_kind.get("coordinate_parse"), by_kind.get("parsed_paper")


def _build_run_source(session, row, upload, chain, text_sha256, *, config_id, user_id):
    study_id, parsed_paper, text = upload
    if not chain:
        raise PaperRefused([f"the parse the record read is not stored for {row.base_study_id}"])
    actual = hashlib.sha256(text.encode("utf-8")).hexdigest()
    if actual != text_sha256:
        raise PaperRefused([f"the text's sha256 {actual} is not the {text_sha256} the run read"])
    original, revisions = chain[0], chain[1:]
    paper = paper_from_documents(study_id, parsed_paper, original, row.result_data, text)
    revision = coordinates.from_chain(original, revisions) if revisions else None
    # Unrevised, the digest is the file import's, so a record already loaded from files
    # is skipped as that source; a revision is part of what was loaded.
    return _build_source(
        session,
        paper,
        wrapper=None if revision is None else {"coordinate_revision": revision},
        user_id=user_id,
        run_id=row.run_id,
        pipeline_config_id=config_id,
        coordinate_revision=revision,
    )


def _build_source(
    session, paper, *, wrapper, user_id, run_id, pipeline_config_id=None, coordinate_revision=None
):
    """Load ``paper`` as a source, or skip it as the source loaded with the same digest: that of
    its record without stable_ids, or, given a ``wrapper``, of the record and the wrapper's
    fields."""
    problems = check_paper(paper)
    if problems:
        raise PaperRefused(problems)
    problems = _positional_problems(paper.record)
    if problems:
        raise PaperRefused(problems)
    identifiers = paper.parsed_paper["header"]["identifiers"]
    base_study = find_base_study(session, identifiers)
    if base_study is None:
        raise PaperRefused([_no_base_study(identifiers)])
    fulltext = _fulltext(session, base_study, paper)
    bare = without_stable_ids(paper.record)
    digest = sha256_of(bare if wrapper is None else {"record": bare, **wrapper})
    existing = session.scalar(
        sa.select(ReviewSource).where(
            ReviewSource.fulltext_id == fulltext.id, ReviewSource.record_sha256 == digest
        )
    )
    if existing is not None:
        return "skipped", {
            "study_id": paper.study_id,
            "source_id": existing.id,
            "reason": "already loaded",
        }
    record = _with_stable_ids(session, base_study, paper.record, pipeline_config_id)
    source = ReviewSource(
        fulltext_id=fulltext.id,
        parsed_paper=paper.parsed_paper,
        coordinate_parse=paper.coordinate_parse,
        coordinate_revision=coordinate_revision,
        record=record,
        judgeable_keys=judgeable_keys(
            record, coordinates.current(paper.coordinate_parse, coordinate_revision)
        ),
        label=paper.parsed_paper["bibliography"]["title"],
        schema_versions=_schema_versions(paper),
        record_sha256=digest,
        loaded_by_id=user_id,
        pipeline_config_id=pipeline_config_id,
        run_id=run_id,
    )
    session.add(source)
    session.flush()
    return "loaded", {
        "study_id": paper.study_id,
        "source_id": source.id,
        "base_study_id": base_study.id,
    }


def _with_stable_ids(session, base_study, record, config_id):
    """``record`` with a stable_id on each entity: the one it carries, else that of the
    StudyEntity its run linked its local_id to, else a new one.

    A record from files is the run's when a run stored the same record for the base study.
    """
    if config_id is None:
        config_id = _config_storing(session, base_study, record)
    linked = {} if config_id is None else _linked_stable_ids(session, base_study, config_id)
    record = with_stable_ids(record, linked, generate_stable_id)
    shared = shared_stable_ids(record)
    if shared:
        raise PaperRefused([
            f"stable_id {stable_id} is on more than one entity: {', '.join(local_ids)}"
            for stable_id, local_ids in shared.items()
        ])
    return record


def _config_storing(session, base_study, record):
    """The config of the newest run that stored ``record`` for ``base_study``, or None.

    The stored result_data (JSONB) must equal the whole record: one whose numbers differ in
    form (1.0 against 1) is no run's, and its entities get new stable_ids."""
    return session.scalar(
        sa.select(PipelineStudyResult.config_id)
        .join(PipelineConfig, PipelineStudyResult.config_id == PipelineConfig.id)
        .join(Pipeline, PipelineConfig.pipeline_id == Pipeline.id)
        .where(
            PipelineStudyResult.base_study_id == base_study.id,
            Pipeline.name != PARSE_PIPELINE,
            PipelineStudyResult.result_data == record,
        )
        .order_by(
            PipelineStudyResult.date_executed.desc().nulls_last(), PipelineStudyResult.id
        )
        .limit(1)
    )


def _linked_stable_ids(session, base_study, config_id):
    """``{local_id: stable_id}`` of the StudyEntities the run of ``config_id`` linked the base
    study's local_ids to."""
    prefix = f"{base_study.id}:"
    rows = session.execute(
        sa.select(ExtractionEntityLink.local_id, StudyEntity.stable_id)
        .join(StudyEntity, ExtractionEntityLink.entity_id == StudyEntity.id)
        .where(
            ExtractionEntityLink.config_id == config_id,
            ExtractionEntityLink.local_id.startswith(prefix, autoescape=True),
            StudyEntity.base_study_id == base_study.id,
        )
    )
    return {local_id.removeprefix(prefix): stable_id for local_id, stable_id in rows}


def _names_review(provenance):
    source = provenance.get("source")
    return isinstance(source, dict) and source.get("kind") == "review"


def _wrapper(provenance):
    """The part of a record's digest its provenance wrapper is: the wrapper when it names a
    review, else None."""
    if provenance is None or not _names_review(provenance):
        return None
    return {"provenance": provenance}


def _positional_problems(record):
    problems = []
    for analysis in record.get("analyses") or ():
        key = extracted_value(analysis.get("source_table_analysis"))
        if isinstance(key, str) and _POSITIONAL_KEY.fullmatch(key):
            problems.append(
                f"positional coordinate key {key}; import takes content keys only, "
                "as study_schema's coordinate parse keys analyses"
            )
    return problems


def _fulltext(session, base_study, paper):
    source = paper.parsed_paper["source"]
    if source not in FULLTEXT_SOURCE_PREFERENCE:
        raise PaperRefused([f"unknown text source {source!r}"])
    digest = paper.parsed_paper["text_sha256"]
    fulltext = session.scalar(
        sa.select(Fulltext).where(
            Fulltext.base_study_id == base_study.id, Fulltext.sha256 == digest
        )
    )
    if fulltext is None:
        fulltext = Fulltext(base_study_id=base_study.id, source=source, text=paper.text)
        session.add(fulltext)
        session.flush()
    return fulltext


def _schema_versions(paper):
    return {
        "paper_parse": paper.parsed_paper["header"]["schema_version"],
        "coordinate_parse": paper.coordinate_parse["header"]["schema_version"],
        "extraction": defs.extraction_version(),
    }
