"""The study_schema ingester: a parse, a parse with a record, a record, a revision."""

from datetime import datetime, timezone

import pytest
import sqlalchemy as sa

from neurostore.exceptions.base import NeuroStoreException
from neurostore.ingest.study_schema import (
    BOTH_DIRECTIONS,
    HISTORY_SOURCE,
    NO_STORED_PARSE_REASON,
    NO_SUCCESSOR,
    NOT_CARRIED,
    ORPHAN_REASONS,
    OUTCOME_WITHHELD_REASON,
    POSITIONAL_KEY_REASON,
    RELABEL_REVISED_REASON,
    SHARED_NAME,
    STUDY_SOURCE,
    UNKNOWN_KEY_REASON,
    _cell_weights,
    _point_rows,
    backfill_roles,
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
)
from neurostore.database import db
from neurostore.models.data import is_result_analysis, study_entity_hash
from neurostore.services.has_media_flags import recompute_media_flags
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


def _hash(base_study_id, key, entity_class="Analysis"):
    """The entity hash of the analysis under ``key``: the content key is its identity."""
    return study_entity_hash(base_study_id, entity_class, key)


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
    return revision, original, inverse, merged


def test_parse_alone_stores_skeleton_keyed_by_content(session):
    summary = ingest_upload({"coordinate_parse": ORIGINAL})

    assert summary["kind"] == "parse"
    study = _current(summary["base_study_id"])
    assert study.source_id == ORIGINAL["parse_id"]
    # Every role is stored; the role is the analysis's.
    assert {a.source_id: a.role for a in study.analyses} == {
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


def test_an_old_cell_key_in_a_record_is_parked_as_positional(session):
    # A key minted from cells (``<table id>#<12 hex>``) no longer names an analysis.
    base_study_id = ingest_upload({"coordinate_parse": ORIGINAL})["base_study_id"]
    record = fx.record([fx.record_analysis("a0", "tbl1#0123456789ab", "Loss > Neutral")])

    summary = ingest_upload(
        {"record": record, "parse_id": ORIGINAL["parse_id"], "base_study_id": base_study_id}
    )

    assert summary["record"]["analyses"]["parked"] == [
        {"key": "tbl1#0123456789ab", "reason": POSITIONAL_KEY_REASON}
    ]
    assert summary["record"]["claims"]["parked_entities"] == [
        {"entity": "Analysis[tbl1#0123456789ab]", "reason": POSITIONAL_KEY_REASON}
    ]
    assert not StudyEntity.query.filter_by(entity_class="Analysis").count()


def test_the_same_analysis_read_from_another_source_is_one_analysis(session):
    # Loss > Neutral read again from the sentence restating the table, its name spaced
    # differently: same name, space and points, so the same key, analysis and claims.
    first = _ingested(ORIGINAL, LOSS, coordinate_sets=[LOSS["key"]])
    base_study_id = first["base_study_id"]
    loss = next(a for a in _current(base_study_id).analyses if a.source_id == LOSS["key"])
    claims = {c.id for c in _claims(base_study_id, LOSS["key"])}
    restated = fx.text_analysis([(310, 402)], "Loss>Neutral", LOSS["points"])
    assert restated["key"] == LOSS["key"]

    summary = ingest_upload({"coordinate_parse": fx.parse([GAIN, restated, RISK, SEED])})

    skeleton = summary["skeleton"]
    assert (skeleton["created"], skeleton["updated"], skeleton["superseded"]) == (0, 4, 0)
    assert skeleton["orphaned_claims"] == []
    again = next(a for a in _current(base_study_id).analyses if a.source_id == LOSS["key"])
    assert again.id == loss.id and again.table is None
    assert {c.id for c in _claims(base_study_id, LOSS["key"])} == claims
    assert _entity(base_study_id, LOSS["key"]).analysis_id == loss.id
    # A record that read the table parse still resolves to it.
    late = ingest_upload(
        {"record": _record(LOSS), "parse_id": ORIGINAL["parse_id"], "base_study_id": base_study_id}
    )
    assert late["record"]["analyses"]["resolved"] == 1
    assert late["record"]["claims"]["entities"]["created"] == 0


@pytest.mark.parametrize(
    "changed",
    [fx.point((1, 2, 4)), fx.point((1, 2, 3), t=3.6), fx.point((1, 2, 3), space="TAL")],
    ids=["coordinate", "value", "space"],
)
def test_a_changed_point_is_a_new_analysis(session, changed):
    base_study_id = _ingested(ORIGINAL, LOSS)["base_study_id"]
    loss = next(a for a in _current(base_study_id).analyses if a.source_id == LOSS["key"])
    claims = {c.id for c in _claims(base_study_id, LOSS["key"])}
    assert claims
    reread = fx.table_analysis("tbl1", [4, 5], "Loss > Neutral", [changed])
    assert reread["key"] != LOSS["key"]

    summary = ingest_upload({"coordinate_parse": fx.parse([GAIN, reread, RISK, SEED])})

    skeleton = summary["skeleton"]
    assert (skeleton["created"], skeleton["superseded"]) == (1, 1)
    current = {a.source_id: a for a in _current(base_study_id).analyses}
    assert LOSS["key"] not in current and current[reread["key"]].id != loss.id
    assert db.session.get(Analysis, loss.id).study.source == HISTORY_SOURCE
    # The claims stay on the old analysis's entity, reported; the new analysis has none.
    assert {c.id for c in _claims(base_study_id, LOSS["key"])} == claims
    assert skeleton["orphaned_claims"] == [
        {
            "key": LOSS["key"],
            "class": "Analysis",
            "entity_id": _entity(base_study_id, LOSS["key"]).id,
            "claims": len(claims),
            "reason": NO_SUCCESSOR,
        }
    ]
    assert not StudyEntity.query.filter_by(entity_hash=_hash(base_study_id, reread["key"])).count()


def test_revision_versions_analyses_and_carries_claims(session):
    first = ingest_upload(
        {"coordinate_parse": ORIGINAL, "record": _record(GAIN, LOSS, RISK)}
    )
    base_study_id = first["base_study_id"]
    old_ids = {a.source_id: a.id for a in _current(base_study_id).analyses}

    revision, original, inverse, merged = _revision()
    summary = ingest_upload({"coordinate_parse": revision})

    assert summary["kind"] == "revision"
    # Split and merged analyses had their claims copied on, so none stays behind.
    assert summary["skeleton"]["orphaned_claims"] == []
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


def test_a_revision_that_omits_an_analysis_reports_its_claims_as_not_carried(session):
    base_study_id = _ingested(ORIGINAL, GAIN)["base_study_id"]
    claims = _claims(base_study_id, GAIN["key"])
    revision = fx.parse(
        [LOSS, SEED],
        revision_of=ORIGINAL["parse_id"],
        verdicts=[
            fx.verdict(GAIN["key"], "omit"),
            fx.verdict(LOSS["key"], "accept", [LOSS["key"]]),
            fx.verdict(RISK["key"], "omit"),
            fx.verdict(SEED["key"], "accept", [SEED["key"]]),
        ],
    )

    summary = ingest_upload({"coordinate_parse": revision})

    assert summary["skeleton"]["orphaned_claims"] == [
        {
            "key": GAIN["key"],
            "class": "Analysis",
            "entity_id": _entity(base_study_id, GAIN["key"]).id,
            "claims": len(claims),
            "reason": NOT_CARRIED,
        }
    ]


def test_orphaned_claim_reasons_are_codes():
    assert ORPHAN_REASONS == ("no_successor", "not_carried")


@pytest.mark.parametrize("kind", ["accept", "relabel"])
def test_a_verdict_keeping_a_key_the_revision_lacks_is_refused(session, kind):
    ingest_upload({"coordinate_parse": ORIGINAL})
    revision = fx.parse(
        [SEED],
        revision_of=ORIGINAL["parse_id"],
        verdicts=[
            fx.verdict(GAIN["key"], kind, [GAIN["key"]]),
            fx.verdict(LOSS["key"], "omit"),
            fx.verdict(RISK["key"], "omit"),
            fx.verdict(SEED["key"], "accept", [SEED["key"]]),
        ],
    )

    with pytest.raises(NeuroStoreException) as error:
        ingest_upload({"coordinate_parse": revision})

    assert error.value.status_code == 422
    assert "VERDICT_KEY_NOT_IN_REVISION" in str(error.value.errors)
    assert GAIN["key"] in str(error.value.errors)


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
    assert sorted(a.role for a in stored) == sorted(roles)


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


def test_cells_differing_only_by_label_each_keep_their_weight():
    weights, conflicts = _cell_weights(
        _effect(
            ("g", "pat", "Patients", "positive"),
            ("g", "pat", "Early patients", "positive"),
            ("g", "con", "Controls", "negative"),
        )
    )

    assert weights == {"Patients": 1.0, "Early patients": 1.0, "Controls": -1.0}
    assert conflicts == []


def test_a_label_equal_to_another_cells_level_keeps_both_cells():
    weights, conflicts = _cell_weights(
        _effect(("g", None, "P", "positive"), ("g", "P", "Q", "positive"))
    )

    assert weights == {"P": 1.0, "Q": 1.0}
    assert conflicts == []


def test_one_level_in_both_directions_under_two_labels_is_a_conflict():
    weights, conflicts = _cell_weights(
        _effect(("g", "pat", "Patients", "positive"), ("g", "pat", "Early", "negative"))
    )

    assert weights == {}
    assert conflicts == [{"term": "g", "level": "pat", "reason": BOTH_DIRECTIONS}]


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


# ---------------------------------------------------------------------------
# outcome, role and retraction columns
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
    other = fx.table_analysis("tbl5", [0], "Peak voxel", [fx.point((2, 4, 6))], role="other")
    summary = ingest_upload({"coordinate_parse": fx.parse([LOSS, ROI, other])})

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
    # `other` coordinates are kept as analyses, but are not results.
    assert analyses[other["key"]].role == "other"
    assert analyses[other["key"]].outcome is None
    assert not is_result_analysis(analyses[other["key"]])


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
    revision, original, inverse, _ = _revision()
    ingest_upload({"coordinate_parse": ORIGINAL})
    own = _contrast(inverse, local_id="a0")
    own["outcome"] = fx.extracted("no_significant_effect")
    orig = _contrast(original, local_id="a1")
    orig["outcome"] = fx.extracted("significant_effect")
    # The inverse half's own entry comes first; the original half's derived one follows.
    summary = ingest_upload({"coordinate_parse": revision, "record": fx.record([own, orig])})
    by_key = _by_key(_current(summary["base_study_id"]))
    assert by_key[original["key"]].outcome == "significant_effect"
    assert by_key[inverse["key"]].outcome == "no_significant_effect"

    # A derived entry with no outcome adds nothing: the inverse half keeps its own.
    ingest_upload(
        {
            "parse_id": revision["parse_id"],
            "base_study_id": summary["base_study_id"],
            "record": fx.record([_contrast(original, local_id="a1")]),
        }
    )
    assert by_key[original["key"]].outcome is None
    assert by_key[inverse["key"]].outcome == "no_significant_effect"


def _outcome_claims(base_study_id, key):
    return {
        (c.value, c.extraction_status)
        for c in _claims(base_study_id, key)
        if c.field_path == "outcome"
    }


def test_an_anchor_outcome_is_a_claim_not_a_column(session):
    parse = fx.parse([NULL, ROI])
    summary = ingest_upload(
        {
            "coordinate_parse": parse,
            "record": _outcome_record(
                (NULL, "no_significant_effect"), (ROI, "no_significant_effect")
            ),
        }
    )
    base_id = summary["base_study_id"]
    analyses = _by_key(_current(base_id))
    assert analyses[NULL["key"]].outcome == "no_significant_effect"
    # An ROI was not tested in this study: no outcome, but the record's is kept.
    assert analyses[ROI["key"]].outcome is None
    assert _outcome_claims(base_id, ROI["key"]) == {("no_significant_effect", "extracted")}
    assert summary["record"]["outcomes_withheld"] == [
        {
            "key": ROI["key"],
            "role": "anchor",
            "outcome": "no_significant_effect",
            "reason": OUTCOME_WITHHELD_REASON,
        }
    ]


def test_a_role_change_applies_or_withdraws_the_claimed_outcome(session):
    parse = fx.parse([LOSS, ROI])
    summary = ingest_upload(
        {
            "coordinate_parse": parse,
            "record": _outcome_record((LOSS, None), (ROI, "no_significant_effect")),
        }
    )
    base_id = summary["base_study_id"]
    roi = _by_key(_current(base_id))[ROI["key"]]
    assert roi.outcome is None

    # A later parse reads the same set as a result: the claimed outcome applies.
    as_result = {**ROI, "role": "result", "from_prior_study": None}
    ingest_upload({"coordinate_parse": fx.parse([LOSS, as_result])})
    assert (roi.role, roi.outcome) == ("result", "no_significant_effect")
    # Re-applying it keeps the outcome rather than looking it up again.
    ingest_upload({"coordinate_parse": fx.parse([LOSS, as_result])})
    assert roi.outcome == "no_significant_effect"

    # Back to an anchor (a stored parse cannot be replayed, so a new one): the column
    # clears and the claim stays.
    ingest_upload({"coordinate_parse": fx.parse([LOSS, {**ROI, "description": "ROI"}])})
    assert (roi.role, roi.outcome) == ("anchor", None)
    assert _outcome_claims(base_id, ROI["key"]) == {("no_significant_effect", "extracted")}


def test_a_role_change_applies_only_the_latest_records_outcome(session):
    parse = fx.parse([LOSS, ROI])
    summary = ingest_upload(
        {
            "coordinate_parse": parse,
            "record": _outcome_record((LOSS, None), (ROI, "no_significant_effect")),
        }
    )
    base_id = summary["base_study_id"]
    # The same config re-run reports no outcome for the ROI. The first run's claim stays,
    # still linked to that config, but it is not what the latest run says.
    ingest_upload(
        {"coordinate_parse": parse, "record": _outcome_record((LOSS, None), (ROI, None))}
    )
    assert _outcome_claims(base_id, ROI["key"]) == {("no_significant_effect", "extracted")}

    as_result = {**ROI, "role": "result", "from_prior_study": None}
    ingest_upload({"coordinate_parse": fx.parse([LOSS, as_result])})
    roi = _by_key(_current(base_id))[ROI["key"]]
    assert (roi.role, roi.outcome) == ("result", None)

    # Back to an anchor; a later run reports an outcome again, and that one applies.
    as_anchor = fx.parse([LOSS, {**ROI, "description": "ROI"}])
    ingest_upload({"coordinate_parse": as_anchor})
    ingest_upload(
        {
            "coordinate_parse": as_anchor,
            "record": _outcome_record((LOSS, None), (ROI, "significant_effect")),
        }
    )
    ingest_upload({"coordinate_parse": fx.parse([LOSS, {**as_result, "description": "R"}])})
    assert (roi.role, roi.outcome) == ("result", "significant_effect")


# ---------------------------------------------------------------------------
# reviewed relabels and the role backfill
# ---------------------------------------------------------------------------

PEAK = fx.table_analysis("tbl3", [0], "Peak > Baseline", [fx.point((8, 8, 8))])


def test_a_relabel_wins_over_a_later_classifier_parse(session):
    original = fx.parse([LOSS, PEAK])
    base_study_id = ingest_upload({"coordinate_parse": original})["base_study_id"]
    revision = fx.parse(
        [LOSS, {**PEAK, "role": "anchor"}],
        revision_of=original["parse_id"],
        verdicts=[
            fx.verdict(LOSS["key"], "accept", [LOSS["key"]]),
            fx.verdict(PEAK["key"], "relabel", [PEAK["key"]]),
        ],
    )
    ingest_upload({"coordinate_parse": revision})
    peak = _by_key(_current(base_study_id))[PEAK["key"]]
    assert (peak.role, peak.relabelled_by) == ("anchor", revision["parse_id"])
    assert _by_key(_current(base_study_id))[LOSS["key"]].relabelled_by is None

    # The classifier runs again (a new parse, not a revision) and calls it a result.
    rerun = fx.parse([LOSS, PEAK, RISK])
    summary = ingest_upload({"coordinate_parse": rerun})

    peak = _by_key(_current(base_study_id))[PEAK["key"]]
    assert (peak.role, peak.relabelled_by) == ("anchor", revision["parse_id"])
    assert summary["skeleton"]["relabels_kept"] == [
        {
            "key": PEAK["key"],
            "role": "anchor",
            "parse_role": "result",
            "relabelled_by": revision["parse_id"],
        }
    ]
    assert not is_result_analysis(peak)


def _strip_roles(study):
    """Make ``study``'s analyses look uploaded before the role column existed."""
    for analysis in study.analyses:
        analysis.metadata_ = {**analysis.metadata_, "role": analysis.role}
        analysis.role = None
    db.session.flush()


def test_backfill_roles_dry_run_then_apply(session):
    summary = ingest_upload({"coordinate_parse": fx.parse([LOSS, SEED], pmid="77777777")})
    base_study_id = summary["base_study_id"]
    study = _current(base_study_id)
    _strip_roles(study)
    stray = Analysis(name="Stray", study=study, source_id="no-such-key", user=study.user)
    curated = Study(name="Curated", base_study_id=base_study_id, user=study.user)
    legacy = Analysis(name="Legacy", study=curated, source_id="legacy-key", user=study.user)
    db.session.add_all([stray, curated, legacy])
    recompute_media_flags([base_study_id])
    db.session.flush()
    db.session.expire_all()
    # An unclassified pipeline set gives the paper no coordinates.
    assert not session.get(BaseStudy, base_study_id).has_coordinates

    dry = backfill_roles(base_study_id=base_study_id)

    expected_unmatched = [
        {
            "analysis_id": stray.id,
            "study_id": study.id,
            "key": "no-such-key",
            "reason": NO_STORED_PARSE_REASON,
        }
    ]
    assert dry == {
        "matched": {"result": 1, "reference": 1},
        "matched_by": {"own_parse": 2},
        "unmatched": expected_unmatched,
        "legacy_unmatched": 1,
        "disagreements": [],
        "applied": False,
    }
    assert {a.source_id: a.role for a in study.analyses} == {
        LOSS["key"]: None,
        SEED["key"]: None,
        "no-such-key": None,
    }

    applied = backfill_roles(apply=True, base_study_id=base_study_id)

    assert applied["matched"] == dry["matched"]
    assert applied["unmatched"] == expected_unmatched
    assert {a.source_id: a.role for a in study.analyses} == {
        LOSS["key"]: "result",
        SEED["key"]: "reference",
        "no-such-key": None,
    }
    assert all("role" not in (a.metadata_ or {}) for a in study.analyses)
    assert legacy.role is None
    db.session.expire_all()
    assert session.get(BaseStudy, base_study_id).has_coordinates
    # Applied once, there is nothing left to set.
    assert backfill_roles(base_study_id=base_study_id)["matched"] == {}


def _as_before_roles(study, **metadata):
    """``_strip_roles``, and no relabel record or outcome: columns an older ingest lacked."""
    _strip_roles(study)
    for analysis in study.analyses:
        analysis.relabelled_by = None
        analysis.outcome = None
        analysis.metadata_ = {**analysis.metadata_, **metadata.get(analysis.source_id, {})}
    db.session.flush()


def _relabel_peak(base_study_id, original):
    revision = fx.parse(
        [LOSS, {**PEAK, "role": "anchor"}],
        revision_of=original["parse_id"],
        verdicts=[
            fx.verdict(LOSS["key"], "accept", [LOSS["key"]]),
            fx.verdict(PEAK["key"], "relabel", [PEAK["key"]]),
        ],
    )
    ingest_upload({"coordinate_parse": revision})
    return revision


def test_backfill_records_a_relabel_so_a_classifier_rerun_keeps_it(session):
    original = fx.parse([LOSS, PEAK])
    base_study_id = ingest_upload({"coordinate_parse": original})["base_study_id"]
    revision = _relabel_peak(base_study_id, original)
    _as_before_roles(_current(base_study_id))

    summary = backfill_roles(apply=True, base_study_id=base_study_id)

    assert summary["matched_by"] == {"relabel": 1, "own_parse": 1}
    peak = _by_key(_current(base_study_id))[PEAK["key"]]
    assert (peak.role, peak.relabelled_by) == ("anchor", revision["parse_id"])

    rerun = ingest_upload({"coordinate_parse": fx.parse([LOSS, PEAK, RISK])})
    peak = _by_key(_current(base_study_id))[PEAK["key"]]
    assert (peak.role, peak.relabelled_by) == ("anchor", revision["parse_id"])
    assert [k["key"] for k in rerun["skeleton"]["relabels_kept"]] == [PEAK["key"]]


def test_backfill_prefers_a_relabel_over_a_later_classifier_parse(session):
    # Before roles were columns, a classifier re-run overwrote the relabelled role.
    original = fx.parse([LOSS, PEAK])
    base_study_id = ingest_upload({"coordinate_parse": original})["base_study_id"]
    revision = _relabel_peak(base_study_id, original)
    rerun = fx.parse([LOSS, PEAK, RISK])
    ingest_upload({"coordinate_parse": rerun})
    _as_before_roles(_current(base_study_id), **{PEAK["key"]: {"role": "result"}})
    peak = _by_key(_current(base_study_id))[PEAK["key"]]
    assert peak.metadata_["parse_id"] == rerun["parse_id"]

    backfill_roles(apply=True, base_study_id=base_study_id)

    assert (peak.role, peak.relabelled_by) == ("anchor", revision["parse_id"])


def test_backfill_prefers_the_analysis_own_parse(session):
    as_anchor = fx.parse([LOSS, {**PEAK, "role": "anchor"}])
    base_study_id = ingest_upload({"coordinate_parse": as_anchor})["base_study_id"]
    ingest_upload({"coordinate_parse": fx.parse([LOSS, PEAK])})
    study = _current(base_study_id)
    _as_before_roles(study)
    peak = _by_key(study)[PEAK["key"]]
    # Written from the older parse; the newer one calls the same key a result.
    peak.metadata_ = {
        **{k: v for k, v in peak.metadata_.items() if k != "role"},
        "parse_id": as_anchor["parse_id"],
    }
    db.session.flush()

    summary = backfill_roles(base_study_id=base_study_id)

    assert summary["matched"] == {"result": 1, "anchor": 1}
    assert summary["disagreements"] == []


def test_backfill_falls_back_to_the_newest_parse_and_reports_disagreement(session):
    as_anchor = fx.parse([LOSS, {**PEAK, "role": "anchor"}])
    base_study_id = ingest_upload({"coordinate_parse": as_anchor})["base_study_id"]
    newest = fx.parse([LOSS, PEAK])
    ingest_upload({"coordinate_parse": newest})
    study = _current(base_study_id)
    _as_before_roles(study)
    peak = _by_key(study)[PEAK["key"]]
    peak.metadata_ = {"parse_id": "no-longer-stored"}
    db.session.flush()

    summary = backfill_roles(base_study_id=base_study_id)

    assert summary["matched_by"] == {"own_parse": 1, "other_parse": 1}
    assert summary["matched"] == {"result": 2}
    assert summary["disagreements"] == [
        {"analysis_id": peak.id, "key": PEAK["key"], "roles": ["result", "anchor"]}
    ]


def test_backfill_applies_the_claimed_outcome_and_rebuilds_the_shard(session):
    summary = ingest_upload(
        {
            "coordinate_parse": fx.parse([LOSS, NULL]),
            "record": _outcome_record((LOSS, None), (NULL, "no_significant_effect")),
        }
    )
    base_study_id = summary["base_study_id"]
    study = _current(base_study_id)
    _as_before_roles(study)
    study.updated_at = study.source_updated_at = datetime(2020, 1, 1, tzinfo=timezone.utc)
    db.session.commit()

    backfill_roles(apply=True, base_study_id=base_study_id)

    study = _current(base_study_id)
    assert {a.source_id: a.outcome for a in study.analyses} == {
        LOSS["key"]: None,
        NULL["key"]: "no_significant_effect",
    }
    # Only the analyses changed; the Study is marked so a release rebuilds its shard.
    assert study.updated_at > datetime(2020, 1, 2, tzinfo=timezone.utc)


def test_backfill_gives_a_clone_its_parent_role(session):
    summary = ingest_upload(
        {
            "coordinate_parse": fx.parse([LOSS, SEED, NULL]),
            "record": _outcome_record((LOSS, None), (NULL, "no_significant_effect")),
        }
    )
    base_study_id = summary["base_study_id"]
    pipeline = _current(base_study_id)
    by_key = _by_key(pipeline)
    by_key[SEED["key"]].from_prior_study = None
    _as_before_roles(pipeline, **{SEED["key"]: {"from_prior_study": True}})
    # A parent that already has its role is read from the database, not this run.
    by_key[LOSS["key"]].role = "result"
    # Clones made before roles were copied: their source_id is the parent analysis.
    clone = Study(name="Clone", base_study_id=base_study_id, source="neurostore")
    of_clone = Study(name="Clone of clone", base_study_id=base_study_id, source="neurostore")
    copies = {}
    for key, parent in by_key.items():
        copies[key] = Analysis(
            name=parent.name, study=clone, source_id=parent.id, metadata_=parent.metadata_
        )
    db.session.add_all([clone, of_clone, *copies.values()])
    db.session.flush()
    second = Analysis(name="2nd", study=of_clone, source_id=copies[NULL["key"]].id)
    db.session.add(second)
    db.session.flush()

    summary = backfill_roles(apply=True, base_study_id=base_study_id)

    assert summary["matched_by"] == {"own_parse": 2, "parent": 4}
    clone = db.session.get(Study, clone.id)
    assert sorted(
        (a.name, a.role, a.outcome, a.from_prior_study) for a in clone.analyses
    ) == sorted(
        [
            (LOSS["name"], "result", None, None),
            (SEED["name"], "reference", None, True),
            (NULL["name"], "result", "no_significant_effect", None),
        ]
    )
    second = db.session.get(Analysis, second.id)
    assert (second.role, second.outcome) == ("result", "no_significant_effect")


def test_backfill_works_through_every_batch_and_commits_each(session, monkeypatch):
    base_ids = []
    for pmid in ("70000001", "70000002", "70000003"):
        summary = ingest_upload({"coordinate_parse": fx.parse([LOSS], pmid=pmid)})
        base_ids.append(summary["base_study_id"])
        _strip_roles(_current(summary["base_study_id"]))
    db.session.commit()
    commit = db.session.commit
    # What each commit made durable: the papers whose pipeline set has its role.
    committed = []

    def spy():
        committed.append(
            {
                base_id
                for base_id in base_ids
                if _by_key(_current(base_id))[LOSS["key"]].role == "result"
            }
        )
        commit()

    monkeypatch.setattr(db.session, "commit", spy)

    summary = backfill_roles(apply=True, batch_size=2)

    assert summary["matched"] == {"result": 3}
    # The batches follow the database's id order, which is not Python's under en_US.
    ordered = list(
        db.session.scalars(
            sa.select(BaseStudy.id).where(BaseStudy.id.in_(base_ids)).order_by(BaseStudy.id)
        )
    )
    # Two batches, each committed as it finishes, so its row locks end with it.
    assert committed == [set(ordered[:2]), set(ordered)]


def test_backfill_gives_a_clone_the_relabel_of_a_parent_already_set(session):
    original = fx.parse([LOSS, PEAK])
    base_study_id = ingest_upload({"coordinate_parse": original})["base_study_id"]
    revision = _relabel_peak(base_study_id, original)
    peak = _by_key(_current(base_study_id))[PEAK["key"]]
    assert (peak.role, peak.relabelled_by) == ("anchor", revision["parse_id"])
    clone = Study(name="Clone", base_study_id=base_study_id, source="neurostore")
    copy = Analysis(name=peak.name, study=clone, source_id=peak.id)
    db.session.add_all([clone, copy])
    db.session.flush()

    summary = backfill_roles(apply=True, base_study_id=base_study_id)

    assert summary["matched_by"] == {"parent": 1}
    copy = db.session.get(Analysis, copy.id)
    # Without the relabel record, a re-run of the clone's paper would not keep its role.
    assert (copy.role, copy.relabelled_by) == ("anchor", revision["parse_id"])


def test_backfill_gives_a_clone_the_relabel_of_a_parent_resolved_in_the_same_batch(session):
    original = fx.parse([LOSS, PEAK])
    base_study_id = ingest_upload({"coordinate_parse": original})["base_study_id"]
    revision = _relabel_peak(base_study_id, original)
    _as_before_roles(_current(base_study_id))
    peak = _by_key(_current(base_study_id))[PEAK["key"]]
    assert (peak.role, peak.relabelled_by) == (None, None)
    clone = Study(name="Clone", base_study_id=base_study_id, source="neurostore")
    copy = Analysis(name=peak.name, study=clone, source_id=peak.id)
    # A clone of that clone: its parent may sort after it by id.
    grandcopy_study = Study(name="Clone 2", base_study_id=base_study_id, source="neurostore")
    grandcopy = Analysis(name=peak.name, study=grandcopy_study, source_id=copy.id)
    db.session.add_all([clone, copy, grandcopy_study, grandcopy])
    db.session.flush()
    grandcopy.source_id = copy.id

    summary = backfill_roles(apply=True, base_study_id=base_study_id)

    assert summary["matched_by"] == {"relabel": 1, "own_parse": 1, "parent": 2}
    for analysis in (copy, grandcopy):
        analysis = db.session.get(Analysis, analysis.id)
        assert (analysis.role, analysis.relabelled_by) == ("anchor", revision["parse_id"])


def test_backfill_takes_the_outcome_of_the_newest_record(session):
    parse = fx.parse([LOSS, NULL])
    base_study_id = ingest_upload({"coordinate_parse": parse})["base_study_id"]
    # Uploaded newest first, so the order they arrive in cannot decide.
    for version, date, outcome in (
        ("2.0.0", "2026-01-01T00:00:00Z", "no_significant_effect"),
        ("1.0.0", "2025-01-01T00:00:00Z", "significant_effect"),
    ):
        record = _outcome_record((LOSS, None), (NULL, outcome))
        record["extraction_metadata"].update(extractor_version=version, extraction_date=date)
        ingest_upload(
            {"parse_id": parse["parse_id"], "base_study_id": base_study_id, "record": record}
        )
    _as_before_roles(_current(base_study_id))
    db.session.commit()

    backfill_roles(apply=True, base_study_id=base_study_id)

    assert _by_key(_current(base_study_id))[NULL["key"]].outcome == "no_significant_effect"


def test_backfill_takes_the_upload_role_before_another_parse(session):
    base_study_id = ingest_upload({"coordinate_parse": fx.parse([LOSS])})["base_study_id"]
    study = _current(base_study_id)
    # Written from a parse that was never stored, with the role the upload gave it.
    _as_before_roles(study, **{LOSS["key"]: {"parse_id": "not-stored", "role": "anchor"}})
    db.session.flush()

    summary = backfill_roles(apply=True, base_study_id=base_study_id)

    assert summary["matched_by"] == {"upload": 1}
    assert _by_key(_current(base_study_id))[LOSS["key"]].role == "anchor"


def test_a_revision_that_splits_a_relabelled_set_reports_the_relabel(session):
    original = fx.parse([LOSS, PEAK])
    base_study_id = ingest_upload({"coordinate_parse": original})["base_study_id"]
    revision = _relabel_peak(base_study_id, original)
    left = fx.table_analysis("tbl3", [0], "Peak > Baseline (left)", [fx.point((8, 8, 8))])
    right = fx.table_analysis("tbl3", [1], "Peak > Baseline (right)", [fx.point((9, 9, 9))])
    split = fx.parse(
        [LOSS, left, right],
        revision_of=revision["parse_id"],
        verdicts=[
            fx.verdict(LOSS["key"], "accept", [LOSS["key"]]),
            fx.verdict(PEAK["key"], "split", [left["key"], right["key"]]),
        ],
    )

    summary = ingest_upload({"coordinate_parse": split})

    assert summary["skeleton"]["relabels_dropped"] == [
        {
            "key": PEAK["key"],
            "role": "anchor",
            "relabelled_by": revision["parse_id"],
            "reason": RELABEL_REVISED_REASON,
        }
    ]
