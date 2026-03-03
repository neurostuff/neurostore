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
from neurosynth_compose.models import Annotation, MetaAnalysis, Project, Studyset, User
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


def _request_with_nested_fallback(client: Client, path: str, *, params: dict):
    response = client.get(path, params=params)
    if response.status_code < 400:
        return response, True

    if (
        response.status_code == 400
        and params.get("nested") == "true"
        and b"Extra query parameter(s) nested not in spec" in response.data
    ):
        fallback_params = dict(params)
        fallback_params.pop("nested", None)
        return _request(client, "get", path, params=fallback_params), False

    raise RuntimeError(
        f"GET {path} failed with {response.status_code}: {response.data}"
    )


def _ensure_user() -> None:
    user = db.session.execute(
        select(User).where(User.external_id == "user1-id")
    ).scalar_one_or_none()
    if user is None:
        db.session.add(User(name="production-regression", external_id="user1-id"))
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


def _first_accessible_ids(client: Client) -> tuple[str | None, str | None]:
    project_list = _response_json(
        _request(
            client,
            "get",
            "/api/projects",
            params={"page_size": "1", "sort": "created_at"},
        )
    )
    meta_list = _response_json(
        _request(
            client,
            "get",
            "/api/meta-analyses",
            params={"page_size": "1", "sort": "created_at"},
        )
    )

    project_id = None
    meta_id = None
    if project_list["results"]:
        project_id = project_list["results"][0]["id"]
    if meta_list["results"]:
        meta_id = meta_list["results"][0]["id"]
    return project_id, meta_id


def _fallback_ids() -> tuple[str | None, str | None]:
    project_id = db.session.execute(
        select(Project.id).where(Project.public.is_(True)).order_by(Project.id).limit(1)
    ).scalar_one_or_none()
    meta_id = db.session.execute(
        select(MetaAnalysis.id)
        .where(MetaAnalysis.public.is_(True))
        .order_by(MetaAnalysis.id)
        .limit(1)
    ).scalar_one_or_none()
    return project_id, meta_id


def _resolve_cached_ids(meta_id: str | None) -> tuple[str | None, str | None]:
    if meta_id is not None:
        cached_ids = db.session.execute(
            select(MetaAnalysis.cached_studyset_id, MetaAnalysis.cached_annotation_id)
            .where(MetaAnalysis.id == meta_id)
        ).one_or_none()
        if cached_ids and cached_ids[1]:
            return cached_ids[0], cached_ids[1]

    studyset_id = db.session.execute(
        select(Studyset.id).order_by(Studyset.id).limit(1)
    ).scalar_one_or_none()
    annotation_id = db.session.execute(
        select(Annotation.id).order_by(Annotation.id).limit(1)
    ).scalar_one_or_none()
    return studyset_id, annotation_id


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


def _list_with_optional_nested(
    client: Client, path: str, *, page_size: str, sort: str = "created_at"
) -> dict:
    response, nested_supported = _request_with_nested_fallback(
        client,
        path,
        params={"page_size": page_size, "sort": sort, "nested": "true"},
    )
    payload = _response_json(response)
    return {
        "total_count": payload["metadata"]["total_count"],
        "nested_supported": nested_supported,
    }


def _detail_with_optional_nested(client: Client, path: str, *, id_key: str) -> dict:
    response, nested_supported = _request_with_nested_fallback(
        client,
        path,
        params={"nested": "true"},
    )
    payload = _response_json(response)
    return {id_key: payload["id"], "nested_supported": nested_supported}


def _create_project(
    client: Client,
    *,
    suffix: str,
    cached_studyset_id: str | None = None,
    cached_annotation_id: str | None = None,
) -> dict:
    payload = {
        "name": f"production-regression-project-{suffix}",
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
        "filter": f"production-regression-filter-{suffix}",
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
        "name": f"production-regression-meta-{suffix}",
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


def _update_meta_analysis(client: Client, meta_analysis_id: str, *, variant: bool) -> dict:
    payload = {
        "name": (
            "production-regression-meta-updated-a"
            if variant
            else "production-regression-meta-updated-b"
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
        project_id, meta_id = _first_accessible_ids(client)
        if project_id is None or meta_id is None:
            fallback_project_id, fallback_meta_id = _fallback_ids()
            project_id = project_id or fallback_project_id
            meta_id = meta_id or fallback_meta_id

        cached_studyset_id, cached_annotation_id = _resolve_cached_ids(meta_id)
        if cached_annotation_id is None:
            raise RuntimeError(
                "Need at least one cached annotation in the restored compose database"
            )

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
                lambda _index: _list_with_optional_nested(
                    client,
                    "/api/meta-analyses",
                    page_size="10",
                ),
            ),
        ]

        if project_id is not None:
            cases.append(
                _benchmark_case(
                    "get_project_detail",
                    iterations,
                    lambda _index: {
                        "project_id": _response_json(
                            _request(client, "get", f"/api/projects/{project_id}")
                        )["id"]
                    },
                )
            )

        if meta_id is not None:
            cases.append(
                _benchmark_case(
                    "get_meta_analysis_detail",
                    iterations,
                    lambda _index: {
                        "meta_analysis_id": _response_json(
                            _request(client, "get", f"/api/meta-analyses/{meta_id}")
                        )["id"]
                    },
                )
            )
            cases.append(
                _benchmark_case(
                    "get_meta_analysis_detail_nested",
                    iterations,
                    lambda _index: _detail_with_optional_nested(
                        client,
                        f"/api/meta-analyses/{meta_id}",
                        id_key="meta_analysis_id",
                    ),
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
