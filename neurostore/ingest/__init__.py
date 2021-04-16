"""
Ingest and sync data from various sources (Neurosynth, NeuroVault, etc.).
"""
import re
import os.path as op
from pathlib import Path
from dateutil.parser import parse as parse_date
import tarfile

import pandas as pd
import requests

from neurostore.models import Study, Analysis, Image, User, Point
from neurostore.core import db


def ingest_neurovault(verbose=False, limit=20):

    user = User.query.filter_by(email="admin@neurostore.org").first()

    # Store existing studies for quick lookup
    all_studies = {s.doi: s for s in Study.query.filter(Study.doi.isnot(None)).all()}

    def add_collection(data):
        if data["DOI"] in all_studies:
            print("Skipping {} (already exists)...".format(data["DOI"]))
            return
        s = Study(name=data["name"], doi=data["DOI"], metadata_=data, user=user)

        # Process images
        url = "https://neurovault.org/api/collections/{}/images/?format=json"
        image_url = url.format(data["id"])
        data = requests.get(image_url).json()
        analyses = {}
        images = []
        for img in data["results"]:
            aname = img["name"]
            if aname not in analyses:
                analysis = Analysis(name=aname, description=img["description"], study=s)
                analyses[aname] = analysis
            else:
                analysis = analyses[aname]
            # TODO: could parse Analysis into Conditions here
            space = "unknown" if not img.get("not_mni", False) else "MNI"
            type_ = img.get("map_type", "Unknown")
            if re.match(r"\w\smap.*", type_):
                type_ = type_[0]
            image = Image(
                url=img["file"],
                space=space,
                value_type=type_,
                analysis=analysis,
                data=img,
                filename=op.basename(img["file"]),
                add_date=parse_date(img["add_date"]),
            )
            images.append(image)

        db.session.add_all([s] + list(analyses.values()) + images)
        db.session.commit()
        all_studies[s.name] = s
        return s

    url = "https://neurovault.org/api/collections.json"
    count = 0
    while True:
        data = requests.get(url).json()
        url = data["next"]
        studies = [
            add_collection(c)
            for c in data["results"]
            if c["DOI"] is not None and c["number_of_images"]
        ]
        db.session.add_all(studies)
        db.session.commit()
        count += len(studies)
        if (limit is not None and count >= limit) or not url:
            break


def ingest_neurosynth(max_rows=None):

    user = User.query.filter_by(email="admin@neurostore.org").first()

    path = Path(__file__).parent.parent / "data" / "data_0.7.July_2018.tar.gz"
    with open(path, "rb") as tf:
        tar = tarfile.open(fileobj=tf)
        f = tar.extractfile("database.txt")
        data = pd.read_csv(f, sep="\t")

        if max_rows is not None:
            data = data.iloc[:max_rows]

        for doi, study_df in data.groupby("doi"):
            row = study_df.iloc[0]
            md = {
                "authors": row["authors"],
                "year": int(row["year"]),
                "journal": row["journal"],
            }
            s = Study(name=row["title"], metadata=md, doi=doi, user=user)
            analyses = []
            points = []
            for t_id, df in study_df.groupby("table_id"):
                a = Analysis(name=str(t_id), study=s)
                analyses.append(a)
                for _, p in df.iterrows():
                    point = Point(
                        x=p["x"],
                        y=p["y"],
                        z=p["z"],
                        space=p["space"],
                        kind="unknown",
                        analysis=a,
                    )
                    points.append(point)
            db.session.add_all([s] + analyses + points)
            db.session.commit()
