import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("compare_results.py")
MODULE_SPEC = importlib.util.spec_from_file_location("compare_results", MODULE_PATH)
compare_results = importlib.util.module_from_spec(MODULE_SPEC)
assert MODULE_SPEC.loader is not None
MODULE_SPEC.loader.exec_module(compare_results)
build_rows = compare_results.build_rows
extract_cases = compare_results.extract_cases
render_report = compare_results.render_report


def test_extract_cases_prefers_flat_cases_when_present():
    results = {
        "cases": [{"name": "list_projects_10", "median_seconds": 1.23}],
        "case_analyses": [
            {
                "case": "list_projects",
                "raw_case_samples": [
                    {"case_name": "list_projects_50", "median_seconds": 5.67}
                ],
            }
        ],
    }

    assert extract_cases(results) == [
        {"name": "list_projects_10", "median_seconds": 1.23}
    ]


def test_extract_cases_falls_back_to_scaling_samples():
    results = {
        "case_analyses": [
            {
                "case": "list_projects",
                "raw_case_samples": [
                    {"case_name": "list_projects_10", "median_seconds": 1.23},
                    {"case_name": "list_projects_50", "median_seconds": 5.67},
                ],
            }
        ]
    }

    assert extract_cases(results) == [
        {"name": "list_projects_10", "median_seconds": 1.23},
        {"name": "list_projects_50", "median_seconds": 5.67},
    ]


def test_build_rows_reports_missing_cases_without_marking_slowdown():
    rows, slowdowns, mismatches = build_rows(
        {"baseline_only": {"median_seconds": 1.0}},
        {"candidate_only": {"median_seconds": 2.0}},
        threshold=0.2,
    )

    assert rows == []
    assert slowdowns == []
    assert mismatches == [
        {"name": "baseline_only", "reason": "missing in candidate"},
        {"name": "candidate_only", "reason": "missing in baseline"},
    ]


def test_build_rows_marks_only_true_slowdowns():
    rows, slowdowns, mismatches = build_rows(
        {"same_case": {"median_seconds": 1.0}},
        {"same_case": {"median_seconds": 1.5}},
        threshold=0.2,
    )

    assert len(rows) == 1
    assert rows[0]["status"] == "slow"
    assert slowdowns == rows
    assert mismatches == []


def test_render_report_separates_case_mismatches_from_slowdowns():
    report = render_report(
        "store",
        rows=[
            {
                "name": "same_case",
                "baseline": 1.0,
                "candidate": 1.0,
                "delta": 0.0,
                "ratio": 0.0,
                "status": "ok",
            }
        ],
        slowdowns=[],
        mismatches=[{"name": "candidate_only", "reason": "missing in baseline"}],
        threshold=0.2,
    )

    assert "No slowdowns over the configured threshold." in report
    assert "Case mismatches (reported only):" in report
    assert "candidate_only: missing in baseline" in report
