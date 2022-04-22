"""
Ingest studies from Neurostore
"""
import requests

from ..models import Studyset, Annotation, Specification, MetaAnalysis
from ..database import db


def ingest_neurostore(url="https://www.neurostore.xyz", n_studysets=None):
    studysets = requests.get(f"{url}/api/studysets/").json['results']
    
    to_commit = []
    with db.session.no_autoflush:
        for studyset in studysets:
            ss = Studyset(neurostore_id=studyset['id'])
            to_commit.append(ss)
            annotations = requests.get(f"{url}/api/annotations/?studyset_id={studyset['id']}").json['results']
            for annot in annotations:
                to_commit.append(Annotation(studyset=ss, neurostore_id=annot['id']))
        
        db.session.add_all(to_commit)
        db.session.commit()


def create_meta_analyses(url="https://www.neurostore.xyz", n_studysets=None):
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
                    annotation=ss.annotations[0],
                )
            )
        
        db.session.add_all(to_commit)
        db.session.commit()

        
