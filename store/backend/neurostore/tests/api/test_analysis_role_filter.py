"""The ``role`` filter on the analyses and studies lists."""

import pytest

from neurostore.ingest.study_schema import ingest_upload
from neurostore.models import Analysis, Study, User
from neurostore.tests import study_schema_fixtures as fx

pytestmark = pytest.mark.anyio


def _studies_with_roles(session, username):
    summary = ingest_upload(
        {
            "coordinate_parse": fx.parse(
                [
                    fx.table_analysis("tbl1", [0], "Loss > Neutral", [fx.point((1, 2, 3))]),
                    fx.table_analysis(
                        "tbl2", [0], "Amygdala ROI", [fx.point((20, -4, -18))], role="anchor"
                    ),
                ],
                pmid="65432109",
            )
        }
    )
    user = User.query.filter_by(external_id=username).first()
    curated = Study(
        name="Curated",
        user=user,
        public=True,
        level="group",
        analyses=[Analysis(name="Curated contrast", user=user)],
    )
    session.add(curated)
    session.commit()
    return summary["study_id"], curated.id


async def test_role_filter_on_the_analyses_list(auth_client, session):
    pipeline_id, curated_id = _studies_with_roles(session, auth_client.username)

    async def names(query):
        resp = await auth_client.get(f"/api/analyses/?{query}")
        assert resp.status_code == 200, resp.text
        return {a["name"] for a in resp.json()["results"]}

    # No filter: every analysis, as before.
    assert {"Loss > Neutral", "Amygdala ROI", "Curated contrast"} <= await names(
        "page_size=1000"
    )
    assert await names(f"study={pipeline_id}&role=anchor") == {"Amygdala ROI"}
    # result: the pipeline's results and analyses that predate roles.
    assert await names("role=result&page_size=1000") >= {"Loss > Neutral", "Curated contrast"}
    assert "Amygdala ROI" not in await names("role=result&page_size=1000")

    resp = await auth_client.get("/api/analyses/?role=bogus")
    assert resp.status_code in (400, 422)


async def test_role_filter_on_the_studies_list(auth_client, session):
    pipeline_id, curated_id = _studies_with_roles(session, auth_client.username)

    async def ids(query):
        resp = await auth_client.get(f"/api/studies/?{query}&page_size=1000")
        assert resp.status_code == 200, resp.text
        return {s["id"] for s in resp.json()["results"]}

    assert {pipeline_id, curated_id} <= await ids("flat=true")
    anchor_ids = await ids("role=anchor&flat=true")
    assert pipeline_id in anchor_ids and curated_id not in anchor_ids
    assert {pipeline_id, curated_id} <= await ids("role=result&flat=true")
