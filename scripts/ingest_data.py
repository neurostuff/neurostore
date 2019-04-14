"""
Ingest and sync data from various sources (Neurosynth, NeuroVault, etc.).
"""

from neurosynth.models import Study, Analysis, Image
from neurosynth import database as db
import requests


def ingest_neurovault(verbose=False, limit=20):

    # Store existing studies for quick lookup
    all_studies = {s.name: s for s in
                   Study.query.filter(Study.doi.isnot(None)).all()}

    def add_collection(data):
        if data['name'] in all_studies:
            return
        s = Study(name=data['name'], doi=data['DOI'])
        all_studies[s.name] = s
        return s

    url = "https://neurovault.org/api/collections.json"
    count = 0
    while True:
        data = requests.get(url).json()
        url = data['next']
        studies = [add_collection(c) for c in data['results']
                   if c['DOI'] is not None and c['number_of_images']]
        db.session.add_all(studies)
        db.session.commit()
        count += len(studies)
        if (limit is not None and count >= limit) or not url:
            break

db.reset_database()
ingest_neurovault()