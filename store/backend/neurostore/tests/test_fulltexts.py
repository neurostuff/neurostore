"""GET /fulltexts: a full text's provenance for whoever may see its paper, and its text only
when its copy may be passed on (docs/adr/0022-fulltexts-served-by-licence.md). Every test
that reads a response looks for the withheld text in the whole body, not in one field."""

from urllib.parse import urlencode

import pytest

from neurostore.fulltext_access import may_redistribute
from neurostore.models import BaseStudy, Fulltext
from neurostore.schemas import FulltextSchema
from neurostore.tests import study_schema_fixtures as fx
from neurostore.tests.request_utils import AsyncClient

pytestmark = pytest.mark.anyio

OPEN_TEXT = "Openly licensed zyxomma text, free to pass on."
CLOSED_TEXT = "Withheld quellbrook text that must never leave neurostore."

ELSEVIER_USER_LICENSE = {
    "license_id": "other",
    "determination": "stated",
    "stated_by": "elsevier",
    "stated_as": "https://www.elsevier.com/open-access/userlicense/1.0/",
}

#: Copies whose text may not be passed on, each as ingestion stores it, and why.
WITHHELD = {
    # A PubMed Central author manuscript whose record says TDM.
    "pmc_author_manuscript": (
        "pmc",
        "all_rights_reserved",
        fx.text_copy("am", fx.ALL_RIGHTS_RESERVED, access="tdm_grant"),
        "access",
    ),
    # Elsevier's full-text API, under its open-access user licence.
    "elsevier_user_license": (
        "elsevier",
        "other",
        fx.text_copy(license=ELSEVIER_USER_LICENSE, route="publisher", access="tdm_grant"),
        "access",
    ),
    # A copy obtained publicly whose licence is all rights reserved.
    "public_all_rights_reserved": (
        "pdf",
        "all_rights_reserved",
        fx.text_copy(license=fx.ALL_RIGHTS_RESERVED, route="publisher"),
        "license",
    ),
    # CC BY, but fetched through our TDM key: the access forbids it whatever the licence.
    "cc_by_through_tdm_grant": (
        "elsevier",
        "cc_by",
        fx.text_copy(license=fx.CC_BY, route="publisher", access="tdm_grant"),
        "access",
    ),
    # Scraped as our network sees it (ACE).
    "unrecorded_access": (
        "ace",
        "cc_by",
        fx.text_copy(license=fx.CC_BY, route="publisher", access="unrecorded"),
        "access",
    ),
    # A text stored before copies were recorded.
    "no_copy_record": ("pubget", None, None, "no_copy_record"),
    # The licence column and the copy disagree: either one refusing withholds the text.
    "column_refuses": ("pmc", "all_rights_reserved", fx.text_copy(), "license"),
    "copy_refuses": (
        "pmc",
        "cc_by",
        fx.text_copy(license=fx.ALL_RIGHTS_RESERVED),
        "license",
    ),
}


def _paper(session, **fields):
    paper = BaseStudy(
        name="A paper", level="group", doi="10.1000/xyz", authors="Doe J", year=2020,
        **fields,
    )
    session.add(paper)
    session.flush()
    return paper


def _text(session, paper, text, source="pmc", license="cc_by", text_copy=fx.text_copy()):
    fulltext = Fulltext(
        base_study_id=paper.id, source=source, text=text, text_copy=text_copy, license=license
    )
    session.add(fulltext)
    session.commit()
    return fulltext


@pytest.fixture
async def anonymous(app):
    client = AsyncClient(token=None, asgi_app=app.asgi_app)
    try:
        yield client
    finally:
        await client.aclose()


@pytest.fixture(params=sorted(WITHHELD))
def withheld(request, session):
    source, license, text_copy, reason = WITHHELD[request.param]
    paper = _paper(session)
    fulltext = _text(session, paper, CLOSED_TEXT, source, license, text_copy)
    return paper, fulltext, reason


async def _get(client, path, **params):
    resp = await client.get(f"/api/{path}" + (f"?{urlencode(params)}" if params else ""))
    assert resp.status_code == 200, resp.text
    return resp


async def test_an_open_copy_s_text_is_returned_with_its_attribution(auth_client, session):
    paper = _paper(session)
    fulltext = _text(session, paper, OPEN_TEXT)

    body = (await _get(auth_client, f"fulltexts/{fulltext.id}")).json()

    assert body["text"] == OPEN_TEXT
    assert body["text_withheld"] is None
    assert body["redistributable"] is True
    assert body["preferred"] is True
    assert body["base_study_id"] == paper.id
    assert body["sha256"] == fulltext.sha256
    assert body["text_copy"] == fx.text_copy()
    assert body["attribution"] == {
        "title": "A paper",
        "authors": "Doe J",
        "year": 2020,
        "publication": None,
        "doi": "10.1000/xyz",
        "license": "cc_by",
        "license_statement": "https://creativecommons.org/licenses/by/4.0/",
    }


async def test_a_withheld_text_is_never_returned_by_id(auth_client, withheld):
    paper, fulltext, reason = withheld

    resp = await _get(auth_client, f"fulltexts/{fulltext.id}")

    assert CLOSED_TEXT not in resp.text
    body = resp.json()
    assert body["text"] is None
    assert body["redistributable"] is False
    assert body["text_withheld"]["reason"] == reason
    assert body["text_withheld"]["read_at"] == "https://doi.org/10.1000/xyz"
    # Its provenance is still served.
    assert body["sha256"] == fulltext.sha256
    assert body["source"] == fulltext.source


async def test_a_withheld_text_is_never_returned_to_an_admin(admin_client, withheld):
    _, fulltext, _ = withheld
    resp = await _get(admin_client, f"fulltexts/{fulltext.id}")
    assert CLOSED_TEXT not in resp.text


async def test_a_list_carries_no_text_and_lists_every_copy(auth_client, session):
    paper = _paper(session)
    other = _text(
        session, paper, CLOSED_TEXT, "elsevier", "other",
        WITHHELD["elsevier_user_license"][2],
    )
    # Of two versions of record from sources that rank alike, the newer is preferred.
    preferred = _text(session, paper, OPEN_TEXT, source="pmc")

    resp = await _get(auth_client, "fulltexts/", base_study_id=paper.id)

    assert OPEN_TEXT not in resp.text and CLOSED_TEXT not in resp.text
    results = {r["id"]: r for r in resp.json()["results"]}
    # The copy that is not preferred has no search copy of public/user_id, and is listed.
    assert set(results) == {preferred.id, other.id}
    assert not {"text", "text_withheld"} & set(results[preferred.id])
    assert results[preferred.id]["redistributable"] is True
    assert results[preferred.id]["preferred"] is True
    assert results[other.id]["redistributable"] is False
    assert results[other.id]["preferred"] is False


async def test_a_list_filters_by_source_and_licence(auth_client, session):
    paper = _paper(session)
    _text(session, paper, OPEN_TEXT, source="pmc")
    elsevier = _text(
        session, paper, CLOSED_TEXT, "elsevier", "other",
        WITHHELD["elsevier_user_license"][2],
    )
    _paper(session)  # another paper's texts are not listed

    for params in ({"source": "elsevier"}, {"license": "other"}):
        body = (await _get(auth_client, "fulltexts/", base_study_id=paper.id, **params)).json()
        assert [r["id"] for r in body["results"]] == [elsevier.id]
        assert body["metadata"]["total_count"] == 1


@pytest.mark.parametrize("license", ["cc-by-4.0", "CC_BY"])
async def test_a_licence_outside_study_schema_s_license_id_is_refused(auth_client, license):
    resp = await auth_client.get(f"/api/fulltexts/?{urlencode({'license': license})}")
    assert resp.status_code in (400, 422), resp.text


async def test_a_base_study_links_its_preferred_text_and_carries_none(
    auth_client, withheld
):
    paper, fulltext, _ = withheld
    reads = [
        (f"base-studies/{paper.id}", {}),
        (f"base-studies/{paper.id}", {"nested": "true"}),
        (f"base-studies/{paper.id}", {"info": "true"}),
        ("base-studies/", {}),
        ("base-studies/", {"flat": "true"}),
        ("base-studies/", {"nested": "true"}),
        ("base-studies/", {"search": "quellbrook", "search_full_text": "true"}),
    ]
    for path, params in reads:
        resp = await _get(auth_client, path, **params)
        assert CLOSED_TEXT not in resp.text, (path, params)
        body = resp.json()
        records = body["results"] if "results" in body else [body]
        assert [r["fulltext_id"] for r in records if r["id"] == paper.id] == [fulltext.id]


async def test_a_private_paper_s_texts_are_its_owner_s(auth_client, anonymous, session):
    paper = _paper(session, public=False, user_id=auth_client.username)
    fulltext = _text(session, paper, OPEN_TEXT)

    anonymous_read = await anonymous.get(f"/api/fulltexts/{fulltext.id}")
    assert anonymous_read.status_code == 404
    assert OPEN_TEXT not in anonymous_read.text
    listed = (await _get(anonymous, "fulltexts/", base_study_id=paper.id)).json()
    assert listed["results"] == []

    assert (await _get(auth_client, f"fulltexts/{fulltext.id}")).json()["text"] == OPEN_TEXT
    listed = (await _get(auth_client, "fulltexts/", base_study_id=paper.id)).json()
    assert [r["id"] for r in listed["results"]] == [fulltext.id]


async def test_an_unknown_full_text_is_not_found(auth_client):
    assert (await auth_client.get("/api/fulltexts/nonexistent")).status_code == 404


async def test_a_list_cannot_be_sorted_by_the_text(auth_client, session):
    _text(session, _paper(session), CLOSED_TEXT, "pdf", None, None)
    resp = await auth_client.get("/api/fulltexts/?sort=text")
    assert resp.status_code in (400, 422)
    assert CLOSED_TEXT not in resp.text


async def test_nothing_writes_a_full_text_through_the_api(admin_client, session):
    fulltext = _text(session, _paper(session), OPEN_TEXT)
    for method, path in [
        ("post", "/api/fulltexts/"),
        ("put", f"/api/fulltexts/{fulltext.id}"),
        ("delete", f"/api/fulltexts/{fulltext.id}"),
    ]:
        kwargs = {} if method == "delete" else {"data": {"text": "x"}}
        resp = await getattr(admin_client, method)(path, **kwargs)
        assert resp.status_code in (404, 405), (method, resp.status_code)
    assert session.get(Fulltext, fulltext.id).text == OPEN_TEXT


def test_the_schema_dumps_the_text_only_when_asked_and_only_through_the_gate(withheld):
    _, fulltext, _ = withheld
    assert "text" not in FulltextSchema().dump(fulltext)
    assert FulltextSchema(context={"text": True}).dump(fulltext)["text"] is None
    assert not may_redistribute(fulltext)
