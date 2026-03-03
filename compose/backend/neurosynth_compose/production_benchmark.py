"""Benchmark high-impact Neurosynth Compose endpoints on restored production data."""

from __future__ import annotations

import argparse
import json
import os
import statistics
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from uuid import uuid4

from jose.jwt import encode
from sqlalchemy import select

from neurosynth_compose.database import db
from neurosynth_compose.models import MetaAnalysis, User
from neurosynth_compose.tests.request_utils import Client

TOKEN = encode({"sub": "user1-id"}, "abc", algorithm="HS256")


def _response_json(response):
    payload = getattr(response, "json", None)
    if callable(payload):
        return payload()
    return payload


def _request(client: Client, method: str, path: str, *, data=None, params=None):
    response = getattr(client, method)(path, data=data, params=params)
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


def _load_app():
    from neurosynth_compose import create_app
    from neurosynth_compose.resources import analysis as analysis_resources

    app = create_app()
    app.config.from_object(
        os.environ.get("APP_SETTINGS", "neurosynth_compose.config.TestingConfig")
    )
    _install_local_neurostore_stub(analysis_resources)
    return app


def _install_local_neurostore_stub(analysis_resources) -> None:
    def _stub_create_or_update_neurostore_study(ns_study):
        if not ns_study.neurostore_id:
            project_id = getattr(ns_study, "project_id", None) or "unknown"
            ns_study.neurostore_id = f"local-neurostore-study-{project_id}"
        ns_study.status = "OK"
        ns_study.exception = None
        ns_study.traceback = None
        return ns_study

    analysis_resources.create_or_update_neurostore_study = (
        _stub_create_or_update_neurostore_study
    )


def _pick_seed_cached_ids() -> tuple[str | None, str]:
    cached_ids = db.session.execute(
        select(MetaAnalysis.cached_studyset_id, MetaAnalysis.cached_annotation_id)
        .where(MetaAnalysis.cached_annotation_id.is_not(None))
        .order_by(MetaAnalysis.public.desc(), MetaAnalysis.id)
        .limit(1)
    ).one_or_none()
    if not cached_ids:
        raise RuntimeError(
            "Need at least one meta-analysis with a cached annotation "
            "in the restored compose database"
        )
    return cached_ids[0], cached_ids[1]


def _benchmark_case(name: str, iterations: int, fn) -> dict:
    durations = []
    last_metadata = {}
    for index in range(iterations):
        started = perf_counter()
        last_metadata = fn(index) or {}
        durations.append(perf_counter() - started)
    return {
        "name": name,
        "iterations": durations,
        "median_seconds": statistics.median(durations),
        "metadata": last_metadata,
    }


def _create_project(
    client: Client,
    *,
    suffix: str,
    cached_studyset_id: str | None = None,
    cached_annotation_id: str | None = None,
) -> dict:
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
    return _response_json(_request(client, "post", "/api/projects", data=payload))


def _create_specification(client: Client, *, suffix: str) -> dict:
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
    cached_studyset_id: str | None = None,
    cached_annotation_id: str | None = None,
) -> dict:
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


def _update_meta_analysis(
    client: Client, meta_analysis_id: str, *, variant: bool
) -> dict:
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


def run(iterations: int) -> dict:
    app = _load_app()
    ctx = app.app_context()
    ctx.push()
    client = Client(token=TOKEN)

    try:
        _ensure_user()
        cached_studyset_id, cached_annotation_id = _pick_seed_cached_ids()

        seeded_project = _create_project(
            client,
            suffix="seed",
            cached_studyset_id=cached_studyset_id,
            cached_annotation_id=cached_annotation_id,
        )
        seeded_project_id = seeded_project["id"]
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

        cases = [
            _benchmark_case(
                "post_project_local_only",
                iterations,
                lambda index: {
                    "project_id": _create_project(
                        client,
                        suffix=f"{index}-{uuid4().hex[:8]}",
                        cached_studyset_id=cached_studyset_id,
                        cached_annotation_id=cached_annotation_id,
                    )["id"]
                },
            ),
            _benchmark_case(
                "post_meta_analysis",
                iterations,
                lambda index: {
                    "meta_analysis_id": _create_meta_analysis(
                        client,
                        seeded_project_id,
                        suffix=f"{index}-{uuid4().hex[:8]}",
                        specification_id=seeded_specification_id,
                        cached_studyset_id=cached_studyset_id,
                        cached_annotation_id=cached_annotation_id,
                    )["id"]
                },
            ),
            _benchmark_case(
                "put_meta_analysis",
                iterations,
                lambda index: {
                    "meta_analysis_id": _update_meta_analysis(
                        client,
                        seeded_meta_analysis_id,
                        variant=bool(index % 2),
                    )["id"]
                },
            ),
            _benchmark_case(
                "list_projects",
                iterations,
                lambda _index: {
                    "total_count": _response_json(
                        _request(
                            client,
                            "get",
                            "/api/projects",
                            params={"page_size": "25", "sort": "created_at"},
                        )
                    )["metadata"]["total_count"]
                },
            ),
            _benchmark_case(
                "list_meta_analyses",
                iterations,
                lambda _index: {
                    "total_count": _response_json(
                        _request(
                            client,
                            "get",
                            "/api/meta-analyses",
                            params={"page_size": "25", "sort": "created_at"},
                        )
                    )["metadata"]["total_count"]
                },
            ),
            _benchmark_case(
                "list_meta_analyses_nested",
                iterations,
                lambda _index: {
                    "total_count": _response_json(
                        _request(
                            client,
                            "get",
                            "/api/meta-analyses",
                            params={
                                "page_size": "10",
                                "sort": "created_at",
                                "nested": "true",
                            },
                        )
                    )["metadata"]["total_count"]
                },
            ),
        ]

        cases.append(
            _benchmark_case(
                "get_project_detail",
                iterations,
                lambda _index: {
                    "project_id": _response_json(
                        _request(client, "get", f"/api/projects/{seeded_project_id}")
                    )["id"]
                },
            )
        )
        cases.append(
            _benchmark_case(
                "get_meta_analysis_detail",
                iterations,
                lambda _index: {
                    "meta_analysis_id": _response_json(
                        _request(
                            client,
                            "get",
                            f"/api/meta-analyses/{seeded_meta_analysis_id}",
                        )
                    )["id"]
                },
            )
        )
        cases.append(
            _benchmark_case(
                "get_meta_analysis_detail_nested",
                iterations,
                lambda _index: {
                    "meta_analysis_id": _response_json(
                        _request(
                            client,
                            "get",
                            f"/api/meta-analyses/{seeded_meta_analysis_id}",
                            params={"nested": "true"},
                        )
                    )["id"]
                },
            )
        )

        return {
            "service": "compose",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "iterations_per_case": iterations,
            "seeded_project_id": seeded_project_id,
            "seeded_specification_id": seeded_specification_id,
            "seeded_meta_analysis_id": seeded_meta_analysis_id,
            "seeded_cached_studyset_id": cached_studyset_id,
            "seeded_cached_annotation_id": cached_annotation_id,
            "cases": cases,
        }
    finally:
        client.close()
        ctx.pop()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--iterations", type=int, default=5)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    results = run(args.iterations)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w") as handle:
        json.dump(results, handle, indent=2)
        handle.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
