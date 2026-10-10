"""The study_schema ingester: a parse, a parse with a record, a record, a revision."""

import pytest
import sqlalchemy as sa

from neurostore.exceptions.base import NeuroStoreException
from neurostore.ingest.study_schema import (
    ALIAS_CELLS_CHANGED,
    HISTORY_SOURCE,
    STUDY_SOURCE,
    _point_rows,
    ingest_upload,
)
from neurostore.models import (
    Analysis,
    FieldClaim,
    FieldVote,
    PipelineAnalysisResult,
    PipelineConfig,
    Study,
    StudyEntity,
    StudyEntityAlias,
    User,
)
from neurostore.tests import study_schema_fixtures as fx

# Table 1 of one paper: rows 0-3 are one contrast with both signs, rows 4-7 two more.
GAIN = fx.table_analysis(
    "tbl1",
    [0, 1, 2, 3],
    "Gain > Neutral",
    [
        fx.point((10, 20, 30), space="other"),
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


def _claims(base_study_id, key):
    entity = StudyEntity.query.filter_by(
        base_study_id=base_study_id, entity_class="Analysis", natural_key=key
    ).one()
    return FieldClaim.query.filter_by(entity_id=entity.id).all()


def _revision():
    """Split Gain by sign; merge Loss and Risk."""
    positive = fx.table_analysis(
        "tbl1",
        [0, 1],
        "Gain > Neutral",
        GAIN["points"][:2],
        split={
            "group": "gain",
            "direction": "positive",
            "rule": "sign_of_directional_statistic",
            "primary": True,
        },
    )
    negative = fx.table_analysis(
        "tbl1",
        [2, 3],
        "Neutral > Gain",
        GAIN["points"][2:],
        split={
            "group": "gain",
            "direction": "negative",
            "rule": "sign_of_directional_statistic",
            "primary": False,
        },
    )
    merged = fx.table_analysis(
        "tbl1", [4, 5, 6, 7], "Loss or Risk > Neutral", LOSS["points"] + RISK["points"]
    )
    revision = fx.parse(
        [positive, negative, merged, SEED],
        revision_of=ORIGINAL["parse_id"],
        verdicts=[
            fx.verdict(GAIN["key"], "split", [positive["key"], negative["key"]]),
            fx.verdict(LOSS["key"], "merge", [merged["key"]]),
            fx.verdict(RISK["key"], "merge", [merged["key"]]),
            fx.verdict(SEED["key"], "accept", [SEED["key"]]),
        ],
    )
    return revision, positive, negative, merged


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
    entity = StudyEntity.query.filter_by(natural_key=GAIN["key"]).one()
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
        StudyEntity.natural_key.in_(["tbl1#2", "text#3"])
    ).count()
    # The study's own claims still land.
    assert StudyEntity.query.filter_by(entity_class="Study").count() == 1


def test_revision_versions_analyses_and_carries_claims(session):
    voter = User(name="voter", external_id="voter-id")
    session.add(voter)
    session.flush()
    first = ingest_upload(
        {"coordinate_parse": ORIGINAL, "record": _record(GAIN, LOSS, RISK)}
    )
    base_study_id = first["base_study_id"]
    gain_claim = next(c for c in _claims(base_study_id, GAIN["key"]) if c.field_path == "name")
    session.add(FieldVote(claim_id=gain_claim.id, user_id="voter-id", verdict="up"))
    session.flush()
    old_ids = {a.source_id: a.id for a in _current(base_study_id).analyses}

    revision, positive, negative, merged = _revision()
    summary = ingest_upload({"coordinate_parse": revision})

    assert summary["kind"] == "revision"
    current = _current(base_study_id)
    assert current.source_id == revision["parse_id"]
    assert {a.source_id for a in current.analyses} == {
        positive["key"],
        negative["key"],
        merged["key"],
    }
    by_key = {a.source_id: a for a in current.analyses}
    assert by_key[negative["key"]].metadata_["split"]["direction"] == "negative"
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
    for half in (positive, negative):
        copies = _claims(base_study_id, half["key"])
        assert {c.carried_from for c in copies} == gain_claims
        voted = next(c for c in copies if c.carried_from == gain_claim.id)
        assert [v.user_id for v in FieldVote.query.filter_by(claim_id=voted.id)] == [
            "voter-id"
        ]
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
    assert summary["carried"]["votes"] == 2
    entity = StudyEntity.query.filter_by(natural_key=positive["key"]).one()
    assert entity.analysis_id == by_key[positive["key"]].id

    # Re-uploading the revision copies nothing twice; its record resolves to the revision.
    again = ingest_upload(
        {"coordinate_parse": revision, "record": _record(positive, negative, merged)}
    )
    assert again["carried"] == {"claims": 0, "votes": 0}
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


def test_reparse_reading_other_cells_aliases_the_key(session):
    base_study_id = ingest_upload(
        {"coordinate_parse": ORIGINAL, "record": _record(GAIN, LOSS, RISK)}
    )["base_study_id"]
    wider = fx.table_analysis("tbl1", [4, 5, 8], "Loss > Neutral", LOSS["points"])
    reparse = fx.parse([GAIN, wider, RISK, SEED])

    summary = ingest_upload({"coordinate_parse": reparse})

    assert summary["skeleton"]["aliased"] == [{"from": LOSS["key"], "to": wider["key"]}]
    alias = StudyEntityAlias.query.filter_by(natural_key=LOSS["key"]).one()
    assert alias.reason == ALIAS_CELLS_CHANGED
    entity = StudyEntity.query.get(alias.entity_id)
    assert entity.natural_key == wider["key"]
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


def test_merge_keeps_votes_on_a_claim_that_collapses(session):
    for name in ("first", "second"):
        session.add(User(name=name, external_id=f"{name}-id"))
    session.flush()
    first = ingest_upload(
        {"coordinate_parse": ORIGINAL, "record": _defined((LOSS, "same"), (RISK, "same"))}
    )
    base_study_id = first["base_study_id"]

    def definition(key):
        return next(c for c in _claims(base_study_id, key) if c.field_path == "definition")

    risk = definition(RISK["key"])
    session.add(FieldVote(claim_id=risk.id, user_id="first-id", verdict="down"))
    session.flush()
    revision, _, _, merged = _revision()
    ingest_upload({"coordinate_parse": revision})

    # Risk's definition collapses into Loss's copy, and brings its vote and runs with it.
    target = definition(merged["key"])
    assert target.carried_from == definition(LOSS["key"]).id
    assert [(v.user_id, v.verdict) for v in FieldVote.query.filter_by(claim_id=target.id)] == [
        ("first-id", "down")
    ]

    # A vote cast after the carry reaches the copy on re-upload, once.
    session.add(FieldVote(claim_id=risk.id, user_id="second-id", verdict="up"))
    session.flush()
    for _ in range(2):
        ingest_upload({"coordinate_parse": revision})
    assert sorted(v.user_id for v in FieldVote.query.filter_by(claim_id=target.id)) == [
        "first-id",
        "second-id",
    ]


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
    revision, positive, negative, _ = _revision()
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
        [positive["key"], negative["key"]]
    )
    row = PipelineAnalysisResult.query.filter_by(source_table_analysis=GAIN["key"]).one()
    assert row.status == "FAILURE"
    gain_claims = {c.id for c in _claims(base_study_id, GAIN["key"])}
    for half in (positive, negative):
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


def test_negative_half_takes_the_conditions_negated(session):
    revision, positive, negative, merged = _revision()
    ingest_upload({"coordinate_parse": ORIGINAL})
    summary = ingest_upload(
        {
            "coordinate_parse": revision,
            "record": fx.record([_contrast(positive, gain="positive", neutral="negative")]),
        }
    )
    by_key = {a.source_id: a for a in _current(summary["base_study_id"]).analyses}
    assert _weights(by_key[positive["key"]]) == {"gain": 1.0, "neutral": -1.0}
    # Sign lives on the condition: the inverse contrast is the same conditions, negated.
    assert _weights(by_key[negative["key"]]) == {"gain": -1.0, "neutral": 1.0}
    assert _weights(by_key[merged["key"]]) == {}
    assert by_key[negative["key"]].metadata_["split"]["direction"] == "negative"


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
