import copy
import json
from pathlib import Path

import pytest

from neurosynth_compose.models.analysis import MetaAnalysis, Project
from neurosynth_compose.scripts.merge_base_studies import (
    BaseStudyMergeError,
    Change,
    load_plan,
    merge_base_studies,
)

# A public project's provenance (4ttKXDQjgSgT), cut to a few stubs. Column 1 stub 1
# curates dVE7SbbDthMm, the keeper of a pair whose duplicate is yNyHck2e72Fe.
PROVENANCE = json.loads(
    (Path(__file__).parent / "data" / "project_provenance_curated.json").read_text()
)
KEEPER, OLD = "dVE7SbbDthMm", "yNyHck2e72Fe"
STUB_PATH = "provenance.curationMetadata.columns[0].stubStudies[0].neurostoreId"


def _curating_old(session, provenance=None):
    """A project whose not-included column curates the duplicate base study."""
    provenance = copy.deepcopy(provenance or PROVENANCE)
    provenance["curationMetadata"]["columns"][0]["stubStudies"][0]["neurostoreId"] = OLD
    project = Project(name="curates the duplicate", provenance=provenance)
    untouched = Project(name="curates the keeper", provenance=copy.deepcopy(PROVENANCE))
    session.add_all([project, untouched])
    session.commit()
    return project.id, untouched.id, provenance


def _provenance(session, project_id):
    session.expire_all()
    return session.get(Project, project_id).provenance


def test_dry_run_reports_the_stub_and_changes_nothing(session):
    project_id, _, provenance = _curating_old(session)

    [outcome] = merge_base_studies([(KEEPER, OLD)])

    assert outcome.merged and outcome.refusal is None
    assert outcome.changes == [Change("projects", project_id, STUB_PATH, OLD, KEEPER)]
    assert _provenance(session, project_id) == provenance


def test_execute_repoints_only_the_stub(session):
    project_id, untouched_id, provenance = _curating_old(session)

    [outcome] = merge_base_studies([(KEEPER, OLD)], dry_run=False)

    assert outcome.changes == [Change("projects", project_id, STUB_PATH, OLD, KEEPER)]
    expected = copy.deepcopy(provenance)
    expected["curationMetadata"]["columns"][0]["stubStudies"][0]["neurostoreId"] = KEEPER
    assert _provenance(session, project_id) == expected
    assert _provenance(session, untouched_id) == PROVENANCE


def test_a_column_curating_both_base_studies_is_refused(session):
    provenance = copy.deepcopy(PROVENANCE)
    keeper_stub = provenance["curationMetadata"]["columns"][1]["stubStudies"][1]
    assert keeper_stub["neurostoreId"] == KEEPER
    duplicate = copy.deepcopy(keeper_stub)
    duplicate["neurostoreId"] = OLD
    provenance["curationMetadata"]["columns"][1]["stubStudies"].append(duplicate)
    project = Project(name="curates both", provenance=provenance)
    session.add(project)
    session.commit()

    [outcome] = merge_base_studies([(KEEPER, OLD)], dry_run=False)

    assert not outcome.merged
    assert "column 1 has stubs for both" in outcome.refusal
    assert _provenance(session, project.id) == provenance


def test_the_old_id_outside_a_stub_is_refused(session):
    provenance = copy.deepcopy(PROVENANCE)
    provenance["extractionMetadata"]["studyStatusList"][0]["id"] = OLD
    project_id, _, stored = _curating_old(session, provenance)

    [outcome] = merge_base_studies([(KEEPER, OLD)], dry_run=False)

    assert not outcome.merged
    assert "provenance.extractionMetadata.studyStatusList[0].id" in outcome.refusal
    assert _provenance(session, project_id) == stored


def test_a_meta_analysis_naming_the_old_id_refuses_the_pair(session):
    project_id, _, provenance = _curating_old(session)
    meta_analysis = MetaAnalysis(name="m", provenance={"studysetId": "x", "baseStudy": OLD})
    session.add(meta_analysis)
    session.commit()

    outcomes = merge_base_studies([(KEEPER, OLD), ("7xKzE2rfw8dM", "6ejr6ry3JpSo")], dry_run=False)

    assert [o.merged for o in outcomes] == [False, True]
    assert "provenance.baseStudy" in outcomes[0].refusal
    # The refused pair's project change was rolled back with it.
    assert _provenance(session, project_id) == provenance


@pytest.mark.parametrize(
    "merges, message",
    [
        ([], 'no "merges"'),
        ([{"keeper": KEEPER}], "needs a keeper and an old id"),
        ([{"keeper": KEEPER, "old": KEEPER}], "as keeper and old"),
        ([{"keeper": KEEPER, "old": OLD}, {"keeper": OLD, "old": "other"}], "repeats"),
    ],
)
def test_a_malformed_plan_is_refused(tmp_path, merges, message):
    plan = tmp_path / "plan.json"
    plan.write_text(json.dumps({"merges": merges}))
    with pytest.raises(BaseStudyMergeError, match=message):
        load_plan(plan)


def test_a_plan_loads_its_pairs_in_order(tmp_path):
    plan = tmp_path / "plan.json"
    plan.write_text(
        json.dumps(
            {
                "merges": [
                    {"keeper": KEEPER, "old": OLD, "evidence": {"studysets": 7}},
                    {"keeper": "7xKzE2rfw8dM", "old": "6ejr6ry3JpSo"},
                ]
            }
        )
    )
    assert load_plan(plan) == [(KEEPER, OLD), ("7xKzE2rfw8dM", "6ejr6ry3JpSo")]
