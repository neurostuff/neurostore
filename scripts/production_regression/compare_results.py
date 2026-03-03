#!/usr/bin/env python3
"""Compare median endpoint timings and fail only on material regressions."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def load_results(path: Path) -> dict:
    with path.open() as handle:
        return json.load(handle)


def format_pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def format_seconds(value: float) -> str:
    return f"{value:.4f}s"


def build_rows(baseline_cases: dict, candidate_cases: dict, threshold: float) -> tuple[list[dict], list[dict]]:
    rows = []
    regressions = []

    for name, candidate in candidate_cases.items():
        baseline = baseline_cases.get(name)
        if baseline is None:
            regressions.append(
                {
                    "name": name,
                    "reason": "missing in baseline",
                }
            )
            continue

        base_median = float(baseline["median_seconds"])
        cand_median = float(candidate["median_seconds"])
        delta = cand_median - base_median
        ratio = 0.0 if base_median == 0 else delta / base_median
        row = {
            "name": name,
            "baseline": base_median,
            "candidate": cand_median,
            "delta": delta,
            "ratio": ratio,
            "status": "ok",
        }
        if ratio > threshold:
            row["status"] = "regression"
            regressions.append(row)
        rows.append(row)

    for name in baseline_cases:
        if name not in candidate_cases:
            regressions.append(
                {
                    "name": name,
                    "reason": "missing in candidate",
                }
            )

    rows.sort(key=lambda row: row["name"])
    return rows, regressions


def render_report(service: str, rows: list[dict], regressions: list[dict], threshold: float) -> str:
    lines = [
        f"Service: {service}",
        f"Threshold: {format_pct(threshold)} slower",
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

    if regressions:
        lines.extend(["", "Regressions:"])
        for regression in regressions:
            if "reason" in regression:
                lines.append(f"- {regression['name']}: {regression['reason']}")
                continue
            lines.append(
                "- {name}: candidate median {candidate} vs baseline {baseline} ({ratio})".format(
                    name=regression["name"],
                    candidate=format_seconds(regression["candidate"]),
                    baseline=format_seconds(regression["baseline"]),
                    ratio=format_pct(regression["ratio"]),
                )
            )
    else:
        lines.extend(["", "No regressions over the configured threshold."])

    return "\n".join(lines)


def maybe_append_summary(path: str | None, report: str) -> None:
    if not path:
        return
    with Path(path).open("a") as handle:
        handle.write("## Production Regression Comparison\n\n")
        handle.write("```\n")
        handle.write(report)
        handle.write("\n```\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--threshold", type=float, default=0.2)
    parser.add_argument("--summary-file")
    args = parser.parse_args()

    baseline = load_results(Path(args.baseline))
    candidate = load_results(Path(args.candidate))
    service = candidate.get("service") or baseline.get("service") or "unknown"

    baseline_cases = {case["name"]: case for case in baseline.get("cases", [])}
    candidate_cases = {case["name"]: case for case in candidate.get("cases", [])}
    rows, regressions = build_rows(baseline_cases, candidate_cases, args.threshold)
    report = render_report(service, rows, regressions, args.threshold)

    print(report)
    maybe_append_summary(args.summary_file, report)
    return 1 if regressions else 0


if __name__ == "__main__":
    raise SystemExit(main())
