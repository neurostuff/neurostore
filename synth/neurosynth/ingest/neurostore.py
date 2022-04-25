"""
Ingest studies from Neurostore
"""
import requests

from ..models import Studyset, Annotation, Specification, MetaAnalysis, StudysetReference, AnnotationReference
from ..database import db


def ingest_neurostore(url="https://neurostore.xyz", n_studysets=None):
    studysets = requests.get(f"{url}/api/studysets/").json()['results']
    if n_studysets:
        studysets = studysets[:n_studysets]

    to_commit = []
    with db.session.no_autoflush:
        for studyset in studysets:
            ss = Studyset(studyset_reference=StudysetReference(neurostore_id=studyset['id']))
            to_commit.append(ss)
            # only ingest annotations for smaller studysets now.
            if len(studyset['studies']) < 1000:
                annotations = requests.get(f"{url}/api/annotations/?studyset_id={studyset['id']}").json()['results']
                for annot in annotations:
                    to_commit.append(
                        Annotation(
                            studyset=ss,
                            annotation_reference=AnnotationReference(neurostore_id=annot['id'])
                        )
                    )

        db.session.add_all(to_commit)
        db.session.commit()


def create_meta_analyses(url="https://neurostore.xyz", n_studysets=None):
    ingest_neurostore(url, n_studysets)
    stdsts = Studyset.query.all()
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
                    "args": {"method": "indep", "alpha": 0.05}
                },
            )

            to_commit.append(
                MetaAnalysis(
                    specification=spec,
                    studyset=ss,
                    annotation=ss.annotations[0] if ss.annotations else None,
                )
            )

        db.session.add_all(to_commit)
        db.session.commit()
