"""Integration tests for snapshot deduplication and MetaAnalysis.snapshots history.

TDD-first: these tests are written before Part 2c (snapshot append) is
implemented.  They define the expected behaviour for:

  1. Studyset/Annotation deduplication via the POST /meta-analysis-results path.
  2. MetaAnalysis.snapshots history being appended on each result creation.
  3. The snapshots list being exposed in the GET /meta-analyses/{id} response.
"""

from sqlalchemy import select

from neurosynth_compose.models import MetaAnalysis, Studyset
from neurosynth_compose.utils.snapshots import md5_of_snapshot


def _post_result(auth_client, meta_analysis, ss_payload, ann_payload):
    auth_client.token = None
    headers = {"Compose-Upload-Key": meta_analysis.run_key}
    data = {
        "cached_studyset": ss_payload,
        "cached_annotation": ann_payload,
        "meta_analysis_id": meta_analysis.id,
    }
    return auth_client.post("/api/meta-analysis-results", data=data, headers=headers)


def test_dedup_same_snapshot_one_studyset_row(session, db, auth_client, user_data):
    """POSTing identical cached_studyset payloads must converge on a single Studyset row."""
    meta = db.session.execute(select(MetaAnalysis)).scalars().first()
    payload = {"study": "alpha", "n": 42}

    resp1 = _post_result(auth_client, meta, payload, {"ann": 1})
    assert resp1.status_code == 200

    resp2 = _post_result(auth_client, meta, payload, {"ann": 1})
    assert resp2.status_code == 200

    expected_md5 = md5_of_snapshot(payload)
    rows = (
        db.session.execute(select(Studyset).where(Studyset.md5 == expected_md5))
        .scalars()
        .all()
    )
    assert len(rows) == 1, f"Expected 1 canonical Studyset row, found {len(rows)}"


def test_snapshot_history_appended_on_result_creation(
    session, db, auth_client, user_data
):
    """After one result creation, MetaAnalysis.snapshots must have exactly 1 entry."""
    meta = db.session.execute(select(MetaAnalysis)).scalars().first()

    resp = _post_result(auth_client, meta, {"study": "beta"}, {"ann": "x"})
    assert resp.status_code == 200

    db.session.expire(meta)
    assert meta.snapshots is not None
    assert len(meta.snapshots) >= 1

    entry = meta.snapshots[-1]
    assert "cached_studyset_id" in entry
    assert "cached_annotation_id" in entry
    assert "result_id" in entry
    assert entry["result_id"] == resp.json["id"]


def test_snapshot_history_entry_per_result_even_for_same_md5(
    session, db, auth_client, user_data
):
    """Each result produces its own snapshot history entry; canonical rows dedupe."""
    meta = db.session.execute(select(MetaAnalysis)).scalars().first()
    payload_ss = {"study": "gamma", "n": 7}
    payload_ann = {"ann": "y"}

    resp1 = _post_result(auth_client, meta, payload_ss, payload_ann)
    assert resp1.status_code == 200

    db.session.expire(meta)
    count_after_first = len(meta.snapshots or [])

    resp2 = _post_result(auth_client, meta, payload_ss, payload_ann)
    assert resp2.status_code == 200

    db.session.expire(meta)
    entries = meta.snapshots or []

    assert (
        len(entries) == count_after_first + 1
    ), "Each result should contribute its own snapshot entry"
    md = md5_of_snapshot(payload_ss)
    rows = (
        db.session.execute(select(Studyset).where(Studyset.md5 == md)).scalars().all()
    )
    assert len(rows) == 1, "Canonical Studyset row should be deduplicated"
    canonical_id = rows[0].id
    assert all(
        entry.get("cached_studyset_id") == canonical_id for entry in entries[-2:]
    )


def test_snapshot_history_new_entry_for_different_md5(
    session, db, auth_client, user_data
):
    """POSTing snapshots with a changed studyset must append a new history entry."""
    meta = db.session.execute(select(MetaAnalysis)).scalars().first()

    resp1 = _post_result(auth_client, meta, {"study": "delta-v1"}, {"ann": "z"})
    assert resp1.status_code == 200

    db.session.expire(meta)
    count_v1 = len(meta.snapshots or [])

    resp2 = _post_result(auth_client, meta, {"study": "delta-v2"}, {"ann": "z"})
    assert resp2.status_code == 200

    db.session.expire(meta)
    count_v2 = len(meta.snapshots or [])

    assert (
        count_v2 == count_v1 + 1
    ), "Changed snapshot should append exactly one new history entry"


def test_snapshots_exposed_in_meta_analysis_response(
    session, db, auth_client, user_data
):
    """GET /meta-analyses/{id} must include a 'snapshots' key after result creation."""
    meta = db.session.execute(select(MetaAnalysis)).scalars().first()

    _post_result(auth_client, meta, {"study": "epsilon"}, {"ann": "w"})

    resp = auth_client.token and auth_client.get(f"/api/meta-analyses/{meta.id}")
    # Re-authenticate with the Bearer token for the GET call
    from jose.jwt import encode

    from neurosynth_compose.tests.conftest import mock_decode_token  # noqa: F401

    token = encode({"sub": "user1-id"}, "abc", algorithm="HS256")
    auth_client.token = token
    resp = auth_client.get(f"/api/meta-analyses/{meta.id}")

    assert resp.status_code == 200
    body = resp.json
    assert (
        "snapshots" in body
    ), f"'snapshots' key missing from response: {list(body.keys())}"
    assert isinstance(body["snapshots"], list)
    assert len(body["snapshots"]) >= 1
