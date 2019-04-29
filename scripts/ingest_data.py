"""
Ingest and sync data from various sources (Neurosynth, NeuroVault, etc.).
"""

from neurosynth.models import Study, Analysis, Condition, Image
from neurosynth.core import db
import requests
import re


def ingest_neurovault(verbose=False, limit=20):

    # Store existing studies for quick lookup
    all_studies = {s.doi: s for s in
                   Study.query.filter(Study.doi.isnot(None)).all()}
    print(all_studies)

    def add_collection(data):
        if data['DOI'] in all_studies:
            print("Skipping {} (already exists)...".format(data['DOI']))
            return
        s = Study(name=data['name'], doi=data['DOI'], data=data)

        # Process images
        url = "https://neurovault.org/api/collections/{}/images/?format=json"
        image_url = url.format(data['id'])
        data = requests.get(image_url).json()
        analyses = {}
        images = []
        for img in data['results']:
            aname = img['name']
            if aname not in analyses:
                analysis = Analysis(name=aname, description=img['description'],
                                    study=s)
                analyses[aname] = analysis
            else:
                analysis = analyses[aname]
            # TODO: could parse Analysis into Conditions here
            space = 'unknown' if not img.get('not_mni', False) else 'MNI'
            type_ = img.get('map_type', 'Unknown')
            if re.match('\w\smap.*', type_):
                type_ = type_[0]
            image = Image(path=img['file'], space=space, value_type=type_,
                          analysis=analysis, data=img)
            images.append(image)

        db.session.add_all([s] + list(analyses.values()) + images)
        db.session.commit()
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

db.drop_all()
db.create_all()

ingest_neurovault(limit=5)