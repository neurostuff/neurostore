import pytest

from neurostore.models import BaseStudy, Journal, Study, Studyset, StudysetStudy

pytestmark = pytest.mark.anyio

HBM = {
    "openalex_id": "S121666818",
    "kind": "journal",
    "title": "Human Brain Mapping",
    "abbreviation": "Hum Brain Mapp",
    "issns": ["1065-9471", "1097-0193"],
    "issn_l": "1065-9471",
    "nlm_id": "9419065",
    "wikidata_id": "Q5936947",
}


@pytest.fixture
def papers(session):
    """A Human Brain Mapping paper with a study, a bioRxiv preprint, and a paper whose
    journal is unknown."""
    hbm = Journal(**HBM)
    biorxiv = Journal(openalex_id="S4306402567", kind="repository",
                      title="bioRxiv (Cold Spring Harbor Laboratory)")
    session.add_all([hbm, biorxiv])
    session.commit()
    in_hbm = BaseStudy(name="in HBM", level="group", publication="Hum Brain Mapp",
                       journal_id=hbm.id, journal_match="doi")
    preprint = BaseStudy(name="preprint", level="group", publication="bioRxiv",
                         journal_id=biorxiv.id, journal_match="preprint_server")
    unknown = BaseStudy(name="unknown", level="group", publication="Proceedings of the …")
    session.add_all([in_hbm, preprint, unknown])
    session.commit()
    study = Study(name="in HBM", level="group", base_study=in_hbm, publication="HBM")
    studyset = Studyset(name="a studyset")
    session.add_all([study, studyset])
    session.commit()
    session.add(StudysetStudy(studyset_id=studyset.id, study_id=study.id))
    session.commit()
    return {"hbm": hbm, "biorxiv": biorxiv, "in_hbm": in_hbm, "preprint": preprint,
            "unknown": unknown, "study": study, "studyset": studyset}


async def test_journals_are_listed_searched_and_read(auth_client, papers):
    hbm_id = papers["hbm"].id

    listed = (await auth_client.get("/api/journals/")).json()
    assert listed["metadata"]["total_count"] == 2
    for search in ("brain mapp", "Hum Brain", "1097-0193"):
        found = (await auth_client.get(f"/api/journals/?search={search}")).json()
        assert [j["id"] for j in found["results"]] == [hbm_id], search
    repositories = (await auth_client.get("/api/journals/?kind=repository")).json()
    assert [j["id"] for j in repositories["results"]] == [papers["biorxiv"].id]

    one = await auth_client.get(f"/api/journals/{hbm_id}")
    assert one.status_code == 200
    assert {k: one.json()[k] for k in HBM} == HBM
    assert (await auth_client.get("/api/journals/nosuchid")).status_code == 404


async def test_a_paper_shows_its_journal_beside_the_name_as_printed(auth_client, papers):
    summary = {"id": papers["hbm"].id, "title": "Human Brain Mapping",
               "abbreviation": "Hum Brain Mapp"}

    base_study = (await auth_client.get(f"/api/base-studies/{papers['in_hbm'].id}")).json()
    assert (base_study["journal"], base_study["publication"]) == (summary, "Hum Brain Mapp")
    unknown = (await auth_client.get(f"/api/base-studies/{papers['unknown'].id}")).json()
    assert unknown["journal"] is None

    study = (await auth_client.get(f"/api/studies/{papers['study'].id}")).json()
    assert (study["journal"], study["publication"]) == (summary, "HBM")
    nested = (await auth_client.get(f"/api/studies/{papers['study'].id}?nested=true")).json()
    assert nested["journal"] == summary


async def test_a_studyset_s_studies_show_their_journal(auth_client, papers):
    summary = {"id": papers["hbm"].id, "title": "Human Brain Mapping",
               "abbreviation": "Hum Brain Mapp"}
    url = f"/api/studysets/{papers['studyset'].id}"
    for query in ("?summary=true", "?nested=true"):
        (study,) = (await auth_client.get(url + query)).json()["studies"]
        assert (study["journal"], study["publication"]) == (summary, "HBM"), query


async def test_papers_are_filtered_by_journal(auth_client, papers):
    hbm_id = papers["hbm"].id

    base_studies = (await auth_client.get(f"/api/base-studies/?journal_id={hbm_id}")).json()
    assert [bs["id"] for bs in base_studies["results"]] == [papers["in_hbm"].id]
    assert base_studies["results"][0]["journal"]["id"] == hbm_id

    studies = (await auth_client.get(f"/api/studies/?journal_id={hbm_id}")).json()
    assert [s["id"] for s in studies["results"]] == [papers["study"].id]
