#!/usr/bin/env python3
"""Compare benchmark timings and fail only on material slowdowns."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


def load_results(path: Path) -> dict:
    with path.open() as handle:
        return json.load(handle)


def _case_suffix(case: dict, occurrence: int) -> str:
    for key in (
        "workload_size",
        "scale",
        "requested_count",
        "note_count",
        "study_count",
        "annotation_count",
        "base_study_count",
    ):
        value = case.get(key) or (case.get("metadata") or {}).get(key)
        if value is not None:
            return f"{key}={value}"

    profiling = case.get("profiling") or {}
    for path_key in ("stats_path", "summary_path"):
        match = re.search(r"/scale-([^/]+)/", str(profiling.get(path_key) or ""))
        if match:
            return f"scale={match.group(1)}"

    return f"sample={occurrence}"


def _deduplicate_case_names(cases: list[dict]) -> list[dict]:
    name_counts = Counter(case["name"] for case in cases)
    seen = defaultdict(int)
    deduplicated = []
    for case in cases:
        case_copy = dict(case)
        name = case["name"]
        if name_counts[name] > 1:
            seen[name] += 1
            case_copy["name"] = f"{name} [{_case_suffix(case, seen[name])}]"
        deduplicated.append(case_copy)
    return deduplicated


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return values[0]

    sorted_values = sorted(values)
    rank = (len(sorted_values) - 1) * percentile
    lower_index = int(rank)
    upper_index = min(lower_index + 1, len(sorted_values) - 1)
    fraction = rank - lower_index
    return sorted_values[lower_index] + (
        sorted_values[upper_index] - sorted_values[lower_index]
    ) * fraction


def _with_iteration_metrics(case: dict, *, drop_first_iteration: bool) -> dict:
    if not drop_first_iteration:
        return case

    iterations = list(case.get("iterations") or [])
    if len(iterations) <= 1:
        return case

    measured = iterations[1:]
    case = dict(case)
    case["iterations"] = measured
    case["median_seconds"] = _percentile(measured, 0.5)
    case["p95_seconds"] = _percentile(measured, 0.95)
    return case


def extract_cases(results: dict, *, drop_first_iteration: bool = False) -> list[dict]:
    cases = results.get("cases") or []
    if cases:
        return _deduplicate_case_names(
            [
                _with_iteration_metrics(
                    case, drop_first_iteration=drop_first_iteration
                )
                for case in cases
            ]
        )

    extracted_cases = []
    for case_analysis in results.get("case_analyses", []):
        for sample in case_analysis.get("raw_case_samples", []):
            extracted_cases.append(
                {
                    "name": sample.get("case_name") or case_analysis.get("case"),
                    "median_seconds": sample["median_seconds"],
                    "p95_seconds": sample.get("p95_seconds"),
                }
            )
    return _deduplicate_case_names(extracted_cases)


def format_pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def format_seconds(value: float) -> str:
    return f"{value:.4f}s"


def case_metric(case: dict, metric: str) -> float:
    if metric in case and case[metric] is not None:
        return float(case[metric])
    if metric == "p95_seconds" and "median_seconds" in case:
        return float(case["median_seconds"])
    raise KeyError(metric)


def build_rows(
    baseline_cases: dict,
    candidate_cases: dict,
    threshold: float,
    metric: str = "p95_seconds",
    min_delta_seconds: float = 0.0,
) -> tuple[list[dict], list[dict], list[dict]]:
    rows = []
    slowdowns = []
    mismatches = []

    for name, candidate in candidate_cases.items():
        baseline = baseline_cases.get(name)
        if baseline is None:
            mismatches.append(
                {
                    "name": name,
                    "reason": "missing in baseline",
                }
            )
            continue

        base_value = case_metric(baseline, metric)
        cand_value = case_metric(candidate, metric)
        delta = cand_value - base_value
        ratio = 0.0 if base_value == 0 else delta / base_value
        row = {
            "name": name,
            "baseline": base_value,
            "candidate": cand_value,
            "delta": delta,
            "ratio": ratio,
            "status": "ok",
        }
        if ratio > threshold and delta > min_delta_seconds:
            row["status"] = "slow"
            slowdowns.append(row)
        rows.append(row)

    for name in baseline_cases:
        if name not in candidate_cases:
            mismatches.append(
                {
                    "name": name,
                    "reason": "missing in candidate",
                }
            )

    rows.sort(key=lambda row: row["name"])
    mismatches.sort(key=lambda row: row["name"])
    return rows, slowdowns, mismatches


def render_report(
    service: str,
    rows: list[dict],
    slowdowns: list[dict],
    mismatches: list[dict],
    threshold: float,
    metric: str = "p95_seconds",
    min_delta_seconds: float = 0.0,
) -> str:
    lines = [
        f"**Service:** `{service}`",
        f"**Metric:** `{metric}`",
        f"**Threshold:** `{format_pct(threshold)} slower`",
        f"**Minimum absolute slowdown:** `{format_seconds(min_delta_seconds)}`",
        "",
        "| Case | Baseline | Candidate | Delta | Status |",
        "| --- | ---: | ---: | ---: | --- |",
    ]

    for row in rows:
        delta_label = (
            f"{format_seconds(row['delta'])} ({format_pct(row['ratio'])})"
            if row["baseline"] != 0
            else format_seconds(row["delta"])
        )
        lines.append(
            "| {name} | {baseline} | {candidate} | {delta} | {status} |".format(
                name=row["name"],
                baseline=format_seconds(row["baseline"]),
                candidate=format_seconds(row["candidate"]),
                delta=delta_label,
                status=row["status"],
            )
        )

    if slowdowns:
        lines.extend(["", "Slowdowns:"])
        for slowdown in slowdowns:
            if "reason" in slowdown:
                lines.append(f"- {slowdown['name']}: {slowdown['reason']}")
                continue
            lines.append(
                "- {name}: candidate {metric} {candidate} vs baseline {baseline} ({ratio})".format(
                    name=slowdown["name"],
                    metric=metric,
                    candidate=format_seconds(slowdown["candidate"]),
                    baseline=format_seconds(slowdown["baseline"]),
                    ratio=format_pct(slowdown["ratio"]),
                )
            )
    else:
        lines.extend(["", "No slowdowns over the configured threshold."])

    if mismatches:
        lines.extend(["", "Case mismatches (reported only):"])
        for mismatch in mismatches:
            lines.append(f"- {mismatch['name']}: {mismatch['reason']}")

    return "\n".join(lines)


def maybe_append_summary(path: str | None, report: str) -> None:
    if not path:
        return
    with Path(path).open("a") as handle:
        handle.write("## Production Benchmark Comparison\n\n")
        handle.write(report)
        handle.write("\n\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--metric", default="p95_seconds")
    parser.add_argument("--threshold", type=float, default=0.2)
    parser.add_argument(
        "--min-delta-seconds",
        type=float,
        default=0.0,
        help=(
            "Only fail a slowdown when the relative threshold is exceeded and "
            "the absolute delta is larger than this many seconds."
        ),
    )
    parser.add_argument("--summary-file")
    parser.add_argument(
        "--drop-first-iteration",
        action="store_true",
        help=(
            "Recompute median/p95 from the per-case iterations after dropping "
            "the first sample for both baseline and candidate."
        ),
    )
    args = parser.parse_args()

    baseline = load_results(Path(args.baseline))
    candidate = load_results(Path(args.candidate))
    service = candidate.get("service") or baseline.get("service") or "unknown"

    baseline_cases = {
        case["name"]: case
        for case in extract_cases(
            baseline, drop_first_iteration=args.drop_first_iteration
        )
    }
    candidate_cases = {
        case["name"]: case
        for case in extract_cases(
            candidate, drop_first_iteration=args.drop_first_iteration
        )
    }
    rows, slowdowns, mismatches = build_rows(
        baseline_cases,
        candidate_cases,
        args.threshold,
        metric=args.metric,
        min_delta_seconds=args.min_delta_seconds,
    )
    report = render_report(
        service,
        rows,
        slowdowns,
        mismatches,
        args.threshold,
        metric=args.metric,
        min_delta_seconds=args.min_delta_seconds,
    )

    print(report)
    maybe_append_summary(args.summary_file, report)
    return 1 if slowdowns else 0


if __name__ == "__main__":
    raise SystemExit(main())
