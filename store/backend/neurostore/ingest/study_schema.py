"""Ingest study_schema artifacts: coordinate parses, their revisions, and extraction records.

One writer for what the pipeline hands neurostore, taking four kinds of upload:

    parse              a CoordinateParse alone: the skeleton, no record
    parse_and_record   a CoordinateParse and the extraction record read from it
    record             a record alone, attached to a parse stored earlier
    revision           pondie's revised CoordinateParse (``revision_of`` set), with or
                       without its record

The shapes are study_schema's (neuroimaging-paper-parse and neuroimaging-study-extraction),
validated against the JSON Schema that package ships. Analyses are keyed by the parse's
cell keys (``ParsedAnalysis.key``), stored as ``Analysis.source_id``.

Each base study has one pipeline-owned Study (``source = STUDY_SOURCE``) holding the
current parse version; ``Study.source_id`` is that parse's ``parse_id``. When a new
version drops a key, the analysis under it moves -- ids, points and payloads intact -- to a
non-public history Study for the version it came from (``source = HISTORY_SOURCE``,
``source_id`` = the old ``parse_id``), so it is kept but never selected for a studyset.
Every parse uploaded is also kept whole as a PipelineStudyResult of the PARSE_PIPELINE
pipeline.

Claims (field_claims) hang off StudyEntity rows identified by ``entity_hash``
(``study_entity_hash``); for an analysis or coordinate set the hash covers every cell or
span it was read from, taken from a stored parse that holds its key. An analysis whose
cells survive a new version keeps its claims untouched. A revision's split and merge
verdicts copy the claims, evidence and runs on the old entity to each replacement, each
copy naming its origin in ``carried_from``. A new original parse that reads an analysis
from other cells (same table and name, new key) re-hashes its entities instead, keeping the
old hash as a ``cells_changed`` alias so a record that read the older parse still resolves.
Record keys that are positional rather than content keys, or that no stored parse holds,
are set aside (the record summary's ``parked`` and ``claims.parked_entities``), never made
entities. A positional key stays set aside until a record names it by content; a key no
parse held is resolved when a later parse holds it: each stored record naming it has its
claims re-ingested onto the new entity (the parse upload's ``set_aside_resolved``).

Every result an upload writes carries the caller's ``run_id``. Replaying a run (same
run_id, same documents) returns the same results and adds none; the same run_id with a
different document for the paper is refused (RUN_ID_REUSED).

Only a new parse supersedes the current one: re-uploading a stored, non-current parse is
refused (NOT_CURRENT). A record that read an older parse reports the keys that resolve to
history as ``superseded`` (a FAILURE row), and its claims are carried through the revisions
since. The sign of a contrast lives on its condition weights: the inverse half of a sign
split gets its original half's conditions, negated.
"""

import hashlib
import json
import re
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError
from jsonschema import validators
from study_schema import keys as parse_keys
from study_schema.jsonschema import load as load_json_schema
from study_schema.statistics import point_side

from neurostore.coordinate_spaces import normalize_space
from neurostore.database import db
from neurostore.exceptions.factories import make_field_error
from neurostore.exceptions.utils.error_helpers import (
    abort_not_found,
    abort_unprocessable,
    abort_validation,
)
from neurostore.models.data import analysis_identity, study_entity_hash
from neurostore.models import (
    Analysis,
    AnalysisConditions,
    BaseStudy,
    Condition,
    ExtractionEntityLink,
    FieldClaim,
    FieldClaimEvidence,
    FieldClaimRun,
    Pipeline,
    PipelineAnalysisResult,
    PipelineConfig,
    PipelineStudyResult,
    Point,
    PointValue,
    Study,
    StudyEntity,
    StudyEntityAlias,
    Table,
)
from neurostore.services.has_media_flags import recompute_media_flags

STUDY_SOURCE = "study_schema"
HISTORY_SOURCE = "study_schema:superseded"
PARSE_PIPELINE = "coordinate-parse"
DEFAULT_RECORD_PIPELINE = "pondie"

# Roles stored as analyses. References, display positions and localizations stay in the
# stored parse document only (see the paper-parse schema's CoordinateRole).
UPLOADED_ROLES = {"result", "anchor"}

# Entities a record names by parse key, hashed by the cells or spans behind that key, so a
# split or merge moves their claims.
PARSE_KEYED_CLASSES = ("Analysis", "CoordinateSet")

# The storage schema's unique_key_slots: the only nested lists a claim path may index.
DECLARED_KEYS = {
    "Cell": ("term", "level"),
    "AnalysisGroup": ("group",),
    "ModelTerm": ("name",),
    "FactorLevel": ("level",),
}

# Analysis fields the skeleton keeps as columns or points rather than in metadata.
_ANALYSIS_COLUMNS = {"key", "name", "description", "points"}

# StudyEntityAlias.reason when a new parse reads the same analysis from other cells.
ALIAS_CELLS_CHANGED = "cells_changed"
SUPERSEDED_REASON = (
    "the record read an older parse; a revision since replaced this key, and its claims "
    "are carried to replaced_by"
)
DROPPED_REASON = "the record read an older parse that held this key; the current one does not"

# A content key ends in 12 hex digits of its cells' or spans' hash (study_schema.keys).
# pondie records still carry positional ``<table_id>#<ordinal>`` / ``text#<N>`` keys until
# pondie moves to content keys; those are held, never minted into entities, since an
# ordinal re-addresses claims.
_CONTENT_KEY = re.compile(r"[^#]+#[0-9a-f]{12}")
POSITIONAL_KEY_REASON = (
    "positional key: claims are keyed only by content keys (study_schema.keys), "
    "which pondie records carry once they are migrated"
)
UNKNOWN_KEY_REASON = "no stored parse of this paper holds the key, so it has no cells to hash"

_MAX_REPORTED_ERRORS = 20


def is_content_key(key):
    return bool(key) and _CONTENT_KEY.fullmatch(key) is not None


def ingest_upload(body, user=None):
    """Store one upload; return a summary of what changed. Does not commit."""
    parse = body.get("coordinate_parse")
    record = body.get("record")
    parsed_paper = body.get("parsed_paper")
    if parse is None and record is None:
        abort_validation("An upload needs a coordinate_parse, a record, or both.")

    for name, document in (
        ("coordinate-parse", parse),
        ("extraction-record", record),
        ("parsed-paper", parsed_paper),
    ):
        if document is not None:
            _validate(name, document)
    if parse is not None:
        _check_keys(parse)

    if parse is not None and parse.get("revision_of"):
        kind = "revision"
    elif parse is not None:
        kind = "parse_and_record" if record is not None else "parse"
    else:
        kind = "record"

    parse_id = parse["parse_id"] if parse is not None else body.get("parse_id")
    if record is not None and not parse_id:
        abort_validation(
            "A record uploaded alone must name the parse it read.",
            [make_field_error("parse_id", None, code="MISSING")],
        )
    if parse is not None and body.get("parse_id") not in (None, parse_id):
        abort_validation(
            "parse_id names a different parse from the one uploaded.",
            [make_field_error("parse_id", body.get("parse_id"), code="MISMATCH")],
        )

    base_study = _resolve_base_study(body, parse, parsed_paper, create=parse is not None)
    # Serialize uploads for one paper: version changes read, then move, its analyses.
    db.session.execute(
        sa.select(BaseStudy.id).where(BaseStudy.id == base_study.id).with_for_update()
    )

    summary = {
        "kind": kind,
        "base_study_id": base_study.id,
        "parse_id": parse_id,
    }
    study = _current_study(base_study)
    current_parse_id = study.source_id if study is not None else None

    if (
        parse is not None
        and current_parse_id not in (None, parse_id)
        and _stored_parse(base_study, parse_id) is not None
    ):
        # Only a new parse supersedes the current one; replaying an older one would undo
        # the revisions made since.
        abort_unprocessable(
            "This parse is stored and is no longer the paper's current parse.",
            [
                make_field_error(
                    "coordinate_parse/parse_id",
                    {"parse_id": parse_id, "current": current_parse_id},
                    code="NOT_CURRENT",
                )
            ],
        )

    provenance = {}
    if parse is not None:
        study = study or _create_study(base_study, parsed_paper, user)
        held_before = _held_keys(base_study)
        provenance["parse"] = _store_parse(base_study, parse, body.get("run_id"))
        summary["skeleton"] = _apply_parse(study, parse, parsed_paper, user)
        if kind == "revision":
            summary["carried"] = _carry_claims(base_study, study, parse)
        db.session.flush()
        summary["set_aside_resolved"] = _resolve_set_aside(
            base_study, {a["key"] for a in parse["analyses"]} - held_before
        )

    if record is not None:
        stored_parse = _stored_parse(base_study, parse_id)
        if stored_parse is None:
            abort_unprocessable(
                "A record attaches to a stored parse; this one is not stored for the paper.",
                [make_field_error("parse_id", parse_id, code="UNKNOWN_PARSE")],
            )
        summary["record"], provenance["record"] = _ingest_record(
            base_study,
            study,
            record,
            stored_parse,
            body.get("pipeline") or {},
            user,
            body.get("run_id"),
        )

    if study is not None:
        summary["study_id"] = study.id
    db.session.flush()
    summary["provenance"] = {name: _provenance(result) for name, result in provenance.items()}
    recompute_media_flags([base_study.id])
    return summary


# ---------------------------------------------------------------------------
# validation
# ---------------------------------------------------------------------------


_validators = {}


def _validate(name, document):
    if name not in _validators:
        schema = load_json_schema(name)
        _validators[name] = validators.validator_for(schema)(schema)
    errors = sorted(_validators[name].iter_errors(document), key=lambda e: list(e.path))
    if errors:
        abort_unprocessable(
            f"The {name} does not validate against study_schema.",
            [
                make_field_error(
                    f"{name}/" + "/".join(str(p) for p in error.path),
                    error.message,
                    code="SCHEMA",
                )
                for error in errors[:_MAX_REPORTED_ERRORS]
            ],
        )


def _expected_key(analysis):
    if analysis["origin"] == "table":
        if not analysis.get("table_id") or not analysis.get("cells"):
            return None
        return parse_keys.table_key(
            analysis["table_id"],
            ((c["row"], c["column_group"]) for c in analysis["cells"]),
        )
    if not analysis.get("text_spans"):
        return None
    return parse_keys.span_key(
        analysis["origin"],
        ((s["start_char"], s["end_char"]) for s in analysis["text_spans"]),
    )


def _check_keys(parse):
    """Every key is the one its cells or spans give, and no two analyses share one."""
    errors, seen = [], set()
    for index, analysis in enumerate(parse["analyses"]):
        expected = _expected_key(analysis)
        if analysis["key"] != expected:
            errors.append(
                make_field_error(
                    f"coordinate_parse/analyses/{index}/key",
                    {"key": analysis["key"], "expected": expected},
                    code="KEY_MISMATCH",
                )
            )
        if analysis["key"] in seen:
            errors.append(
                make_field_error(
                    f"coordinate_parse/analyses/{index}/key",
                    analysis["key"],
                    code="DUPLICATE_KEY",
                )
            )
        seen.add(analysis["key"])
    if errors:
        abort_unprocessable(
            "Analysis keys must be derived from their cells or spans.",
            errors[:_MAX_REPORTED_ERRORS],
        )


def _check_verdicts(revision, revised):
    """A revision gives every analysis of the parse it revises a verdict."""
    keys = {a["key"] for a in revision["analyses"]}
    verdicts = revision.get("verdicts") or []
    errors = []
    judged = {v["key"] for v in verdicts if v["verdict"] != "add"}
    missing = sorted({a["key"] for a in revised["analyses"]} - judged)
    if missing:
        errors.append(make_field_error("coordinate_parse/verdicts", missing, code="MISSING"))
    for index, verdict in enumerate(verdicts):
        replaced_by = verdict.get("replaced_by") or []
        unknown = [key for key in replaced_by if key not in keys]
        if verdict["verdict"] == "add" and verdict["key"] not in keys:
            unknown.append(verdict["key"])
        if verdict["verdict"] in ("split", "merge") and not replaced_by:
            errors.append(
                make_field_error(
                    f"coordinate_parse/verdicts/{index}/replaced_by", None, code="MISSING"
                )
            )
        if unknown:
            errors.append(
                make_field_error(
                    f"coordinate_parse/verdicts/{index}/replaced_by",
                    unknown,
                    code="UNKNOWN_KEY",
                )
            )
    if errors:
        abort_unprocessable(
            "The revision's verdicts do not cover the parse it revises.", errors
        )


# ---------------------------------------------------------------------------
# base study, study, and the stored parse documents
# ---------------------------------------------------------------------------


def _resolve_base_study(body, parse, parsed_paper, create):
    identifiers = {}
    if parse is not None:
        identifiers = parse["header"]["identifiers"] or {}
    base_study_id = body.get("base_study_id") or identifiers.get("neurostore_base_study_id")
    if base_study_id:
        base_study = db.session.get(BaseStudy, base_study_id)
        if base_study is None:
            abort_not_found("BaseStudy", base_study_id)
        return base_study

    _lock_identifiers(identifiers)
    for field in ("doi", "pmid", "pmcid"):
        value = identifiers.get(field)
        if not value:
            continue
        base_study = (
            BaseStudy.query.filter(getattr(BaseStudy, field) == value)
            .filter(BaseStudy.is_active.is_(True))
            .order_by(BaseStudy.created_at)
            .first()
        )
        if base_study is not None:
            return base_study

    if not create:
        abort_validation(
            "A record uploaded alone must name its base study.",
            [make_field_error("base_study_id", None, code="MISSING")],
        )
    if not any(identifiers.get(field) for field in ("doi", "pmid", "pmcid")):
        abort_validation(
            "The parse names no identifier to find or create its base study by.",
            [make_field_error("coordinate_parse/header/identifiers", identifiers)],
        )
    base_study = BaseStudy(
        doi=identifiers.get("doi"),
        pmid=identifiers.get("pmid"),
        pmcid=identifiers.get("pmcid"),
        level="group",
        **_bibliography(parsed_paper),
    )
    db.session.add(base_study)
    db.session.flush()
    return base_study


def _lock_identifiers(identifiers):
    """Serialize lookups of one paper until commit.

    BaseStudy has no unique doi/pmid/pmcid, so two first uploads of a paper would each
    create one. Locks are taken in one order, so uploads sharing identifiers cannot deadlock.
    """
    for key in sorted(
        f"{field}:{identifiers[field]}"
        for field in ("doi", "pmid", "pmcid")
        if identifiers.get(field)
    ):
        db.session.execute(
            sa.text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
            {"key": f"study_schema.base_study:{key}"},
        )


def _bibliography(parsed_paper):
    """BaseStudy/Study fields copied from a parsed paper's bibliography."""
    if parsed_paper is None:
        return {}
    bib = parsed_paper["bibliography"]
    authors = [a.get("name") if isinstance(a, dict) else a for a in bib.get("authors") or []]
    fields = {
        "name": bib.get("title"),
        "description": bib.get("abstract"),
        "publication": bib.get("journal"),
        "year": bib.get("publication_year"),
        "authors": ", ".join(a for a in authors if a) or None,
    }
    return {k: v for k, v in fields.items() if v is not None}


def _current_study(base_study):
    return Study.query.filter_by(base_study_id=base_study.id, source=STUDY_SOURCE).first()


def _create_study(base_study, parsed_paper, user):
    fields = {
        "name": base_study.name,
        "description": base_study.description,
        "publication": base_study.publication,
        "authors": base_study.authors,
        "year": base_study.year,
    }
    fields.update(_bibliography(parsed_paper))
    study = Study(
        base_study=base_study,
        doi=base_study.doi,
        pmid=base_study.pmid,
        pmcid=base_study.pmcid,
        level="group",
        public=True,
        source=STUDY_SOURCE,
        user=user,
        **fields,
    )
    db.session.add(study)
    db.session.flush()
    return study


def _history_study(base_study, current, parse_id, superseded_by, user):
    study = Study.query.filter_by(
        base_study_id=base_study.id, source=HISTORY_SOURCE, source_id=parse_id
    ).first()
    if study is None:
        study = Study(
            base_study=base_study,
            name=current.name,
            doi=current.doi,
            pmid=current.pmid,
            pmcid=current.pmcid,
            level=current.level,
            public=False,
            source=HISTORY_SOURCE,
            source_id=parse_id,
            user=user,
        )
        db.session.add(study)
    study.metadata_ = {**(study.metadata_ or {}), "superseded_by": superseded_by}
    study.source_updated_at = _now()
    db.session.flush()
    return study


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def _hash(value):
    return hashlib.sha256(_canonical(value).encode("utf-8")).hexdigest()


def _get_config(pipeline_name, version, config_args, schema=None):
    pipeline = Pipeline.query.filter_by(name=pipeline_name).first()
    if pipeline is None:
        pipeline = Pipeline(name=pipeline_name)
        db.session.add(pipeline)
        db.session.flush()
    config_hash = _hash(config_args)
    config = PipelineConfig.query.filter_by(
        pipeline_id=pipeline.id, version=version, config_hash=config_hash
    ).first()
    if config is None:
        config = PipelineConfig(
            pipeline_id=pipeline.id,
            version=version,
            config_args=config_args,
            config_hash=config_hash,
            schema=schema,
        )
        db.session.add(config)
        db.session.flush()
    return config


def _parse_version(header):
    """The producer half of a parse's header: what a record's config records it read."""
    producer = header["producer"]
    return {
        key: producer.get(key)
        for key in ("name", "version", "stage", "model", "prompt_version")
    }


def _store_parse(base_study, parse, run_id=None):
    """Keep ``parse`` whole as a PARSE_PIPELINE result; return that result."""
    stored = _stored_parse_result(base_study, parse["parse_id"])
    if stored is not None:
        return stored
    producer = _parse_version(parse["header"])
    config = _get_config(
        PARSE_PIPELINE,
        producer["version"],
        {"producer": producer},
        schema={
            "name": "neuroimaging-paper-parse",
            "version": parse["header"]["schema_version"],
        },
    )
    _check_run(config, base_study, run_id, parse)

    def write():
        result = PipelineStudyResult(
            config_id=config.id,
            base_study_id=base_study.id,
            run_id=run_id,
            result_data=parse,
            file_inputs=parse["header"].get("inputs"),
            status="SUCCESS",
            date_executed=parse["header"].get("created_at") or _now(),
        )
        db.session.add(result)
        return result

    return _write_run(write, config, base_study, run_id, parse)


def _check_run(config, base_study, run_id, document):
    """Refuse a run_id that already stored a different document for this config and paper.

    The same document under the same run_id is a replay and goes through unchanged.
    """
    if run_id is None:
        return
    stored = PipelineStudyResult.query.filter_by(
        config_id=config.id, base_study_id=base_study.id, run_id=run_id
    ).first()
    if stored is not None and stored.result_data != document:
        abort_unprocessable(
            "This run_id already stored a different document for the paper.",
            [make_field_error("run_id", run_id, code="RUN_ID_REUSED")],
        )


def _write_run(write, config, base_study, run_id, document):
    """Run ``write``, which adds the result; a run_id a concurrent upload just took is refused.

    Returns ``write``'s result, or the stored one when that upload stored this same document.
    """
    try:
        with db.session.begin_nested():
            result = write()
            db.session.flush()
        return result
    except IntegrityError:
        stored = PipelineStudyResult.query.filter_by(
            config_id=config.id, base_study_id=base_study.id, run_id=run_id
        ).first()
        if run_id is None or stored is None:
            raise
        if stored.result_data == document:
            return stored
        abort_unprocessable(
            "This run_id already stored a different document for the paper.",
            [make_field_error("run_id", run_id, code="RUN_ID_REUSED")],
        )


def _stored_parse_results(base_study):
    return (
        PipelineStudyResult.query.join(PipelineConfig)
        .join(Pipeline)
        .filter(
            Pipeline.name == PARSE_PIPELINE,
            PipelineStudyResult.base_study_id == base_study.id,
        )
        .all()
    )


def _held_keys(base_study):
    """Every analysis key a stored parse of the paper holds."""
    return {
        analysis["key"]
        for result in _stored_parse_results(base_study)
        for analysis in (result.result_data or {}).get("analyses") or []
    }


def _record_keys(record):
    """The content keys a record names for its parse-keyed entities."""
    keys = set()
    for value in record.values():
        if not isinstance(value, list):
            continue
        for item in value:
            if not isinstance(item, dict):
                continue
            for cls in PARSE_KEYED_CLASSES:
                key = _record_key(cls, item)
                if key and is_content_key(key):
                    keys.add(key)
    return keys


def _resolve_set_aside(base_study, new_keys):
    """Attach stored records' set-aside keys that a newly stored parse now holds.

    A record key no stored parse held was set aside (parked, UNKNOWN_KEY_REASON) rather
    than minted. When a later parse holds it, each stored record naming it has its claims
    re-ingested, so they land on the new entity, and its analysis rows for those keys are
    linked. Returns, per record config, the keys resolved.
    """
    if not new_keys:
        return []
    records = (
        PipelineStudyResult.query.join(PipelineConfig)
        .join(Pipeline)
        .filter(
            Pipeline.name != PARSE_PIPELINE,
            PipelineStudyResult.base_study_id == base_study.id,
        )
        .all()
    )
    resolved = []
    for result in records:
        record = result.result_data or {}
        keys = sorted(_record_keys(record) & new_keys)
        if not keys:
            continue
        config = result.config
        _ingest_claims(
            base_study, record, config, (config.config_args or {}).get("schema_version")
        )
        for row in PipelineAnalysisResult.query.filter(
            PipelineAnalysisResult.config_id == config.id,
            PipelineAnalysisResult.base_study_id == base_study.id,
            PipelineAnalysisResult.source_table_analysis.in_(keys),
        ):
            key = _current_key(base_study, row.source_table_analysis)
            analysis = _analysis_for_key(base_study, key)
            row.analysis_id = analysis.id if analysis is not None else None
            row.status = "SUCCESS" if analysis is not None else "FAILURE"
        resolved.append({"config_id": config.id, "keys": keys})
    db.session.flush()
    return resolved


def _stored_parse_result(base_study, parse_id):
    return (
        PipelineStudyResult.query.join(PipelineConfig)
        .join(Pipeline)
        .filter(
            Pipeline.name == PARSE_PIPELINE,
            PipelineStudyResult.base_study_id == base_study.id,
            PipelineStudyResult.result_data["parse_id"].astext == parse_id,
        )
        .first()
    )


def _stored_parse(base_study, parse_id):
    result = _stored_parse_result(base_study, parse_id)
    return result.result_data if result is not None else None


def _iso(value):
    return value.isoformat() if isinstance(value, datetime) else value


def _provenance(result):
    """The run a stored result came from: pipeline, version, commit, schema and times."""
    config = result.config
    args = config.config_args or {}
    return {
        "result_id": result.id,
        "config_id": config.id,
        "run_id": result.run_id,
        "pipeline": config.pipeline.name,
        "version": config.version,
        "commit": args.get("commit"),
        "schema": config.schema,
        "parse_version": args.get("parse_version") or args.get("producer"),
        "date_executed": _iso(result.date_executed),
        "created_at": _iso(result.created_at),
        "updated_at": _iso(result.updated_at),
    }


def _now():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# the coordinate skeleton
# ---------------------------------------------------------------------------


def _apply_parse(study, parse, parsed_paper, user):
    """Make ``study`` hold ``parse``'s analyses; move the ones it drops to history."""
    base_study = study.base_study
    current_parse_id = study.source_id
    revision_of = parse.get("revision_of")
    if revision_of and current_parse_id not in (None, parse["parse_id"], revision_of):
        abort_unprocessable(
            "A revision must revise the paper's current parse.",
            [
                make_field_error(
                    "coordinate_parse/revision_of",
                    {"revision_of": revision_of, "current": current_parse_id},
                    code="NOT_CURRENT",
                )
            ],
        )
    revised = _stored_parse(base_study, revision_of) if revision_of else None
    if revision_of and revised is None:
        abort_unprocessable(
            "A revision revises a stored parse; the one it names is not stored for the paper.",
            [make_field_error("coordinate_parse/revision_of", revision_of, code="UNKNOWN_PARSE")],
        )
    if revised is not None:
        _check_verdicts(parse, revised)

    uploaded = [a for a in parse["analyses"] if a["role"] in UPLOADED_ROLES]
    wanted = {a["key"] for a in uploaded}
    existing = {a.source_id: a for a in study.analyses}
    tables = {t.t_id: t for t in study.tables}
    paper_tables = {
        t["table_id"]: t for t in (parsed_paper or {}).get("tables") or []
    }
    counts = {"created": 0, "updated": 0, "superseded": 0}
    counts["not_uploaded"] = sorted(
        a["key"] for a in parse["analyses"] if a["role"] not in UPLOADED_ROLES
    )

    superseded = [a for key, a in existing.items() if key not in wanted]
    if superseded:
        history = _history_study(
            base_study, study, current_parse_id, parse["parse_id"], user
        )
        history_tables = {t.t_id: t for t in history.tables}
        for analysis in superseded:
            if analysis.table is not None:
                analysis.table = _table(
                    history, history_tables, analysis.table.t_id, analysis.table
                )
            analysis.study = history
            counts["superseded"] += 1
        if not revision_of:
            counts["aliased"] = _alias_rekeyed(base_study, superseded, uploaded, existing)

    for order, parsed in enumerate(uploaded):
        analysis = existing.get(parsed["key"])
        if analysis is None:
            analysis = Analysis(study=study, source_id=parsed["key"], user=user)
            db.session.add(analysis)
            counts["created"] += 1
        else:
            counts["updated"] += 1
        analysis.name = parsed["name"]
        analysis.description = parsed.get("description")
        analysis.order = order
        analysis.metadata_ = _analysis_metadata(parsed, parse["parse_id"])
        analysis.table = (
            _table(study, tables, parsed["table_id"], paper_tables.get(parsed["table_id"]))
            if parsed.get("table_id")
            else None
        )
        _set_points(analysis, parsed, user)

    study.source_id = parse["parse_id"]
    study.source_updated_at = _now()
    study.metadata_ = {
        **(study.metadata_ or {}),
        "coordinate_parse": {
            "parse_id": parse["parse_id"],
            "revision_of": revision_of,
            "text_sha256": parse["text_sha256"],
            "schema_version": parse["header"]["schema_version"],
            "producer": _parse_version(parse["header"]),
            "tables": parse.get("tables"),
            "text_sweep": parse.get("text_sweep"),
        },
    }
    db.session.flush()
    _link_entities(base_study, study)
    return counts


def _table(study, tables, t_id, source):
    """The study's Table for ``t_id``, created from a parsed table or another Table."""
    table = tables.get(t_id)
    if table is None:
        table = Table(study=study, t_id=t_id)
        db.session.add(table)
        tables[t_id] = table
    if isinstance(source, Table):
        for field in ("name", "table_label", "caption", "footer"):
            setattr(table, field, getattr(source, field))
    elif source is not None:
        table.table_label = source.get("label")
        table.caption = source.get("caption")
        table.footer = source.get("footer")
    table.name = table.name or table.table_label or t_id
    return table


def _analysis_metadata(parsed, parse_id):
    metadata = {
        key: value
        for key, value in parsed.items()
        if key not in _ANALYSIS_COLUMNS and value is not None
    }
    metadata["parse_id"] = parse_id
    # Points with no directional statistic, so no side of their own; derived from their
    # values. The facet projection reads the count from here.
    metadata["unsigned_points"] = sum(
        1 for point in parsed.get("points") or [] if point_side(point.get("values")) is None
    )
    return metadata


def _point_rows(parsed):
    rows = []
    for point in parsed.get("points") or []:
        space = normalize_space(point.get("space") or parsed.get("coordinate_space"))
        x, y, z = point["coordinates"]
        rows.append(
            {
                "x": x,
                "y": y,
                "z": z,
                "space": space,
                "cluster_size": point.get("cluster_size"),
                "cluster_measurement_unit": point.get("cluster_measure"),
                "subpeak": point.get("is_subpeak"),
                "values": [(v["kind"], v["value"]) for v in point.get("values") or []],
            }
        )
    return rows


def _stored_point_rows(analysis):
    return [
        {
            "x": p.x,
            "y": p.y,
            "z": p.z,
            "space": p.space,
            "cluster_size": p.cluster_size,
            "cluster_measurement_unit": p.cluster_measurement_unit,
            "subpeak": p.subpeak,
            "values": [(v.kind, v.value) for v in p.values],
        }
        for p in sorted(analysis.points, key=lambda p: p.order or 0)
    ]


def _set_points(analysis, parsed, user):
    """Replace the analysis's points when, and only when, the parse's differ."""
    rows = _point_rows(parsed)
    if analysis.id is not None and _stored_point_rows(analysis) == rows:
        return
    for point in list(analysis.points):
        analysis.points.remove(point)
    for order, row in enumerate(rows):
        values = row.pop("values")
        point = Point(order=order, user=user, **row)
        point.values = [PointValue(kind=k, value=v, user=user) for k, v in values]
        analysis.points.append(point)


def _alias_rekeyed(base_study, superseded, uploaded, existing):
    """Re-hash the entities of analyses a new parse reads from other cells.

    A dropped and an added analysis are the same one when they alone share a table and a
    name. Its entities take the new hash and keep the old one as an alias, so claims stay
    put rather than being copied. A revision says this with verdicts instead.
    """

    def by_name(pairs):
        groups = {}
        for item, table_id, name in pairs:
            groups.setdefault((table_id, name), []).append(item)
        return {k: v[0] for k, v in groups.items() if len(v) == 1}

    dropped = by_name(
        (a, a.table.t_id if a.table is not None else None, a.name) for a in superseded
    )
    added = by_name(
        (a, a.get("table_id"), a["name"]) for a in uploaded if a["key"] not in existing
    )
    aliased = []
    for match, old in dropped.items():
        new = added.get(match)
        if new is None:
            continue
        rehashed = False
        for entity_class in PARSE_KEYED_CLASSES:
            old_hash = _entity_hash(base_study, entity_class, old.metadata_)
            new_hash = _entity_hash(base_study, entity_class, new)
            entity = StudyEntity.query.filter_by(entity_hash=old_hash).first()
            if entity is None or StudyEntity.query.filter_by(entity_hash=new_hash).first():
                continue
            entity.entity_hash = new_hash
            db.session.add(
                StudyEntityAlias(
                    entity_hash=old_hash, entity_id=entity.id, reason=ALIAS_CELLS_CHANGED
                )
            )
            rehashed = True
        if rehashed:
            # One pair per analysis, however many of its entity classes moved.
            aliased.append({"from": old.source_id, "to": new["key"]})
    db.session.flush()
    return aliased


def _link_entities(base_study, study):
    """Point each Analysis entity at the current analysis read from its cells."""
    by_hash = {
        _entity_hash(base_study, "Analysis", a.metadata_): a.id for a in study.analyses
    }
    for entity in StudyEntity.query.filter(StudyEntity.entity_hash.in_(list(by_hash))):
        entity.analysis_id = by_hash[entity.entity_hash]


def _analysis_identity(parsed):
    """``analysis_identity`` of a parse analysis (or the metadata stored from one)."""
    return analysis_identity(
        parsed["origin"],
        parsed.get("table_id"),
        cells=[(c["row"], c["column_group"]) for c in parsed.get("cells") or []],
        spans=[(s["start_char"], s["end_char"]) for s in parsed.get("text_spans") or []],
    )


def _entity_hash(base_study, entity_class, parsed):
    return study_entity_hash(base_study.id, entity_class, _analysis_identity(parsed))


def _parsed_for_key(base_study, key):
    """The analysis a stored parse of this paper holds under ``key``, or None.

    A content key is a function of its cells, so any stored parse holding it agrees.
    """
    stored = (
        PipelineStudyResult.query.join(PipelineConfig)
        .join(Pipeline)
        .filter(
            Pipeline.name == PARSE_PIPELINE,
            PipelineStudyResult.base_study_id == base_study.id,
            PipelineStudyResult.result_data["analyses"].contains([{"key": key}]),
        )
        .first()
    )
    if stored is None:
        return None
    return next(a for a in stored.result_data["analyses"] if a["key"] == key)


def _hash_for_key(base_study, entity_class, key):
    """The entity hash of ``entity_class`` named by ``key`` in a record, or None.

    A parse key's hash covers its cells or spans; every other class is hashed by its
    name (Table by its table id; Study by '').
    """
    if entity_class not in PARSE_KEYED_CLASSES:
        return study_entity_hash(base_study.id, entity_class, key)
    parsed = _parsed_for_key(base_study, key)
    return _entity_hash(base_study, entity_class, parsed) if parsed is not None else None


def _current_key(base_study, key):
    """``key``, or the key its analysis took when a later parse re-read it from other cells."""
    old_hash = _hash_for_key(base_study, "Analysis", key)
    renamed = (
        db.session.query(Analysis.source_id)
        .join(StudyEntity, StudyEntity.analysis_id == Analysis.id)
        .join(StudyEntityAlias, StudyEntityAlias.entity_id == StudyEntity.id)
        .filter(StudyEntityAlias.entity_hash == old_hash)
        .scalar()
        if old_hash is not None
        else None
    )
    return renamed or key


def _analysis_for_key(base_study, key):
    """The analysis stored under ``key``: the current version's, else the newest history."""
    return (
        Analysis.query.join(Study, Analysis.study_id == Study.id)
        .filter(
            Study.base_study_id == base_study.id,
            Study.source.in_((STUDY_SOURCE, HISTORY_SOURCE)),
            Analysis.source_id == key,
        )
        .order_by(
            (Study.source == STUDY_SOURCE).desc(),
            Study.source_updated_at.desc().nulls_last(),
        )
        .first()
    )


# ---------------------------------------------------------------------------
# carrying claims through a revision
# ---------------------------------------------------------------------------


def _entity(base_study, entity_class, key, config=None):
    """The entity ``key`` names, created if new; None when ``key`` cannot be hashed."""
    entity_hash = _hash_for_key(base_study, entity_class, key)
    if entity_hash is None:
        return None
    entity = StudyEntity.query.filter_by(entity_hash=entity_hash).first()
    if entity is None:
        # A record that read an older parse may name cells since re-read.
        entity = (
            StudyEntity.query.join(
                StudyEntityAlias, StudyEntityAlias.entity_id == StudyEntity.id
            )
            .filter(StudyEntityAlias.entity_hash == entity_hash)
            .first()
        )
    if entity is None:
        entity = StudyEntity(
            base_study_id=base_study.id,
            entity_class=entity_class,
            entity_hash=entity_hash,
            first_seen_config_id=config.id if config is not None else None,
        )
        db.session.add(entity)
    if config is not None:
        entity.last_seen_config_id = config.id
    return entity


def _carry_claims(base_study, study, revision):
    """Copy what is stored against each split or merged key to its replacements."""
    current = {a.source_id: a for a in study.analyses}
    carried = {"claims": 0}
    for verdict in revision.get("verdicts") or []:
        if verdict["verdict"] not in ("split", "merge"):
            continue
        hashes = [
            h
            for h in (_hash_for_key(base_study, c, verdict["key"]) for c in PARSE_KEYED_CLASSES)
            if h is not None
        ]
        for source in StudyEntity.query.filter(StudyEntity.entity_hash.in_(hashes)).all():
            for new_key in verdict["replaced_by"]:
                target = _entity(base_study, source.entity_class, new_key)
                if source.entity_class == "Analysis" and new_key in current:
                    target.analysis_id = current[new_key].id
                db.session.flush()
                carried["claims"] += _copy_claims(source, target)
    db.session.flush()
    return carried


def _copy_claims(source, target):
    """Copy ``source``'s claims onto ``target``; return how many claims were made.

    A claim whose value ``target`` already holds is merged into that claim rather than
    copied: its runs and evidence are added where missing, so two sources that collapse
    into one claim keep everything. ``carried_from`` names the first origin.
    """
    existing = {
        (c.field_path, c.value_hash): c
        for c in FieldClaim.query.filter_by(entity_id=target.id)
    }
    copied = 0
    for claim in FieldClaim.query.filter_by(entity_id=source.id).order_by(
        FieldClaim.created_at, FieldClaim.id
    ):
        copy = existing.get((claim.field_path, claim.value_hash))
        if copy is None:
            copy = FieldClaim(
                entity_id=target.id,
                field_path=claim.field_path,
                schema_version=claim.schema_version,
                value=claim.value,
                extraction_status=claim.extraction_status,
                value_source=claim.value_source,
                value_hash=claim.value_hash,
                origin=claim.origin,
                origin_user_id=claim.origin_user_id,
                carried_from=claim.id,
            )
            db.session.add(copy)
            db.session.flush()
            existing[(claim.field_path, claim.value_hash)] = copy
            copied += 1
        _merge_claim(claim, copy)
    return copied


def _evidence_key(evidence):
    return (evidence.status, evidence.source, _canonical(evidence.spans), evidence.config_id)


def _merge_claim(claim, copy):
    """Add ``claim``'s runs and evidence to ``copy`` where it lacks them."""
    runs = {r.config_id for r in FieldClaimRun.query.filter_by(claim_id=copy.id)}
    for run in FieldClaimRun.query.filter_by(claim_id=claim.id):
        if run.config_id not in runs:
            db.session.add(FieldClaimRun(claim_id=copy.id, config_id=run.config_id))
            runs.add(run.config_id)
    held = {_evidence_key(e) for e in FieldClaimEvidence.query.filter_by(claim_id=copy.id)}
    for evidence in FieldClaimEvidence.query.filter_by(claim_id=claim.id):
        if _evidence_key(evidence) in held:
            continue
        held.add(_evidence_key(evidence))
        db.session.add(
            FieldClaimEvidence(
                claim_id=copy.id,
                status=evidence.status,
                source=evidence.source,
                spans=evidence.spans,
                origin=evidence.origin,
                origin_user_id=evidence.origin_user_id,
                config_id=evidence.config_id,
            )
        )
    db.session.flush()


# ---------------------------------------------------------------------------
# extraction records
# ---------------------------------------------------------------------------


def _ingest_record(base_study, study, record, parse, pipeline, user, run_id=None):
    metadata = record["extraction_metadata"]
    schema_version = load_json_schema("extraction-record").get("version")
    config_args = {
        "extractor_model": metadata["extractor_model"],
        "schema_version": schema_version,
        # PipelineConfig names the parse version beside the schema version; the
        # paper's own parse_id is in the result's file_inputs.
        "parse_version": _parse_version(parse["header"]),
    }
    if pipeline.get("commit"):
        # The code that produced the record, so two builds of one version stay apart.
        config_args["commit"] = pipeline["commit"]
    config = _get_config(
        pipeline.get("name") or DEFAULT_RECORD_PIPELINE,
        pipeline.get("version") or metadata["extractor_version"],
        config_args,
        schema={"name": "neuroimaging-study-extraction", "version": schema_version},
    )
    executed = metadata.get("extraction_date") or _now()
    inputs = [
        {"artifact_kind": "coordinate_parse", "fingerprint": parse["parse_id"]},
        {"artifact_kind": "parsed_paper", "fingerprint": parse["text_sha256"]},
    ]

    _check_run(config, base_study, run_id, record)

    def write():
        result = PipelineStudyResult.query.filter_by(
            config_id=config.id, base_study_id=base_study.id
        ).first()
        if result is None:
            result = PipelineStudyResult(config_id=config.id, base_study_id=base_study.id)
            db.session.add(result)
        result.run_id = run_id
        result.result_data = record
        result.file_inputs = inputs
        result.status = "SUCCESS"
        result.date_executed = executed
        return result

    result = _write_run(write, config, base_study, run_id, record)
    if result.run_id != run_id or result.result_data is not record:
        # A concurrent upload stored this same record under the run_id; its results stand.
        abort_unprocessable(
            "This run_id already stored this record; replay the upload as a whole.",
            [make_field_error("run_id", run_id, code="RUN_ID_REUSED")],
        )

    # A record that read an older parse: its keys the revisions since split or merged
    # resolve to history, and its claims are carried on to their replacements.
    revisions = _revisions_since(base_study, parse["parse_id"], study)
    analyses = {"resolved": 0, "unresolved": [], "parked": [], "superseded": []}
    conditions = {}
    for extracted in record.get("analyses") or []:
        key = (extracted.get("source_table_analysis") or {}).get("value")
        positional = bool(key) and not is_content_key(key)
        analysis = (
            _analysis_for_key(base_study, _current_key(base_study, key))
            if key and not positional
            else None
        )
        row = PipelineAnalysisResult.query.filter_by(
            config_id=config.id, base_study_id=base_study.id, source_table_analysis=key
        ).first() if key else None
        if row is None:
            row = PipelineAnalysisResult(
                config_id=config.id, base_study_id=base_study.id, source_table_analysis=key
            )
            db.session.add(row)
        row.analysis_id = analysis.id if analysis is not None else None
        row.result_data = extracted
        superseded = analysis is not None and analysis.study_id != study.id
        # A key that resolves to no current analysis is held, never dropped: an ingest
        # error on that analysis, not a quiet null.
        row.status = "SUCCESS" if analysis is not None and not superseded else "FAILURE"
        row.date_executed = executed
        if superseded:
            replaced_by = _replaced_by(revisions, analysis.source_id)
            analyses["superseded"].append(
                {
                    "key": key,
                    "replaced_by": replaced_by,
                    "reason": SUPERSEDED_REASON if replaced_by else DROPPED_REASON,
                }
            )
            current = {a.source_id: a for a in study.analyses}
            for new_key in replaced_by:
                if new_key in current:
                    _want_conditions(conditions, current[new_key], extracted, derived=True)
        elif analysis is not None:
            analyses["resolved"] += 1
            _want_conditions(conditions, analysis, extracted, derived=False)
            partner = _inverse_half(study, analysis)
            if partner is not None:
                _want_conditions(conditions, partner, extracted, derived=True)
        elif positional:
            analyses["parked"].append({"key": key, "reason": POSITIONAL_KEY_REASON})
        else:
            analyses["unresolved"].append(key or extracted["local_id"])

    claims = _ingest_claims(base_study, record, config, schema_version)
    db.session.flush()
    carried = {"claims": 0}
    for revision in revisions:
        for name, count in _carry_claims(base_study, study, revision).items():
            carried[name] += count
    for analysis, weights, _ in conditions.values():
        _set_conditions(analysis, weights, user)
    db.session.flush()
    summary = {"config_id": config.id, "analyses": analyses, "claims": claims}
    if revisions:
        summary["carried"] = carried
    return summary, result


def _revisions_since(base_study, parse_id, study):
    """The revisions from ``parse_id`` to the current parse, oldest first."""
    chain = []
    current = study.source_id if study is not None else None
    while current is not None and current != parse_id:
        stored = _stored_parse(base_study, current)
        if stored is None or not stored.get("revision_of"):
            # Reached through a re-parse, not revisions: no verdicts map the old keys.
            return []
        chain.append(stored)
        current = stored["revision_of"]
    return list(reversed(chain)) if current == parse_id else []


def _replaced_by(revisions, key):
    """The keys ``key`` became through the split and merge verdicts of ``revisions``."""
    keys = [key]
    for revision in revisions:
        mapped = {
            v["key"]: v["replaced_by"]
            for v in revision.get("verdicts") or []
            if v["verdict"] in ("split", "merge")
        }
        keys = [new for k in keys for new in mapped.get(k, [k])]
    return sorted(set(keys)) if keys != [key] else []


# ---------------------------------------------------------------------------
# conditions: the sign of a contrast lives on its condition weights
# ---------------------------------------------------------------------------


def _split(analysis):
    return (analysis.metadata_ or {}).get("split") or {}


def _inverse_half(study, analysis):
    """The inverse half of a sign split whose original half is ``analysis``.

    The inverse half names its original by key (``split.original_analysis``), which the
    ingester stores as ``Analysis.source_id``.
    """
    if _split(analysis).get("half") != "original":
        return None
    return next(
        (
            a
            for a in study.analyses
            if _split(a).get("half") == "inverse"
            and _split(a).get("original_analysis") == analysis.source_id
        ),
        None,
    )


def _cell_weights(extracted):
    """(condition name, weight) per directional cell of a record analysis's effect."""
    weights = {}
    for cell in ((extracted.get("effect") or {}).get("cells")) or []:
        direction = (cell.get("direction") or {}).get("value")
        if direction not in ("positive", "negative"):
            continue
        # A slope names no level; it has no condition to weight.
        name = (cell.get("label") or {}).get("value") or (cell.get("level") or {}).get("value")
        if name:
            weights.setdefault(name, 1.0 if direction == "positive" else -1.0)
    return weights


def _want_conditions(wanted, analysis, extracted, derived):
    """Queue ``extracted``'s conditions for ``analysis``.

    ``derived`` conditions come from another analysis's cells: the original half of a
    split, or a key a revision replaced. On an inverse half they are negated, since the
    inverse half is the reversed contrast. An analysis's own record entry wins over them.
    """
    weights = _cell_weights(extracted)
    if not weights or (derived and analysis.id in wanted and not wanted[analysis.id][2]):
        return
    if derived and _split(analysis).get("half") == "inverse":
        weights = {name: -weight for name, weight in weights.items()}
    wanted[analysis.id] = (analysis, weights, derived)


def _set_conditions(analysis, weights, user):
    by_name = {}
    for name in weights:
        condition = (
            Condition.query.filter_by(name=name).order_by(Condition.created_at).first()
        )
        if condition is None:
            condition = Condition(name=name, user=user)
            db.session.add(condition)
        by_name[name] = condition
    db.session.flush()
    held = {ac.condition_id: ac for ac in analysis.analysis_conditions}
    wanted = {by_name[name].id: weight for name, weight in weights.items()}
    for condition_id, link in held.items():
        if condition_id not in wanted:
            analysis.analysis_conditions.remove(link)
    for condition_id, weight in wanted.items():
        if condition_id in held:
            held[condition_id].weight = weight
        else:
            analysis.analysis_conditions.append(
                AnalysisConditions(condition_id=condition_id, weight=weight)
            )


def _ingest_claims(base_study, record, config, schema_version):
    defs = load_json_schema("extraction-record")["$defs"]
    names = _local_id_names(record)
    entities = [("Study", "", record, "Study")]
    unkeyed = []
    entity_lists = {
        attribute
        for attribute, schema in defs["Study"]["properties"].items()
        if _list_item_class(schema) is not None
    }
    for attribute in entity_lists:
        value = record.get(attribute)
        if not isinstance(value, list):
            continue
        cls = _list_item_class(defs["Study"]["properties"][attribute])
        for item in value:
            key = _record_key(cls, item)
            if key is None:
                unkeyed.append(f"{attribute}[local_id={item.get('local_id')}]")
            else:
                entities.append((cls, key, item, cls))

    parked = []
    for cls, key, item, def_name in list(entities):
        if cls in PARSE_KEYED_CLASSES and not is_content_key(key):
            entities.remove((cls, key, item, def_name))
            parked.append({"entity": f"{cls}[{key}]", "reason": POSITIONAL_KEY_REASON})
    counts = {
        "created": 0,
        "matched": 0,
        "rejected_paths": [],
        "unkeyed_entities": unkeyed,
        "parked_entities": parked,
    }
    for entity_class, key, item, def_name in entities:
        entity = _entity(base_study, entity_class, key, config)
        if entity is None:
            parked.append({"entity": f"{entity_class}[{key}]", "reason": UNKNOWN_KEY_REASON})
            continue
        if entity_class == "Analysis":
            analysis = _analysis_for_key(base_study, _current_key(base_study, key))
            entity.analysis_id = analysis.id if analysis is not None else None
        db.session.flush()
        if item.get("local_id"):
            link = db.session.get(
                ExtractionEntityLink, (config.id, f"{base_study.id}:{item['local_id']}")
            )
            if link is None:
                db.session.add(
                    ExtractionEntityLink(
                        config_id=config.id,
                        # extraction_entity_links is keyed by (config, local_id) and
                        # local_ids repeat across papers, so the base study prefixes them.
                        local_id=f"{base_study.id}:{item['local_id']}",
                        entity_id=entity.id,
                    )
                )
            else:
                link.entity_id = entity.id

        # The Study entity's own fields; its lists are entities of their own.
        skip = entity_lists if entity_class == "Study" else ()
        leaves, rejected = [], []
        _walk(defs, def_name, item, "", names, leaves, rejected, skip)
        counts["rejected_paths"].extend(
            f"{entity_class}[{key}].{path}" for path in rejected
        )
        _upsert_claims(entity, leaves, config, schema_version, counts)
    return counts


def _local_id_names(record):
    """Per-run local_ids mapped to the names a claim path can use instead."""
    names = {}
    for value in record.values():
        if not isinstance(value, list):
            continue
        for item in value:
            if not isinstance(item, dict) or "local_id" not in item:
                continue
            name = _record_key(None, item)
            if name:
                names[item["local_id"]] = name
            for term in item.get("terms") or []:
                term_name = (term.get("name") or {}).get("value")
                if term.get("local_id") and term_name:
                    names[term["local_id"]] = term_name
    return names


def _record_key(cls, item):
    if cls == "Analysis":
        return (item.get("source_table_analysis") or {}).get("value")
    if cls in ("CoordinateSet", "Table"):
        return item.get("local_id")
    name = item.get("name")
    if isinstance(name, dict) and name.get("value"):
        return name["value"]
    return None


def _refs(schema):
    """The $defs names a property schema can hold."""
    out = []
    if "$ref" in schema:
        out.append(schema["$ref"].rsplit("/", 1)[-1])
    for option in schema.get("anyOf", []):
        out.extend(_refs(option))
    return out


def _list_item_class(schema):
    for option in [schema, *schema.get("anyOf", [])]:
        items = option.get("items")
        if items:
            refs = _refs(items)
            if refs:
                return refs[0]
    return None


def _is_extracted(defs, name):
    props = defs.get(name, {}).get("properties", {})
    return "extraction_status" in props and "evidence" in props


def _pick(defs, names, value):
    """The class among ``names`` that ``value`` is an instance of."""
    classes = [n for n in names if defs.get(n, {}).get("type") == "object"]
    for name in classes:
        props = defs[name].get("properties", {})
        required = defs[name].get("required", [])
        if all(r in value for r in required) and set(value) <= set(props):
            return name
    return classes[0] if classes else None


def _key_value(value, names):
    if isinstance(value, dict):
        value = value.get("value")
    return names.get(value, value)


def _walk(defs, name, obj, prefix, names, leaves, rejected, skip=()):
    """Collect (path, ExtractedValue) for every extracted field below ``obj``."""
    props = defs.get(name, {}).get("properties", {})
    for attribute, value in obj.items():
        if value is None or attribute in skip or attribute not in props:
            continue
        schema = props[attribute]
        path = f"{prefix}{attribute}"
        if isinstance(value, dict):
            cls = _pick(defs, _refs(schema), value)
            if cls is None:
                continue
            if _is_extracted(defs, cls):
                leaves.append((path, value))
            else:
                _walk(defs, cls, value, f"{path}.", names, leaves, rejected)
        elif isinstance(value, list) and value and all(isinstance(v, dict) for v in value):
            item_refs = _refs(schema.get("items", {}))
            for option in schema.get("anyOf", []):
                item_refs.extend(_refs(option.get("items", {})))
            for item in value:
                cls = _pick(defs, item_refs, item)
                key_slots = DECLARED_KEYS.get(cls)
                if cls is None or _is_extracted(defs, cls) or key_slots is None:
                    # No declared key: an index would be positional, so the path is
                    # rejected rather than stored as a guess.
                    rejected.append(f"{path}[]")
                    break
                predicate = ",".join(
                    f"{slot}={_key_value(item.get(slot), names)}" for slot in key_slots
                )
                _walk(defs, cls, item, f"{path}[{predicate}].", names, leaves, rejected)


def _upsert_claims(entity, leaves, config, schema_version, counts):
    existing = {
        (c.field_path, c.value_hash): c
        for c in FieldClaim.query.filter_by(entity_id=entity.id)
    }
    runs = {
        claim_id
        for (claim_id,) in db.session.query(FieldClaimRun.claim_id)
        .join(FieldClaim, FieldClaim.id == FieldClaimRun.claim_id)
        .filter(FieldClaim.entity_id == entity.id, FieldClaimRun.config_id == config.id)
    }
    for path, leaf in leaves:
        value = leaf.get("value")
        value_hash = _hash(value)
        claim = existing.get((path, value_hash))
        if claim is None:
            claim = FieldClaim(
                entity_id=entity.id,
                field_path=path,
                schema_version=schema_version,
                value=value,
                extraction_status=leaf["extraction_status"],
                value_source=leaf.get("value_source"),
                value_hash=value_hash,
                origin="extraction",
            )
            db.session.add(claim)
            db.session.flush()
            existing[(path, value_hash)] = claim
            counts["created"] += 1
        else:
            counts["matched"] += 1
        if claim.id not in runs:
            db.session.add(FieldClaimRun(claim_id=claim.id, config_id=config.id))
            runs.add(claim.id)
        # One run's evidence for a claim is replaced, not appended, on re-upload.
        FieldClaimEvidence.query.filter_by(claim_id=claim.id, config_id=config.id).delete()
        evidence = leaf["evidence"]
        for evidence_set in evidence.get("sets") or [None]:
            db.session.add(
                FieldClaimEvidence(
                    claim_id=claim.id,
                    status=evidence["status"],
                    source=(evidence_set or {}).get("source"),
                    spans=(evidence_set or {}).get("spans"),
                    origin="extraction",
                    config_id=config.id,
                )
            )
