import pytest

from pathlib import Path

from neurostore.models import Analysis, DataSource, Study, User
from neurostore.scripts.data_sources import ingest
from neurostore.scripts.data_sources.ingest import link_matches, load_data_sources
from neurostore.services.data_source_links import data_sources_of

pytestmark = pytest.mark.anyio

UKB = {
    "id": "ukb",
    "name": "UK Biobank",
    "kinds": ["study"],
    "modalities": ["MRI"],
    "url": "https://www.ukbiobank.ac.uk",
    "url_kind": "rrid",
    "rrids": ["SCR_012815"],
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
    assert created["id"] == "ukb"
    assert created["name"] == "UK Biobank"

    url = "/api/data-sources/ukb"
    put = await auth_client.put(url, data={"name": "changed"})
    assert put.status_code == 403
    denied = await auth_client.delete(url)
    assert denied.status_code == 403

    put = await admin_client.put(url, data={"id": "other", "name": "UK Biobank (UKB)"})
    assert put.status_code == 200, put.text
    assert (put.json()["id"], put.json()["name"]) == ("ukb", "UK Biobank (UKB)")


async def test_post_requires_a_new_well_formed_id(admin_client):
    await create_data_source(admin_client)
    again = await admin_client.post("/api/data-sources/", data=UKB)
    assert again.status_code == 409, again.text
    for bad in ({"name": "no id"}, {"id": "UK Biobank", "name": "UK Biobank"}):
        resp = await admin_client.post("/api/data-sources/", data=bad)
        assert resp.status_code in (400, 422), resp.text
    assert DataSource.query.count() == 1


async def test_list_filters_by_kind(admin_client, auth_client):
    await create_data_source(admin_client)
    await create_data_source(
        admin_client,
        {"id": "openneuro", "name": "OpenNeuro", "kinds": ["repository"]},
    )

    resp = await auth_client.get("/api/data-sources/?kind=repository")
    assert [r["id"] for r in resp.json()["results"]] == ["openneuro"]
    resp = await auth_client.get("/api/data-sources/ukb")
    assert resp.json()["name"] == "UK Biobank"


async def test_analysis_link_shows_on_study_and_base_study(admin_client, auth_client):
    data_source = await create_data_source(admin_client)
    study = user1_study()
    analysis_id = study.analyses[0].id
    base_study_id = study.base_study_id
    summary = [
        {
            "id": data_source["id"],
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
        data={"analysis_data_sources": [{"data_source": {"id": "x", "name": "x"}}]},
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


# the child row first: its parent is set once every row exists
DICTIONARY = (
    "id\tname\troles\tmodality\thosted_by\trrid\tre3data_id\turl\turl_source\n"
    "msc\tMidnight Scan Club\tstudy\tMRI\topenneuro\t\t\t\t\n"
    "openneuro\tOpenNeuro\trepository\tMRI|PET\t\t\t\t"
    "https://openneuro.org\tchecked:official\n"
)


def test_load_data_sources_seeds_once(tmp_path, session):
    path = tmp_path / "data_sources.tsv"
    path.write_text(DICTIONARY)

    result = load_data_sources(path)
    assert sorted(result.created) == ["msc", "openneuro"]
    msc = session.get(DataSource, "msc")
    assert msc.part_of_id == "openneuro"
    assert msc.modalities == ["MRI"]

    msc.name = "edited in neurostore"
    session.flush()
    assert sorted(load_data_sources(path).skipped) == ["msc", "openneuro"]
    assert session.get(DataSource, "msc").name == "edited in neurostore"
    assert load_data_sources(path, update=True).updated
    assert session.get(DataSource, "msc").name == "Midnight Scan Club"


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
    assert [ds.id for ds in data_sources_of(base_study)] == ["msc"]
    assert link_matches(matches).links == 0


async def test_seed_loads_and_reads_back_through_the_api(auth_client, session):
    seed = Path(ingest.__file__).with_name("data_sources.tsv")
    rows = ingest.read_tsv(seed)
    assert len(load_data_sources(seed).created) == len(rows)
    session.commit()

    resp = await auth_client.get("/api/data-sources/?page_size=1000")
    got = {r["id"]: r for r in resp.json()["results"]}
    assert set(got) == {row["id"] for row in rows}
    for row in rows:
        record = got[row["id"]]
        assert record["name"] == row["name"]
        assert record["part_of"] == (row["hosted_by"] or None)
        assert record["kinds"] == ingest.split(row["roles"])
        assert record["rrids"] == ingest.split(row["rrid"])
        assert record["url"] == (row["url"] or None)
