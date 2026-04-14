"""Benchmark high-impact Neurosynth Compose endpoints on production-like data."""

from __future__ import annotations

import argparse
import json
import os
import statistics
import threading
import tracemalloc
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from time import perf_counter
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from jose.jwt import encode
from sqlalchemy import event, func, inspect, select, text

from neurosynth_compose.database import db
from neurosynth_compose.models.analysis import (
    Annotation,
    AnnotationReference,
    MetaAnalysis,
    MetaAnalysisResult,
    NeurovaultCollection,
    Project,
    Specification,
    Studyset,
    StudysetReference,
)
from neurosynth_compose.models.auth import User
from neurosynth_compose.resources import (
    meta_analysis_jobs as meta_analysis_jobs_resource,
)
from neurosynth_compose.tests.request_utils import Client

TOKEN = encode({"sub": "user1-id"}, "abc", algorithm="HS256")
DEFAULT_SCALES = [10, 50, 100, 200]


def _env_flag(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _load_app():
    os.environ.setdefault("APP_ENV", "testing")
    os.environ["CONNEXION_DISABLE_RESPONSE_VALIDATION"] = "1"
    from neurosynth_compose import config as config_module
    from neurosynth_compose import create_app

    config_module.Config.BEARERINFO_FUNC = (
        "neurosynth_compose.tests.conftest.mock_decode_token"
    )
    config_module.Config.APIKEYINFO_FUNC = (
        "neurosynth_compose.resources.auth.verify_key"
    )
    return create_app()


def _response_json(response):
    payload = getattr(response, "json", None)
    if callable(payload):
        return payload()
    return payload


def _response_size_bytes(response):
    data = getattr(response, "data", None)
    if data is None:
        return 0
    if isinstance(data, str):
        data = data.encode("utf-8")
    return len(data)


def _json_size_bytes(value):
    if value is None:
        return 0
    return len(json.dumps(value).encode("utf-8"))


def _request(
    client: Client, method: str, path: str, *, data=None, params=None, headers=None
):
    response = getattr(client, method)(path, data=data, params=params, headers=headers)
    if response.status_code >= 400:
        raise RuntimeError(
            f"{method.upper()} {path} failed with {response.status_code}: {response.data}"
        )
    return response


def _ensure_user():
    user = db.session.execute(
        select(User).where(User.external_id == "user1-id")
    ).scalar_one_or_none()
    if user is None:
        db.session.add(User(name="production-benchmark", external_id="user1-id"))
        db.session.commit()


def _ensure_schema_ready():
    if "users" in inspect(db.engine).get_table_names():
        return
    db.create_all()


def _discover_project_provenance_target_bytes():
    try:
        target = db.session.execute(
            text(
                "SELECT COALESCE(MAX(pg_column_size(provenance::jsonb)), 0) "
                "FROM projects "
                "WHERE provenance IS NOT NULL"
            )
        ).scalar_one()
    except Exception:
        return 0
    return int(target or 0)


class _InMemoryJobStore:
    def __init__(self):
        self._store = {}
        self._sets = {}

    def setex(self, key, ttl, value):
        if isinstance(value, str):
            value = value.encode("utf-8")
        self._store[key] = value

    def get(self, key):
        return self._store.get(key)

    def delete(self, key):
        self._store.pop(key, None)

    def sadd(self, key, *values):
        bucket = self._sets.setdefault(key, set())
        bucket.update(values)

    def smembers(self, key):
        return set(self._sets.get(key, set()))

    def srem(self, key, *values):
        bucket = self._sets.get(key)
        if not bucket:
            return
        for value in values:
            bucket.discard(value)

    def expire(self, key, ttl):
        return True


def _install_local_neurostore_stub():
    from neurosynth_compose.resources import resource_services
    from neurosynth_compose.resources.data_views import projects_view

    def _stub_create_or_update_neurostore_study(ns_study):
        if not ns_study.neurostore_id:
            project_id = getattr(ns_study, "project_id", None) or "unknown"
            ns_study.neurostore_id = f"local-neurostore-study-{project_id}"
        ns_study.status = "OK"
        ns_study.exception = None
        ns_study.traceback = None
        return ns_study

    resource_services.create_or_update_neurostore_study = (
        _stub_create_or_update_neurostore_study
    )
    projects_view.create_or_update_neurostore_study = (
        _stub_create_or_update_neurostore_study
    )


def _pick_seed_cached_ids():
    cached_ids = db.session.execute(
        select(MetaAnalysis.cached_studyset_id, MetaAnalysis.cached_annotation_id)
        .where(MetaAnalysis.cached_annotation_id.is_not(None))
        .order_by(MetaAnalysis.public.desc(), MetaAnalysis.id)
        .limit(1)
    ).one_or_none()
    if cached_ids:
        return cached_ids[0], cached_ids[1]

    user = db.session.execute(
        select(User).where(User.external_id == "user1-id")
    ).scalar_one()
    studyset_reference = StudysetReference(
        id=f"benchmark-studyset-ref-{uuid4().hex[:8]}"
    )
    annotation_reference = AnnotationReference(
        id=f"benchmark-annotation-ref-{uuid4().hex[:8]}"
    )
    studyset = Studyset(
        user=user,
        snapshot={"name": "synthetic benchmark studyset"},
        version="benchmark-seed",
        studyset_reference=studyset_reference,
    )
    annotation = Annotation(
        user=user,
        studyset=studyset,
        snapshot={"name": "synthetic benchmark annotation"},
        annotation_reference=annotation_reference,
    )
    db.session.add(studyset_reference)
    db.session.add(annotation_reference)
    db.session.add(studyset)
    db.session.add(annotation)
    db.session.commit()
    return studyset.id, annotation.id


def _pick_existing_result_id():
    result_id = (
        db.session.execute(
            select(MetaAnalysisResult.id).order_by(MetaAnalysisResult.id)
        )
        .scalars()
        .first()
    )
    return result_id


def _flush_scoped_session_commit(self):
    return self.flush()


def _noop_scoped_session_remove(self):
    return None


@contextmanager
def _benchmark_write_isolation(*, enabled: bool):
    if not enabled:
        yield
        return

    scoped_session_cls = type(db.session)
    original_remove = scoped_session_cls.remove
    db.session.remove()

    with patch.object(
        scoped_session_cls, "commit", _flush_scoped_session_commit
    ), patch.object(
        scoped_session_cls,
        "remove",
        _noop_scoped_session_remove,
    ):
        outer_transaction = db.session.begin()
        try:
            yield
        finally:
            if outer_transaction.is_active:
                outer_transaction.rollback()
            else:
                db.session.rollback()

    original_remove(db.session)


@contextmanager
def _benchmark_case_rollback(*, enabled: bool):
    if not enabled:
        yield
        return

    savepoint = db.session.begin_nested()
    try:
        yield
    finally:
        if savepoint.is_active:
            savepoint.rollback()
        else:
            db.session.rollback()
        db.session.expire_all()


def _parse_scales(value, *, label: str) -> list[int]:
    if value is None:
        return list(DEFAULT_SCALES)
    if isinstance(value, (list, tuple)):
        items = value
    else:
        items = str(value).split(",")

    parsed = []
    for item in items:
        normalized = str(item).strip()
        if not normalized:
            continue
        parsed_value = int(normalized)
        if parsed_value <= 0:
            raise ValueError(f"{label} must contain only positive integers")
        parsed.append(parsed_value)
    if not parsed:
        raise ValueError(f"{label} must contain at least one positive integer")
    return parsed


def _fit_line(xs: list[int], ys: list[float]) -> dict[str, float]:
    if len(xs) != len(ys):
        raise ValueError("xs and ys must have the same length")
    if not xs:
        return {"slope": 0.0, "intercept": 0.0}
    x_mean = statistics.mean(xs)
    y_mean = statistics.mean(ys)
    denominator = sum((x - x_mean) ** 2 for x in xs)
    if denominator == 0:
        return {"slope": 0.0, "intercept": y_mean}
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    slope = numerator / denominator
    intercept = y_mean - slope * x_mean
    return {"slope": slope, "intercept": intercept}


def _project_line(fit: dict[str, float], x_value: int) -> float:
    return fit["intercept"] + fit["slope"] * x_value


def _canonical_case_name(case: dict) -> str:
    metadata = case.get("metadata") or {}
    for candidate in ("scale_factor", "workload_size"):
        scale = metadata.get(candidate)
        if not isinstance(scale, int):
            continue
        suffix = f"_{scale}"
        if case["name"].endswith(suffix):
            return case["name"][: -len(suffix)]
    return case["name"]


def _case_workload_info(case: dict, results: dict, *, target_scale: int):
    metadata = case.get("metadata") or {}
    current_size = int(metadata.get("workload_size") or target_scale)
    target_workload_size = int(metadata.get("target_workload_size") or target_scale)
    return (
        current_size,
        target_workload_size,
        metadata.get(
            "workload_metric",
            "workload_size",
        ),
    )


def _service_profile_root(service: str) -> str:
    if service == "compose":
        return "/neurosynth_compose/"
    raise ValueError(f"Unsupported service for profiling: {service}")


def _profile_function_path(function_key):
    filename, line_number, function_name = function_key
    return f"{filename}:{line_number}({function_name})"


def _extract_profile_functions(stats_path: str, *, service: str) -> list[dict]:
    service_root = _service_profile_root(service)
    profile_data = json.loads(Path(stats_path).read_text())
    rows = []
    for function_row in profile_data.get("functions", []):
        filename = function_row["filename"]
        function_name = function_row["function_name"]
        if service_root not in filename:
            continue
        if function_name == "<module>":
            continue
        if "/tests/" in filename:
            continue
        if filename.endswith("/production_benchmark.py"):
            continue
        rows.append(
            {
                "function": _profile_function_path(
                    (
                        filename,
                        function_row["line_number"],
                        function_name,
                    )
                ),
                "primitive_calls": function_row["primitive_calls"],
                "total_calls": function_row["total_calls"],
                "self_seconds": function_row["self_seconds"],
                "cumulative_seconds": function_row["cumulative_seconds"],
            }
        )
    return rows


def _bounded_page_size(size: int) -> int:
    return max(1, min(int(size), 99))


def _build_project_provenance(*, scale: int):
    scale = max(1, int(scale))
    column_count = max(3, min(10, scale // 8 + 2))
    stubs_per_column = max(4, scale)
    study_status_count = max(12, scale * 3)
    info_tag_count = max(6, min(24, scale // 2))
    import_count = max(1, min(8, scale // 15 + 1))

    provenance = {
        "curationMetadata": {
            "columns": [
                {
                    "id": f"column-{column_index}",
                    "name": f"Column {column_index}",
                    "type": "INCLUSION",
                    "stubStudies": [
                        {
                            "id": f"stub-{column_index}-{stub_index}",
                            "title": f"Study {stub_index}",
                            "authors": ["Author A", "Author B", "Author C"],
                            "journal": "Journal of Benchmarking",
                            "year": 2020 + (stub_index % 4),
                            "doi": f"10.1000/{column_index}-{stub_index}",
                            "exclusionTag": None,
                            "tags": [
                                {
                                    "id": f"tag-{(column_index + stub_index) % 7}",
                                    "label": f"Tag {(column_index + stub_index) % 7}",
                                }
                            ],
                        }
                        for stub_index in range(stubs_per_column)
                    ],
                }
                for column_index in range(column_count)
            ],
            "prismaConfig": {
                "isPrisma": True,
                "identification": {
                    "exclusionTags": [],
                },
                "screening": {
                    "exclusionTags": [],
                },
                "eligibility": {
                    "exclusionTags": [],
                },
            },
            "infoTags": [
                {"id": f"info-tag-{index}", "label": f"Info Tag {index}"}
                for index in range(info_tag_count)
            ],
            "exclusionTags": [
                {"id": f"exclusion-tag-{index}", "label": f"Exclusion Tag {index}"}
                for index in range(info_tag_count)
            ],
            "identificationSources": [
                {"id": f"source-{index}", "label": f"Source {index}"}
                for index in range(max(2, min(8, scale // 20 + 2)))
            ],
            "imports": [
                {
                    "id": f"import-{index}",
                    "name": f"Import {index}",
                    "date": "2026-01-01T00:00:00+00:00",
                    "importModeUsed": "PUBMED",
                    "numImported": scale + index,
                }
                for index in range(import_count)
            ],
        },
        "extractionMetadata": {
            "studysetId": "benchmark-studyset",
            "annotationId": "benchmark-annotation",
            "studyStatusList": [
                {
                    "id": f"study-status-{index}",
                    "status": "COMPLETE" if index % 2 else "TODO",
                }
                for index in range(study_status_count)
            ],
        },
        "metaAnalysisMetadata": {
            "canEditMetaAnalyses": True,
        },
    }
    return provenance, {
        "scale_factor": scale,
        "project_provenance_bytes": _json_size_bytes(provenance),
        "project_provenance_columns": column_count,
        "project_provenance_stub_count": column_count * stubs_per_column,
        "project_provenance_status_count": study_status_count,
    }


def _with_project_autosave_marker(provenance, *, variant: bool):
    if provenance is None:
        return None
    updated = json.loads(json.dumps(provenance))
    extraction_metadata = updated.setdefault("extractionMetadata", {})
    extraction_metadata["autosaveRevision"] = "revision-a" if variant else "revision-b"
    return updated


@dataclass
class _ThreadProfileFrame:
    function_key: tuple[str, int, str]
    code: object
    started_at: float
    child_seconds: float = 0.0


class _ThreadAwareProfiler:
    def __init__(self):
        self._timer = perf_counter
        self._lock = threading.Lock()
        self._thread_state = {}

    def _get_thread_state(self):
        thread_id = threading.get_ident()
        with self._lock:
            state = self._thread_state.get(thread_id)
            if state is None:
                state = {"stack": [], "stats": {}}
                self._thread_state[thread_id] = state
            return state

    @staticmethod
    def _function_key(frame):
        code = frame.f_code
        return (code.co_filename, code.co_firstlineno, code.co_name)

    @staticmethod
    def _ensure_stat(stats_by_function, function_key):
        return stats_by_function.setdefault(
            function_key,
            {
                "primitive_calls": 0,
                "total_calls": 0,
                "self_seconds": 0.0,
                "cumulative_seconds": 0.0,
            },
        )

    def _handle_call(self, state, frame):
        stack = state["stack"]
        function_key = self._function_key(frame)
        stat = self._ensure_stat(state["stats"], function_key)
        stat["total_calls"] += 1
        if not any(frame_state.function_key == function_key for frame_state in stack):
            stat["primitive_calls"] += 1
        stack.append(
            _ThreadProfileFrame(
                function_key=function_key,
                code=frame.f_code,
                started_at=self._timer(),
            )
        )

    def _finalize_frame(self, state, frame_state, now):
        elapsed_seconds = max(0.0, now - frame_state.started_at)
        self_seconds = max(0.0, elapsed_seconds - frame_state.child_seconds)
        stat = self._ensure_stat(state["stats"], frame_state.function_key)
        stat["self_seconds"] += self_seconds
        stat["cumulative_seconds"] += elapsed_seconds
        if state["stack"]:
            state["stack"][-1].child_seconds += elapsed_seconds

    def _handle_return(self, state, frame):
        stack = state["stack"]
        if not stack:
            return
        matching_index = None
        for index in range(len(stack) - 1, -1, -1):
            if stack[index].code is frame.f_code:
                matching_index = index
                break
        if matching_index is None:
            return
        now = self._timer()
        while len(stack) - 1 >= matching_index:
            frame_state = stack.pop()
            self._finalize_frame(state, frame_state, now)

    def _profile_hook(self, frame, event, arg):
        if event not in {"call", "return"}:
            return self._profile_hook
        state = self._get_thread_state()
        if event == "call":
            self._handle_call(state, frame)
        else:
            self._handle_return(state, frame)
        return self._profile_hook

    def profile_callable(self, fn):
        import sys

        previous_thread_profile = threading.getprofile()
        previous_profile = sys.getprofile()
        threading.setprofile(self._profile_hook)
        sys.setprofile(self._profile_hook)
        try:
            return fn()
        finally:
            sys.setprofile(previous_profile)
            threading.setprofile(previous_thread_profile)

    def export(self):
        merged = {}
        for state in self._thread_state.values():
            for function_key, stat in state["stats"].items():
                merged_row = merged.setdefault(
                    function_key,
                    {
                        "filename": function_key[0],
                        "line_number": function_key[1],
                        "function_name": function_key[2],
                        "primitive_calls": 0,
                        "total_calls": 0,
                        "self_seconds": 0.0,
                        "cumulative_seconds": 0.0,
                    },
                )
                merged_row["primitive_calls"] += stat["primitive_calls"]
                merged_row["total_calls"] += stat["total_calls"]
                merged_row["self_seconds"] += stat["self_seconds"]
                merged_row["cumulative_seconds"] += stat["cumulative_seconds"]
        rows = sorted(
            merged.values(),
            key=lambda row: row["cumulative_seconds"],
            reverse=True,
        )
        return {
            "profile_format": "thread-aware-json",
            "thread_count": len(self._thread_state),
            "functions": rows,
        }


class _SqlTimingCollector:
    def __init__(self, engine):
        self._engine = engine
        self.statement_count = 0
        self.total_seconds = 0.0

    def _before_cursor_execute(
        self, conn, cursor, statement, parameters, context, executemany
    ):
        starts = conn.info.setdefault("_production_benchmark_query_starts", [])
        starts.append(perf_counter())

    def _after_cursor_execute(
        self, conn, cursor, statement, parameters, context, executemany
    ):
        starts = conn.info.get("_production_benchmark_query_starts") or []
        started = starts.pop() if starts else None
        if started is None:
            return
        self.statement_count += 1
        self.total_seconds += perf_counter() - started

    def __enter__(self):
        event.listen(self._engine, "before_cursor_execute", self._before_cursor_execute)
        event.listen(self._engine, "after_cursor_execute", self._after_cursor_execute)
        return self

    def __exit__(self, exc_type, exc, tb):
        event.remove(self._engine, "before_cursor_execute", self._before_cursor_execute)
        event.remove(self._engine, "after_cursor_execute", self._after_cursor_execute)


def _write_profile_artifacts(profile_dir: Path, name: str, profiler, sql_collector):
    profile_dir.mkdir(parents=True, exist_ok=True)
    stats_path = profile_dir / f"{name}.profile.json"
    summary_path = profile_dir / f"{name}.summary.txt"
    profile_data = profiler.export()
    stats_path.write_text(json.dumps(profile_data, indent=2))

    summary_buffer = StringIO()
    summary_buffer.write(
        f"Captured {len(profile_data['functions'])} functions across "
        f"{profile_data['thread_count']} threads\n\n"
    )
    summary_buffer.write("Ordered by: cumulative time\n")
    summary_buffer.write(
        f"{'primitive':>10} {'total':>10} {'self':>10} {'cumulative':>12} function\n"
    )
    summary_buffer.write(f"{'-':->10} {'-':->10} {'-':->10} {'-':->12} {'-' * 40}\n")
    for function_row in profile_data["functions"][:40]:
        summary_buffer.write(
            f"{function_row['primitive_calls']:10d} "
            f"{function_row['total_calls']:10d} "
            f"{function_row['self_seconds']:10.4f} "
            f"{function_row['cumulative_seconds']:12.4f} "
            f"{function_row['filename']}:{function_row['line_number']}"
            f"({function_row['function_name']})\n"
        )
    summary_path.write_text(summary_buffer.getvalue())

    return {
        "stats_path": str(stats_path),
        "summary_path": str(summary_path),
        "profile_format": profile_data["profile_format"],
        "thread_count": profile_data["thread_count"],
        "sql_statement_count": sql_collector.statement_count,
        "sql_seconds": sql_collector.total_seconds,
    }


def _benchmark_case(
    name: str,
    iterations: int,
    fn,
    *,
    profile_dir: Path | None = None,
    client_ref: SimpleNamespace | None = None,
    rollback_after: bool = False,
):
    durations = []
    last_metadata = {}
    profiling = None
    peak_memory_bytes = None

    original_client = client_ref.current if client_ref is not None else None
    warmup_client = Client(token=TOKEN) if client_ref is not None else None
    try:
        with _benchmark_case_rollback(enabled=rollback_after):
            if client_ref is not None and warmup_client is not None:
                client_ref.current = warmup_client
            fn(-1)
    finally:
        if client_ref is not None:
            client_ref.current = original_client
        if warmup_client is not None:
            warmup_client.close()

    for index in range(iterations):
        if profile_dir is None:
            with _benchmark_case_rollback(enabled=rollback_after):
                started = perf_counter()
                last_metadata = fn(index) or {}
                durations.append(perf_counter() - started)
            continue

        sql_collector = _SqlTimingCollector(db.engine)
        profiler = _ThreadAwareProfiler() if index == 0 else None
        original_client = client_ref.current if client_ref is not None else None
        profiled_client = (
            Client(token=TOKEN) if client_ref is not None and profiler else None
        )

        with _benchmark_case_rollback(enabled=rollback_after):
            with sql_collector:
                started = perf_counter()
                try:
                    if client_ref is not None and profiled_client is not None:
                        client_ref.current = profiled_client
                    if profiler is not None:
                        last_metadata = profiler.profile_callable(
                            lambda: fn(index) or {}
                        )
                    else:
                        last_metadata = fn(index) or {}
                finally:
                    if client_ref is not None:
                        client_ref.current = original_client
                    if profiled_client is not None:
                        profiled_client.close()
                durations.append(perf_counter() - started)

        if profiler is not None:
            profiling = _write_profile_artifacts(
                profile_dir, name, profiler, sql_collector
            )

    original_client = client_ref.current if client_ref is not None else None
    memory_client = Client(token=TOKEN) if client_ref is not None else None
    try:
        with _benchmark_case_rollback(enabled=rollback_after):
            if client_ref is not None and memory_client is not None:
                client_ref.current = memory_client
            tracemalloc.start()
            try:
                last_metadata = fn(0) or last_metadata
                _current_bytes, peak_memory_bytes = tracemalloc.get_traced_memory()
            finally:
                tracemalloc.stop()
    finally:
        if client_ref is not None:
            client_ref.current = original_client
        if memory_client is not None:
            memory_client.close()

    case = {
        "name": name,
        "iterations": durations,
        "median_seconds": statistics.median(durations),
        "metadata": last_metadata,
        "peak_memory_bytes": peak_memory_bytes,
    }
    if profiling is not None:
        case["profiling"] = profiling
    return case


def _build_scaling_case_analysis(case_runs: list[dict], *, service: str) -> dict:
    first_run = case_runs[0]
    target_workload_size = max(run["target_workload_size"] for run in case_runs)
    case_fit = _fit_line(
        [run["workload_size"] for run in case_runs],
        [run["median_seconds"] for run in case_runs],
    )
    memory_fit = _fit_line(
        [run["workload_size"] for run in case_runs],
        [float(run.get("peak_memory_bytes") or 0) for run in case_runs],
    )
    functions_by_name = {}
    for run in case_runs:
        profiling = run.get("profiling") or {}
        stats_path = profiling.get("stats_path")
        if not stats_path:
            continue
        for function_row in _extract_profile_functions(stats_path, service=service):
            functions_by_name.setdefault(function_row["function"], []).append(
                {
                    "workload_size": run["workload_size"],
                    "primitive_calls": function_row["primitive_calls"],
                    "total_calls": function_row["total_calls"],
                    "self_seconds": function_row["self_seconds"],
                    "cumulative_seconds": function_row["cumulative_seconds"],
                }
            )

    function_analyses = []
    for function_name, function_runs in functions_by_name.items():
        function_runs = sorted(function_runs, key=lambda run: run["workload_size"])
        xs = [run["workload_size"] for run in function_runs]
        self_fit = _fit_line(xs, [run["self_seconds"] for run in function_runs])
        cumulative_fit = _fit_line(
            xs, [run["cumulative_seconds"] for run in function_runs]
        )
        function_analyses.append(
            {
                "function": function_name,
                "samples": function_runs,
                "self_slope_seconds_per_unit": self_fit["slope"],
                "self_intercept_seconds": self_fit["intercept"],
                "cumulative_slope_seconds_per_unit": cumulative_fit["slope"],
                "cumulative_intercept_seconds": cumulative_fit["intercept"],
                "projected_self_seconds_at_target": _project_line(
                    self_fit, target_workload_size
                ),
                "projected_cumulative_seconds_at_target": _project_line(
                    cumulative_fit, target_workload_size
                ),
            }
        )
    function_analyses.sort(
        key=lambda row: row["projected_cumulative_seconds_at_target"],
        reverse=True,
    )
    for index, function_analysis in enumerate(function_analyses, start=1):
        function_analysis["projected_cumulative_rank"] = index

    return {
        "case": first_run["canonical_case_name"],
        "workload_metric": first_run["workload_metric"],
        "target_workload_size": target_workload_size,
        "raw_case_samples": [
            {
                "case_name": run["case_name"],
                "workload_size": run["workload_size"],
                "median_seconds": run["median_seconds"],
                "peak_memory_bytes": run.get("peak_memory_bytes"),
                "profiling": run.get("profiling"),
                "metadata": run.get("metadata") or {},
            }
            for run in sorted(case_runs, key=lambda run: run["workload_size"])
        ],
        "case_slope_seconds_per_unit": case_fit["slope"],
        "case_intercept_seconds": case_fit["intercept"],
        "projected_case_seconds_at_target": _project_line(
            case_fit, target_workload_size
        ),
        "case_peak_memory_slope_bytes_per_unit": memory_fit["slope"],
        "case_peak_memory_intercept_bytes": memory_fit["intercept"],
        "projected_case_peak_memory_bytes_at_target": _project_line(
            memory_fit,
            target_workload_size,
        ),
        "functions": function_analyses,
    }


def _create_project(
    client: Client,
    *,
    suffix: str,
    cached_studyset_id=None,
    cached_annotation_id=None,
    provenance=None,
):
    payload = {
        "name": f"production-benchmark-project-{suffix}",
        "description": "local compose benchmark project",
        "public": False,
        "draft": True,
    }
    if cached_studyset_id is not None:
        payload["cached_studyset_id"] = cached_studyset_id
    if cached_annotation_id is not None:
        payload["cached_annotation_id"] = cached_annotation_id
    if provenance is not None:
        payload["provenance"] = provenance
    return _response_json(_request(client, "post", "/api/projects", data=payload))


def _create_specification(client: Client, *, suffix: str):
    payload = {
        "type": "cbma",
        "estimator": {"type": "ALE"},
        "corrector": {"type": "FDRCorrector"},
        "filter": f"production-benchmark-filter-{suffix}",
        "conditions": [f"condition-{suffix}"],
        "weights": [1],
    }
    return _response_json(_request(client, "post", "/api/specifications", data=payload))


def _create_meta_analysis(
    client: Client,
    project_id: str,
    *,
    suffix: str,
    specification_id: str,
    cached_studyset_id=None,
    cached_annotation_id=None,
):
    payload = {
        "name": f"production-benchmark-meta-{suffix}",
        "description": "local compose benchmark meta-analysis",
        "project": project_id,
        "specification": specification_id,
        "public": False,
    }
    if cached_studyset_id is not None:
        payload["cached_studyset_id"] = cached_studyset_id
    if cached_annotation_id is not None:
        payload["cached_annotation_id"] = cached_annotation_id
    return _response_json(_request(client, "post", "/api/meta-analyses", data=payload))


def _update_project(
    client: Client,
    project_id: str,
    *,
    variant: bool,
    provenance=None,
):
    payload = {
        "name": (
            "production-benchmark-project-updated-a"
            if variant
            else "production-benchmark-project-updated-b"
        ),
        "description": (
            "updated compose benchmark project A"
            if variant
            else "updated compose benchmark project B"
        ),
        "public": variant,
    }
    if provenance is not None:
        payload["provenance"] = provenance
    return _response_json(
        _request(
            client,
            "put",
            f"/api/projects/{project_id}",
            data=payload,
            params={"sync_meta_analyses_public": "true"},
        )
    )


def _update_meta_analysis(client: Client, meta_analysis_id: str, *, variant: bool):
    payload = {
        "name": (
            "production-benchmark-meta-updated-a"
            if variant
            else "production-benchmark-meta-updated-b"
        ),
        "description": (
            "updated compose benchmark meta-analysis A"
            if variant
            else "updated compose benchmark meta-analysis B"
        ),
        "public": variant,
    }
    return _response_json(
        _request(client, "put", f"/api/meta-analyses/{meta_analysis_id}", data=payload)
    )


def _ensure_result_for_meta_analysis(meta_analysis_id: str):
    existing = db.session.execute(
        select(MetaAnalysisResult).where(
            MetaAnalysisResult.meta_analysis_id == meta_analysis_id
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing.id
    result = MetaAnalysisResult(
        meta_analysis_id=meta_analysis_id, cli_args={"benchmark": True}
    )
    db.session.add(result)
    db.session.flush()
    collection_id = (
        900000
        + int(
            db.session.execute(
                select(func.count()).select_from(NeurovaultCollection)
            ).scalar_one()
        )
        + 1
    )
    collection = NeurovaultCollection(result=result, collection_id=collection_id)
    db.session.add(collection)
    db.session.commit()
    return result.id


def _seed_jobs(job_store, *, meta_analysis_id: str, count: int, user_id="user1-id"):
    job_ids = []
    for index in range(count):
        job_id = f"arn:aws:states:local:execution:{meta_analysis_id}:{index}"
        payload = {
            "job_id": job_id,
            "meta_analysis_id": meta_analysis_id,
            "artifact_prefix": f"benchmark/{meta_analysis_id}/{index}",
            "status": "SUCCEEDED" if index % 2 else "RUNNING",
            "environment": "testing",
            "no_upload": False,
            "user_id": user_id,
            "created_at": f"2026-01-01T00:00:{index:02d}+00:00",
            "updated_at": f"2026-01-01T00:00:{index:02d}+00:00",
            "logs": [],
        }
        meta_analysis_jobs_resource._store_job(job_id, payload)
        job_ids.append(job_id)
    return job_ids


def _seed_scaling_bundle(
    *, scale: int, cached_studyset_id, cached_annotation_id, user_id="user1-id"
):
    user = db.session.execute(
        select(User).where(User.external_id == user_id)
    ).scalar_one()
    project = Project(
        name=f"production-benchmark-scale-project-{scale}-{uuid4().hex[:6]}",
        description="scaled benchmark project",
        public=False,
        draft=True,
        user=user,
    )
    db.session.add(project)
    if cached_studyset_id:
        project.studyset = db.session.execute(
            select(Studyset).where(Studyset.id == cached_studyset_id)
        ).scalar_one()
    if cached_annotation_id:
        project.annotation = db.session.execute(
            select(Annotation).where(Annotation.id == cached_annotation_id)
        ).scalar_one()
    meta_ids = []
    for index in range(scale):
        specification = Specification(
            type="cbma",
            estimator={"type": "ALE"},
            corrector={"type": "FDRCorrector"},
            filter=f"scale-{scale}-{index}",
            user=user,
        )
        meta_analysis = MetaAnalysis(
            name=f"production-benchmark-scale-meta-{scale}-{index}",
            description="scaled benchmark meta-analysis",
            public=False,
            user=user,
            project=project,
            specification=specification,
            studyset=project.studyset,
            annotation=project.annotation,
        )
        db.session.add(specification)
        db.session.add(meta_analysis)
        db.session.flush()
        meta_ids.append(meta_analysis.id)
    db.session.commit()
    return project.id, meta_ids


def _seed_provenance_project_bundle(
    *,
    scale: int,
    cached_studyset_id,
    cached_annotation_id,
    user_id="user1-id",
):
    user = db.session.execute(
        select(User).where(User.external_id == user_id)
    ).scalar_one()
    provenance, metrics = _build_project_provenance(scale=scale)
    project = Project(
        name=f"production-benchmark-provenance-project-{scale}-{uuid4().hex[:6]}",
        description="scaled benchmark provenance project",
        public=False,
        draft=True,
        user=user,
        provenance=provenance,
    )
    db.session.add(project)
    if cached_studyset_id:
        project.studyset = db.session.execute(
            select(Studyset).where(Studyset.id == cached_studyset_id)
        ).scalar_one()
    if cached_annotation_id:
        project.annotation = db.session.execute(
            select(Annotation).where(Annotation.id == cached_annotation_id)
        ).scalar_one()
    db.session.commit()
    return {
        "project_id": project.id,
        "provenance": provenance,
        **metrics,
    }


def run(
    iterations: int,
    *,
    profile_dir: Path | None = None,
    scale_limit: int | None = None,
    production_project_provenance_bytes: int | None = None,
):
    app = _load_app()
    ctx = app.app_context()
    ctx.push()
    client = Client(token=TOKEN)
    client_ref = SimpleNamespace(current=client)
    rollback_writes = _env_flag("PRODUCTION_BENCHMARK_ROLLBACK_WRITES", True)
    job_store = _InMemoryJobStore()

    try:
        _install_local_neurostore_stub()

        def _stub_call_lambda(url, payload):
            if url and "logs" in url:
                return {"events": []}
            if url and "status" in url:
                cached_payload = (
                    meta_analysis_jobs_resource._load_job(payload["job_id"]) or {}
                )
                return {
                    "job_id": payload["job_id"],
                    "status": cached_payload.get("status", "RUNNING"),
                    "artifact_prefix": cached_payload.get("artifact_prefix"),
                    "output": cached_payload.get("output"),
                    "start_time": cached_payload.get("created_at"),
                    "stop_time": cached_payload.get("updated_at"),
                }
            return {"status": "SUBMITTED"}

        with patch.object(
            meta_analysis_jobs_resource, "get_job_store", return_value=job_store
        ), patch.object(
            meta_analysis_jobs_resource,
            "call_lambda",
            side_effect=_stub_call_lambda,
        ):
            with _benchmark_write_isolation(enabled=rollback_writes):
                _ensure_schema_ready()
                _ensure_user()
                discovered_project_provenance_target = (
                    _discover_project_provenance_target_bytes()
                )
                baseline_project_provenance, baseline_project_provenance_metrics = (
                    _build_project_provenance(scale=25)
                )
                project_provenance_target = int(
                    production_project_provenance_bytes
                    or discovered_project_provenance_target
                    or baseline_project_provenance_metrics["project_provenance_bytes"]
                )
                cached_studyset_id, cached_annotation_id = _pick_seed_cached_ids()
                seeded_project = _create_project(
                    client,
                    suffix="seed",
                    cached_studyset_id=cached_studyset_id,
                    cached_annotation_id=cached_annotation_id,
                    provenance=baseline_project_provenance,
                )
                seeded_project_id = seeded_project["id"]
                seeded_project_provenance = seeded_project["provenance"]
                seeded_specification = _create_specification(client, suffix="seed")
                seeded_specification_id = seeded_specification["id"]
                seeded_meta_analysis = _create_meta_analysis(
                    client,
                    seeded_project_id,
                    suffix="seed",
                    specification_id=seeded_specification_id,
                    cached_studyset_id=cached_studyset_id,
                    cached_annotation_id=cached_annotation_id,
                )
                seeded_meta_analysis_id = seeded_meta_analysis["id"]
                seeded_result_id = (
                    _pick_existing_result_id()
                    or _ensure_result_for_meta_analysis(seeded_meta_analysis_id)
                )
                seeded_job_ids = _seed_jobs(
                    job_store,
                    meta_analysis_id=seeded_meta_analysis_id,
                    count=max(5, scale_limit or 5),
                )

                cases = [
                    _benchmark_case(
                        "post_project_local_only",
                        iterations,
                        lambda index: {
                            "project_id": _create_project(
                                client_ref.current,
                                suffix=f"{index}-{uuid4().hex[:8]}",
                                cached_studyset_id=cached_studyset_id,
                                cached_annotation_id=cached_annotation_id,
                            )["id"]
                        },
                        profile_dir=profile_dir,
                        client_ref=client_ref,
                        rollback_after=True,
                    ),
                    _benchmark_case(
                        "put_project",
                        iterations,
                        lambda index: {
                            "project_id": _update_project(
                                client_ref.current,
                                seeded_project_id,
                                variant=bool(index % 2),
                            )["id"]
                        },
                        profile_dir=profile_dir,
                        client_ref=client_ref,
                    ),
                    _benchmark_case(
                        "put_project_autosave",
                        iterations,
                        lambda index: {
                            "project_id": _update_project(
                                client_ref.current,
                                seeded_project_id,
                                variant=bool(index % 2),
                                provenance=_with_project_autosave_marker(
                                    seeded_project_provenance,
                                    variant=bool(index % 2),
                                ),
                            )["id"],
                            "project_provenance_bytes": baseline_project_provenance_metrics[
                                "project_provenance_bytes"
                            ],
                            "project_provenance_columns": baseline_project_provenance_metrics[
                                "project_provenance_columns"
                            ],
                            "project_provenance_status_count": baseline_project_provenance_metrics[
                                "project_provenance_status_count"
                            ],
                        },
                        profile_dir=profile_dir,
                        client_ref=client_ref,
                    ),
                    _benchmark_case(
                        "list_projects",
                        iterations,
                        lambda _index: (
                            lambda response: {
                                "total_count": _response_json(response)["metadata"][
                                    "total_count"
                                ],
                                "response_bytes": _response_size_bytes(response),
                            }
                        )(
                            _request(
                                client_ref.current,
                                "get",
                                "/api/projects",
                                params={"page_size": "25", "sort": "created_at"},
                            )
                        ),
                        profile_dir=profile_dir,
                        client_ref=client_ref,
                    ),
                    _benchmark_case(
                        "get_project_detail",
                        iterations,
                        lambda _index: (
                            lambda response: {
                                "project_id": _response_json(response)["id"],
                                "response_bytes": _response_size_bytes(response),
                                "project_provenance_bytes": _json_size_bytes(
                                    _response_json(response).get("provenance")
                                ),
                            }
                        )(
                            _request(
                                client_ref.current,
                                "get",
                                f"/api/projects/{seeded_project_id}",
                            )
                        ),
                        profile_dir=profile_dir,
                        client_ref=client_ref,
                    ),
                    _benchmark_case(
                        "get_project_detail_info",
                        iterations,
                        lambda _index: (
                            lambda response: {
                                "project_id": _response_json(response)["id"],
                                "response_bytes": _response_size_bytes(response),
                                "project_provenance_bytes": _json_size_bytes(
                                    _response_json(response).get("provenance")
                                ),
                            }
                        )(
                            _request(
                                client_ref.current,
                                "get",
                                f"/api/projects/{seeded_project_id}",
                                params={"info": "true"},
                            )
                        ),
                        profile_dir=profile_dir,
                        client_ref=client_ref,
                    ),
                    _benchmark_case(
                        "post_meta_analysis",
                        iterations,
                        lambda index: {
                            "meta_analysis_id": _create_meta_analysis(
                                client_ref.current,
                                seeded_project_id,
                                suffix=f"{index}-{uuid4().hex[:8]}",
                                specification_id=seeded_specification_id,
                                cached_studyset_id=cached_studyset_id,
                                cached_annotation_id=cached_annotation_id,
                            )["id"]
                        },
                        profile_dir=profile_dir,
                        client_ref=client_ref,
                        rollback_after=True,
                    ),
                    _benchmark_case(
                        "put_meta_analysis",
                        iterations,
                        lambda index: {
                            "meta_analysis_id": _update_meta_analysis(
                                client_ref.current,
                                seeded_meta_analysis_id,
                                variant=bool(index % 2),
                            )["id"]
                        },
                        profile_dir=profile_dir,
                        client_ref=client_ref,
                    ),
                    _benchmark_case(
                        "list_meta_analyses",
                        iterations,
                        lambda _index: {
                            "total_count": _response_json(
                                _request(
                                    client_ref.current,
                                    "get",
                                    "/api/meta-analyses",
                                    params={"page_size": "25", "sort": "created_at"},
                                )
                            )["metadata"]["total_count"]
                        },
                        profile_dir=profile_dir,
                        client_ref=client_ref,
                    ),
                    _benchmark_case(
                        "get_meta_analysis_detail_nested",
                        iterations,
                        lambda _index: {
                            "meta_analysis_id": _response_json(
                                _request(
                                    client_ref.current,
                                    "get",
                                    f"/api/meta-analyses/{seeded_meta_analysis_id}",
                                    params={"nested": "true"},
                                )
                            )["id"]
                        },
                        profile_dir=profile_dir,
                        client_ref=client_ref,
                    ),
                    _benchmark_case(
                        "get_meta_analysis_result_detail",
                        iterations,
                        lambda _index: {
                            "result_id": _response_json(
                                _request(
                                    client_ref.current,
                                    "get",
                                    f"/api/meta-analysis-results/{seeded_result_id}",
                                )
                            )["id"]
                        },
                        profile_dir=profile_dir,
                        client_ref=client_ref,
                    ),
                    _benchmark_case(
                        "list_meta_analysis_jobs",
                        iterations,
                        lambda _index: {
                            "count": _response_json(
                                _request(
                                    client_ref.current, "get", "/api/meta-analysis-jobs"
                                )
                            )["metadata"]["count"]
                        },
                        profile_dir=profile_dir,
                        client_ref=client_ref,
                    ),
                    _benchmark_case(
                        "get_meta_analysis_job_detail",
                        iterations,
                        lambda _index: {
                            "job_id": _response_json(
                                _request(
                                    client_ref.current,
                                    "get",
                                    f"/api/meta-analysis-jobs/{seeded_job_ids[-1]}",
                                )
                            )["job_id"]
                        },
                        profile_dir=profile_dir,
                        client_ref=client_ref,
                    ),
                ]

                if scale_limit is not None:
                    scaled_project_id, scaled_meta_ids = _seed_scaling_bundle(
                        scale=scale_limit,
                        cached_studyset_id=cached_studyset_id,
                        cached_annotation_id=cached_annotation_id,
                    )
                    scaled_provenance_project = _seed_provenance_project_bundle(
                        scale=scale_limit,
                        cached_studyset_id=cached_studyset_id,
                        cached_annotation_id=cached_annotation_id,
                    )
                    _seed_jobs(
                        job_store,
                        meta_analysis_id=scaled_meta_ids[0],
                        count=scale_limit,
                    )
                    cases.extend(
                        [
                            _benchmark_case(
                                f"list_projects_seed_{scale_limit}",
                                iterations,
                                lambda _index: {
                                    "scale_factor": scale_limit,
                                    "workload_size": scale_limit,
                                    "workload_metric": "project_count",
                                    "total_count": _response_json(
                                        _request(
                                            client_ref.current,
                                            "get",
                                            "/api/projects",
                                            params={
                                                "page_size": str(
                                                    _bounded_page_size(scale_limit)
                                                ),
                                                "sort": "created_at",
                                            },
                                        )
                                    )["metadata"]["total_count"],
                                },
                                profile_dir=profile_dir,
                                client_ref=client_ref,
                            ),
                            _benchmark_case(
                                f"get_project_detail_info_seed_{scale_limit}",
                                iterations,
                                lambda _index: {
                                    "scale_factor": scale_limit,
                                    "workload_size": scale_limit,
                                    "workload_metric": "meta_analysis_count",
                                    "project_id": _response_json(
                                        _request(
                                            client_ref.current,
                                            "get",
                                            f"/api/projects/{scaled_project_id}",
                                            params={"info": "true"},
                                        )
                                    )["id"],
                                },
                                profile_dir=profile_dir,
                                client_ref=client_ref,
                            ),
                            _benchmark_case(
                                f"list_meta_analyses_seed_{scale_limit}",
                                iterations,
                                lambda _index: {
                                    "scale_factor": scale_limit,
                                    "workload_size": scale_limit,
                                    "workload_metric": "meta_analysis_count",
                                    "total_count": _response_json(
                                        _request(
                                            client_ref.current,
                                            "get",
                                            "/api/meta-analyses",
                                            params={
                                                "page_size": str(
                                                    _bounded_page_size(scale_limit)
                                                ),
                                                "sort": "created_at",
                                            },
                                        )
                                    )["metadata"]["total_count"],
                                },
                                profile_dir=profile_dir,
                                client_ref=client_ref,
                            ),
                            _benchmark_case(
                                f"list_meta_analysis_jobs_seed_{scale_limit}",
                                iterations,
                                lambda _index: {
                                    "scale_factor": scale_limit,
                                    "workload_size": scale_limit,
                                    "workload_metric": "job_count",
                                    "count": _response_json(
                                        _request(
                                            client_ref.current,
                                            "get",
                                            "/api/meta-analysis-jobs",
                                        )
                                    )["metadata"]["count"],
                                },
                                profile_dir=profile_dir,
                                client_ref=client_ref,
                            ),
                            _benchmark_case(
                                f"get_project_detail_provenance_seed_{scale_limit}",
                                iterations,
                                lambda _index: (
                                    lambda response: {
                                        "scale_factor": scale_limit,
                                        "workload_size": scaled_provenance_project[
                                            "project_provenance_bytes"
                                        ],
                                        "target_workload_size": max(
                                            project_provenance_target,
                                            scaled_provenance_project[
                                                "project_provenance_bytes"
                                            ],
                                        ),
                                        "workload_metric": "project_provenance_bytes",
                                        "project_id": _response_json(response)["id"],
                                        "response_bytes": _response_size_bytes(
                                            response
                                        ),
                                        "project_provenance_bytes": scaled_provenance_project[
                                            "project_provenance_bytes"
                                        ],
                                        "project_provenance_columns": scaled_provenance_project[
                                            "project_provenance_columns"
                                        ],
                                        "project_provenance_stub_count": scaled_provenance_project[
                                            "project_provenance_stub_count"
                                        ],
                                        "project_provenance_status_count": scaled_provenance_project[  # noqa: E501
                                            "project_provenance_status_count"
                                        ],
                                    }
                                )(
                                    _request(
                                        client_ref.current,
                                        "get",
                                        f"/api/projects/{scaled_provenance_project['project_id']}",
                                    )
                                ),
                                profile_dir=profile_dir,
                                client_ref=client_ref,
                            ),
                            _benchmark_case(
                                f"put_project_autosave_provenance_seed_{scale_limit}",
                                iterations,
                                lambda index: {
                                    "scale_factor": scale_limit,
                                    "workload_size": scaled_provenance_project[
                                        "project_provenance_bytes"
                                    ],
                                    "target_workload_size": max(
                                        project_provenance_target,
                                        scaled_provenance_project[
                                            "project_provenance_bytes"
                                        ],
                                    ),
                                    "workload_metric": "project_provenance_bytes",
                                    "project_id": _update_project(
                                        client_ref.current,
                                        scaled_provenance_project["project_id"],
                                        variant=bool(index % 2),
                                        provenance=_with_project_autosave_marker(
                                            scaled_provenance_project["provenance"],
                                            variant=bool(index % 2),
                                        ),
                                    )["id"],
                                    "project_provenance_bytes": scaled_provenance_project[
                                        "project_provenance_bytes"
                                    ],
                                    "project_provenance_columns": scaled_provenance_project[
                                        "project_provenance_columns"
                                    ],
                                    "project_provenance_stub_count": scaled_provenance_project[
                                        "project_provenance_stub_count"
                                    ],
                                    "project_provenance_status_count": scaled_provenance_project[
                                        "project_provenance_status_count"
                                    ],
                                },
                                profile_dir=profile_dir,
                                client_ref=client_ref,
                            ),
                        ]
                    )

                return {
                    "service": "compose",
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "iterations_per_case": iterations,
                    "seeded_project_id": seeded_project_id,
                    "seeded_specification_id": seeded_specification_id,
                    "seeded_meta_analysis_id": seeded_meta_analysis_id,
                    "seeded_result_id": seeded_result_id,
                    "seeded_job_id": seeded_job_ids[-1],
                    "seeded_cached_studyset_id": cached_studyset_id,
                    "seeded_cached_annotation_id": cached_annotation_id,
                    "seeded_project_provenance_bytes": baseline_project_provenance_metrics[
                        "project_provenance_bytes"
                    ],
                    "production_project_provenance_bytes": project_provenance_target,
                    "cases": cases,
                }
    finally:
        client.close()
        ctx.pop()


def run_scaling_profile(
    iterations: int,
    *,
    profile_dir: Path,
    scales: list[int],
    production_project_provenance_bytes: int | None = None,
):
    profile_dir.mkdir(parents=True, exist_ok=True)
    scale_runs = []
    case_runs = {}
    cases = []
    target_scale = max(scales)

    for scale_limit in scales:
        scale_profile_dir = profile_dir / f"scale-{scale_limit}"
        results = run(
            iterations,
            profile_dir=scale_profile_dir,
            scale_limit=scale_limit,
            production_project_provenance_bytes=production_project_provenance_bytes,
        )
        cases.extend(results["cases"])
        scale_runs.append({"scale": scale_limit})

        for case in results["cases"]:
            metadata = case.get("metadata") or {}
            if not metadata.get("workload_size"):
                continue
            workload_size, target_workload_size, workload_metric = _case_workload_info(
                case,
                results,
                target_scale=target_scale,
            )
            canonical_case_name = _canonical_case_name(case)
            case_runs.setdefault(canonical_case_name, []).append(
                {
                    "case_name": case["name"],
                    "canonical_case_name": canonical_case_name,
                    "workload_size": workload_size,
                    "target_workload_size": target_workload_size,
                    "workload_metric": workload_metric,
                    "median_seconds": case["median_seconds"],
                    "peak_memory_bytes": case.get("peak_memory_bytes"),
                    "profiling": case.get("profiling"),
                    "metadata": metadata,
                }
            )

    case_analyses = [
        _build_scaling_case_analysis(case_run_group, service="compose")
        for case_run_group in case_runs.values()
    ]
    case_analyses.sort(
        key=lambda analysis: analysis["projected_case_seconds_at_target"],
        reverse=True,
    )

    return {
        "service": "compose",
        "mode": "scaling-profile",
        "iterations_per_case": iterations,
        "scales": scales,
        "scale_runs": scale_runs,
        "cases": cases,
        "case_analyses": case_analyses,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--iterations", type=int, default=5)
    parser.add_argument("--output", required=True)
    parser.add_argument("--profile-dir")
    parser.add_argument("--scales")
    parser.add_argument("--production-project-provenance-bytes", type=int)
    args = parser.parse_args()

    output_path = Path(args.output)
    profile_dir = (
        Path(args.profile_dir)
        if args.profile_dir
        else output_path.parent / "profiles" / output_path.stem
    )
    scales = _parse_scales(args.scales, label="scales")
    results = run_scaling_profile(
        args.iterations,
        profile_dir=profile_dir,
        scales=scales,
        production_project_provenance_bytes=args.production_project_provenance_bytes,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(results, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
