import gzip
import json

import anyio
import httpx
import pytest
from sqlalchemy import select
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route

from neurosynth_compose.gzip_request import GzipRequestMiddleware
from neurosynth_compose.models import Project, User


def _stub(i):
    return {
        "id": f"stub-{i}",
        "title": f"Study {i}",
        "abstractText": "Participants viewed faces during fMRI. " * 20,
        "exclusionTag": None,
        "tags": [],
    }


def test_gzip_project_update_is_saved(session, auth_client, user_data):
    project = (
        session.execute(
            select(Project)
            .join(Project.user)
            .where(User.external_id == auth_client.username)
        )
        .scalars()
        .first()
    )
    provenance = {
        "curationMetadata": {
            "columns": [
                {
                    "id": "identification",
                    "name": "Identification",
                    "stubStudies": [_stub(i) for i in range(500)],
                }
            ]
        }
    }
    raw = json.dumps({"provenance": provenance}).encode()
    body = gzip.compress(raw)
    assert len(body) * 10 < len(raw)

    response = auth_client.put(
        f"/api/projects/{project.id}",
        data=body,
        headers={"Content-Encoding": "gzip", "Content-Type": "application/json"},
        json_dump=False,
    )

    assert response.status_code == 200, response.json
    session.expire_all()
    saved = session.get(Project, project.id).provenance
    assert saved["curationMetadata"] == provenance["curationMetadata"]


async def _echo(request):
    body = await request.body()
    return JSONResponse(
        {
            "body": body.decode(),
            "content_length": request.headers.get("content-length"),
            "content_encoding": request.headers.get("content-encoding"),
        }
    )


def _put(body, headers, max_bytes=1024, chunks=None):
    app = GzipRequestMiddleware(
        Starlette(routes=[Route("/", _echo, methods=["PUT"])]), max_bytes=max_bytes
    )

    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as client:
            content = body
            if chunks:

                async def stream():
                    for i in range(0, len(body), chunks):
                        yield body[i:i + chunks]

                content = stream()
            return await client.put("/", content=content, headers=headers)

    return anyio.run(run)


@pytest.mark.parametrize("output_chunk", [1024 * 1024, 16, 902])
def test_gzip_body_reaches_route_decompressed_across_chunks(monkeypatch, output_chunk):
    monkeypatch.setattr("neurosynth_compose.gzip_request._CHUNK", output_chunk)
    raw = b'{"a": "' + b"x" * 900 + b'"}'
    response = _put(gzip.compress(raw), {"Content-Encoding": "gzip"}, chunks=7)

    assert response.status_code == 200
    assert response.json() == {
        "body": raw.decode(),
        "content_length": str(len(raw)),
        "content_encoding": None,
    }


def test_plain_body_passes_through():
    response = _put(b"x" * 2000, {})

    assert response.status_code == 200
    assert response.json()["body"] == "x" * 2000


def test_gzip_body_over_the_cap_is_refused():
    response = _put(gzip.compress(b"x" * 1025), {"Content-Encoding": "gzip"})

    assert response.status_code == 413
    assert response.json()["title"] == "Payload Too Large"


def test_invalid_gzip_is_refused():
    response = _put(b'{"a": 1}', {"Content-Encoding": "gzip"})

    assert response.status_code == 400


def test_truncated_gzip_is_refused():
    response = _put(gzip.compress(b"x" * 500)[:-12], {"Content-Encoding": "gzip"})

    assert response.status_code == 400
    assert "truncated" in response.json()["detail"]
