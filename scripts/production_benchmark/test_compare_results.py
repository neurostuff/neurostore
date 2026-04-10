import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("compare_results.py")
MODULE_SPEC = importlib.util.spec_from_file_location("compare_results", MODULE_PATH)
compare_results = importlib.util.module_from_spec(MODULE_SPEC)
assert MODULE_SPEC.loader is not None
MODULE_SPEC.loader.exec_module(compare_results)
extract_cases = compare_results.extract_cases


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
