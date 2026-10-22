import copy
import json
from pathlib import Path

import pytest

from click.testing import CliRunner

from neurosynth_compose import cli
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


def _merge(pairs, dry_run=True):
    return list(merge_base_studies(pairs, dry_run=dry_run))


def _provenance(session, project_id):
    session.expire_all()
    return session.get(Project, project_id).provenance


def test_dry_run_reports_the_stub_and_changes_nothing(session):
    project_id, _, provenance = _curating_old(session)

    [outcome] = _merge([(KEEPER, OLD)])

    assert (outcome.status, outcome.refusal) == ("merged", None)
    assert outcome.changes == [Change("projects", project_id, STUB_PATH, OLD, KEEPER)]
    assert _provenance(session, project_id) == provenance


def test_execute_repoints_only_the_stub(session):
    project_id, untouched_id, provenance = _curating_old(session)

    [outcome] = _merge([(KEEPER, OLD)], dry_run=False)

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

    [outcome] = _merge([(KEEPER, OLD)], dry_run=False)

    assert outcome.status == "refused"
    assert "column 1 has stubs for both" in outcome.refusal
    assert _provenance(session, project.id) == provenance


def test_the_old_id_outside_a_stub_is_refused(session):
    provenance = copy.deepcopy(PROVENANCE)
    provenance["extractionMetadata"]["studyStatusList"][0]["id"] = OLD
    project_id, _, stored = _curating_old(session, provenance)

    [outcome] = _merge([(KEEPER, OLD)], dry_run=False)

    assert outcome.status == "refused"
    assert "provenance.extractionMetadata.studyStatusList[0].id" in outcome.refusal
    assert _provenance(session, project_id) == stored


def test_a_meta_analysis_naming_the_old_id_refuses_the_pair(session):
    project_id, _, provenance = _curating_old(session)
    meta_analysis = MetaAnalysis(name="m", provenance={"studysetId": "x", "baseStudy": OLD})
    session.add(meta_analysis)
    session.commit()

    outcomes = _merge([(KEEPER, OLD), ("7xKzE2rfw8dM", "6ejr6ry3JpSo")], dry_run=False)

    assert [o.status for o in outcomes] == ["refused", "merged"]
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


def test_every_stub_of_every_project_is_repointed(session):
    first = copy.deepcopy(PROVENANCE)
    first["curationMetadata"]["columns"][0]["stubStudies"][0]["neurostoreId"] = OLD
    # A paper imported twice sits in two columns, as X6u8UPSV39vS does in 48q5h5Xt4mGe.
    first["curationMetadata"]["columns"][1]["stubStudies"][1]["neurostoreId"] = OLD
    second = copy.deepcopy(PROVENANCE)
    second["curationMetadata"]["columns"][1]["stubStudies"][1]["neurostoreId"] = OLD
    projects = [Project(name="first", provenance=first), Project(name="second", provenance=second)]
    session.add_all(projects)
    session.commit()

    [outcome] = _merge([(KEEPER, OLD)], dry_run=False)

    stub = "provenance.curationMetadata.columns[{}].stubStudies[{}].neurostoreId"
    assert sorted(outcome.changes, key=repr) == sorted(
        [
            Change("projects", projects[0].id, stub.format(0, 0), OLD, KEEPER),
            Change("projects", projects[0].id, stub.format(1, 1), OLD, KEEPER),
            Change("projects", projects[1].id, stub.format(1, 1), OLD, KEEPER),
        ],
        key=repr,
    )
    for project in projects:
        assert OLD not in json.dumps(_provenance(session, project.id))


def test_a_plan_run_again_changes_nothing(session):
    project_id, _, _ = _curating_old(session)
    _merge([(KEEPER, OLD)], dry_run=False)
    applied = _provenance(session, project_id)

    [again] = _merge([(KEEPER, OLD)], dry_run=False)

    assert (again.status, again.changes) == ("merged", [])
    assert _provenance(session, project_id) == applied


def _plan(tmp_path, *pairs):
    plan = tmp_path / "plan.json"
    plan.write_text(json.dumps({"merges": [{"keeper": k, "old": o} for k, o in pairs]}))
    return str(plan)


@pytest.fixture
def in_process(monkeypatch):
    monkeypatch.setattr(cli, "_run_with_runtime", lambda callback: callback(None, None))


def test_the_cli_dry_runs_by_default_and_commits_with_execute(session, tmp_path, in_process):
    project_id, _, provenance = _curating_old(session)
    plan = _plan(tmp_path, (KEEPER, OLD))

    dry = CliRunner().invoke(cli.main, ["merge-base-studies", plan])

    assert dry.exit_code == 0, dry.output
    assert f"would merge {OLD} -> {KEEPER}: 1 change(s)" in dry.output
    assert f"  projects {project_id} {STUB_PATH}: '{OLD}' -> '{KEEPER}'" in dry.output
    assert _provenance(session, project_id) == provenance

    applied = CliRunner().invoke(cli.main, ["merge-base-studies", plan, "--execute"])

    assert applied.exit_code == 0, applied.output
    assert f"merged {OLD} -> {KEEPER}: 1 change(s)" in applied.output
    assert OLD not in json.dumps(_provenance(session, project_id))


def test_the_cli_exits_1_when_a_pair_is_refused(session, tmp_path, in_process):
    session.add(MetaAnalysis(name="m", provenance={"baseStudy": OLD}))
    project_id, _, _ = _curating_old(session)
    plan = _plan(tmp_path, (KEEPER, OLD), ("7xKzE2rfw8dM", "6ejr6ry3JpSo"))

    result = CliRunner().invoke(cli.main, ["merge-base-studies", plan, "--execute"])

    assert result.exit_code == 1
    assert f"REFUSED {OLD} -> {KEEPER}: meta-analysis" in result.output
    assert "merged 6ejr6ry3JpSo -> 7xKzE2rfw8dM: 0 change(s)" in result.output
