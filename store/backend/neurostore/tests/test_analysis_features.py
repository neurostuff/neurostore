"""Resolving extraction records into analysis_features rows, at ingest."""

import pytest
import sqlalchemy as sa
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext

from neurostore import service_migrations
from neurostore.database import db
from neurostore.ingest.analysis_features import backfill_analysis_features, record_features
from neurostore.ingest.study_schema import STUDY_SOURCE, ingest_upload
from neurostore.models import AnalysisFeature, AnalysisTerm, BaseStudy, Study
from neurostore.models.data import NORMALIZED_FEATURES
from neurostore.services.base_study_metadata_enrichment import merge_base_study
from neurostore.study_schema_tools import schema_errors
from neurostore.tests import analysis_fixtures as af
from neurostore.tests import study_schema_fixtures as fx


FEATURE_TABLES = (
    "analysis_features",
    "analysis_terms",
    "concept_releases",
    "concepts",
    "concept_ancestors",
)
#: The head before the normalized-search migration.
PUBLICATION_REVISION = "c3e5a7b9d1f2"
#: The head before the contrast-sides migration.
PUBLIC_QUERY_REVISION = "e5b7d9f1a3c4"
#: The head before the record-details migration.
PUBLIC_QUERY_DATA_SOURCES_REVISION = "b8d0f2a4c6e9"


def _by_name(name):
    document = af.record(name)
    features = record_features(document)
    names = {
        a["source_table_analysis"]["value"]: a["name"]["value"] for a in document["analyses"]
    }
    return {names[key]: row for key, row in features.items()}


def test_the_fixture_records_are_valid_extraction_records():
    for name in [*af.RECORDS, *af.NS_POND_RECORDS]:
        assert [e.message for e in schema_errors("extraction-record", af.record(name))] == []


def test_groups_resolve_to_medical_conditions_species_and_health():
    rows = _by_name("ya2RC6UYbibC")
    versus_controls = rows["schizophrenia > control"]
    versus_bipolar = rows["schizophrenia > BDp"]

    assert versus_controls["medical_condition_ids"] == ["MONDO:0005090"]
    assert versus_controls["has_patients"] is True and versus_controls["has_healthy"] is True
    # The healthy controls' condition is silent.
    assert versus_controls["medical_condition_text"] == "schizophrenia"
    assert versus_bipolar["medical_condition_ids"] == ["MONDO:0005090", "MONDO:0004985"]
    assert versus_bipolar["medical_condition_text"] == "schizophrenia | bipolar disorder | " + (
        "bipolar disorder with psychotic features"
    )
    assert versus_bipolar["has_healthy"] is False
    assert versus_bipolar["species"] == ["human"]
    assert versus_bipolar["n"] == 22


def test_a_healthy_group_or_an_absence_is_silent_not_unmapped():
    document = af.record("ya2RC6UYbibC")
    controls = next(g for g in document["groups"] if g["is_healthy"]["value"] is True)
    controls["medical_condition"]["normalized"] = []
    healthy_only = af.record("ya2RC6UYbibC")
    for analysis in healthy_only["analyses"]:
        analysis["groups"] = [
            link
            for link in analysis["groups"]
            if link["group"] == controls["local_id"]
        ]
    rows = {
        row["display"]["name"]: row for row in record_features(document).values()
    }
    alone = next(iter(record_features(healthy_only).values()))

    # Without its absence entry, the controls' "Healthy controls" is still not wording.
    assert rows["schizophrenia > control"]["medical_condition_text"] == "schizophrenia"
    assert alone["medical_condition_unmapped"] is None
    assert alone["medical_condition_text"] is None


def test_an_unmapped_condition_is_text_without_ids():
    rows = _by_name("6SKTGteXbbBs")
    row = rows["Immediate–delayed"]

    assert row["medical_condition_ids"] is None
    assert row["medical_condition_text"] == "nicotine dependence"
    assert row["display"]["medical_condition"] == ["Nicotine dependence"]


def test_measure_task_and_contrast_resolve_through_their_ids():
    row = _by_name("ya2RC6UYbibC")["schizophrenia > control"]

    assert (row["measure_type"], row["measure_family"]) == ("bold_response", "functional_bold")
    assert row["task_ids"] == ["hedtsk_n_back"]
    assert row["task_family_ids"] == ["working_memory_span"]
    assert "n-back task" in row["task_text"] and "working memory span" in row["task_text"]
    # Cells name their level; the level's conditions add their own names.
    assert row["contrast_positive"] == "schizophrenia | 2-back"
    assert row["contrast_negative"] == "control | 0-back"
    assert row["contrast_key_ids"] == ["working_memory_span|load:2|vs:load:0"]
    # The analysis states the set's contrast the other way round.
    assert row["contrast_set_ids"] == ["working_memory#1:reversed"]
    assert row["display"]["contrast_set"] == ["working_memory#1:reversed"]


def test_ancestors_add_a_task_or_contrast_s_family():
    row = _by_name("ya2RC6UYbibC")["schizophrenia > control"]

    assert row["task_ancestor_ids"] == ["hedtsk_n_back", "working_memory_span"]
    assert row["contrast_key_ancestor_ids"] == [
        "working_memory_span|load:2|vs:load:0",
        "working_memory_span",
    ]
    assert row["contrast_set_ancestor_ids"] == ["working_memory#1:reversed", "working_memory"]


def test_a_key_whose_sign_is_negative_is_the_reversed_term():
    document = af.record("ya2RC6UYbibC")
    for analysis in document["analyses"]:
        for entry in analysis["name"]["normalized"]:
            if entry["vocabulary"] == "astra contrast key":
                entry["method"] = "reversed; sign -1"
    row = next(iter(record_features(document).values()))

    assert row["contrast_key_ids"] == ["working_memory_span|load:2|vs:load:0:reversed"]


def test_roles_qualify_the_medical_condition_ids():
    document = af.with_roles(
        af.record("ya2RC6UYbibC"), {"MONDO:0005090": "primary", "MONDO:0004985": "comorbid"}
    )
    rows = {row["display"]["name"]: row for row in record_features(document).values()}

    assert rows["schizophrenia > BDp"]["medical_condition_role_ids"] == [
        "primary|MONDO:0005090",
        "comorbid|MONDO:0004985",
    ]
    assert rows["schizophrenia > BDp"]["medical_condition_ids"] == [
        "MONDO:0005090",
        "MONDO:0004985",
    ]


def test_a_set_takes_the_orientation_of_its_own_fit():
    document = af.record("ya2RC6UYbibC")
    name = document["analyses"][0]["name"]
    name["normalized"] += [
        {
            "vocabulary": "ns-pond contrast set fit-111111111111",
            "status": "mapped",
            "value": "working_memory#7",
            "label": "2-back > 0-back",
            "mapping_tool": "fixture",
        },
        {
            "vocabulary": "ns-pond contrast set orientation fit-111111111111",
            "status": "mapped",
            "value": "same",
            "mapping_tool": "fixture",
        },
    ]
    row = record_features(document)[af.keys_of(document)[0]]

    assert row["contrast_set_ids"] == ["working_memory#1:reversed", "working_memory#7"]


def test_a_role_given_to_one_head_stays_with_that_head():
    document = af.record("ya2RC6UYbibC")
    group = next(
        g for g in document["groups"] if g["medical_condition"]["value"] == ["schizophrenia"]
    )
    group["medical_condition"]["normalized"] = [
        {"vocabulary": "MONDO", "status": "mapped", "value": "MONDO:1", "item": 0,
         "head": "schizophrenia", "mapping_tool": "fixture"},
        {"vocabulary": "MONDO", "status": "mapped", "value": "MONDO:2", "item": 0,
         "head": "depression", "mapping_tool": "fixture"},
        {"vocabulary": "astra medical role", "status": "mapped", "value": "primary",
         "item": 0, "head": "schizophrenia", "mapping_tool": "fixture"},
        {"vocabulary": "astra medical role", "status": "mapped", "value": "comorbid",
         "item": 0, "mapping_tool": "fixture"},
    ]
    rows = {row["display"]["name"]: row for row in record_features(document).values()}

    assert rows["schizophrenia > control"]["medical_condition_role_ids"] == [
        "primary|MONDO:1",
        "comorbid|MONDO:2",
    ]


def test_an_item_is_silent_only_when_every_reading_of_it_is_an_absence():
    document = af.record("6SKTGteXbbBs")
    smokers = next(g for g in document["groups"] if g["is_healthy"]["value"] is False)
    smokers["medical_condition"]["normalized"] = [
        {"vocabulary": "MONDO", "status": "unmapped", "item": 0, "head": "nicotine",
         "mapping_tool": "fixture"},
        {"vocabulary": "MONDO", "status": "absent", "item": 0, "head": "no history",
         "mapping_tool": "fixture"},
    ]
    task = document["tasks"][0]
    task["name"]["normalized"] = [
        {"vocabulary": "astra canonical task", "status": "absent", "mapping_tool": "fixture"}
    ]
    row = record_features(document)[af.keys_of(document)[0]]

    assert row["medical_condition_unmapped"] is True
    assert row["medical_condition_text"] == "nicotine dependence"
    # A task name read only as an absence is silent, not unmapped.
    assert row["task_unmapped"] is None


def test_a_contrast_key_s_family_is_what_comes_before_its_first_bar():
    document = af.record("ya2RC6UYbibC")
    for analysis in document["analyses"]:
        for entry in analysis["name"]["normalized"]:
            if entry["vocabulary"] == "astra contrast key":
                entry["value"] = "working_memory_span|load:#2|vs:load:0"
    row = record_features(document)[af.keys_of(document)[0]]

    assert row["contrast_key_ancestor_ids"][-1] == "working_memory_span"


def test_a_record_that_does_not_name_a_term_s_parent_keeps_the_known_one(session):
    af.upload("ya2RC6UYbibC")
    document = af.record("6SKTGteXbbBs")
    document["tasks"][0]["name"]["normalized"] = [
        {"vocabulary": "astra canonical task", "status": "mapped", "value": "hedtsk_n_back",
         "label": "N-Back Task", "mapping_tool": "fixture"}
    ]
    af.upload("6SKTGteXbbBs", document)

    term = AnalysisTerm.query.filter_by(field="task", term="hedtsk_n_back").one()
    assert term.parent == "working_memory_span"


def _sides(row, *columns):
    """``row``'s ``contrast_<side>_<column>`` values, as {column: (positive, negative)}."""
    return {c: (row[f"contrast_positive_{c}"], row[f"contrast_negative_{c}"]) for c in columns}


def test_each_side_has_its_cells_groups_health_and_medical_conditions():
    rows = _by_name("ya2RC6UYbibC")
    columns = ("has_patients", "has_healthy", "medical_condition_ids", "medical_condition_text")

    assert _sides(rows["schizophrenia > control"], *columns) == {
        "has_patients": (True, False),
        "has_healthy": (False, True),
        # The controls' condition is silent.
        "medical_condition_ids": (["MONDO:0005090"], None),
        "medical_condition_text": ("schizophrenia", None),
    }
    assert _sides(rows["schizophrenia > BDp"], "has_healthy", "medical_condition_ids") == {
        "has_healthy": (False, False),
        "medical_condition_ids": (["MONDO:0005090"], ["MONDO:0004985"]),
    }
    assert _sides(rows["schizophrenia > control"], "medical_condition_unmapped") == {
        "medical_condition_unmapped": (False, None)
    }


def test_a_side_whose_levels_carry_no_groups_is_silent_on_them():
    rows = _by_name("y6qgUVcjRYtn")
    over_time = rows["Time differences between follow-up and baseline"]

    # The analysis ran on both cohorts; its sides are occasions, not cohorts.
    assert (over_time["has_patients"], over_time["has_healthy"]) == (True, True)
    assert _sides(over_time, "has_patients", "medical_condition_ids", "timepoints") == {
        "has_patients": (None, None),
        "medical_condition_ids": (None, None),
        "timepoints": (["post_intervention"], ["pre_intervention"]),
    }


def test_each_side_has_its_levels_arms_and_timepoints():
    patients = _by_name("y6qgUVcjRYtn")["Group differences between MDD and HCs"]
    rows = _by_name("myhy8yAbQrAV")

    assert _sides(patients, "has_patients", "has_healthy", "medical_condition_ids") == {
        "has_patients": (True, False),
        "has_healthy": (False, True),
        "medical_condition_ids": (["MONDO:0002009", "ONVOC:0000207"], None),
    }
    assert _sides(patients, "arm_kinds", "timepoints") == {
        "arm_kinds": (["pharmacological"], ["no_intervention"]),
        "timepoints": (None, None),
    }
    # CBT x post x reappraise against waitlist x baseline x react, and the inverse: the
    # cohort term swaps sides, the occasion and condition terms do not.
    assert _sides(rows["Positive FC"], "arm_kinds", "timepoints") == {
        "arm_kinds": (["behavioural_intervention"], ["no_intervention"]),
        "timepoints": (["post_intervention"], ["pre_intervention"]),
    }
    assert _sides(rows["Inverse FC"], "arm_kinds", "timepoints") == {
        "arm_kinds": (["no_intervention"], ["behavioural_intervention"]),
        "timepoints": (["post_intervention"], ["pre_intervention"]),
    }


def test_each_side_has_its_contrast_keys_facets():
    rows = _by_name("ya2RC6UYbibC")
    conduct = _by_name("AhxosLhYA5YG")
    regulation = _by_name("myhy8yAbQrAV")["Positive FC"]

    assert _sides(rows["schizophrenia > control"], "facets") == {
        "facets": (["load:2"], ["load:0"])
    }
    assert _sides(regulation, "facets") == {
        "facets": (["regulation:reappraise"], ["referent:self"])
    }
    # A baseline of kinds is its kinds.
    assert [_sides(row, "facets")["facets"] for row in conduct.values()] == [
        (["concreteness:abstract"], ["control_state"])
    ] * len(conduct)


def test_a_key_s_facets_are_its_atoms_or_its_wording_and_a_reversed_key_swaps_them():
    def sides(*keys):
        document = af.record("ya2RC6UYbibC")
        for analysis in document["analyses"]:
            name = analysis["name"]
            name["normalized"] = [
                e for e in name["normalized"] if e["vocabulary"] != "astra contrast key"
            ] + [
                {"vocabulary": "astra contrast key", "status": "mapped", "value": key,
                 "method": method, "mapping_tool": "fixture"}
                for key, method in keys
            ]
        return _sides(next(iter(record_features(document).values())), "facets")["facets"]

    # Keys as ns-pond wrote them on staging's records.
    assert sides(
        (
            "oddball_and_vigilance|memory_outcome:remembered;stimulus:music,valence:positive"
            "|vs:memory_outcome:forgotten;stimulus:music",
            "neither; sign +1",
        )
    ) == (
        ["memory_outcome:remembered", "stimulus:music", "valence:positive"],
        ["memory_outcome:forgotten", "stimulus:music"],
    )
    assert sides(("motor_performance|~lip licking|fixation", "target>baseline; sign +1")) == (
        ["~lip licking"],
        ["fixation"],
    )
    assert sides(("motor_performance|~prediction|-", "one_sided; sign +1")) == (
        ["~prediction"],
        None,
    )
    assert sides(
        ("perceptual_judgment|engagement:active|vs:engagement:passive", "reversed; sign -1")
    ) == (["engagement:passive"], ["engagement:active"])
    assert sides(
        ("language|stimulus:words|fixation+rest", "target>baseline; sign +1"),
        ("language|~reading|?", "target>baseline; sign +1"),
    ) == (["stimulus:words", "~reading"], ["fixation", "rest"])


def test_rows_list_their_terms_with_labels_and_parents():
    row = _by_name("ya2RC6UYbibC")["schizophrenia > control"]

    assert sorted(row["terms"]) == [
        ("contrast_key", "working_memory_span|load:2|vs:load:0", None, "working_memory_span"),
        ("contrast_set", "working_memory#1:reversed", "0-back > 2-back", "working_memory"),
        ("medical_condition", "MONDO:0005090", "schizophrenia", None),
        ("task", "hedtsk_n_back", "N-Back Task", "working_memory_span"),
        ("task_family", "working_memory_span", "working_memory_span", None),
    ]
    assert row["name_text"] == "schizophrenia > control"


def test_unmapped_is_a_stated_feature_nothing_in_which_mapped():
    mapped = _by_name("ya2RC6UYbibC")["schizophrenia > control"]
    unmapped = _by_name("6SKTGteXbbBs")["Immediate–delayed"]
    no_set = next(iter(record_features(af.unmap_names(af.record("6SKTGteXbbBs"))).values()))

    assert mapped["medical_condition_unmapped"] is False
    assert unmapped["medical_condition_unmapped"] is True
    assert unmapped["task_unmapped"] is False
    assert unmapped["contrast_key_unmapped"] is False
    # No set normalizer placed or failed to place it: silent.
    assert unmapped["contrast_set_unmapped"] is None
    assert no_set["contrast_key_unmapped"] is True and no_set["contrast_key_ids"] is None


def test_rows_name_the_normalizers_their_ids_came_from():
    row = _by_name("ya2RC6UYbibC")["schizophrenia > control"]

    assert row["mapping_tools"] == [
        "fixture: hand-mapped",
        "fixture: ns-pond build rows (astra_records.json)",
    ]


def test_design_and_scope_come_from_the_record():
    row = _by_name("6SKTGteXbbBs")["Group difference: immediate–delayed"]

    assert row["spatial_scope"] == "whole_brain"
    assert row["effect_kind"] == "interaction"
    assert row["assignment_structure"] == "observational_cohorts"
    assert row["allocation"] == "not_applicable"
    assert row["blinding"] is None
    assert row["is_meta_analysis"] is False
    assert row["group_count"] == 2


DEPRESSION, SOCIAL_ANXIETY = "y6qgUVcjRYtn", "myhy8yAbQrAV"


def test_the_sample_has_ages_in_years_sex_handedness_counts_and_diagnosis():
    patients = _by_name(DEPRESSION)["Group differences between MDD and HCs"]
    treated = _by_name(SOCIAL_ANXIETY)["Positive FC"]
    document = af.record(DEPRESSION)
    document["groups"][0]["age_unit"]["value"] = "months"
    in_months = record_features(document)

    assert patients["age_means"] == [27.09, 26.41]
    assert patients["age_sds"] == [4.73, 3.94]
    # 35 and 39 of 46 and 58.
    assert (patients["female_count"], patients["male_count"]) == (74, 30)
    assert patients["female_percent"] == pytest.approx(100 * 74 / 104)
    assert (patients["enrolled_count"], patients["excluded_count"]) == (124, 20)
    assert patients["diagnostic_instrument_text"].startswith("mini international")
    assert patients["display"]["diagnostic_system"] == ["DSM-IV"]
    assert all(
        row["age_means"] == [pytest.approx(27.09 / 12), 26.41] for row in in_months.values()
    )
    assert treated["handedness"] == ["right-handed"]
    assert treated["age_means"] is None and treated["female_percent"] is None


def test_inference_acquisitions_and_preprocessing_are_the_analysis_s_own():
    treated = _by_name(SOCIAL_ANXIETY)["Positive FC"]
    patients = _by_name(DEPRESSION)["Group differences between MDD and HCs"]

    assert (treated["height_threshold"], treated["cluster_extent"]) == (0.005, 5)
    assert treated["correction_scope"] == "whole_brain"
    assert patients["correction_text"].startswith("bayesian model comparison")
    assert treated["tfce"] is None
    # The analysis's fMRI acquisition, not the structural scan beside it.
    assert treated["repetition_times"] == [1.5]
    assert treated["voxel_sizes"] == [4.5]
    assert treated["modalities"] == ["fmri"]
    assert patients["display"]["scanner"] == ["Siemens Prisma"]
    assert treated["smoothing_fwhms"] == [4.0]
    assert treated["preprocessing_software_text"] == "afni"


def test_a_model_has_the_models_it_takes_inputs_from_nearest_first():
    treated = _by_name(SOCIAL_ANXIETY)["Positive FC"]

    # The group t-test names no software or HRF; its first level does.
    assert treated["model_family_text"] == "between-group t-test | glm"
    assert treated["model_software_text"] == "3ddeconvolve"
    assert treated["hrf_model_text"].startswith("gamma variate")
    assert treated["model_term_types"] == ["categorical", "continuous"]
    assert treated["statistic_family_text"] == "t"


def test_connectivity_regions_coordinate_sets_and_task_details():
    treated = _by_name(SOCIAL_ANXIETY)["Positive FC"]
    patients = _by_name(DEPRESSION)["Group differences between MDD and HCs"]

    assert (treated["connectivity_method"], treated["seed_region_text"]) == (
        "seed_based",
        "dmpfc",
    )
    assert patients["display"]["regions"] == ["DMN", "SN", "DAN"]
    assert patients["region_atlas_text"] == "shirer et al., 2012 network templates"
    assert patients["region_types"] == ["network"]
    # Coordinate sets that name the analysis; the depression paper's anchors name none.
    assert (treated["coordinate_roles"], treated["result_kinds"]) == (
        ["result"],
        ["connectivity"],
    )
    assert patients["coordinate_roles"] is None
    assert treated["response_modalities"] == ["covert_response"]
    assert treated["design_types"] == ["event_related"]
    assert patients["stimulus_text"] is None
    assert patients["instructions_text"].startswith("lie still")


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
    assert row["task_unmapped"] is None


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
    assert original.contrast_set_ids == ["working_memory#1:reversed"]
    assert inverse.contrast_set_ids == ["working_memory#1"]
    assert (inverse.contrast_positive_has_healthy, inverse.contrast_negative_has_patients) == (
        True,
        True,
    )
    assert inverse.contrast_positive_medical_condition_ids is None
    assert inverse.contrast_negative_medical_condition_ids == ["MONDO:0005090"]
    assert (inverse.contrast_positive_facets, inverse.contrast_negative_facets) == (
        ["load:0"],
        ["load:2"],
    )
    assert inverse.contrast_key_ids == ["working_memory_span|load:2|vs:load:0:reversed"]
    assert inverse.contrast_key_ancestor_ids[-1] == "working_memory_span"
    labels = {(t.term, t.label) for t in AnalysisTerm.query.filter_by(field="contrast_set")}
    assert labels == {
        ("working_memory#1", "2-back > 0-back"),
        ("working_memory#1:reversed", "0-back > 2-back"),
    }


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


def test_the_contrast_sides_migration_adds_the_side_columns_and_its_downgrade_drops_them(
    session,
):
    af.upload("ya2RC6UYbibC")
    session.commit()
    session.remove()

    def side_columns():
        return {
            c["name"]
            for c in sa.inspect(session.bind).get_columns("analysis_features")
            if c["name"].startswith(("contrast_positive_", "contrast_negative_"))
        }

    try:
        service_migrations.downgrade(PUBLIC_QUERY_REVISION)
        assert side_columns() == set()
        service_migrations.upgrade("heads")
        assert len(side_columns()) == 18
        # Rows written before it are silent on the sides until the backfill.
        assert {row.contrast_positive_has_patients for row in AnalysisFeature.query} == {None}
        session.remove()
    finally:
        service_migrations.upgrade("heads")


def test_the_record_details_migration_adds_their_columns_and_its_downgrade_drops_them(
    session,
):
    af.upload(SOCIAL_ANXIETY)
    session.commit()
    session.remove()

    def columns():
        found = {c["name"] for c in sa.inspect(session.bind).get_columns("analysis_features")}
        return found & {"age_means", "height_threshold", "scanner_text", "anchor_kinds"}

    try:
        service_migrations.downgrade(PUBLIC_QUERY_DATA_SOURCES_REVISION)
        assert columns() == set()
        service_migrations.upgrade("heads")
        assert len(columns()) == 4
        # Rows written before it are silent on them until the backfill.
        assert {row.height_threshold for row in AnalysisFeature.query} == {None}
        session.remove()
    finally:
        service_migrations.upgrade("heads")


def test_the_migrated_table_matches_the_model(db):
    def in_scope(obj, name, type_, reflected, compare_to):
        if type_ == "table":
            return name in FEATURE_TABLES
        return obj.table.name in FEATURE_TABLES

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


def test_the_normalized_search_migration_renames_and_adds_columns_and_its_downgrade_undoes_it(
    session,
):
    af.upload("ya2RC6UYbibC")
    session.commit()
    session.remove()

    def state():
        inspector = sa.inspect(session.bind)
        with session.bind.connect() as conn:
            displays = conn.execute(
                sa.text("SELECT display FROM analysis_feature_displays")
            ).scalars()
            keys = {key for display in displays for key in display} & {
                "diagnosis",
                "medical_condition",
            }
        return (
            {c["name"] for c in inspector.get_columns("analysis_features") if "_" in c["name"]},
            {i["name"] for i in inspector.get_indexes("analysis_features")},
            keys,
        )

    renamed = {f"medical_condition_{suffix}" for suffix in ("ids", "text")}
    added = {
        *(
            f"{field}_{suffix}"
            for field in NORMALIZED_FEATURES
            for suffix in ("ancestor_ids", "unmapped")
        ),
        "contrast_key_ids",
        "task_family_ids",
        "medical_condition_role_ids",
        "name_text",
        "mapping_tools",
    }
    try:
        service_migrations.downgrade(PUBLICATION_REVISION)
        columns, indexes, keys = state()
        assert {f"diagnosis_{suffix}" for suffix in ("ids", "labels", "text")} <= columns
        assert not renamed & columns and not added & columns
        assert "contrast_set_text" in columns
        assert "analysis_terms" not in sa.inspect(session.bind).get_table_names()
        assert {
            "ix_analysis_features__diagnosis_ids",
            "ix_analysis_features__diagnosis_text_trgm",
        } <= indexes
        assert keys == {"diagnosis"}

        service_migrations.upgrade("heads")
        columns, indexes, keys = state()
        assert renamed <= columns and added <= columns
        carried = [
            (row.medical_condition_ancestor_ids == row.medical_condition_ids, row.task_unmapped)
            for row in AnalysisFeature.query
        ]
        assert carried == [(True, False), (True, False)]
        session.remove()
        assert "contrast_set_text" not in columns
        assert "analysis_terms" in sa.inspect(session.bind).get_table_names()
        assert not any(column.startswith("diagnosis") for column in columns)
        assert {
            "ix_analysis_features__medical_condition_ids",
            "ix_analysis_features__medical_condition_text_trgm",
        } <= indexes
        assert keys == {"medical_condition"}
    finally:
        service_migrations.upgrade("heads")
    ids = {tuple(row.medical_condition_ids or ()) for row in AnalysisFeature.query}
    assert ids == {("MONDO:0005090",), ("MONDO:0005090", "MONDO:0004985")}
