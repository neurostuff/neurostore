import pytest

pytestmark = pytest.mark.anyio

import json
import threading

from neurostore.database import db
from neurostore.models import Study, Studyset
from neurostore.production_benchmark import (
    _canonical_case_name,
    _case_workload_info,
    _extract_profile_functions,
    _fit_line,
    _parse_scales,
    _project_line,
    _run_async,
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
        "name": "get_nested_studyset_seed_64",
        "metadata": {"study_count": 64},
    }

    assert _canonical_case_name(case) == "get_nested_studyset_seed"


def test_case_workload_info_uses_bulk_count_for_bulk_case():
    case = {
        "name": "post_base_studies_bulk_full_objects_32",
        "metadata": {"requested_count": 32},
    }
    results = {
        "bulk_post_count": 32,
        "available_bulk_post_count": 41107,
        "study_count": 32,
    }

    assert _case_workload_info(case, results, target_scale=200) == (
        32,
        200,
        "bulk_post_count",
    )


def test_case_workload_info_uses_study_count_for_non_bulk_case():
    case = {"name": "get_study_nested_frontend", "metadata": {"study_count": 16}}
    results = {"study_count": 16, "available_seed_study_count": 41332}

    assert _case_workload_info(case, results, target_scale=200) == (
        16,
        200,
        "study_count",
    )


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
                        "filename": "/usr/local/lib/python3.11/site-packages/neurostore/resources/data_views/base_studies_search.py",  # noqa: E501
                        "line_number": 42,
                        "function_name": "apply",
                        "primitive_calls": 1,
                        "total_calls": 1,
                        "self_seconds": 0.1,
                        "cumulative_seconds": 0.3,
                    },
                    {
                        "filename": "/usr/local/lib/python3.11/site-packages/neurostore/tests/request_utils.py",  # noqa: E501
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

    rows = _extract_profile_functions(str(stats_path), service="store")

    assert rows == [
        {
            "function": "/usr/local/lib/python3.11/site-packages/neurostore/resources/data_views/base_studies_search.py:42(apply)",  # noqa: E501
            "primitive_calls": 1,
            "total_calls": 1,
            "self_seconds": 0.1,
            "cumulative_seconds": 0.3,
        }
    ]


async def test_benchmark_write_cleanup_removes_case_writes(
    mock_add_users, ingest_neurosynth
):
    token = mock_add_users["user1"]["token"]
    study_ids = [
        study_id
        for (study_id,) in db.session.query(Study.id).order_by(Study.id).limit(2)
    ]
    initial_count = db.session.query(Studyset).count()

    from neurostore.tests.request_utils import AsyncClient

    client = AsyncClient(token=token)
    studyset_id = None
    try:
        response = await client.post(
            "/api/studysets/",
            data={
                "name": "production-benchmark-studyset-cleanup-check",
                "studies": [{"id": study_id} for study_id in study_ids],
            },
        )
        assert response.status_code == 200
        studyset_id = response.json()["id"]
        db.session.expire_all()
        assert db.session.query(Studyset).count() == initial_count + 1
    finally:
        try:
            if studyset_id is not None:
                response = await client.delete(f"/api/studysets/{studyset_id}")
                assert response.status_code == 200
                db.session.expire_all()
            assert db.session.query(Studyset).count() == initial_count
        finally:
            await client.aclose()


async def test_production_benchmark_runs_on_native_asgi_transport(
    mock_add_users, ingest_neurosynth, session
):
    initial_studyset_count = db.session.query(Studyset).count()

    results = await _run_async(iterations=1, seed_study_limit=1, bulk_post_limit=1)

    assert results["service"] == "store"
    assert results["iterations_per_case"] == 1
    assert results["rollback_writes"] is True
    assert {case["name"] for case in results["cases"]} >= {
        "post_studyset_seed_studies_1",
        "get_study_nested_frontend",
        "clone_study",
    }
    db.session.expire_all()
    assert db.session.query(Studyset).count() == initial_studyset_count
