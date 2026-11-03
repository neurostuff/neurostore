import pytest

from neurostore.models import Analysis, DataSource, Study, User
from neurostore.scripts.data_sources.ingest import link_matches, load_data_sources
from neurostore.services.data_source_links import data_sources_of

pytestmark = pytest.mark.anyio

UKB = {
    "slug": "ukb",
    "name": "UK Biobank",
    "kinds": ["study"],
    "modalities": ["MRI"],
    "url": "https://www.ukbiobank.ac.uk",
    "url_kind": "rrid",
    "rrids": ["SCR_012815"],
    "aliases": [
        {"alias": "UK Biobank", "tier": "name"},
        {"alias": "UKB", "tier": "context"},
    ],
}


def user1_study():
    user = User.query.filter_by(name="user1").first()
    return Study.query.filter_by(user=user).first()


async def create_data_source(admin_client, payload=UKB):
    resp = await admin_client.post("/api/data-sources/", data=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def test_only_admins_write_data_sources(admin_client, auth_client):
    denied = await auth_client.post("/api/data-sources/", data=UKB)
    assert denied.status_code == 403

    created = await create_data_source(admin_client)
    assert created["slug"] == "ukb"
    assert {(a["alias"], a["tier"]) for a in created["aliases"]} == {
        ("UK Biobank", "name"),
        ("UKB", "context"),
    }

    url = f"/api/data-sources/{created['id']}"
    put = await auth_client.put(url, data={"name": "changed"})
    assert put.status_code == 403
    denied = await auth_client.delete(url)
    assert denied.status_code == 403

    put = await admin_client.put(url, data={"aliases": [{"alias": "UKBB", "tier": "safe"}]})
    assert put.status_code == 200, put.text
    assert [(a["alias"], a["tier"]) for a in put.json()["aliases"]] == [("UKBB", "safe")]

    # an alias given again keeps its row
    again = [{"alias": "UKBB", "tier": "safe"}, {"alias": "UKB", "tier": "context"}]
    put = await admin_client.put(url, data={"aliases": again})
    assert put.status_code == 200, put.text
    assert sorted(a["alias"] for a in put.json()["aliases"]) == ["UKB", "UKBB"]


async def test_list_filters_by_kind_and_slug(admin_client, auth_client):
    await create_data_source(admin_client)
    await create_data_source(
        admin_client,
        {"slug": "openneuro", "name": "OpenNeuro", "kinds": ["repository"]},
    )

    resp = await auth_client.get("/api/data-sources/?kind=repository")
    assert [r["slug"] for r in resp.json()["results"]] == ["openneuro"]
    resp = await auth_client.get("/api/data-sources/?slug=ukb")
    assert [r["name"] for r in resp.json()["results"]] == ["UK Biobank"]
    assert resp.json()["results"][0]["aliases"]


async def test_analysis_link_shows_on_study_and_base_study(admin_client, auth_client):
    data_source = await create_data_source(admin_client)
    study = user1_study()
    analysis_id = study.analyses[0].id
    base_study_id = study.base_study_id
    summary = [
        {
            "id": data_source["id"],
            "slug": "ukb",
            "name": "UK Biobank",
            "url": "https://www.ukbiobank.ac.uk",
        }
    ]

    put = await auth_client.put(
        f"/api/analyses/{analysis_id}", data={"data_sources": [data_source["id"]]}
    )
    assert put.status_code == 200, put.text
    assert "data_sources" not in put.json()
    # linking the same data source again is a no-op, not a duplicate key
    again = await auth_client.put(
        f"/api/analyses/{analysis_id}", data={"data_sources": [data_source["id"]]}
    )
    assert again.status_code == 200, again.text

    plain = (await auth_client.get(f"/api/analyses/{analysis_id}")).json()
    assert "data_sources" not in plain
    shown = await auth_client.get(f"/api/analyses/{analysis_id}?data_sources=true")
    assert shown.json()["data_sources"] == summary

    plain_study = await auth_client.get(f"/api/studies/{study.id}")
    assert "data_sources" not in plain_study.json()
    for url in (
        f"/api/studies/{study.id}?data_sources=true",
        f"/api/studies/{study.id}?data_sources=true&nested=true",
        f"/api/base-studies/{base_study_id}?data_sources=true",
    ):
        resp = await auth_client.get(url)
        assert resp.json()["data_sources"] == summary, url
    nested = (
        await auth_client.get(f"/api/studies/{study.id}?data_sources=true&nested=true")
    ).json()
    assert nested["analyses"][0]["data_sources"] == summary

    listed = await auth_client.get(
        f"/api/base-studies/?data_sources=true&search={study.name}"
    )
    by_id = {r["id"]: r for r in listed.json()["results"]}
    assert by_id[base_study_id]["data_sources"] == summary

    put = await auth_client.put(f"/api/analyses/{analysis_id}", data={"data_sources": []})
    assert put.status_code == 200, put.text
    shown = await auth_client.get(f"/api/studies/{study.id}?data_sources=true")
    assert shown.json()["data_sources"] == []


async def test_analysis_rejects_nested_data_source(auth_client, user_data):
    analysis_id = user1_study().analyses[0].id
    put = await auth_client.put(
        f"/api/analyses/{analysis_id}", data={"data_sources": [{"name": "made up"}]}
    )
    assert put.status_code in (400, 422)
    put = await auth_client.put(
        f"/api/analyses/{analysis_id}",
        data={"analysis_data_sources": [{"data_source": {"slug": "x", "name": "x"}}]},
    )
    assert put.status_code in (400, 422)
    assert DataSource.query.count() == 0


async def test_deleting_data_source_clears_study_list(admin_client, auth_client):
    data_source = await create_data_source(admin_client)
    study = user1_study()
    await auth_client.put(
        f"/api/analyses/{study.analyses[0].id}",
        data={"data_sources": [data_source["id"]]},
    )

    resp = await admin_client.delete(f"/api/data-sources/{data_source['id']}")
    assert resp.status_code == 200
    shown = await auth_client.get(f"/api/base-studies/{study.base_study_id}?data_sources=true")
    assert shown.json()["data_sources"] == []


DICTIONARY = (
    "id\tname\troles\tmodality\thosted_by\tfull_names\tacronyms_safe\tacronyms_context\t"
    "acronyms_defined\tqualified_names\trrid\tre3data_id\tsource\turl\turl_source\n"
    "openneuro\tOpenNeuro\trepository\tMRI|PET\t\tOpenNeuro\t\t\t\t\t\t\thand\t"
    "https://openneuro.org\tchecked:official\n"
    "msc\tMidnight Scan Club\tstudy\tMRI\topenneuro\tMidnight Scan Club\t\tMSC\t\t\t\t\t"
    "hand|reviews\t\t\n"
)


def test_load_data_sources_seeds_once(tmp_path, session):
    path = tmp_path / "data_sources.tsv"
    path.write_text(DICTIONARY)

    result = load_data_sources(path)
    assert sorted(result.created) == ["msc", "openneuro"]
    msc = DataSource.query.filter_by(slug="msc").one()
    assert DataSource.query.get(msc.part_of_id).slug == "openneuro"
    assert msc.listed_in == ["hand", "reviews"]
    assert {(a.alias, a.tier) for a in msc.aliases} == {
        ("Midnight Scan Club", "name"),
        ("MSC", "context"),
    }

    msc.name = "edited in neurostore"
    session.flush()
    assert sorted(load_data_sources(path).skipped) == ["msc", "openneuro"]
    assert DataSource.query.filter_by(slug="msc").one().name == "edited in neurostore"
    assert load_data_sources(path, update=True).updated
    assert DataSource.query.filter_by(slug="msc").one().name == "Midnight Scan Club"


def test_link_matches_links_every_analysis(tmp_path, session, user_data):
    path = tmp_path / "data_sources.tsv"
    path.write_text(DICTIONARY)
    load_data_sources(path)
    study = user1_study()
    base_study = study.base_study
    pmid = base_study.pmid or "pmid-for-test"
    base_study.pmid = pmid
    session.flush()

    matches = tmp_path / "paper_entities.tsv"
    matches.write_text(
        "paper\tpmid\tdoi\tyear\tsource\tentity\tstatus\tn_hits\tsections\tforms\n"
        f"p1\t{pmid}\t\t2020\tace\tmsc\tused\t1\tmethods:1\tMSC\n"
        f"p1\t{pmid}\t\t2020\tace\topenneuro\treferences_only\t1\treferences:1\tOpenNeuro\n"
        "p2\t000\t\t2020\tace\tmsc\tused\t1\tmethods:1\tMSC\n"
        f"p1\t{pmid}\t\t2020\tace\tgone\tused\t1\tmethods:1\tGone\n"
    )
    result = link_matches(matches)

    analyses = Analysis.query.join(Study).filter(Study.base_study_id == base_study.id).all()
    assert result.links == len(analyses) > 0
    assert result.unmatched_papers == {"p2"}
    assert result.unknown_data_sources == {"gone"}
    assert [ds.slug for ds in data_sources_of(base_study)] == ["msc"]
    assert link_matches(matches).links == 0


async def test_seed_round_trips_through_the_api(auth_client, session):
    """The matcher reads its dictionary from the API, so it must get back the seed."""
    from pathlib import Path

    from neurostore.scripts.data_sources import match

    seed = Path(match.__file__).with_name("data_sources.tsv")
    load_data_sources(seed)
    session.commit()

    resp = await auth_client.get("/api/data-sources/?page_size=1000&sort=slug&desc=false")
    rows = {r["id"]: r for r in match.dictionary_rows(resp.json()["results"])}
    columns = ("name", "roles", "modality", "hosted_by", "rrid", "re3data_id", "source", "url")
    alias_columns = tuple(match.ALIAS_COLUMNS.values())
    for expected in match.csv.DictReader(open(seed, encoding="utf-8"), delimiter="\t"):
        got = rows.pop(expected["id"])
        assert {c: got[c] for c in columns} == {c: expected[c] for c in columns}
        for column in alias_columns:
            assert set(match.split(got[column])) == set(match.split(expected[column]))
    assert rows == {}
