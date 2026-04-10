#!/usr/bin/env python3
"""Compare median benchmark timings and fail only on material slowdowns."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def load_results(path: Path) -> dict:
    with path.open() as handle:
        return json.load(handle)


def extract_cases(results: dict) -> list[dict]:
    cases = results.get("cases") or []
    if cases:
        return cases

    extracted_cases = []
    for case_analysis in results.get("case_analyses", []):
        for sample in case_analysis.get("raw_case_samples", []):
            extracted_cases.append(
                {
                    "name": sample.get("case_name") or case_analysis.get("case"),
                    "median_seconds": sample["median_seconds"],
                }
            )
    return extracted_cases


def format_pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def format_seconds(value: float) -> str:
    return f"{value:.4f}s"


def build_rows(
    baseline_cases: dict, candidate_cases: dict, threshold: float
) -> tuple[list[dict], list[dict]]:
    rows = []
    slowdowns = []

    for name, candidate in candidate_cases.items():
        baseline = baseline_cases.get(name)
        if baseline is None:
            slowdowns.append(
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
            row["status"] = "slow"
            slowdowns.append(row)
        rows.append(row)

    for name in baseline_cases:
        if name not in candidate_cases:
            slowdowns.append(
                {
                    "name": name,
                    "reason": "missing in candidate",
                }
            )

    rows.sort(key=lambda row: row["name"])
    return rows, slowdowns


def render_report(
    service: str, rows: list[dict], slowdowns: list[dict], threshold: float
) -> str:
    lines = [
        f"**Service:** `{service}`",
        f"**Threshold:** `{format_pct(threshold)} slower`",
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
                "- {name}: candidate median {candidate} vs baseline {baseline} ({ratio})".format(
                    name=slowdown["name"],
                    candidate=format_seconds(slowdown["candidate"]),
                    baseline=format_seconds(slowdown["baseline"]),
                    ratio=format_pct(slowdown["ratio"]),
                )
            )
    else:
        lines.extend(["", "No slowdowns over the configured threshold."])

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
    parser.add_argument("--threshold", type=float, default=0.2)
    parser.add_argument("--summary-file")
    args = parser.parse_args()

    baseline = load_results(Path(args.baseline))
    candidate = load_results(Path(args.candidate))
    service = candidate.get("service") or baseline.get("service") or "unknown"

    baseline_cases = {case["name"]: case for case in extract_cases(baseline)}
    candidate_cases = {case["name"]: case for case in extract_cases(candidate)}
    rows, slowdowns = build_rows(baseline_cases, candidate_cases, args.threshold)
    report = render_report(service, rows, slowdowns, args.threshold)

    print(report)
    maybe_append_summary(args.summary_file, report)
    return 1 if slowdowns else 0


if __name__ == "__main__":
    raise SystemExit(main())
