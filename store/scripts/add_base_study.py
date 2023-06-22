from neurostore.models import BaseStudy, Study
from neurostore.database import db

base_study_attributes = ['name', 'description', 'doi', 'pmid', 'authors', 'publication', 'metadata_', 'level']
base_study_dois = {}
base_study_pmids = {}
for study in Study.query:
    print(f'handling {study.name}')
    base_study = None
    if study.doi:
        base_study = base_study_dois.get(study.doi, None)

    if study.pmid:
        base_study = base_study_pmids.get(study.pmid, None)

    if base_study is None:
        base_study = BaseStudy()

    for attr in base_study_attributes:
        source_attr = getattr(base_study, attr)
        new_attr = getattr(study, attr)
        setattr(base_study, attr, source_attr or new_attr)

    base_study.versions.append(study)

    if base_study.doi:
        base_study_dois[base_study.doi] = base_study

    if base_study.pmid:
        base_study_pmids[base_study.pmid] = base_study

to_commit = set(base_study_dois.values()).union(base_study_pmids.values())

db.session.add_all(to_commit)

db.session.commit()
