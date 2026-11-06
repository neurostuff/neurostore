"""Resolving extraction records into analysis_features rows, at ingest."""

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext

from neurostore.database import db
from neurostore.ingest.analysis_features import backfill_analysis_features, record_features
from neurostore.ingest.study_schema import STUDY_SOURCE, ingest_upload
from neurostore.models import AnalysisFeature, BaseStudy, Study
from neurostore.services.base_study_metadata_enrichment import merge_base_study
from neurostore.study_schema_tools import schema_errors
from neurostore.tests import analysis_fixtures as af
from neurostore.tests import study_schema_fixtures as fx


def _by_name(name):
    document = af.record(name)
    features = record_features(document)
    names = {
        a["source_table_analysis"]["value"]: a["name"]["value"] for a in document["analyses"]
    }
    return {names[key]: row for key, row in features.items()}


def test_the_fixture_records_are_valid_extraction_records():
    for name in af.RECORDS:
        assert [e.message for e in schema_errors("extraction-record", af.record(name))] == []


def test_groups_resolve_to_diagnoses_species_and_health():
    rows = _by_name("ya2RC6UYbibC")
    versus_controls = rows["schizophrenia > control"]
    versus_bipolar = rows["schizophrenia > BDp"]

    assert versus_controls["diagnosis_ids"] == ["MONDO:0005090"]
    assert versus_controls["has_patients"] is True and versus_controls["has_healthy"] is True
    # The controls' "Healthy controls" is read as an absence, so it is not diagnosis text.
    assert versus_controls["diagnosis_text"] == "schizophrenia"
    assert versus_bipolar["diagnosis_ids"] == ["MONDO:0005090", "MONDO:0004985"]
    assert versus_bipolar["diagnosis_labels"] == ["schizophrenia", "bipolar disorder"]
    assert versus_bipolar["has_healthy"] is False
    assert versus_bipolar["species"] == ["human"]
    assert versus_bipolar["n"] == 22


def test_an_unmapped_condition_is_text_without_ids():
    rows = _by_name("6SKTGteXbbBs")
    row = rows["Immediate–delayed"]

    assert row["diagnosis_ids"] is None
    assert row["diagnosis_text"] == "nicotine dependence"
    assert row["display"]["diagnosis"] == ["Nicotine dependence"]


def test_measure_task_and_contrast_resolve_through_their_ids():
    row = _by_name("ya2RC6UYbibC")["schizophrenia > control"]

    assert (row["measure_type"], row["measure_family"]) == ("bold_response", "functional_bold")
    assert row["task_ids"] == ["hedtsk_n_back", "working_memory_span"]
    assert "n-back task" in row["task_text"] and "working memory span" in row["task_text"]
    # Cells name their level; the level's conditions add their own names.
    assert row["contrast_positive"] == "schizophrenia | 2-back"
    assert row["contrast_negative"] == "control | 0-back"
    assert row["contrast_set_ids"] == ["working_memory_span|load:2|vs:load:0", "working_memory#1"]
    assert row["contrast_set_text"] == "2-back > 0-back"
    assert row["display"]["contrast_set_orientation"] == "reversed"


def test_design_and_scope_come_from_the_record():
    row = _by_name("6SKTGteXbbBs")["Group difference: immediate–delayed"]

    assert row["spatial_scope"] == "whole_brain"
    assert row["effect_kind"] == "interaction"
    assert row["assignment_structure"] == "observational_cohorts"
    assert row["allocation"] == "not_applicable"
    assert row["blinding"] is None
    assert row["is_meta_analysis"] is False
    assert row["group_count"] == 2


def test_silence_is_null():
    document = af.record("6SKTGteXbbBs")
    for group in document["groups"]:
        group["species"] = {
            "extraction_status": "not_reported",
            "evidence": {"status": "not_found"},
        }
    document["tasks"] = []
    row = next(iter(record_features(document).values()))

    assert row["species"] is None
    assert row["task_text"] is None and row["task_ids"] is None


def test_an_upload_writes_one_row_per_current_analysis(session):
    summary = af.upload("ya2RC6UYbibC")

    rows = AnalysisFeature.query.filter_by(base_study_id=summary["base_study_id"]).all()
    assert len(rows) == 2
    assert {row.study_id for row in rows} == {summary["study_id"]}
    assert {row.display_row.display["name"] for row in rows} == {
        "schizophrenia > control",
        "schizophrenia > BDp",
    }


def test_a_new_parse_version_drops_the_rows_of_the_analyses_it_moves_to_history(session):
    body = af.upload_body("6SKTGteXbbBs")
    summary = ingest_upload(body)
    kept, dropped = body["coordinate_parse"]["analyses"]
    names = {
        a["source_table_analysis"]["value"]: a["name"]["value"] for a in body["record"]["analyses"]
    }

    ingest_upload({"coordinate_parse": fx.parse([kept], pmid=af.PMIDS["6SKTGteXbbBs"])})

    rows = AnalysisFeature.query.filter_by(base_study_id=summary["base_study_id"]).all()
    assert [row.display_row.display["name"] for row in rows] == [names[kept["key"]]]
    assert names[dropped["key"]] != names[kept["key"]]


def _dated(document, model, date):
    document["extraction_metadata"].update(extractor_model=model, extraction_date=date)
    return document


def test_rows_follow_the_latest_record_by_its_extraction_date(session):
    def upload(model, date, scope):
        document = _dated(af.record("6SKTGteXbbBs"), model, date)
        for analysis in document["analyses"]:
            analysis["spatial_scope"]["value"] = scope
        return af.upload("6SKTGteXbbBs", document)

    def scopes():
        return {row.spatial_scope for row in AnalysisFeature.query}

    base_study_id = upload("model-a", "2026-01-01T00:00:00Z", "whole_brain")["base_study_id"]

    upload("model-b", "2025-01-01T00:00:00Z", "roi")
    assert scopes() == {"whole_brain"}
    upload("model-c", "2027-01-01T00:00:00Z", "searchlight")
    assert scopes() == {"searchlight"}
    assert AnalysisFeature.query.filter_by(base_study_id=base_study_id).count() == 2


def _split_pair():
    original = fx.table_analysis(
        "tbl1",
        [0, 1],
        "Gain > Neutral",
        [fx.point((1, 2, 3))],
        split={"half": "original", "rule": "sign_of_directional_statistic"},
    )
    inverse = fx.table_analysis(
        "tbl1",
        [2, 3],
        "Neutral > Gain",
        [fx.point((-1, 2, 3))],
        split={
            "half": "inverse",
            "original_analysis": original["key"],
            "rule": "sign_of_directional_statistic",
        },
    )
    return original, inverse


def _upload_split(entries):
    original, inverse = _split_pair()
    document = af.record("ya2RC6UYbibC")
    keys = {"original": original["key"], "inverse": inverse["key"]}
    document["analyses"] = [
        {**document["analyses"][0], "source_table_analysis": fx.extracted(keys[half])}
        for half in entries
    ]
    if len(entries) == 2:
        document["analyses"][1] = {
            **document["analyses"][1],
            "local_id": "a_inverse",
            "name": fx.extracted("control > schizophrenia, as extracted"),
        }
    summary = ingest_upload(
        {"coordinate_parse": fx.parse([original, inverse], pmid="20000009"), "record": document}
    )
    return {
        row.analysis_id: row
        for row in AnalysisFeature.query.filter_by(base_study_id=summary["base_study_id"])
    }


def test_the_inverse_half_of_a_sign_split_takes_its_original_reversed(session):
    rows = sorted(
        _upload_split(["original"]).values(), key=lambda r: r.display_row.display["contrast"]
    )

    assert [r.display_row.display["contrast"] for r in rows] == [
        "control + 0-back > schizophrenia + 2-back",
        "schizophrenia + 2-back > control + 0-back",
    ]
    inverse, original = rows
    assert (inverse.contrast_positive, inverse.contrast_negative) == (
        original.contrast_negative,
        original.contrast_positive,
    )
    assert original.display_row.display["contrast_set_orientation"] == "reversed"
    assert inverse.display_row.display["contrast_set_orientation"] == "same"


def test_an_inverse_half_the_record_describes_keeps_its_own_entry(session):
    rows = _upload_split(["original", "inverse"]).values()

    assert sorted(r.display_row.display["name"] for r in rows) == [
        "control > schizophrenia, as extracted",
        "schizophrenia > control",
    ]


def test_a_merge_moves_the_rows_to_the_keeper(session):
    old = af.upload("6SKTGteXbbBs")["base_study_id"]
    moved = {row.analysis_id for row in AnalysisFeature.query.filter_by(base_study_id=old)}
    keeper = BaseStudy(name="the same paper, found again")
    db.session.add(keeper)
    db.session.flush()

    merge_base_study(keeper, db.session.get(BaseStudy, old))
    db.session.flush()

    assert AnalysisFeature.query.filter_by(base_study_id=old).count() == 0
    current = Study.query.filter_by(base_study_id=keeper.id, source=STUDY_SOURCE).one()
    rows = AnalysisFeature.query.filter_by(base_study_id=keeper.id).all()
    assert {row.analysis_id for row in rows} == moved
    assert {row.study_id for row in rows} == {current.id}


def test_the_backfill_rewrites_every_paper_from_its_stored_record(session):
    for name in af.RECORDS:
        af.upload(name)
    written = {row.analysis_id: row.display_row.display for row in AnalysisFeature.query}
    AnalysisFeature.query.delete()
    db.session.commit()

    summary = backfill_analysis_features(batch_size=2)

    assert summary == {"papers": 3, "analyses": 5}
    assert {row.analysis_id: row.display_row.display for row in AnalysisFeature.query} == written


def test_the_migrated_table_matches_the_model(db):
    def in_scope(obj, name, type_, reflected, compare_to):
        if type_ == "table":
            return name == "analysis_features"
        return obj.table.name == "analysis_features"

    with db.engine.connect() as conn:
        context = MigrationContext.configure(
            conn,
            opts={
                "compare_type": True,
                "compare_server_default": True,
                "include_object": in_scope,
            },
        )
        assert compare_metadata(context, db.metadata) == []
