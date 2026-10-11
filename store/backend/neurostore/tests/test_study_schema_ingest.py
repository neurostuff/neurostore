"""The study_schema ingester: a parse, a parse with a record, a record, a revision."""

import pytest
import sqlalchemy as sa

from neurostore.exceptions.base import NeuroStoreException
from neurostore.ingest.study_entities import CELLS_CHANGED
from neurostore.ingest.study_schema import (
    ALIAS_CONFLICT_REASON,
    BOTH_DIRECTIONS,
    HISTORY_SOURCE,
    NO_SUCCESSOR_REASON,
    SHARED_NAME,
    STUDY_SOURCE,
    UNKNOWN_KEY_REASON,
    _cell_weights,
    _point_rows,
    ingest_upload,
)
from neurostore.models import (
    Analysis,
    AnalysisConditions,
    BaseStudy,
    Condition,
    FieldClaim,
    PipelineAnalysisResult,
    PipelineConfig,
    PipelineStudyResult,
    Study,
    StudyEntity,
    StudyEntityAlias,
    StudyEntityCandidateLink,
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
        name=parsed["name"],
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
    # Every role is stored; the role is the analysis's.
    assert {a.source_id: a.metadata_["role"] for a in study.analyses} == {
        GAIN["key"]: "result",
        LOSS["key"]: "result",
        RISK["key"]: "result",
        SEED["key"]: "reference",
    }
    gain = next(a for a in study.analyses if a.source_id == GAIN["key"])
    assert gain.table.t_id == "tbl1"
    assert gain.metadata_["parse_id"] == ORIGINAL["parse_id"]
    # Space is normalized on the way in; the analysis keeps its own direction.
    assert {p.space for p in gain.points} == {"MNI", "OTHER"}
    assert [v.kind for p in gain.points for v in p.values] == ["t"] * 4

    # Re-uploading the same parse changes nothing.
    again = ingest_upload({"coordinate_parse": ORIGINAL})
    assert again["skeleton"]["created"] == 0
    assert again["skeleton"]["updated"] == 4


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
        SEED["key"],
    }
    by_key = {a.source_id: a for a in current.analyses}
    assert by_key[inverse["key"]].metadata_["split"]["half"] == "inverse"
    assert len(by_key[merged["key"]].points) == 2

    # The old version is kept, whole, as non-public history.
    history = Study.query.filter_by(base_study_id=base_study_id, source=HISTORY_SOURCE).one()
    assert history.source_id == ORIGINAL["parse_id"]
    assert history.public is False
    assert history.metadata_["superseded_by"] == revision["parse_id"]
    assert {a.id for a in history.analyses} == {
        i for key, i in old_ids.items() if key != SEED["key"]
    }
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
    assert alias.reason == CELLS_CHANGED
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


def _ingested(parse, *analyses, coordinate_sets=()):
    """Upload ``parse`` with a record naming each of ``analyses``; the base study id."""
    _ANALYSES.update({a["key"]: a for a in parse["analyses"]})
    record = fx.record(
        [fx.record_analysis(f"a{i}", a["key"], a["name"]) for i, a in enumerate(analyses)],
        coordinate_sets=coordinate_sets,
    )
    return ingest_upload({"coordinate_parse": parse, "record": record})


def test_two_contrasts_read_from_the_same_spans_are_two_analyses(session):
    po = fx.text_analysis([(1200, 1288)], "PO > Sil", [fx.point((1, 2, 3))])
    pc = fx.text_analysis([(1200, 1288)], "PC > Sil", [fx.point((4, 5, 6))])

    summary = _ingested(
        fx.parse([po, pc], pmid="22222222"), po, pc, coordinate_sets=[po["key"], pc["key"]]
    )

    base_study_id = summary["base_study_id"]
    assert summary["skeleton"]["created"] == 2
    assert summary["record"]["claims"]["duplicates"] == []
    analyses = {a.source_id: a for a in _current(base_study_id).analyses}
    for parsed in (po, pc):
        entity = _entity(base_study_id, parsed["key"])
        assert entity.analysis_id == analyses[parsed["key"]].id
        names = {c.value for c in _claims(base_study_id, parsed["key"]) if c.field_path == "name"}
        assert names == {parsed["name"]}
    for entity_class in ("Analysis", "CoordinateSet"):
        assert StudyEntity.query.filter_by(entity_class=entity_class).count() == 2


def test_every_role_is_stored_as_an_analysis(session):
    roles = ["result", "anchor", "localization", "reference", "other"]
    analyses = [
        fx.table_analysis("tbl3", [i], f"set {role}", [fx.point((i, i, i))], role=role)
        for i, role in enumerate(roles)
    ]

    summary = ingest_upload({"coordinate_parse": fx.parse(analyses, pmid="33333333")})

    assert summary["skeleton"]["created"] == len(roles)
    stored = _current(summary["base_study_id"]).analyses
    assert sorted(a.metadata_["role"] for a in stored) == sorted(roles)


def test_omitted_analyses_are_kept_with_the_parse(session):
    omitted = [{"name": "Age effect", "reason": "restates a table peak"}]
    parse = {**fx.parse([LOSS], pmid="44444444"), "omitted_analyses": omitted}

    summary = ingest_upload({"coordinate_parse": parse})

    assert summary["skeleton"]["omitted_analyses"] == 1
    metadata = _current(summary["base_study_id"]).metadata_["coordinate_parse"]
    assert metadata["omitted_analyses"] == omitted


def _with_cells(parsed, cells):
    analysis = fx.record_analysis("a0", parsed["key"], parsed["name"])
    analysis["effect"]["cells"] = [
        {
            "term": term,
            "level": fx.extracted(level),
            "label": fx.extracted(label),
            "direction": fx.extracted(direction),
        }
        for term, level, label, direction in cells
    ]
    return analysis


def test_an_interaction_keeps_the_weight_of_every_cell(session):
    base_study_id = ingest_upload({"coordinate_parse": ORIGINAL})["base_study_id"]
    # Group x load: the cells are labelled by the group alone.
    cells = [
        ("group_by_load", "patients:2-back", "Patients", "positive"),
        ("group_by_load", "patients:0-back", "Patients", "negative"),
        ("group_by_load", "controls:2-back", "Controls", "negative"),
        ("group_by_load", "controls:0-back", "Controls", "positive"),
    ]

    summary = ingest_upload(
        {
            "record": fx.record([_with_cells(GAIN, cells)]),
            "parse_id": ORIGINAL["parse_id"],
            "base_study_id": base_study_id,
        }
    )

    gain = next(a for a in _current(base_study_id).analyses if a.source_id == GAIN["key"])
    assert _weights(gain) == {
        "patients:2-back": 1.0,
        "patients:0-back": -1.0,
        "controls:2-back": -1.0,
        "controls:0-back": 1.0,
    }
    assert summary["record"]["condition_conflicts"] == []


def test_a_cell_given_both_directions_sets_no_weights(session):
    base_study_id = ingest_upload({"coordinate_parse": ORIGINAL})["base_study_id"]
    cells = [
        ("group", "patients", "Patients", "positive"),
        ("group", "patients", "Patients", "negative"),
        ("group", "controls", "Controls", "negative"),
    ]

    summary = ingest_upload(
        {
            "record": fx.record([_with_cells(GAIN, cells)]),
            "parse_id": ORIGINAL["parse_id"],
            "base_study_id": base_study_id,
        }
    )

    gain = next(a for a in _current(base_study_id).analyses if a.source_id == GAIN["key"])
    assert _weights(gain) == {}
    assert summary["record"]["condition_conflicts"] == [
        {
            "key": GAIN["key"],
            "cells": [{"term": "group", "level": "patients", "reason": BOTH_DIRECTIONS}],
        }
    ]


def test_a_condition_name_in_two_papers_is_two_conditions(session):
    ids = []
    for pmid, rows in (("55555555", [0]), ("66666666", [1])):
        parsed = fx.table_analysis("tbl1", rows, "Control > Rest", [fx.point((1, 2, 3))])
        record = fx.record([_contrast(parsed, Control="positive", Rest="negative")])
        for _ in range(2):  # A second upload of the paper reuses its own conditions.
            summary = ingest_upload(
                {"coordinate_parse": fx.parse([parsed], pmid=pmid), "record": record}
            )
        (analysis,) = _current(summary["base_study_id"]).analyses
        assert _weights(analysis) == {"Control": 1.0, "Rest": -1.0}
        ids.append({ac.condition_id for ac in analysis.analysis_conditions})

    assert Condition.query.filter_by(name="Control").count() == 2
    assert not ids[0] & ids[1]


def test_reparse_compares_normalized_names(session):
    base_study_id = _ingested(ORIGINAL, LOSS)["base_study_id"]
    wider = fx.table_analysis("tbl1", [4, 5, 8], "LOSS>Neutral", LOSS["points"])

    summary = ingest_upload({"coordinate_parse": fx.parse([GAIN, wider, RISK, SEED])})

    assert summary["skeleton"]["aliased"] == [{"from": LOSS["key"], "to": wider["key"]}]
    _ANALYSES[wider["key"]] = wider
    assert _entity(base_study_id, wider["key"]).id == (
        StudyEntityAlias.query.get(_hash(base_study_id, LOSS["key"])).entity_id
    )


def test_reparse_never_aliases_an_analysis_read_from_other_rows(session):
    # Same table and name, but rows of another task block: a different analysis.
    base_study_id = _ingested(ORIGINAL, LOSS)["base_study_id"]
    claims = {c.id for c in _claims(base_study_id, LOSS["key"])}
    other_task = fx.table_analysis("tbl1", [9, 10], "Loss > Neutral", LOSS["points"])

    summary = ingest_upload({"coordinate_parse": fx.parse([GAIN, other_task, RISK, SEED])})

    assert summary["skeleton"]["aliased"] == []
    assert summary["skeleton"]["rename_candidates"] == []
    assert {c.id for c in _claims(base_study_id, LOSS["key"])} == claims
    assert StudyEntityAlias.query.count() == 0
    # The claims stay on the history analysis, and the summary says so.
    assert summary["skeleton"]["orphaned_claims"] == [
        {
            "key": LOSS["key"],
            "class": "Analysis",
            "entity_id": _entity(base_study_id, LOSS["key"]).id,
            "claims": len(claims),
            "reason": NO_SUCCESSOR_REASON,
        }
    ]


def test_reparse_renaming_at_the_same_cells_links_a_candidate(session):
    base_study_id = _ingested(ORIGINAL, LOSS, coordinate_sets=[LOSS["key"]])["base_study_id"]
    claims = {c.id for c in _claims(base_study_id, LOSS["key"])}
    renamed = fx.table_analysis("tbl1", [4, 5], "Loss > Baseline", LOSS["points"])

    summary = ingest_upload({"coordinate_parse": fx.parse([GAIN, renamed, RISK, SEED])})

    skeleton = summary["skeleton"]
    assert skeleton["aliased"] == []
    assert sorted(c["class"] for c in skeleton["rename_candidates"]) == [
        "Analysis",
        "CoordinateSet",
    ]
    assert {(c["from"], c["to"]) for c in skeleton["rename_candidates"]} == {
        (LOSS["key"], renamed["key"])
    }
    # The claims stay on the old entity; the link waits for a curator.
    assert {c.id for c in _claims(base_study_id, LOSS["key"])} == claims
    _ANALYSES[renamed["key"]] = renamed
    link = StudyEntityCandidateLink.query.filter_by(
        entity_id=_entity(base_study_id, LOSS["key"]).id
    ).filter(StudyEntityCandidateLink.candidate_id == _entity(base_study_id, renamed["key"]).id)
    assert link.count() == 1
    candidate = _entity(base_study_id, renamed["key"])
    assert not FieldClaim.query.filter_by(entity_id=candidate.id).count()


def test_an_upload_is_refused_while_entity_hashes_are_stale(session):
    base_study_id = _ingested(ORIGINAL, GAIN)["base_study_id"]
    study_entity = StudyEntity.query.filter_by(
        base_study_id=base_study_id, entity_class="Study"
    ).one()
    study_entity.entity_hash = "0" * 64  # as if hashed under an older version

    with pytest.raises(NeuroStoreException) as error:
        ingest_upload({"coordinate_parse": ORIGINAL, "record": _record(GAIN)})
    assert error.value.status_code == 422
    assert "STALE_ENTITY_HASHES" in str(error.value.errors)


def test_two_old_analyses_overlapping_one_new_one_alias_neither(session):
    first = fx.table_analysis("tbl1", [4, 5], "Loss > Neutral", LOSS["points"])
    second = fx.table_analysis("tbl1", [6, 7], "Loss > Neutral", RISK["points"])
    base_study_id = _ingested(fx.parse([first, second]), first, second)["base_study_id"]
    both = fx.table_analysis("tbl1", [4, 5, 6, 7], "Loss > Neutral", LOSS["points"])

    summary = ingest_upload({"coordinate_parse": fx.parse([both])})

    skeleton = summary["skeleton"]
    assert skeleton["aliased"] == []
    assert StudyEntityAlias.query.count() == 0
    assert {(o["key"], o["reason"]) for o in skeleton["orphaned_claims"]} == {
        (first["key"], NO_SUCCESSOR_REASON),
        (second["key"], NO_SUCCESSOR_REASON),
    }
    for parsed in (first, second):
        assert _claims(base_study_id, parsed["key"])


def test_reparse_onto_a_hash_another_entity_holds_is_a_conflict(session):
    base_study_id = _ingested(ORIGINAL, LOSS)["base_study_id"]
    claims = {c.id for c in _claims(base_study_id, LOSS["key"])}
    wider = fx.table_analysis("tbl1", [4, 5, 8], "Loss > Neutral", LOSS["points"])
    _ANALYSES[wider["key"]] = wider
    holder = StudyEntity(
        base_study_id=base_study_id,
        entity_class="Analysis",
        entity_hash=_hash(base_study_id, wider["key"]),
        identity=analysis_identity("table", "tbl1", cells=[(4, 0)], name="held"),
    )
    session.add(holder)
    session.flush()

    summary = ingest_upload({"coordinate_parse": fx.parse([GAIN, wider, RISK, SEED])})

    skeleton = summary["skeleton"]
    assert skeleton["aliased"] == []
    assert [(c["from"], c["to"], c["holder_id"]) for c in skeleton["alias_conflicts"]] == [
        (LOSS["key"], wider["key"], holder.id)
    ]
    assert [(o["key"], o["reason"]) for o in skeleton["orphaned_claims"]] == [
        (LOSS["key"], ALIAS_CONFLICT_REASON)
    ]
    assert {c.id for c in _claims(base_study_id, LOSS["key"])} == claims


def test_reparse_with_overlapping_spans_at_another_place_is_no_rename(session):
    # Spans 0-10 and 5-15 cover what 0-15 covers, but are another place to the record
    # side's rename rule, so the parse side must not call them a rename either.
    old = fx.text_analysis([(0, 10), (5, 15)], "Faces > Houses", [fx.point((1, 2, 3))])
    base_study_id = _ingested(fx.parse([old], pmid="77777777"), old)["base_study_id"]
    new = fx.text_analysis([(0, 15)], "Faces > Objects", [fx.point((1, 2, 3))])

    summary = ingest_upload({"coordinate_parse": fx.parse([new], pmid="77777777")})

    assert summary["skeleton"]["rename_candidates"] == []
    assert StudyEntityCandidateLink.query.count() == 0
    assert [o["key"] for o in summary["skeleton"]["orphaned_claims"]] == [old["key"]]
    assert _claims(base_study_id, old["key"])


def test_a_curated_condition_of_the_same_paper_is_not_reused(session):
    base_study_id = ingest_upload({"coordinate_parse": ORIGINAL})["base_study_id"]
    curated = Study(name="curated", base_study_id=base_study_id)
    curated_analysis = Analysis(study=curated, name="Control > Rest")
    control = Condition(name="Control")
    curated_analysis.analysis_conditions.append(
        AnalysisConditions(condition=control, weight=1.0)
    )
    session.add(curated)
    session.flush()

    ingest_upload(
        {
            "record": fx.record([_contrast(GAIN, Control="positive", Rest="negative")]),
            "parse_id": ORIGINAL["parse_id"],
            "base_study_id": base_study_id,
        }
    )

    gain = next(a for a in _current(base_study_id).analyses if a.source_id == GAIN["key"])
    assert _weights(gain) == {"Control": 1.0, "Rest": -1.0}
    assert control.id not in {ac.condition_id for ac in gain.analysis_conditions}


def test_a_superseded_key_given_both_directions_is_a_conflict(session):
    base_study_id = ingest_upload({"coordinate_parse": ORIGINAL})["base_study_id"]
    revision, original, inverse, _ = _revision()
    ingest_upload({"coordinate_parse": revision})
    cells = [
        ("condition", "gain", "Gain", "positive"),
        ("condition", "gain", "Gain", "negative"),
    ]

    summary = ingest_upload(
        {
            "record": fx.record([_with_cells(GAIN, cells)]),
            "parse_id": ORIGINAL["parse_id"],
            "base_study_id": base_study_id,
        }
    )

    assert summary["record"]["analyses"]["superseded"][0]["key"] == GAIN["key"]
    assert summary["record"]["condition_conflicts"] == [
        {
            "key": GAIN["key"],
            "cells": [{"term": "condition", "level": "gain", "reason": BOTH_DIRECTIONS}],
        }
    ]
    by_key = {a.source_id: a for a in _current(base_study_id).analyses}
    assert _weights(by_key[original["key"]]) == {}
    assert _weights(by_key[inverse["key"]]) == {}


def _effect(*cells):
    return {
        "effect": {
            "cells": [
                {
                    "term": term,
                    "level": fx.extracted(level),
                    "label": fx.extracted(label),
                    "direction": fx.extracted(direction),
                }
                for term, level, label, direction in cells
            ]
        }
    }


def test_cells_sharing_label_and_level_are_named_by_term():
    weights, conflicts = _cell_weights(
        _effect(
            ("load", "high", "High", "positive"),
            ("noise", "high", "High", "negative"),
        )
    )

    assert weights == {"load: high": 1.0, "noise: high": -1.0}
    assert conflicts == []


def test_a_name_shared_across_tiers_is_a_conflict_not_an_overwrite():
    # (g, pat) is named by its level, since "P" is shared; (t, x) by its label "pat".
    weights, conflicts = _cell_weights(
        _effect(
            ("g", "pat", "P", "positive"),
            ("g", "con", "P", "negative"),
            ("t", "x", "pat", "negative"),
        )
    )

    assert weights == {}
    assert conflicts == [
        {"term": "g", "level": "pat", "name": "pat", "reason": SHARED_NAME},
        {"term": "t", "level": "x", "name": "pat", "reason": SHARED_NAME},
    ]


def test_only_result_analyses_give_a_paper_coordinates(session):
    roles = ["reference", "localization", "anchor", "other"]
    cited = [
        fx.table_analysis("tbl3", [i], f"set {role}", [fx.point((i, i, i))], role=role)
        for i, role in enumerate(roles)
    ]
    summary = ingest_upload({"coordinate_parse": fx.parse(cited, pmid="88888888")})
    study = _current(summary["base_study_id"])

    assert not any(a.has_coordinates for a in study.analyses)
    assert not study.has_coordinates
    assert not session.get(BaseStudy, summary["base_study_id"]).has_coordinates

    result = fx.table_analysis("tbl3", [9], "Faces > Houses", [fx.point((9, 9, 9))])
    summary = ingest_upload({"coordinate_parse": fx.parse([*cited, result], pmid="88888888")})
    study = _current(summary["base_study_id"])

    assert {a.name for a in study.analyses if a.has_coordinates} == {"Faces > Houses"}
    assert study.has_coordinates
    assert session.get(BaseStudy, summary["base_study_id"]).has_coordinates
