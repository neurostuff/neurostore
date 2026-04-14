import json
import threading

from neurosynth_compose.production_benchmark import (
    _bounded_page_size,
    _build_project_provenance,
    _canonical_case_name,
    _extract_profile_functions,
    _fit_line,
    _json_size_bytes,
    _parse_scales,
    _project_line,
    _ThreadAwareProfiler,
)


def test_fit_line_returns_expected_slope_and_projection():
    fit = _fit_line([2, 4, 8, 16], [1.0, 2.0, 4.0, 8.0])

    assert round(fit["slope"], 6) == 0.5
    assert round(fit["intercept"], 6) == 0.0
    assert round(_project_line(fit, 32), 6) == 16.0


def test_parse_scales_defaults_and_parses_csv():
    assert _parse_scales(None, label="scales") == [10, 50, 100, 200]
    assert _parse_scales("10, 25, 100", label="scales") == [10, 25, 100]


def test_canonical_case_name_strips_scale_suffix_from_scaled_cases():
    case = {
        "name": "list_meta_analysis_jobs_seed_64",
        "metadata": {
            "scale_factor": 64,
            "workload_size": 2048,
            "workload_metric": "job_count",
        },
    }

    assert _canonical_case_name(case) == "list_meta_analysis_jobs_seed"


def test_build_project_provenance_reports_payload_size():
    provenance, metrics = _build_project_provenance(scale=12)

    assert metrics["scale_factor"] == 12
    assert metrics["project_provenance_bytes"] == _json_size_bytes(provenance)
    assert metrics["project_provenance_columns"] >= 3
    assert metrics["project_provenance_status_count"] >= 12


def test_bounded_page_size_caps_large_requests():
    assert _bounded_page_size(0) == 1
    assert _bounded_page_size(25) == 25
    assert _bounded_page_size(1000) == 99


def test_thread_aware_profiler_captures_worker_thread_calls():
    profiler = _ThreadAwareProfiler()

    def worker():
        total = 0
        for index in range(2000):
            total += index
        return total

    def run_work():
        thread = threading.Thread(target=worker)
        thread.start()
        thread.join()

    profiler.profile_callable(run_work)
    profile_data = profiler.export()

    assert profile_data["thread_count"] >= 2
    assert any(row["function_name"] == "worker" for row in profile_data["functions"])


def test_extract_profile_functions_reads_thread_aware_json(tmp_path):
    stats_path = tmp_path / "profile.json"
    stats_path.write_text(
        json.dumps(
            {
                "profile_format": "thread-aware-json",
                "thread_count": 2,
                "functions": [
                    {
                        "filename": "/usr/local/lib/python3.11/site-packages/neurosynth_compose/resources/data_views/meta_analyses_view.py",
                        "line_number": 42,
                        "function_name": "search",
                        "primitive_calls": 1,
                        "total_calls": 1,
                        "self_seconds": 0.1,
                        "cumulative_seconds": 0.3,
                    },
                    {
                        "filename": "/usr/local/lib/python3.11/site-packages/neurosynth_compose/tests/request_utils.py",
                        "line_number": 12,
                        "function_name": "_make_request",
                        "primitive_calls": 1,
                        "total_calls": 1,
                        "self_seconds": 0.2,
                        "cumulative_seconds": 0.4,
                    },
                ],
            }
        )
    )

    rows = _extract_profile_functions(str(stats_path), service="compose")

    assert rows == [
        {
            "function": "/usr/local/lib/python3.11/site-packages/neurosynth_compose/resources/data_views/meta_analyses_view.py:42(search)",
            "primitive_calls": 1,
            "total_calls": 1,
            "self_seconds": 0.1,
            "cumulative_seconds": 0.3,
        }
    ]
