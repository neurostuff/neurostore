"""GET /base-studies/?modality=, and the load of ns-pond's modality export into
`base_studies.modalities`."""

from pathlib import Path
from urllib.parse import urlencode

import pytest
import yaml

import neurostore
from neurostore.models import BaseStudy, Fulltext
from neurostore.models.data import MODALITIES
from neurostore.scripts.base_study_modalities import load_modalities

pytestmark = pytest.mark.anyio

HEADER = ("base_study_id", "modalities", "source", "papers")


def _tsv(tmp_path, *rows):
    """An export as `ingest modality export` writes it."""
    path = tmp_path / "modalities.tsv"
    lines = ["\t".join(HEADER), *("\t".join(row) for row in rows)]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def _paper(session, name, **columns):
    paper = BaseStudy(name=name, level="group", **columns)
    session.add(paper)
    session.flush()
    return paper


@pytest.fixture
def papers(session, tmp_path):
    """Papers by name: one fMRI and PET, one fMRI, one EEG read from its methods, and one
    the export does not name."""
    rows = {name: _paper(session, name, pmid=pmid) for name, pmid in (
        ("multimodal", "30000001"),
        ("fmri", "30000002"),
        ("eeg", "30000003"),
        ("unnamed", "30000004"),
    )}
    session.commit()
    load_modalities(_tsv(
        tmp_path,
        (rows["multimodal"].id, "fmri|pet", "record", "a1|a2"),
        (rows["fmri"].id, "fmri", "record", "a3"),
        (rows["eeg"].id, "eeg", "methods", "a4"),
    ))
    session.commit()
    return {name: row.id for name, row in rows.items()}


async def _found(client, papers, *modalities, **params):
    """The papers the list returns, by name; the count must agree with them."""
    query = urlencode([*(("modality", m) for m in modalities), *params.items()])
    resp = await client.get(f"/api/base-studies/?{query}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    ids = [r["id"] for r in body["results"]]
    assert body["metadata"]["total_count"] == len(ids)
    names = {v: k for k, v in papers.items()}
    return sorted(names.get(i, i) for i in ids)


def _state(session, base_study_id):
    session.expire_all()
    paper = session.get(BaseStudy, base_study_id)
    return paper.modalities, paper.modalities_source


async def test_a_paper_matches_any_of_the_given_modalities(auth_client, papers):
    assert await _found(auth_client, papers, "pet") == ["multimodal"]
    # A paper with two modalities matches each.
    assert await _found(auth_client, papers, "fmri") == ["fmri", "multimodal"]
    # Any of the values.
    assert await _found(auth_client, papers, "eeg", "pet") == ["eeg", "multimodal"]
    assert await _found(auth_client, papers, "meg") == []
    # Without the parameter nothing is filtered.
    assert await _found(auth_client, papers) == ["eeg", "fmri", "multimodal", "unnamed"]


@pytest.mark.parametrize("value", ["xray", "PET", ""])
async def test_a_value_outside_the_vocabulary_is_refused(auth_client, papers, value):
    resp = await auth_client.get(f"/api/base-studies/?modality=pet&modality={value}")
    assert resp.status_code == 400, resp.text


def test_the_spec_lists_the_model_s_vocabulary():
    path = Path(neurostore.__file__).parent / "openapi" / "neurostore-openapi.yml"
    spec = yaml.safe_load(path.read_text())
    (parameter,) = [
        p for p in spec["paths"]["/base-studies/"]["get"]["parameters"]
        if p.get("name") == "modality"
    ]
    assert tuple(parameter["schema"]["items"]["enum"]) == MODALITIES


async def test_the_filter_keeps_the_list_s_other_filters(auth_client, session, papers):
    session.add(Fulltext(base_study_id=papers["fmri"], source="pubget", text="Zyxomma here."))
    session.commit()

    assert await _found(auth_client, papers, "fmri", pmid="30000002") == ["fmri"]
    assert await _found(auth_client, papers, "pet", pmid="30000002") == []
    # The full-text search pages its two indexes itself: the filter still holds.
    full_text = {"search": "zyxomma", "search_full_text": "true"}
    assert await _found(auth_client, papers, "fmri", **full_text) == ["fmri"]
    assert await _found(auth_client, papers, "pet", **full_text) == []


async def test_a_page_lists_the_filtered_papers_only(auth_client, papers):
    resp = await auth_client.get("/api/base-studies/?modality=fmri&page=2&page_size=1")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["metadata"]["total_count"] == 2
    assert len(body["results"]) == 1


def test_a_load_overwrites_the_rows_it_names_and_keeps_the_others(session, tmp_path, papers):
    result = load_modalities(_tsv(
        tmp_path,
        (papers["fmri"], "FMRI|sMRI", "record", "a3"),
        (papers["eeg"], "eeg", "methods", "a4"),
        (papers["multimodal"], "", "none", "a1"),
        ("noSuchPaper", "pet", "record", "a9"),
    ))
    session.commit()

    assert _state(session, papers["fmri"]) == (["fmri", "smri"], "record")
    assert _state(session, papers["multimodal"]) == ([], "none")
    assert _state(session, papers["eeg"]) == (["eeg"], "methods")
    assert _state(session, papers["unnamed"]) == ([], None)
    assert result.updated == {papers["fmri"], papers["multimodal"]}
    assert result.unchanged == 1
    assert result.unknown == ["noSuchPaper"]


def test_a_value_outside_the_vocabulary_refuses_the_whole_file(session, tmp_path, papers):
    with pytest.raises(ValueError, match="xray"):
        load_modalities(_tsv(
            tmp_path,
            (papers["unnamed"], "pet", "record", "a5"),
            (papers["fmri"], "fmri|xray", "record", "a3"),
        ))
    session.rollback()
    assert _state(session, papers["unnamed"]) == ([], None)


def test_a_merged_paper_s_row_goes_to_the_paper_it_was_merged_into(session, tmp_path):
    keeper = _paper(session, "keeper")
    merged = _paper(session, "merged", is_active=False, superseded_by=keeper.id)
    other_keeper = _paper(session, "other keeper")
    other_merged = _paper(session, "other merged", is_active=False)
    other_merged.superseded_by = other_keeper.id
    session.commit()

    result = load_modalities(_tsv(
        tmp_path,
        (merged.id, "pet", "methods", "a1"),
        # The keeper's own row wins over its merged paper's.
        (other_merged.id, "eeg", "methods", "a2"),
        (other_keeper.id, "meg", "record", "a3"),
    ))
    session.commit()

    assert _state(session, keeper.id) == (["pet"], "methods")
    assert _state(session, other_keeper.id) == (["meg"], "record")
    assert result.redirected == {merged.id: keeper.id}
