"""The study_schema ingester: a parse, a parse with a record, a record, a revision."""

import pytest
import sqlalchemy as sa

from neurostore.exceptions.base import NeuroStoreException
from neurostore.ingest.study_schema import (
    ALIAS_CELLS_CHANGED,
    HISTORY_SOURCE,
    STUDY_SOURCE,
    UNKNOWN_KEY_REASON,
    _point_rows,
    ingest_upload,
)
from neurostore.models import (
    Analysis,
    BaseStudy,
    FieldClaim,
    PipelineAnalysisResult,
    PipelineConfig,
    PipelineStudyResult,
    Study,
    StudyEntity,
    StudyEntityAlias,
)
from neurostore.models.data import analysis_identity, study_entity_hash
from neurostore.tests import study_schema_fixtures as fx

# Table 1 of one paper: rows 0-3 are one contrast with both signs, rows 4-7 two more.
GAIN = fx.table_analysis(
    "tbl1",
    [0, 1, 2, 3],
    "Gain > Neutral",
    [
        fx.point((10, 20, 30), space="OTHER"),
        fx.point((12, 22, 32)),
        fx.point((-10, 20, 30), sign="negative"),
        fx.point((-12, 22, 32), sign="negative"),
    ],
)
LOSS = fx.table_analysis("tbl1", [4, 5], "Loss > Neutral", [fx.point((1, 2, 3))])
RISK = fx.table_analysis("tbl1", [6, 7], "Risk > Neutral", [fx.point((4, 5, 6))])
SEED = fx.table_analysis("tbl2", [0], "Seed", [fx.point((0, 0, 0))], role="reference")
ORIGINAL = fx.parse([GAIN, LOSS, RISK, SEED])


def _record(*analyses):
    return fx.record(
        [fx.record_analysis(f"a{i}", a["key"], a["name"]) for i, a in enumerate(analyses)]
    )


def _current(base_study_id):
    return Study.query.filter_by(base_study_id=base_study_id, source=STUDY_SOURCE).one()


# Every fixture analysis by key, to hash the way the ingester must.
_ANALYSES = {a["key"]: a for a in ORIGINAL["analyses"]}


def _hash(base_study_id, key, entity_class="Analysis"):
    """The entity hash of the fixture analysis under ``key``, from all its cells."""
    parsed = _ANALYSES[key]
    identity = analysis_identity(
        parsed["origin"],
        parsed.get("table_id"),
        cells=[(c["row"], c["column_group"]) for c in parsed.get("cells") or []],
        spans=[(s["start_char"], s["end_char"]) for s in parsed.get("text_spans") or []],
    )
    return study_entity_hash(base_study_id, entity_class, identity)


def _entity(base_study_id, key):
    return StudyEntity.query.filter_by(entity_hash=_hash(base_study_id, key)).one()


def _claims(base_study_id, key):
    return FieldClaim.query.filter_by(entity_id=_entity(base_study_id, key).id).all()


def _revision():
    """Split Gain by sign; merge Loss and Risk."""
    original = fx.table_analysis(
        "tbl1",
        [0, 1],
        "Gain > Neutral",
        GAIN["points"][:2],
        split={"half": "original", "rule": "sign_of_directional_statistic"},
    )
    inverse = fx.table_analysis(
        "tbl1",
        [2, 3],
        "Neutral > Gain",
        GAIN["points"][2:],
        split={
            "half": "inverse",
            "original_analysis": original["key"],
            "rule": "sign_of_directional_statistic",
        },
    )
    merged = fx.table_analysis(
        "tbl1", [4, 5, 6, 7], "Loss or Risk > Neutral", LOSS["points"] + RISK["points"]
    )
    revision = fx.parse(
        [original, inverse, merged, SEED],
        revision_of=ORIGINAL["parse_id"],
        verdicts=[
            fx.verdict(GAIN["key"], "split", [original["key"], inverse["key"]]),
            fx.verdict(LOSS["key"], "merge", [merged["key"]]),
            fx.verdict(RISK["key"], "merge", [merged["key"]]),
            fx.verdict(SEED["key"], "accept", [SEED["key"]]),
        ],
    )
    _ANALYSES.update({a["key"]: a for a in (original, inverse, merged)})
    return revision, original, inverse, merged


def test_parse_alone_stores_skeleton_keyed_by_cells(session):
    summary = ingest_upload({"coordinate_parse": ORIGINAL})

    assert summary["kind"] == "parse"
    study = _current(summary["base_study_id"])
    assert study.source_id == ORIGINAL["parse_id"]
    assert {a.source_id for a in study.analyses} == {GAIN["key"], LOSS["key"], RISK["key"]}
    assert summary["skeleton"]["not_uploaded"] == [SEED["key"]]
    gain = next(a for a in study.analyses if a.source_id == GAIN["key"])
    assert gain.table.t_id == "tbl1"
    assert gain.metadata_["parse_id"] == ORIGINAL["parse_id"]
    # Space is normalized on the way in; the analysis keeps its own direction.
    assert {p.space for p in gain.points} == {"MNI", "OTHER"}
    assert [v.kind for p in gain.points for v in p.values] == ["t"] * 4

    # Re-uploading the same parse changes nothing.
    again = ingest_upload({"coordinate_parse": ORIGINAL})
    assert again["skeleton"]["created"] == 0
    assert again["skeleton"]["updated"] == 3


def test_parse_with_a_wrong_key_is_refused(session):
    bad = fx.parse([{**LOSS, "key": "tbl1#000000000000"}])
    with pytest.raises(NeuroStoreException) as error:
        ingest_upload({"coordinate_parse": bad})
    assert error.value.status_code == 422


def test_parse_and_record_resolve_claims_to_analyses(session):
    summary = ingest_upload(
        {"coordinate_parse": ORIGINAL, "record": _record(GAIN, LOSS, RISK)}
    )

    assert summary["kind"] == "parse_and_record"
    assert summary["record"]["analyses"]["resolved"] == 3
    rows = PipelineAnalysisResult.query.filter_by(
        base_study_id=summary["base_study_id"]
    ).all()
    assert {r.source_table_analysis for r in rows} == {GAIN["key"], LOSS["key"], RISK["key"]}
    assert all(r.status == "SUCCESS" and r.analysis_id for r in rows)
    entity = _entity(summary["base_study_id"], GAIN["key"])
    assert entity.entity_class == "Analysis"
    assert entity.analysis_id == next(
        a.id for a in _current(summary["base_study_id"]).analyses if a.source_id == GAIN["key"]
    )
    assert {c.field_path for c in _claims(summary["base_study_id"], GAIN["key"])} >= {
        "name",
        "definition",
    }
    config = db_config(summary["record"]["config_id"])
    assert config.config_args["parse_version"]["name"] == "ingestion"


def db_config(config_id):
    return PipelineConfig.query.get(config_id)


def test_upload_reports_the_provenance_of_each_run(session):
    summary = ingest_upload(
        {
            "coordinate_parse": ORIGINAL,
            "record": _record(GAIN),
            "pipeline": {"name": "pondie", "version": "2.1.0", "commit": "abc1234"},
        }
    )

    parse, record = summary["provenance"]["parse"], summary["provenance"]["record"]
    assert parse["pipeline"] == "coordinate-parse"
    assert parse["schema"]["name"] == "neuroimaging-paper-parse"
    assert parse["parse_version"]["version"] == ORIGINAL["header"]["producer"]["version"]
    assert (record["pipeline"], record["version"], record["commit"]) == (
        "pondie",
        "2.1.0",
        "abc1234",
    )
    assert record["schema"]["name"] == "neuroimaging-study-extraction"
    assert record["config_id"] == summary["record"]["config_id"]
    assert record["created_at"] and record["date_executed"]
    # Another build of the same version is a different config.
    again = ingest_upload(
        {
            "record": _record(GAIN),
            "parse_id": ORIGINAL["parse_id"],
            "base_study_id": summary["base_study_id"],
            "pipeline": {"name": "pondie", "version": "2.1.0", "commit": "def5678"},
        }
    )
    assert again["provenance"]["record"]["config_id"] != record["config_id"]
    assert "parse" not in again["provenance"]


def test_record_attaches_later_to_the_stored_parse(session):
    base_study_id = ingest_upload({"coordinate_parse": ORIGINAL})["base_study_id"]

    unknown = fx.table_analysis("tbl9", [0], "Elsewhere", [])
    summary = ingest_upload(
        {
            "record": _record(LOSS, unknown),
            "parse_id": ORIGINAL["parse_id"],
            "base_study_id": base_study_id,
        }
    )

    assert summary["kind"] == "record"
    assert summary["record"]["analyses"]["resolved"] == 1
    # A key that matches no stored analysis is held as a failure, not dropped.
    assert summary["record"]["analyses"]["unresolved"] == [unknown["key"]]
    held = PipelineAnalysisResult.query.filter_by(source_table_analysis=unknown["key"]).one()
    assert held.status == "FAILURE" and held.analysis_id is None

    with pytest.raises(NeuroStoreException) as error:
        ingest_upload(
            {"record": _record(LOSS), "parse_id": "f" * 64, "base_study_id": base_study_id}
        )
    assert error.value.status_code == 422


def test_positional_record_keys_are_parked_not_minted(session):
    base_study_id = ingest_upload({"coordinate_parse": ORIGINAL})["base_study_id"]
    record = fx.record(
        [fx.record_analysis("a0", "tbl1#2", "Gain"), fx.record_analysis("a1", "text#3", "Loss")],
        coordinate_sets=["tbl1#2"],
    )

    summary = ingest_upload(
        {"record": record, "parse_id": ORIGINAL["parse_id"], "base_study_id": base_study_id}
    )

    parked = summary["record"]["analyses"]["parked"]
    assert [p["key"] for p in parked] == ["tbl1#2", "text#3"]
    assert "positional key" in parked[0]["reason"]
    assert summary["record"]["claims"]["parked_entities"]
    assert not StudyEntity.query.filter(
        StudyEntity.entity_class.in_(["Analysis", "CoordinateSet"])
    ).count()
    # The study's own claims still land.
    assert StudyEntity.query.filter_by(entity_class="Study").count() == 1


def test_revision_versions_analyses_and_carries_claims(session):
    first = ingest_upload(
        {"coordinate_parse": ORIGINAL, "record": _record(GAIN, LOSS, RISK)}
    )
    base_study_id = first["base_study_id"]
    old_ids = {a.source_id: a.id for a in _current(base_study_id).analyses}

    revision, original, inverse, merged = _revision()
    summary = ingest_upload({"coordinate_parse": revision})

    assert summary["kind"] == "revision"
    current = _current(base_study_id)
    assert current.source_id == revision["parse_id"]
    assert {a.source_id for a in current.analyses} == {
        original["key"],
        inverse["key"],
        merged["key"],
    }
    by_key = {a.source_id: a for a in current.analyses}
    assert by_key[inverse["key"]].metadata_["split"]["half"] == "inverse"
    assert len(by_key[merged["key"]].points) == 2

    # The old version is kept, whole, as non-public history.
    history = Study.query.filter_by(base_study_id=base_study_id, source=HISTORY_SOURCE).one()
    assert history.source_id == ORIGINAL["parse_id"]
    assert history.public is False
    assert history.metadata_["superseded_by"] == revision["parse_id"]
    assert {a.id for a in history.analyses} == set(old_ids.values())
    assert len(Analysis.query.get(old_ids[GAIN["key"]]).points) == 4

    # Split: each half gets a copy of every claim on Gain, naming its origin.
    gain_claims = {c.id for c in _claims(base_study_id, GAIN["key"])}
    for half in (original, inverse):
        copies = _claims(base_study_id, half["key"])
        assert {c.carried_from for c in copies} == gain_claims
    # Merge: the merged analysis holds both originals' claims; differing names compete.
    merged_claims = _claims(base_study_id, merged["key"])
    origins = {c.carried_from for c in merged_claims}
    assert origins == {c.id for c in _claims(base_study_id, LOSS["key"])} | {
        c.id for c in _claims(base_study_id, RISK["key"])
    } - _shared_duplicates(base_study_id)
    assert sorted(c.value for c in merged_claims if c.field_path == "name") == [
        "Loss > Neutral",
        "Risk > Neutral",
    ]
    assert summary["carried"]["claims"] == len(merged_claims) + 2 * len(gain_claims)
    entity = _entity(base_study_id, original["key"])
    assert entity.analysis_id == by_key[original["key"]].id

    # Re-uploading the revision copies nothing twice; its record resolves to the revision.
    again = ingest_upload(
        {"coordinate_parse": revision, "record": _record(original, inverse, merged)}
    )
    assert again["carried"] == {"claims": 0}
    assert again["record"]["analyses"]["resolved"] == 3


def _shared_duplicates(base_study_id):
    """Claims of Risk whose value Loss already gave: they collapse into Loss's copy."""
    loss = {(c.field_path, c.value_hash) for c in _claims(base_study_id, LOSS["key"])}
    return {
        c.id
        for c in _claims(base_study_id, RISK["key"])
        if (c.field_path, c.value_hash) in loss
    }


def test_revision_must_cover_a_stored_parse(session):
    revision, *_ = _revision()
    with pytest.raises(NeuroStoreException) as error:
        ingest_upload({"coordinate_parse": revision})
    assert error.value.status_code == 422

    ingest_upload({"coordinate_parse": ORIGINAL})
    incomplete = fx.parse(
        revision["analyses"],
        revision_of=ORIGINAL["parse_id"],
        verdicts=revision["verdicts"][:1],
    )
    with pytest.raises(NeuroStoreException) as error:
        ingest_upload({"coordinate_parse": incomplete})
    assert error.value.status_code == 422


def test_reparse_reading_other_cells_aliases_the_hash(session):
    base_study_id = ingest_upload(
        {
            "coordinate_parse": ORIGINAL,
            "record": fx.record(
                [
                    fx.record_analysis(f"a{i}", p["key"], p["name"])
                    for i, p in enumerate((GAIN, LOSS, RISK))
                ],
                coordinate_sets=[LOSS["key"]],
            ),
        }
    )["base_study_id"]
    assert (
        StudyEntity.query.filter_by(
            entity_hash=_hash(base_study_id, LOSS["key"], "CoordinateSet")
        ).count()
        == 1
    )
    wider = fx.table_analysis("tbl1", [4, 5, 8], "Loss > Neutral", LOSS["points"])
    reparse = fx.parse([GAIN, wider, RISK, SEED])

    summary = ingest_upload({"coordinate_parse": reparse})

    # Analysis and coordinate-set entities both move, yet the pair is listed once.
    assert summary["skeleton"]["aliased"] == [{"from": LOSS["key"], "to": wider["key"]}]
    _ANALYSES[wider["key"]] = wider
    alias = StudyEntityAlias.query.get(_hash(base_study_id, LOSS["key"]))
    assert alias.reason == ALIAS_CELLS_CHANGED
    entity = StudyEntity.query.get(alias.entity_id)
    assert entity.entity_hash == _hash(base_study_id, wider["key"])
    assert entity.analysis_id == next(
        a.id for a in _current(base_study_id).analyses if a.source_id == wider["key"]
    )

    # A late record that read the old parse still lands on the re-keyed analysis.
    late = ingest_upload(
        {
            "record": _record(LOSS),
            "parse_id": ORIGINAL["parse_id"],
            "base_study_id": base_study_id,
        }
    )
    assert late["record"]["analyses"]["resolved"] == 1
    row = PipelineAnalysisResult.query.filter_by(source_table_analysis=LOSS["key"]).first()
    assert row.analysis_id == entity.analysis_id


@pytest.mark.anyio
async def test_upload_endpoint_is_admin_only(admin_client, auth_client, session):
    url = "/api/study-schema-uploads/"
    response = await auth_client.post(url, data={"coordinate_parse": ORIGINAL})
    assert response.status_code == 403

    response = await admin_client.post(url, data={"coordinate_parse": ORIGINAL})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["kind"] == "parse"
    assert Study.query.get(body["study_id"]).source == STUDY_SOURCE


def _defined(*pairs):
    """A record whose analyses give each key the definition paired with it."""
    analyses = []
    for i, (parsed, definition) in enumerate(pairs):
        analysis = fx.record_analysis(f"a{i}", parsed["key"], parsed["name"])
        analysis["definition"] = fx.extracted(definition)
        analyses.append(analysis)
    return fx.record(analyses)


def test_merge_collapses_an_equal_claim_into_one(session):
    first = ingest_upload(
        {"coordinate_parse": ORIGINAL, "record": _defined((LOSS, "same"), (RISK, "same"))}
    )
    base_study_id = first["base_study_id"]

    def definitions(key):
        return [c for c in _claims(base_study_id, key) if c.field_path == "definition"]

    revision, _, _, merged = _revision()
    for _ in range(2):
        ingest_upload({"coordinate_parse": revision})

    # Risk's definition collapses into Loss's copy, once, however often the revision lands.
    [target] = definitions(merged["key"])
    assert target.carried_from == definitions(LOSS["key"])[0].id


def test_a_key_no_stored_parse_holds_is_parked(session):
    base_study_id = ingest_upload({"coordinate_parse": ORIGINAL})["base_study_id"]
    unknown = fx.table_analysis("tbl9", [0], "Elsewhere", [fx.point((1, 1, 1))])

    summary = ingest_upload(
        {
            "record": _record(GAIN, unknown),
            "parse_id": ORIGINAL["parse_id"],
            "base_study_id": base_study_id,
        }
    )

    parked = summary["record"]["claims"]["parked_entities"]
    assert parked == [{"entity": f"Analysis[{unknown['key']}]", "reason": UNKNOWN_KEY_REASON}]
    assert _entity(base_study_id, GAIN["key"])


def test_replaying_a_superseded_parse_is_refused(session):
    base_study_id = ingest_upload({"coordinate_parse": ORIGINAL})["base_study_id"]
    revision, *_ = _revision()
    ingest_upload({"coordinate_parse": revision})

    with pytest.raises(NeuroStoreException) as error:
        ingest_upload({"coordinate_parse": ORIGINAL})
    assert error.value.status_code == 422
    assert "NOT_CURRENT" in str(error.value.to_payload())
    assert _current(base_study_id).source_id == revision["parse_id"]
    gains = Analysis.query.join(Study).filter(
        Study.base_study_id == base_study_id, Analysis.source_id == GAIN["key"]
    )
    assert gains.count() == 1


def test_record_of_a_revised_parse_is_superseded_and_carried(session):
    base_study_id = ingest_upload({"coordinate_parse": ORIGINAL})["base_study_id"]
    revision, original, inverse, _ = _revision()
    ingest_upload({"coordinate_parse": revision})

    summary = ingest_upload(
        {
            "record": _record(GAIN),
            "parse_id": ORIGINAL["parse_id"],
            "base_study_id": base_study_id,
        }
    )
    analyses = summary["record"]["analyses"]
    assert analyses["resolved"] == 0
    assert analyses["superseded"][0]["key"] == GAIN["key"]
    assert analyses["superseded"][0]["replaced_by"] == sorted(
        [original["key"], inverse["key"]]
    )
    row = PipelineAnalysisResult.query.filter_by(source_table_analysis=GAIN["key"]).one()
    assert row.status == "FAILURE"
    gain_claims = {c.id for c in _claims(base_study_id, GAIN["key"])}
    for half in (original, inverse):
        assert {c.carried_from for c in _claims(base_study_id, half["key"])} == gain_claims


def test_base_study_lookup_holds_an_advisory_lock(session):
    ingest_upload({"coordinate_parse": ORIGINAL})
    locks = session.execute(
        sa.text(
            "SELECT count(*) FROM pg_locks "
            "WHERE locktype = 'advisory' AND pid = pg_backend_pid()"
        )
    ).scalar()
    # The parse names a pmid only: one lock, held until the upload's transaction ends.
    assert locks == 1


def _contrast(parsed, local_id="a0", **levels):
    analysis = fx.record_analysis(local_id, parsed["key"], parsed["name"])
    analysis["effect"]["cells"] = [
        {
            "term": "condition",
            "level": fx.extracted(level),
            "direction": fx.extracted(direction),
        }
        for level, direction in levels.items()
    ]
    return analysis


def _weights(analysis):
    return {ac.condition.name: ac.weight for ac in analysis.analysis_conditions}


def test_inverse_half_takes_the_conditions_negated(session):
    revision, original, inverse, merged = _revision()
    ingest_upload({"coordinate_parse": ORIGINAL})
    summary = ingest_upload(
        {
            "coordinate_parse": revision,
            "record": fx.record([_contrast(original, gain="positive", neutral="negative")]),
        }
    )
    by_key = {a.source_id: a for a in _current(summary["base_study_id"]).analyses}
    assert _weights(by_key[original["key"]]) == {"gain": 1.0, "neutral": -1.0}
    # Sign lives on the condition: the inverse contrast is the same conditions, negated.
    assert _weights(by_key[inverse["key"]]) == {"gain": -1.0, "neutral": 1.0}
    assert _weights(by_key[merged["key"]]) == {}
    assert by_key[inverse["key"]].metadata_["split"]["half"] == "inverse"


def test_a_parse_that_states_no_space_stores_a_null_space_never_mni():
    parsed = fx.table_analysis("tbl3", [0, 1], "No space", [fx.point((1, 1, 1))])
    del parsed["coordinate_space"]
    (row,) = _point_rows(parsed)
    assert row["space"] is None
    # A point's own space still wins over a missing analysis space.
    parsed["points"] = [fx.point((1, 1, 1), space="TAL")]
    assert _point_rows(parsed)[0]["space"] == "TAL"


def test_unsigned_points_are_counted_from_values(session):
    parsed = fx.table_analysis(
        "tbl3", [0, 1], "Any effect", [fx.point((1, 1, 1)), fx.point((2, 2, 2), sign="unsigned")]
    )
    summary = ingest_upload({"coordinate_parse": fx.parse([parsed])})
    (analysis,) = _current(summary["base_study_id"]).analyses
    assert analysis.metadata_["unsigned_points"] == 1


def test_a_later_parse_holding_a_set_aside_key_resolves_its_claims(session):
    base_study_id = ingest_upload({"coordinate_parse": ORIGINAL})["base_study_id"]
    unknown = fx.table_analysis("tbl9", [0], "Elsewhere", [fx.point((1, 1, 1))])
    first = ingest_upload(
        {
            "record": _record(GAIN, unknown),
            "parse_id": ORIGINAL["parse_id"],
            "base_study_id": base_study_id,
        }
    )
    assert first["record"]["claims"]["parked_entities"]

    _ANALYSES[unknown["key"]] = unknown
    reparse = fx.parse([GAIN, LOSS, RISK, SEED, unknown])
    summary = ingest_upload({"coordinate_parse": reparse, "base_study_id": base_study_id})

    assert summary["set_aside_resolved"] == [
        {"config_id": first["record"]["config_id"], "keys": [unknown["key"]]}
    ]
    assert {c.field_path for c in _claims(base_study_id, unknown["key"])} >= {"name"}
    row = PipelineAnalysisResult.query.filter_by(
        base_study_id=base_study_id, source_table_analysis=unknown["key"]
    ).one()
    assert row.status == "SUCCESS" and row.analysis_id
    # Uploading the same parse again has nothing left to resolve.
    again = ingest_upload({"coordinate_parse": reparse, "base_study_id": base_study_id})
    assert again["set_aside_resolved"] == []


def test_replaying_a_run_id_returns_the_same_results_and_adds_none(session):
    body = {"coordinate_parse": ORIGINAL, "record": _record(GAIN), "run_id": "run-1"}
    first = ingest_upload(body)
    counts = (
        PipelineStudyResult.query.count(),
        PipelineAnalysisResult.query.count(),
        FieldClaim.query.count(),
    )

    again = ingest_upload(body)

    assert {k: v["run_id"] for k, v in first["provenance"].items()} == {
        "parse": "run-1",
        "record": "run-1",
    }
    for part in ("parse", "record"):
        assert again["provenance"][part]["result_id"] == first["provenance"][part]["result_id"]
    assert again["record"]["claims"]["created"] == 0
    assert (
        PipelineStudyResult.query.count(),
        PipelineAnalysisResult.query.count(),
        FieldClaim.query.count(),
    ) == counts

    # The same run_id cannot store a different record for the paper.
    with pytest.raises(NeuroStoreException) as error:
        ingest_upload({**body, "record": _record(GAIN, LOSS)})
    assert error.value.status_code == 422


def test_a_concurrent_upload_taking_the_run_id_is_refused_as_reused(session, monkeypatch):
    ingest_upload({"coordinate_parse": ORIGINAL, "run_id": "run-1"})
    other = fx.parse([GAIN], pmid="12345678")
    body = {"coordinate_parse": other, "run_id": "run-1"}
    # The run_id check passes as it would for an upload racing the first one.
    monkeypatch.setattr("neurostore.ingest.study_schema._check_run", lambda *a: None)

    with pytest.raises(NeuroStoreException) as error:
        ingest_upload(body)

    assert error.value.status_code == 422
    assert "RUN_ID_REUSED" in str(error.value.__dict__)
    assert PipelineStudyResult.query.filter_by(run_id="run-1").count() == 1


# ---------------------------------------------------------------------------
# Outcome, role and retraction columns
# ---------------------------------------------------------------------------

NULL = fx.table_analysis("tbl3", [0], "Risk > Loss", [])
ROI = fx.table_analysis(
    "tbl4", [0], "Amygdala ROI", [fx.point((20, -4, -18))], role="anchor", from_prior_study=True
)


def _outcome_record(*pairs):
    analyses = []
    for i, (parsed, outcome) in enumerate(pairs):
        analysis = fx.record_analysis(f"a{i}", parsed["key"], parsed["name"])
        if outcome is not None:
            analysis["outcome"] = fx.extracted(outcome)
        analyses.append(analysis)
    return fx.record(analyses)


def _by_key(study):
    return {a.source_id: a for a in study.analyses}


def test_parse_writes_role_and_from_prior_study(session):
    summary = ingest_upload({"coordinate_parse": fx.parse([LOSS, ROI])})

    analyses = _by_key(_current(summary["base_study_id"]))
    assert (analyses[LOSS["key"]].role, analyses[LOSS["key"]].from_prior_study) == (
        "result",
        None,
    )
    assert (analyses[ROI["key"]].role, analyses[ROI["key"]].from_prior_study) == (
        "anchor",
        True,
    )
    # Columns, not a second copy in metadata.
    assert "role" not in analyses[ROI["key"]].metadata_
    assert "from_prior_study" not in analyses[ROI["key"]].metadata_
    assert Analysis.query.filter_by(role="anchor").one().source_id == ROI["key"]


def test_record_writes_outcome(session):
    parse = fx.parse([LOSS, NULL])
    summary = ingest_upload(
        {
            "coordinate_parse": parse,
            "record": _outcome_record(
                (LOSS, "significant_effect"), (NULL, "no_significant_effect")
            ),
        }
    )
    analyses = _by_key(_current(summary["base_study_id"]))
    assert analyses[LOSS["key"]].outcome == "significant_effect"
    assert analyses[NULL["key"]].outcome == "no_significant_effect"
    assert analyses[NULL["key"]].points == []

    # A later record that does not report it clears the analysis's own outcome.
    ingest_upload(
        {
            "parse_id": parse["parse_id"],
            "base_study_id": summary["base_study_id"],
            "record": _outcome_record((LOSS, None), (NULL, "no_significant_effect")),
        }
    )
    assert analyses[LOSS["key"]].outcome is None
    assert analyses[NULL["key"]].outcome == "no_significant_effect"

    # A re-applied parse keeps the record's outcome: the parse does not carry one.
    ingest_upload({"coordinate_parse": parse})
    assert analyses[NULL["key"]].outcome == "no_significant_effect"


def test_parsed_paper_corrections_mark_retraction(session):
    notice = {"kind": "retraction", "pmid": "99999999", "doi": None}
    summary = ingest_upload(
        {
            "coordinate_parse": fx.parse([LOSS]),
            "parsed_paper": fx.parsed_paper(corrections=[{"kind": "erratum"}, notice]),
        }
    )
    base = BaseStudy.query.get(summary["base_study_id"])
    assert base.is_retracted is True
    assert base.retraction_notice == notice

    # A parsed paper whose corrections were not looked up leaves the status alone.
    ingest_upload({"coordinate_parse": fx.parse([LOSS]), "parsed_paper": fx.parsed_paper()})
    assert base.is_retracted is True

    ingest_upload(
        {
            "coordinate_parse": fx.parse([LOSS]),
            "parsed_paper": fx.parsed_paper(corrections=[{"kind": "erratum"}]),
        }
    )
    assert (base.is_retracted, base.retraction_notice) == (False, None)


def test_parse_without_parsed_paper_leaves_retraction_unknown(session):
    summary = ingest_upload({"coordinate_parse": fx.parse([LOSS])})
    assert BaseStudy.query.get(summary["base_study_id"]).is_retracted is None


def test_inverse_half_takes_the_original_halfs_outcome(session):
    revision, original, inverse, merged = _revision()
    ingest_upload({"coordinate_parse": ORIGINAL})
    entry = _contrast(original, gain="positive")
    entry["outcome"] = fx.extracted("significant_effect")
    summary = ingest_upload({"coordinate_parse": revision, "record": fx.record([entry])})

    by_key = _by_key(_current(summary["base_study_id"]))
    assert by_key[original["key"]].outcome == "significant_effect"
    assert by_key[inverse["key"]].outcome == "significant_effect"
    assert by_key[merged["key"]].outcome is None


def test_a_derived_outcome_never_overrides_the_analysis_own(session):
    revision, positive, negative, _ = _revision()
    ingest_upload({"coordinate_parse": ORIGINAL})
    own = _contrast(negative, local_id="a0")
    own["outcome"] = fx.extracted("no_significant_effect")
    pos = _contrast(positive, local_id="a1")
    pos["outcome"] = fx.extracted("significant_effect")
    # The negative half's own entry comes first; the positive half's derived one follows.
    summary = ingest_upload({"coordinate_parse": revision, "record": fx.record([own, pos])})
    by_key = _by_key(_current(summary["base_study_id"]))
    assert by_key[positive["key"]].outcome == "significant_effect"
    assert by_key[negative["key"]].outcome == "no_significant_effect"

    # A derived entry with no outcome adds nothing: the negative half keeps its own.
    ingest_upload(
        {
            "parse_id": revision["parse_id"],
            "base_study_id": summary["base_study_id"],
            "record": fx.record([_contrast(positive, local_id="a1")]),
        }
    )
    assert by_key[positive["key"]].outcome is None
    assert by_key[negative["key"]].outcome == "no_significant_effect"
