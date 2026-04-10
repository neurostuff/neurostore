"""Benchmark high-impact Neurostore endpoints against a restored production dump."""

from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import threading
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from time import perf_counter
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import urlencode
from uuid import uuid4

from jose.jwt import encode
from neurostore.database import db
from neurostore.models import Analysis, BaseStudy, Study, User
from neurostore.tests.request_utils import Client
from sqlalchemy import event, func, select

TOKEN = encode({"sub": "user1-id"}, "abc", algorithm="HS256")
DEFAULT_SCALES = [10, 50, 100, 200]


def _env_flag(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _load_app():
    os.environ.setdefault("APP_ENV", "testing")
    from neurostore import create_app

    return create_app()


def _response_json(response):
    if hasattr(response, "get_json"):
        return response.get_json()
    payload = getattr(response, "json", None)
    if callable(payload):
        return payload()
    return payload


def _request(client: Client, method: str, path: str, *, data=None, params=None):
    if params:
        separator = "&" if "?" in path else "?"
        path = f"{path}{separator}{urlencode(params, doseq=True)}"
    response = getattr(client, method)(path, data=data)
    if response.status_code >= 400:
        raise RuntimeError(
            f"{method.upper()} {path} failed with {response.status_code}: {response.data}"
        )
    return response


def _ensure_user() -> None:
    user = db.session.execute(
        select(User).where(User.external_id == "user1-id")
    ).scalar_one_or_none()
    if user is None:
        db.session.add(User(name="production-benchmark", external_id="user1-id"))
        db.session.commit()


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
        scoped_session_cls,
        "commit",
        _flush_scoped_session_commit,
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


def _extract_search_term(base_study_name: str, fallback_id: str) -> str:
    for candidate in re.split(r"[^A-Za-z0-9]+", base_study_name or ""):
        if len(candidate) >= 4:
            return candidate
    return str(fallback_id)[:8]


def _resolve_scale(desired: int, available: int, *, minimum: int, label: str) -> int:
    if available < minimum:
        raise RuntimeError(f"Need at least {minimum} {label}, found {available}")
    return min(desired, available)


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
    for key in ("requested_count", "study_count"):
        value = metadata.get(key)
        if not isinstance(value, int):
            continue
        suffix = f"_{value}"
        if case["name"].endswith(suffix):
            return case["name"][: -len(suffix)]
    return case["name"]


def _case_workload_info(
    case: dict, results: dict, *, target_scale: int
) -> tuple[int, int, str]:
    metadata = case.get("metadata") or {}
    if metadata.get("requested_count") is not None or case["name"].startswith(
        "post_base_studies_bulk_full_objects"
    ):
        current_size = int(
            metadata.get("requested_count") or results["bulk_post_count"]
        )
        target_size = min(
            target_scale,
            int(results.get("available_bulk_post_count") or target_scale),
        )
        return current_size, target_size, "bulk_post_count"

    current_size = int(metadata.get("study_count") or results["study_count"])
    target_size = min(
        target_scale,
        int(results.get("available_seed_study_count") or target_scale),
    )
    return current_size, target_size, "study_count"


def _profile_function_path(function_key) -> str:
    filename, line_number, function_name = function_key
    return f"{filename}:{line_number}({function_name})"


def _service_profile_root(service: str) -> str:
    if service == "store":
        return "/neurostore/"
    if service == "compose":
        return "/neurosynth_compose/"
    raise ValueError(f"Unsupported service for profiling: {service}")


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
        self._thread_state: dict[int, dict] = {}

    def _get_thread_state(self) -> dict:
        thread_id = threading.get_ident()
        with self._lock:
            state = self._thread_state.get(thread_id)
            if state is None:
                state = {"stack": [], "stats": {}}
                self._thread_state[thread_id] = state
            return state

    @staticmethod
    def _function_key(frame) -> tuple[str, int, str]:
        code = frame.f_code
        return (code.co_filename, code.co_firstlineno, code.co_name)

    @staticmethod
    def _ensure_stat(
        stats_by_function: dict, function_key: tuple[str, int, str]
    ) -> dict:
        return stats_by_function.setdefault(
            function_key,
            {
                "primitive_calls": 0,
                "total_calls": 0,
                "self_seconds": 0.0,
                "cumulative_seconds": 0.0,
            },
        )

    def _handle_call(self, state: dict, frame) -> None:
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

    def _finalize_frame(
        self, state: dict, frame_state: _ThreadProfileFrame, now: float
    ) -> None:
        elapsed_seconds = max(0.0, now - frame_state.started_at)
        self_seconds = max(0.0, elapsed_seconds - frame_state.child_seconds)
        stat = self._ensure_stat(state["stats"], frame_state.function_key)
        stat["self_seconds"] += self_seconds
        stat["cumulative_seconds"] += elapsed_seconds
        if state["stack"]:
            state["stack"][-1].child_seconds += elapsed_seconds

    def _handle_return(self, state: dict, frame) -> None:
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

    def export(self) -> dict:
        merged: dict[tuple[str, int, str], dict] = {}
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


def _build_scaling_case_analysis(case_runs: list[dict], *, service: str) -> dict:
    first_run = case_runs[0]
    target_workload_size = max(run["target_workload_size"] for run in case_runs)
    workload_metric = first_run["workload_metric"]

    case_fit = _fit_line(
        [run["workload_size"] for run in case_runs],
        [run["median_seconds"] for run in case_runs],
    )

    functions_by_name: dict[str, list[dict]] = {}
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
        key=lambda row: row["projected_cumulative_seconds_at_target"], reverse=True
    )
    for index, function_analysis in enumerate(function_analyses, start=1):
        function_analysis["projected_cumulative_rank"] = index

    case_runs_summary = [
        {
            "case_name": run["case_name"],
            "workload_size": run["workload_size"],
            "median_seconds": run["median_seconds"],
            "profiling": run.get("profiling"),
            "metadata": run.get("metadata") or {},
        }
        for run in sorted(case_runs, key=lambda run: run["workload_size"])
    ]

    return {
        "case": first_run["canonical_case_name"],
        "workload_metric": workload_metric,
        "target_workload_size": target_workload_size,
        "raw_case_samples": case_runs_summary,
        "case_slope_seconds_per_unit": case_fit["slope"],
        "case_intercept_seconds": case_fit["intercept"],
        "projected_case_seconds_at_target": _project_line(
            case_fit, target_workload_size
        ),
        "functions": function_analyses,
    }


def run_scaling_profile(
    iterations: int,
    *,
    profile_dir: Path,
    scales: list[int],
) -> dict:
    profile_dir.mkdir(parents=True, exist_ok=True)
    scale_runs = []
    case_runs: dict[str, list[dict]] = {}
    cases = []
    target_scale = max(scales)

    for scale_limit in scales:
        scale_profile_dir = profile_dir / f"scale-{scale_limit}"
        results = run(
            iterations,
            profile_dir=scale_profile_dir,
            seed_study_limit=scale_limit,
            bulk_post_limit=scale_limit,
        )
        cases.extend(results["cases"])
        scale_runs.append(
            {
                "scale": scale_limit,
                "study_count": results["study_count"],
                "bulk_post_count": results["bulk_post_count"],
                "available_seed_study_count": results.get("available_seed_study_count"),
                "available_bulk_post_count": results.get("available_bulk_post_count"),
            }
        )

        for case in results["cases"]:
            workload_size, target_workload_size, workload_metric = _case_workload_info(
                case, results, target_scale=target_scale
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
                    "profiling": case.get("profiling"),
                    "metadata": case.get("metadata") or {},
                }
            )

    case_analyses = [
        _build_scaling_case_analysis(case_run_group, service="store")
        for case_run_group in case_runs.values()
    ]
    case_analyses.sort(
        key=lambda analysis: analysis["projected_case_seconds_at_target"],
        reverse=True,
    )

    return {
        "service": "store",
        "mode": "scaling-profile",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "iterations_per_case": iterations,
        "scales": scales,
        "scale_runs": scale_runs,
        "cases": cases,
        "case_analyses": case_analyses,
    }


def _pick_seed_studies_from_base_studies(
    limit: int | None = None,
) -> tuple[list[str], list[str], str, int]:
    candidate_queries = [
        (
            select(BaseStudy.id, BaseStudy.name, Study.id)
            .join(Study, Study.base_study_id == BaseStudy.id)
            .where(
                BaseStudy.is_active.is_(True),
                BaseStudy.public.is_(True),
                Study.public.is_(True),
            )
            .order_by(BaseStudy.id, Study.id),
            select(func.count()).select_from(
                select(BaseStudy.id)
                .join(Study, Study.base_study_id == BaseStudy.id)
                .where(
                    BaseStudy.is_active.is_(True),
                    BaseStudy.public.is_(True),
                    Study.public.is_(True),
                )
                .distinct()
                .subquery()
            ),
        ),
        (
            select(BaseStudy.id, BaseStudy.name, Study.id)
            .join(Study, Study.base_study_id == BaseStudy.id)
            .where(
                BaseStudy.is_active.is_(True),
                Study.public.is_(True),
            )
            .order_by(BaseStudy.id, Study.id),
            select(func.count()).select_from(
                select(BaseStudy.id)
                .join(Study, Study.base_study_id == BaseStudy.id)
                .where(
                    BaseStudy.is_active.is_(True),
                    Study.public.is_(True),
                )
                .distinct()
                .subquery()
            ),
        ),
    ]

    selected_rows = []
    available_count = 0
    for query, count_query in candidate_queries:
        available_count = int(db.session.execute(count_query).scalar_one())
        selected_rows = []
        seen_base_studies = set()
        for base_study_id, base_study_name, study_id in db.session.execute(query):
            if base_study_id in seen_base_studies:
                continue
            seen_base_studies.add(base_study_id)
            selected_rows.append((base_study_id, base_study_name or "", study_id))
            if limit is not None and len(selected_rows) == limit:
                break
        if selected_rows:
            break

    resolved_limit = _resolve_scale(
        limit if limit is not None else len(selected_rows),
        len(selected_rows),
        minimum=1,
        label="active base-studies with versioned studies",
    )
    selected_rows = selected_rows[:resolved_limit]

    base_study_ids = [row[0] for row in selected_rows]
    study_ids = [row[2] for row in selected_rows]
    search_term = _extract_search_term(selected_rows[0][1], selected_rows[0][0])
    return base_study_ids, study_ids, search_term, available_count


def _pick_bulk_post_payload(
    limit: int | None = None,
) -> tuple[list[dict[str, str]], int]:
    rows = []
    seen_base_studies = set()
    query = (
        select(BaseStudy.id, BaseStudy.doi, BaseStudy.pmid)
        .join(Study, Study.base_study_id == BaseStudy.id)
        .where(BaseStudy.is_active.is_(True))
        .order_by(BaseStudy.id, Study.id)
    )
    available_count = int(
        db.session.execute(
            select(func.count()).select_from(
                select(BaseStudy.id)
                .join(Study, Study.base_study_id == BaseStudy.id)
                .where(
                    BaseStudy.is_active.is_(True),
                    (BaseStudy.doi.is_not(None)) | (BaseStudy.pmid.is_not(None)),
                )
                .distinct()
                .subquery()
            )
        ).scalar_one()
    )

    for base_study_id, doi, pmid in db.session.execute(query):
        if base_study_id in seen_base_studies:
            continue
        if not doi and not pmid:
            continue

        seen_base_studies.add(base_study_id)
        payload = {}
        if doi:
            payload["doi"] = doi
        if pmid:
            payload["pmid"] = pmid
        rows.append(payload)

        if limit is not None and len(rows) == limit:
            break

    resolved_limit = _resolve_scale(
        limit if limit is not None else len(rows),
        len(rows),
        minimum=1,
        label="active base-studies with DOI/PMID identifiers",
    )
    return rows[:resolved_limit], available_count


def _create_large_studyset(client: Client, study_ids: list[str], *, suffix: str) -> str:
    payload = {
        "name": f"production-benchmark-studyset-{suffix}",
        "studies": [{"id": study_id} for study_id in study_ids],
    }
    response = _request(client, "post", "/api/studysets/", data=payload)
    body = _response_json(response)
    return body["id"]


def _create_large_annotation(client: Client, studyset_id: str, *, suffix: str) -> str:
    payload = {
        "studyset": studyset_id,
        "name": f"production-benchmark-annotation-{suffix}",
        "note_keys": {
            "included": {"type": "boolean", "order": 0, "default": True},
            "confidence": {"type": "string", "order": 1, "default": "high"},
            "priority": {"type": "number", "order": 2, "default": 1},
        },
    }
    response = _request(client, "post", "/api/annotations/", data=payload)
    body = _response_json(response)
    return body["id"]


def _load_annotation_payload(client: Client, annotation_id: str) -> dict:
    response = _request(client, "get", f"/api/annotations/{annotation_id}")
    return _response_json(response)


class _SqlTimingCollector:
    def __init__(self, engine):
        self._engine = engine
        self.statement_count = 0
        self.total_seconds = 0.0

    def _before_cursor_execute(
        self,
        conn,
        cursor,
        statement,
        parameters,
        context,
        executemany,
    ):
        starts = conn.info.setdefault("_production_benchmark_query_starts", [])
        starts.append(perf_counter())

    def _after_cursor_execute(
        self,
        conn,
        cursor,
        statement,
        parameters,
        context,
        executemany,
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


def _write_profile_artifacts(
    profile_dir: Path, name: str, profiler, sql_collector
) -> dict:
    profile_dir.mkdir(parents=True, exist_ok=True)
    stats_path = profile_dir / f"{name}.profile.json"
    summary_path = profile_dir / f"{name}.summary.txt"

    profile_data = profiler.export()
    stats_path.write_text(json.dumps(profile_data, indent=2))

    summary_buffer = StringIO()
    summary_buffer.write(
        f"Captured {len(profile_data['functions'])} functions across {profile_data['thread_count']} threads\n\n"
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
            f"{function_row['filename']}:{function_row['line_number']}({function_row['function_name']})\n"
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
) -> dict:
    durations = []
    last_metadata = {}
    profiling = None

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

    case = {
        "name": name,
        "iterations": durations,
        "median_seconds": statistics.median(durations),
        "metadata": last_metadata,
    }
    if profiling is not None:
        case["profiling"] = profiling
    return case


def _pick_seed_analysis_id(study_id: str) -> str:
    analysis_id = (
        db.session.execute(
            select(Analysis.id)
            .where(Analysis.study_id == study_id)
            .order_by(Analysis.id)
        )
        .scalars()
        .first()
    )
    if analysis_id is None:
        raise RuntimeError(f"Study {study_id} does not have an analysis to benchmark")
    return analysis_id


def _load_base_study_detail(client: Client, base_study_id: str) -> dict:
    response = _request(
        client,
        "get",
        f"/api/base-studies/{base_study_id}",
        params={"nested": "false", "info": "true"},
    )
    return _response_json(response)


def _load_study_detail(client: Client, study_id: str) -> dict:
    response = _request(
        client,
        "get",
        f"/api/studies/{study_id}",
        params={"nested": "true"},
    )
    return _response_json(response)


def _load_analysis_detail(client: Client, analysis_id: str) -> dict:
    response = _request(
        client,
        "get",
        f"/api/analyses/{analysis_id}",
        params={"nested": "true"},
    )
    return _response_json(response)


def _list_annotations_for_studyset(client: Client, studyset_id: str) -> dict:
    response = _request(
        client,
        "get",
        "/api/annotations/",
        params={"studyset_id": studyset_id},
    )
    return _response_json(response)


def _list_frontend_base_studies(
    client: Client, *, search_term: str | None = None
) -> dict:
    params = {
        "page": "1",
        "page_size": "10",
        "desc": "true",
        "flat": "true",
        "info": "false",
        "data_type": "coordinate",
        "level": "group",
    }
    if search_term:
        params["search"] = search_term
    response = _request(client, "get", "/api/base-studies/", params=params)
    return _response_json(response)


def _case_name(base_name: str, scale: int | None = None) -> str:
    if scale is None:
        return base_name
    return f"{base_name}_{scale}"


def run(
    iterations: int,
    *,
    profile_dir: Path | None = None,
    seed_study_limit: int | None = None,
    bulk_post_limit: int | None = None,
) -> dict:
    app = _load_app()
    ctx = app.app_context()
    ctx.push()
    client = Client(token=TOKEN)
    client_ref = SimpleNamespace(current=client)
    rollback_writes = _env_flag("PRODUCTION_BENCHMARK_ROLLBACK_WRITES", True)

    try:
        with _benchmark_write_isolation(enabled=rollback_writes):
            _ensure_user()
            (
                base_study_ids,
                study_ids,
                search_term,
                available_seed_study_count,
            ) = _pick_seed_studies_from_base_studies(seed_study_limit)
            bulk_post_payload, available_bulk_post_count = _pick_bulk_post_payload(
                bulk_post_limit
            )
            source_study_id = study_ids[0]
            source_analysis_id = _pick_seed_analysis_id(source_study_id)
            study_scale = len(study_ids)
            bulk_post_scale = len(bulk_post_payload)

            shared_studyset_id = _create_large_studyset(
                client, study_ids, suffix="seed"
            )
            shared_annotation_id = _create_large_annotation(
                client, shared_studyset_id, suffix="seed"
            )
            shared_annotation = _load_annotation_payload(client, shared_annotation_id)
            note_count = len(shared_annotation.get("notes", []))

            cases = [
                _benchmark_case(
                    _case_name("post_studyset_seed_studies", study_scale),
                    iterations,
                    lambda index: {
                        "studyset_id": _create_large_studyset(
                            client_ref.current,
                            study_ids,
                            suffix=f"{index}-{uuid4().hex[:8]}",
                        ),
                        "study_count": study_scale,
                    },
                    profile_dir=profile_dir,
                    client_ref=client_ref,
                    rollback_after=rollback_writes,
                ),
                _benchmark_case(
                    _case_name("post_annotation_on_seed_studyset", study_scale),
                    iterations,
                    lambda index: {
                        "annotation_id": _create_large_annotation(
                            client_ref.current,
                            shared_studyset_id,
                            suffix=f"{index}-{uuid4().hex[:8]}",
                        ),
                        "study_count": study_scale,
                    },
                    profile_dir=profile_dir,
                    client_ref=client_ref,
                    rollback_after=rollback_writes,
                ),
                _benchmark_case(
                    "put_annotation_note_keys",
                    iterations,
                    lambda index: _update_annotation_case(
                        client_ref.current,
                        shared_annotation_id,
                        variant=bool(index % 2),
                    ),
                    profile_dir=profile_dir,
                    client_ref=client_ref,
                    rollback_after=rollback_writes,
                ),
                _benchmark_case(
                    "get_annotation_large",
                    iterations,
                    lambda _index: {
                        "note_count": len(
                            _load_annotation_payload(
                                client_ref.current, shared_annotation_id
                            ).get("notes", [])
                        )
                    },
                    profile_dir=profile_dir,
                    client_ref=client_ref,
                ),
                _benchmark_case(
                    "list_annotations_for_studyset_frontend",
                    iterations,
                    lambda _index: {
                        "result_count": len(
                            _list_annotations_for_studyset(
                                client_ref.current, shared_studyset_id
                            ).get("results", [])
                        )
                    },
                    profile_dir=profile_dir,
                    client_ref=client_ref,
                ),
                _benchmark_case(
                    _case_name("get_nested_studyset_seed", study_scale),
                    iterations,
                    lambda _index: {
                        "study_count": len(
                            _response_json(
                                _request(
                                    client_ref.current,
                                    "get",
                                    f"/api/studysets/{shared_studyset_id}",
                                    params={"nested": "true"},
                                )
                            ).get("studies", [])
                        )
                    },
                    profile_dir=profile_dir,
                    client_ref=client_ref,
                ),
                _benchmark_case(
                    "get_study_nested_frontend",
                    iterations,
                    lambda _index: {
                        "analysis_count": len(
                            _load_study_detail(client_ref.current, source_study_id).get(
                                "analyses", []
                            )
                        )
                    },
                    profile_dir=profile_dir,
                    client_ref=client_ref,
                ),
                _benchmark_case(
                    "get_analysis_nested_frontend",
                    iterations,
                    lambda _index: {
                        "point_count": len(
                            _load_analysis_detail(
                                client_ref.current, source_analysis_id
                            ).get("points", [])
                        )
                    },
                    profile_dir=profile_dir,
                    client_ref=client_ref,
                ),
                _benchmark_case(
                    "browse_base_studies_frontend",
                    iterations,
                    lambda _index: {
                        "result_count": len(
                            _list_frontend_base_studies(client_ref.current).get(
                                "results", []
                            )
                        )
                    },
                    profile_dir=profile_dir,
                    client_ref=client_ref,
                ),
                _benchmark_case(
                    "search_base_studies_text",
                    iterations,
                    lambda _index: {
                        "query": search_term,
                        "total_count": _response_json(
                            _request(
                                client_ref.current,
                                "get",
                                "/api/base-studies/",
                                params={"search": search_term, "page_size": "50"},
                            )
                        )["metadata"]["total_count"],
                    },
                    profile_dir=profile_dir,
                    client_ref=client_ref,
                ),
                _benchmark_case(
                    "search_base_studies_frontend",
                    iterations,
                    lambda _index: {
                        "query": search_term,
                        "result_count": len(
                            _list_frontend_base_studies(
                                client_ref.current, search_term=search_term
                            ).get("results", [])
                        ),
                    },
                    profile_dir=profile_dir,
                    client_ref=client_ref,
                ),
                _benchmark_case(
                    "search_base_studies_info",
                    iterations,
                    lambda _index: {
                        "query": search_term,
                        "total_count": _response_json(
                            _request(
                                client_ref.current,
                                "get",
                                "/api/base-studies/",
                                params={
                                    "search": search_term,
                                    "page_size": "50",
                                    "info": "true",
                                },
                            )
                        )["metadata"]["total_count"],
                    },
                    profile_dir=profile_dir,
                    client_ref=client_ref,
                ),
                _benchmark_case(
                    "get_base_study_detail_frontend",
                    iterations,
                    lambda _index: {
                        "version_count": len(
                            _load_base_study_detail(
                                client_ref.current, base_study_ids[0]
                            ).get("versions", [])
                        )
                    },
                    profile_dir=profile_dir,
                    client_ref=client_ref,
                ),
                _benchmark_case(
                    _case_name("post_base_studies_bulk_full_objects", bulk_post_scale),
                    iterations,
                    lambda _index: {
                        "count": len(
                            _response_json(
                                _request(
                                    client_ref.current,
                                    "post",
                                    "/api/base-studies/",
                                    data=bulk_post_payload,
                                )
                            )
                        ),
                        "requested_count": bulk_post_scale,
                    },
                    profile_dir=profile_dir,
                    client_ref=client_ref,
                    rollback_after=rollback_writes,
                ),
                _benchmark_case(
                    "clone_study",
                    iterations,
                    lambda _index: {
                        "study_id": _response_json(
                            _request(
                                client_ref.current,
                                "post",
                                f"/api/studies/?source_id={source_study_id}",
                                data={},
                            )
                        )["id"]
                    },
                    profile_dir=profile_dir,
                    client_ref=client_ref,
                    rollback_after=rollback_writes,
                ),
            ]

            return {
                "service": "store",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "iterations_per_case": iterations,
                "rollback_writes": rollback_writes,
                "study_count": len(study_ids),
                "available_seed_study_count": available_seed_study_count,
                "base_study_count": len(base_study_ids),
                "bulk_post_count": bulk_post_scale,
                "available_bulk_post_count": available_bulk_post_count,
                "shared_annotation_notes": note_count,
                "cases": cases,
            }
    finally:
        if hasattr(client, "client") and hasattr(client.client, "close"):
            client.client.close()
        ctx.pop()


def _update_annotation_case(
    client: Client, annotation_id: str, *, variant: bool
) -> dict:
    payload = _load_annotation_payload(client, annotation_id)
    payload["name"] = (
        "production-benchmark-annotation-updated-a"
        if variant
        else "production-benchmark-annotation-updated-b"
    )
    payload["note_keys"] = {
        "included": {"type": "boolean", "order": 0, "default": variant},
        "confidence": {
            "type": "string",
            "order": 1,
            "default": "high" if variant else "medium",
        },
        "priority": {"type": "number", "order": 2, "default": 2 if variant else 1},
        "reviewed": {"type": "boolean", "order": 3, "default": variant},
    }

    for note in payload.get("notes", [])[: min(25, len(payload.get("notes", [])))]:
        note.setdefault("note", {})
        note["note"]["included"] = variant
        note["note"]["confidence"] = "high" if variant else "medium"
        note["note"]["priority"] = 2 if variant else 1
        note["note"]["reviewed"] = variant

    response = _request(
        client, "put", f"/api/annotations/{annotation_id}", data=payload
    )
    body = _response_json(response)
    return {"note_count": len(body.get("notes", []))}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--iterations", type=int, default=5)
    parser.add_argument("--output", required=True)
    parser.add_argument("--profile-dir")
    parser.add_argument("--scales")
    args = parser.parse_args()

    output_path = Path(args.output)
    profile_dir = args.profile_dir or os.environ.get("PRODUCTION_BENCHMARK_PROFILE_DIR")
    scales = _parse_scales(
        (
            args.scales
            if args.scales is not None
            else os.environ.get("PRODUCTION_BENCHMARK_SCALES")
        ),
        label="scales",
    )

    resolved_profile_dir = (
        Path(profile_dir)
        if profile_dir
        else output_path.parent / "profiles" / output_path.stem
    )
    results = run_scaling_profile(
        args.iterations,
        profile_dir=resolved_profile_dir,
        scales=scales,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w") as handle:
        json.dump(results, handle, indent=2)
        handle.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
