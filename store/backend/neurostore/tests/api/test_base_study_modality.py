"""GET /base-studies/?modality=: the papers with an analysis acquired by any of the given
modalities, read from `base_studies.modalities`, which a trigger keeps equal to the union of
the paper's `analysis_features.modalities`.

The test database is built by the migrations, so these tests check what a migrated
database does.
"""

import copy
from urllib.parse import urlencode

import pytest
import sqlalchemy as sa

from neurostore.database import db
from neurostore.models import (
    Analysis,
    AnalysisFeature,
    BaseStudy,
    Fulltext,
    Point,
    PointValue,
)
from neurostore.tests import analysis_fixtures as af

pytestmark = pytest.mark.anyio

SCHIZOPHRENIA, NICOTINE, CONDUCT = "ya2RC6UYbibC", "6SKTGteXbbBs", "AhxosLhYA5YG"


def _with_pet(name):
    """Record ``name`` with its last analysis acquired by PET; the others stay fMRI."""
    document = af.record(name)
    fmri = document["acquisitions"][0]
    pet = copy.deepcopy(fmri)
    pet["local_id"] = "acq_pet"
    pet["modality"]["value"] = "PET"
    document["acquisitions"].append(pet)
    document["analyses"][-1]["acquisitions"] = ["acq_pet"]
    return document


@pytest.fixture
def papers(session):
    """Base study id of each paper: SCHIZOPHRENIA fMRI and PET, the others fMRI only.
    CONDUCT's record also describes an sMRI acquisition that no analysis uses."""
    ids = {
        SCHIZOPHRENIA: af.upload(SCHIZOPHRENIA, _with_pet(SCHIZOPHRENIA))["base_study_id"],
        NICOTINE: af.upload(NICOTINE)["base_study_id"],
        CONDUCT: af.upload(CONDUCT)["base_study_id"],
    }
    db.session.commit()
    return ids


async def _found(client, papers, *modalities, **params):
    """The fixture papers the list returns, by name; the count must agree with them."""
    query = urlencode([*(("modality", m) for m in modalities), *params.items()])
    resp = await client.get(f"/api/base-studies/?{query}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    ids = [r["id"] for r in body["results"]]
    assert body["metadata"]["total_count"] == len(ids)
    names = {v: k for k, v in papers.items()}
    return sorted(names.get(i, i) for i in ids)


def _modalities(session, base_study_id):
    session.expire_all()
    return session.get(BaseStudy, base_study_id).modalities


async def test_a_paper_matches_when_any_analysis_has_any_given_modality(auth_client, papers):
    every = sorted([SCHIZOPHRENIA, NICOTINE, CONDUCT])

    assert await _found(auth_client, papers, "pet") == [SCHIZOPHRENIA]
    # One paper, two modalities: its fMRI analyses match too.
    assert await _found(auth_client, papers, "fmri") == every
    # Any of the values, compared as the features store them, lower-cased.
    assert await _found(auth_client, papers, "MEG", "PET") == [SCHIZOPHRENIA]
    assert await _found(auth_client, papers, "meg") == []
    # An acquisition no analysis uses is not the paper's modality.
    assert await _found(auth_client, papers, "smri") == []
    # Without the parameter nothing is filtered.
    assert await _found(auth_client, papers) == every


async def test_the_filter_keeps_the_list_s_other_filters(auth_client, session, papers):
    nicotine = papers[NICOTINE]
    session.add(Fulltext(base_study_id=nicotine, source="pubget", text="Zyxomma here."))
    session.commit()

    assert await _found(auth_client, papers, "fmri", pmid=af.PMIDS[NICOTINE]) == [NICOTINE]
    assert await _found(auth_client, papers, "pet", pmid=af.PMIDS[NICOTINE]) == []
    # The full-text search pages its two indexes itself: the filter still holds.
    full_text = {"search": "zyxomma", "search_full_text": "true"}
    assert await _found(auth_client, papers, "fmri", **full_text) == [NICOTINE]
    assert await _found(auth_client, papers, "pet", **full_text) == []


async def test_a_page_lists_the_filtered_papers_only(auth_client, papers):
    resp = await auth_client.get("/api/base-studies/?modality=fmri&page=2&page_size=2")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["metadata"]["total_count"] == 3
    assert len(body["results"]) == 1


async def test_the_copy_follows_every_writer(session, papers):
    paper = papers[SCHIZOPHRENIA]
    assert _modalities(session, paper) == ["fmri", "pet"]

    # A deleted analysis: its features go by cascade.
    pet_analysis = session.execute(
        sa.select(AnalysisFeature.analysis_id).where(
            AnalysisFeature.base_study_id == paper,
            AnalysisFeature.modalities.contains(["pet"]),
        )
    ).scalar_one()
    points = sa.select(Point.id).where(Point.analysis_id == pet_analysis)
    session.execute(sa.delete(PointValue).where(PointValue.point_id.in_(points)))
    session.execute(sa.delete(Analysis).where(Analysis.id == pet_analysis))
    session.commit()
    assert _modalities(session, paper) == ["fmri"]

    # A new record: the ingester rewrites the paper's features.
    af.upload(SCHIZOPHRENIA, _with_pet(SCHIZOPHRENIA))
    session.commit()
    assert _modalities(session, paper) == ["fmri", "pet"]

    # An edit of a feature row.
    session.execute(
        sa.update(AnalysisFeature)
        .where(AnalysisFeature.base_study_id == paper)
        .values(modalities=["eeg"])
    )
    session.commit()
    assert _modalities(session, paper) == ["eeg"]

    # No features left: the copy is empty, not NULL.
    session.execute(sa.delete(AnalysisFeature).where(AnalysisFeature.base_study_id == paper))
    session.commit()
    assert _modalities(session, paper) == []

    # Other papers are untouched throughout.
    assert _modalities(session, papers[NICOTINE]) == ["fmri"]
