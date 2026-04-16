"""
Ingest studies from Neurostore
"""

import requests
from sqlalchemy import select

from neurosynth_compose.database import commit_session, db
from neurosynth_compose.models import (
    SnapshotAnnotation,
    SnapshotStudyset,
    NeurostoreAnnotation,
    NeurostoreStudyset,
    MetaAnalysis,
    Specification,
)


def ingest_neurostore(
    url="https://neurostore.org", n_studysets=None, study_size_limit=1000
):
    request = requests.get(f"{url}/api/studysets/")
    if request.status_code != 200:
        request.raise_for_status()
    studysets = requests.get(f"{url}/api/studysets/").json()["results"]
    if n_studysets:
        studysets = studysets[:n_studysets]

    to_commit = []
    with db.session.no_autoflush:
        for studyset in studysets:
            ss_ref = db.session.execute(
                select(NeurostoreStudyset).where(
                    NeurostoreStudyset.id == studyset["id"]
                )
            ).scalar_one_or_none() or NeurostoreStudyset(id=studyset["id"])
            ss = SnapshotStudyset(neurostore_studyset=ss_ref)
            to_commit.append(ss)
            # only ingest annotations for smaller studysets now.
            if len(studyset["studies"]) < study_size_limit:
                annotations = requests.get(
                    f"{url}/api/annotations/?studyset_id={studyset['id']}"
                ).json()["results"]
                for annot in annotations:
                    annot_ref = db.session.execute(
                        select(NeurostoreAnnotation).where(
                            NeurostoreAnnotation.id == annot["id"]
                        )
                    ).scalar_one_or_none() or NeurostoreAnnotation(id=annot["id"])
                    to_commit.append(
                        SnapshotAnnotation(
                            snapshot_studyset=ss,
                            neurostore_annotation=annot_ref,
                        )
                    )

        db.session.add_all(to_commit)
        commit_session()


def create_meta_analyses(url="https://neurostore.org", n_studysets=None):
    ingest_neurostore(url, n_studysets)
    stdsts = db.session.execute(select(SnapshotStudyset)).scalars().all()
    to_commit = []
    with db.session.no_autoflush:
        for ss in stdsts:
            spec = Specification(
                type="CBMA",
                estimator={
                    "type": "MKDADensity",
                    "args": {"kernel__r": 6.0},
                },
                corrector={
                    "type": "FDRCorrector",
                    "args": {"method": "indep", "alpha": 0.05},
                },
            )

            to_commit.append(
                MetaAnalysis(
                    specification=spec,
                    neurostore_studyset_id=getattr(ss, "neurostore_id", None),
                    neurostore_annotation_id=(
                        getattr(ss.annotations[0], "neurostore_id", None)
                        if ss.annotations
                        else None
                    ),
                )
            )

        db.session.add_all(to_commit)
        commit_session()
