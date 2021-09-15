"""
Ingest and sync data from various sources (Neurosynth, NeuroVault, etc.).
"""
import os.path as op
import re
from pathlib import Path

import pandas as pd
import requests
from dateutil.parser import parse as parse_date
from neurostore.core import db
from neurostore.models import (
    Analysis,
    AnalysisConditions,
    Condition,
    Image,
    Point,
    Study,
)


def ingest_neurovault(verbose=False, limit=20):

    # Store existing studies for quick lookup
    all_studies = {s.doi: s for s in Study.query.filter(Study.doi.isnot(None)).all()}

    def add_collection(data):
        if data["DOI"] in all_studies:
            print("Skipping {} (already exists)...".format(data["DOI"]))
            return
        collection_id = data.pop('id')
        s = Study(
            name=data.pop("name", None),
            description=data.pop("description", None),
            doi=data.pop("DOI", None),
            authors=data.pop("authors", None),
            publication=data.pop("journal_name", None),
            source_id=collection_id,
            metadata_=data,
            source="neurovault")

        space = data.get("coordinate_space", None)
        # Process images
        url = "https://neurovault.org/api/collections/{}/images/?format=json"
        image_url = url.format(collection_id)
        data = requests.get(image_url).json()
        analyses = {}
        images = []
        conditions = set()
        for img in data["results"]:
            aname = img["name"]
            if aname not in analyses:
                condition = img.get('cognitive_paradigm_cogatlas')
                analysis_kwargs = {
                    "name": aname,
                    "description": img['description'],
                    "study": s,
                }

                analysis = Analysis(**analysis_kwargs)
                if condition:
                    cond = next(
                        (
                            cond for cond in list(conditions) + Condition.query.all()
                            if cond.name == condition), Condition(name=condition)
                    )
                    conditions.add(cond)

                    analysis.analysis_conditions.append(
                        AnalysisConditions(weight=1, condition=cond)
                    )

                analyses[aname] = analysis
            else:
                analysis = analyses[aname]
            space = space or "Unknown" if img.get("not_mni", False) else "MNI"
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

        db.session.add_all([s] + list(analyses.values()) + images + list(conditions))
        db.session.commit()
        all_studies[s.name] = s
        return s

    url = "https://neurovault.org/api/collections.json"
    count = 0

    while True:
        data = requests.get(url).json()
        url = data["next"]
        studies = list(filter(None, [
            add_collection(c)
            for c in data["results"]
            if c["DOI"] is not None and c["number_of_images"]
        ]))
        db.session.add_all(studies)
        db.session.commit()
        count += len(studies)
        if (limit is not None and count >= int(limit)) or not url:
            break


def ingest_neurosynth(max_rows=None):

    coords_file = (
        Path(__file__).parent.parent / "data" / "data-neurosynth_version-7_coordinates.tsv.gz"
    )
    metadata_file = (
        Path(__file__).parent.parent / "data" / "data-neurosynth_version-7_metadata.tsv.gz"
    )

    coord_data = pd.read_table(coords_file, dtype={"id": str})
    coord_data = coord_data.set_index("id")
    metadata = pd.read_table(metadata_file, dtype={"id": str})
    metadata = metadata.set_index("id")

    if max_rows is not None:
        metadata = metadata.iloc[:max_rows]

    for id_, metadata_row in metadata.iterrows():
        study_coord_data = coord_data.loc[[id_]]
        md = {
            "year": int(metadata_row["year"]),
        }
        s = Study(
            name=metadata_row["title"],
            authors=metadata_row["authors"],
            publication=metadata_row['journal'],
            metadata=md,
            pmid=id_,
            doi=metadata_row["doi"],
            source="neurosynth",
            source_id=id_,
        )
        analyses = []
        points = []

        for t_id, df in study_coord_data.groupby("table_id"):
            a = Analysis(name=str(t_id), study=s)
            analyses.append(a)
            for _, p in df.iterrows():
                point = Point(
                    x=p["x"],
                    y=p["y"],
                    z=p["z"],
                    space=metadata_row["space"],
                    kind="unknown",
                    analysis=a,
                )
                points.append(point)

        db.session.add_all([s] + analyses + points)
        db.session.commit()


def ingest_neuroquery(max_rows=None):

    coords_file = (
        Path(__file__).parent.parent / "data" / "data-neuroquery_version-1_coordinates.tsv.gz"
    )
    metadata_file = (
        Path(__file__).parent.parent / "data" / "data-neuroquery_version-1_metadata.tsv.gz"
    )

    coord_data = pd.read_table(coords_file, dtype={"id": str})
    coord_data = coord_data.set_index("id")
    metadata = pd.read_table(metadata_file, dtype={"id": str})
    metadata = metadata.set_index("id")

    if max_rows is not None:
        metadata = metadata.iloc[:max_rows]

    for id_, metadata_row in metadata.iterrows():
        study_coord_data = coord_data.loc[[id_]]
        s = Study(
            name=metadata_row["title"],
            metadata=dict(),
            source="neuroquery",
            pmid=id_,
            source_id=id_,
        )
        analyses = []
        points = []

        for t_id, df in study_coord_data.groupby("table_id"):
            a = Analysis(name=str(t_id), study=s)
            analyses.append(a)
            for _, p in df.iterrows():
                point = Point(
                    x=p["x"],
                    y=p["y"],
                    z=p["z"],
                    space="MNI",
                    kind="unknown",
                    analysis=a,
                )
                points.append(point)

        db.session.add_all([s] + analyses + points)
        db.session.commit()
