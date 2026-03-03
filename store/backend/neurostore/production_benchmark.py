"""Benchmark high-impact Neurostore endpoints against a restored production dump."""

from __future__ import annotations

import argparse
import json
import os
import re
import statistics
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from urllib.parse import urlencode
from uuid import uuid4

from jose.jwt import encode
from sqlalchemy import select

from neurostore.database import db
from neurostore.models import BaseStudy, Study, User
from neurostore.tests.request_utils import Client

TOKEN = encode({"sub": "user1-id"}, "abc", algorithm="HS256")


def _load_app():
    from neurostore.core import app as raw_app

    app = raw_app if getattr(raw_app, "config", None) else raw_app._app
    app.config.from_object(
        os.environ.get("APP_SETTINGS", "neurostore.config.TestingConfig")
    )
    return app


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


def _extract_search_term(base_study_name: str, fallback_id: str) -> str:
    for candidate in re.split(r"[^A-Za-z0-9]+", base_study_name or ""):
        if len(candidate) >= 4:
            return candidate
    return str(fallback_id)[:8]


def _pick_seed_studies_from_base_studies(limit: int = 500) -> tuple[list[str], list[str], str]:
    candidate_queries = [
        select(BaseStudy.id, BaseStudy.name, Study.id)
        .join(Study, Study.base_study_id == BaseStudy.id)
        .where(
            BaseStudy.is_active.is_(True),
            BaseStudy.public.is_(True),
            Study.public.is_(True),
        )
        .order_by(BaseStudy.id, Study.id),
        select(BaseStudy.id, BaseStudy.name, Study.id)
        .join(Study, Study.base_study_id == BaseStudy.id)
        .where(
            BaseStudy.is_active.is_(True),
            Study.public.is_(True),
        )
        .order_by(BaseStudy.id, Study.id),
    ]

    selected_rows = []
    for query in candidate_queries:
        selected_rows = []
        seen_base_studies = set()
        for base_study_id, base_study_name, study_id in db.session.execute(query):
            if base_study_id in seen_base_studies:
                continue
            seen_base_studies.add(base_study_id)
            selected_rows.append((base_study_id, base_study_name or "", study_id))
            if len(selected_rows) == limit:
                break
        if len(selected_rows) == limit:
            break

    if len(selected_rows) < limit:
        raise RuntimeError(
            "Need at least "
            f"{limit} active base-studies with versioned studies, found {len(selected_rows)}"
        )

    base_study_ids = [row[0] for row in selected_rows]
    study_ids = [row[2] for row in selected_rows]
    search_term = _extract_search_term(selected_rows[0][1], selected_rows[0][0])
    return base_study_ids, study_ids, search_term


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


def run(iterations: int) -> dict:
    app = _load_app()
    ctx = app.app_context()
    ctx.push()
    client = Client(token=TOKEN)

    try:
        _ensure_user()
        base_study_ids, study_ids, search_term = _pick_seed_studies_from_base_studies()
        source_study_id = study_ids[0]

        shared_studyset_id = _create_large_studyset(client, study_ids, suffix="seed")
        shared_annotation_id = _create_large_annotation(
            client, shared_studyset_id, suffix="seed"
        )
        shared_annotation = _load_annotation_payload(client, shared_annotation_id)
        note_count = len(shared_annotation.get("notes", []))

        cases = [
            _benchmark_case(
                "post_studyset_500_studies",
                iterations,
                lambda index: {
                    "studyset_id": _create_large_studyset(
                        client, study_ids, suffix=f"{index}-{uuid4().hex[:8]}"
                    )
                },
            ),
            _benchmark_case(
                "post_annotation_on_500_study_studyset",
                iterations,
                lambda index: {
                    "annotation_id": _create_large_annotation(
                        client, shared_studyset_id, suffix=f"{index}-{uuid4().hex[:8]}"
                    )
                },
            ),
            _benchmark_case(
                "put_annotation_note_keys",
                iterations,
                lambda index: _update_annotation_case(
                    client, shared_annotation_id, variant=bool(index % 2)
                ),
            ),
            _benchmark_case(
                "get_annotation_large",
                iterations,
                lambda _index: {
                    "note_count": len(
                        _load_annotation_payload(client, shared_annotation_id).get(
                            "notes", []
                        )
                    )
                },
            ),
            _benchmark_case(
                "get_nested_studyset_500",
                iterations,
                lambda _index: {
                    "study_count": len(
                        _response_json(
                            _request(
                                client,
                                "get",
                                f"/api/studysets/{shared_studyset_id}",
                                params={"nested": "true"},
                            )
                        ).get("studies", [])
                    )
                },
            ),
            _benchmark_case(
                "search_base_studies_text",
                iterations,
                lambda _index: {
                    "query": search_term,
                    "total_count": _response_json(
                        _request(
                            client,
                            "get",
                            "/api/base-studies/",
                            params={"search": search_term, "page_size": "50"},
                        )
                    )["metadata"]["total_count"],
                },
            ),
            _benchmark_case(
                "search_base_studies_info",
                iterations,
                lambda _index: {
                    "query": search_term,
                    "total_count": _response_json(
                        _request(
                            client,
                            "get",
                            "/api/base-studies/",
                            params={
                                "search": search_term,
                                "page_size": "25",
                                "info": "true",
                            },
                        )
                    )["metadata"]["total_count"],
                },
            ),
            _benchmark_case(
                "clone_study",
                iterations,
                lambda _index: {
                    "study_id": _response_json(
                        _request(
                            client,
                            "post",
                            f"/api/studies/?source_id={source_study_id}",
                            data={},
                        )
                    )["id"]
                },
            ),
        ]

        return {
            "service": "store",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "iterations_per_case": iterations,
            "study_count": len(study_ids),
            "base_study_count": len(base_study_ids),
            "shared_annotation_notes": note_count,
            "cases": cases,
        }
    finally:
        if hasattr(client, "client") and hasattr(client.client, "close"):
            client.client.close()
        ctx.pop()


def _update_annotation_case(client: Client, annotation_id: str, *, variant: bool) -> dict:
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

    response = _request(client, "put", f"/api/annotations/{annotation_id}", data=payload)
    body = _response_json(response)
    return {"note_count": len(body.get("notes", []))}


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
