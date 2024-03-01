"""
Ingest and sync data from various sources (Neurosynth, NeuroVault, etc.).
"""

import os.path as op
import re
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from scipy import sparse
from dateutil.parser import parse as parse_date
from sqlalchemy import or_

from neurostore.database import db
from neurostore.models import (
    Analysis,
    AnalysisConditions,
    AnnotationAnalysis,
    Annotation,
    Condition,
    Image,
    Point,
    Study,
    BaseStudy,
    Studyset,
    Entity,
)
from neurostore.models.data import StudysetStudy, _check_type


def ingest_neurovault(verbose=False, limit=20, overwrite=False, max_images=None):
    # Store existing studies for quick lookup
    all_studies = {s.doi: s for s in Study.query.filter_by(source="neurovault").all()}

    def add_collection(data):
        if data["DOI"] in all_studies and not overwrite:
            print("Skipping {} (already exists)...".format(data["DOI"]))
            return
        collection_id = data.pop("id")
        doi = data.pop("DOI", None)
        base_study = None
        if doi:
            base_study = BaseStudy.query.filter_by(doi=doi).one_or_none()

        if base_study is None:
            base_study = BaseStudy(
                name=data.pop("name", None),
                description=data.pop("description", None),
                doi=data.pop("DOI", None),
                authors=data.pop("authors", None),
                publication=data.pop("journal_name", None),
                metadata_=data,
                level="group",
            )
        s = Study(
            name=data.pop("name", None) or base_study.name,
            description=data.pop("description", None) or base_study.description,
            doi=doi,
            pmid=base_study.pmid,
            authors=data.pop("authors", None) or base_study.authors,
            publication=data.pop("journal_name", None) or base_study.publication,
            source_id=collection_id,
            metadata_=data,
            source="neurovault",
            level="group",
            base_study=base_study,
        )

        space = data.get("coordinate_space", None)
        # Process images
        url = "https://neurovault.org/api/collections/{}/images/?format=json"
        image_url = url.format(collection_id)
        data = requests.get(image_url).json()
        analyses = {}
        images = []
        conditions = set()
        order = 0
        for img in data["results"]:
            aname = img["name"]
            if aname not in analyses:
                condition = img.get("cognitive_paradigm_cogatlas")
                analysis_kwargs = {
                    "name": aname,
                    "description": img["description"],
                    "study": s,
                    "order": order,
                }
                order += 1
                analysis = Analysis(**analysis_kwargs)
                if condition:
                    cond = next(
                        (
                            cond
                            for cond in list(conditions) + Condition.query.all()
                            if cond.name == condition
                        ),
                        Condition(name=condition),
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
                entities=[
                    Entity(level="group", label=analysis.name, analysis=analysis)
                ],
            )
            images.append(image)

        db.session.add_all(
            [base_study] + [s] + list(analyses.values()) + images + list(conditions)
        )
        db.session.commit()
        all_studies[s.name] = s
        return s

    url = "https://neurovault.org/api/collections.json"
    count = 0

    while True:
        data = requests.get(url).json()
        url = data["next"]
        studies = list(
            filter(
                None,
                [
                    add_collection(c)
                    for c in data["results"]
                    if c["DOI"] is not None
                    and c["number_of_images"] > 0
                    and (max_images is None or c["number_of_images"] < max_images)
                ],
            )
        )
        db.session.add_all(studies)
        db.session.commit()
        count += len(studies)
        if (limit is not None and count >= int(limit)) or not url:
            break


def ingest_neurosynth(max_rows=None):
    coords_file = (
        Path(__file__).parent.parent
        / "data"
        / "data-neurosynth_version-7_coordinates.tsv.gz"
    )
    metadata_file = (
        Path(__file__).parent.parent
        / "data"
        / "data-neurosynth_version-7_metadata.tsv.gz"
    )

    feature_file = (
        Path(__file__).parent.parent
        / "data"
        / "data-neurosynth_version-7_vocab-terms_source-abstract_type-tfidf_features.npz"
    )

    vocab_file = (
        Path(__file__).parent.parent
        / "data"
        / "data-neurosynth_version-7_vocab-terms_vocabulary.txt"
    )

    coord_data = pd.read_table(coords_file, dtype={"id": str})
    coord_data = coord_data.set_index("id")
    metadata = pd.read_table(metadata_file, dtype={"id": str, "doi": str})
    metadata = metadata.set_index("id")
    # load annotations
    features = sparse.load_npz(feature_file).todense()
    vocabulary = np.loadtxt(vocab_file, dtype=str, delimiter="\t")
    annotations = pd.DataFrame(features, columns=vocabulary)

    if max_rows is not None:
        metadata = metadata.iloc[:max_rows]
        annotations = annotations.iloc[:max_rows]

    # create studyset object
    d = Studyset(
        name="neurosynth",
        description="TODO",
        publication="Nature Methods",
        pmid="21706013",
        doi="10.1038/nmeth.1635",
        authors="Yarkoni T, Poldrack RA, Nichols TE, Van Essen DC, Wager TD",
        public=True,
    )

    studies = []
    to_commit = []
    all_studies = {s.pmid: s for s in Study.query.filter_by(source="neurosynth").all()}
    with db.session.no_autoflush:
        for metadata_row, annotation_row in zip(
            metadata.itertuples(), annotations.itertuples(index=False)
        ):
            base_study = None
            doi = None if isinstance(metadata_row.doi, float) else metadata_row.doi
            id_ = pmid = metadata_row.Index

            # find an base_study based on available information
            if doi is not None:
                base_studies = BaseStudy.query.filter(
                    or_(BaseStudy.doi == doi, BaseStudy.pmid == pmid)
                ).all()

                if len(base_studies) == 1:
                    base_study = base_studies[0]
                elif len(base_studies) > 1:
                    source_base_study = base_studies[0]
                    # do not overwrite the versions column
                    # we want to append to this column
                    columns = [
                        c
                        for c in source_base_study.__table__.columns
                        if c != "versions"
                    ]
                    for ab in base_studies[1:]:
                        for col in columns:
                            source_attr = getattr(source_base_study, col)
                            new_attr = getattr(ab, col)
                            setattr(source_base_study, col, source_attr or new_attr)
                        source_base_study.versions.extend(ab.versions)
                        # delete the extraneous record
                        db.session.delete(ab)

            if doi is None:
                base_study = BaseStudy.query.filter_by(pmid=pmid).one_or_none()

            if base_study is None:
                base_study = BaseStudy(
                    name=metadata_row.title,
                    doi=doi,
                    pmid=pmid,
                    authors=metadata_row.authors,
                    publication=metadata_row.journal,
                    year=metadata_row.year,
                    level="group",
                )
            else:
                # try to update the abstract study if information is missing
                study_info = {
                    "name": metadata_row.title,
                    "doi": doi,
                    "pmid": pmid,
                    "authors": metadata_row.authors,
                    "publication": metadata_row.journal,
                    "year": metadata_row.year,
                    "level": "group",
                }
                for col, value in study_info.items():
                    source_attr = getattr(base_study, col)
                    setattr(base_study, col, source_attr or value)
            to_commit.append(base_study)
            study_coord_data = coord_data.loc[[id_]]
            md = {
                "year": int(metadata_row.year),
            }
            if metadata_row.doi in all_studies:
                continue
            s = Study(
                name=metadata_row.title,
                authors=metadata_row.authors,
                year=metadata_row.year,
                publication=metadata_row.journal,
                metadata=md,
                pmid=id_,
                doi=doi,
                source="neurosynth",
                source_id=id_,
                level="group",
                base_study=base_study,
            )
            analyses = []
            points = []

            for order, (t_id, df) in enumerate(study_coord_data.groupby("table_id")):
                a = Analysis(name=str(t_id), study=s, order=order, table_id=str(t_id))
                analyses.append(a)
                point_idx = 0
                for _, p in df.iterrows():
                    point = Point(
                        x=p["x"],
                        y=p["y"],
                        z=p["z"],
                        space=metadata_row.space,
                        kind="unknown",
                        analysis=a,
                        entities=[Entity(label=a.name, level="group", analysis=a)],
                        order=point_idx,
                    )
                    points.append(point)
                    point_idx += 1
            to_commit.extend(points)
            to_commit.extend(analyses)
            studies.append(s)

        # add studies to studyset
        d.studies = studies
        db.session.add_all([d] + studies + to_commit)
        db.session.commit()

        # create annotation object
        annot = Annotation(
            name="neurosynth",
            source="neurostore",
            source_id=None,
            description="TODO",
            studyset=d,
        )

        # collect notes (single annotations) for each analysis
        notes = []
        for metadata_row, annotation_row in zip(
            metadata.itertuples(), annotations.itertuples(index=False)
        ):
            id_ = metadata_row.Index
            study_coord_data = coord_data.loc[[id_]]
            study = Study.query.filter_by(pmid=id_).one()
            studyset_study = StudysetStudy.query.filter_by(
                study_id=study.id, studyset_id=d.id
            ).one()
            to_commit.extend([study, studyset_study] + study.analyses)
            for analysis in study.analyses:
                # add annotation
                notes.append(
                    AnnotationAnalysis(
                        note=annotation_row._asdict(),
                        analysis=analysis,
                        annotation=annot,
                        studyset_study=studyset_study,
                    )
                )

        # add notes to annotation
        annot.note_keys = {
            k: _check_type(v) for k, v in annotation_row._asdict().items()
        }
        annot.annotation_analyses = notes
        db.session.add_all([annot] + notes + to_commit)
        db.session.commit()


def ingest_neuroquery(max_rows=None):
    coords_file = (
        Path(__file__).parent.parent
        / "data"
        / "data-neuroquery_version-1_coordinates.tsv.gz"
    )
    metadata_file = (
        Path(__file__).parent.parent
        / "data"
        / "data-neuroquery_version-1_metadata.tsv.gz"
    )

    coord_data = pd.read_table(coords_file, dtype={"id": str})
    coord_data = coord_data.set_index("id")
    metadata = pd.read_table(metadata_file, dtype={"id": str})
    metadata = metadata.set_index("id")

    if max_rows is not None:
        metadata = metadata.iloc[:max_rows]

    # all_studies = {s.pmid: s for s in Study.query.filter(source="neuroquery").all()}
    for id_, metadata_row in metadata.iterrows():
        base_study = BaseStudy.query.filter_by(pmid=id_).one_or_none()

        if base_study is None:
            base_study = BaseStudy(name=metadata_row["title"], level="group", pmid=id_)

        study_coord_data = coord_data.loc[[id_]]
        s = Study(
            name=metadata_row["title"] or base_study.name,
            source="neuroquery",
            pmid=id_,
            doi=base_study.doi,
            year=base_study.year,
            publication=base_study.publication,
            authors=base_study.authors,
            source_id=id_,
            level="group",
            base_study=base_study,
        )
        analyses = []
        points = []

        for order, (t_id, df) in enumerate(study_coord_data.groupby("table_id")):
            a = Analysis(name=str(t_id), table_id=str(t_id), order=order, study=s)
            analyses.append(a)
            point_idx = 0
            for _, p in df.iterrows():
                point = Point(
                    x=p["x"],
                    y=p["y"],
                    z=p["z"],
                    space="MNI",
                    kind="unknown",
                    analysis=a,
                    entities=[Entity(label=a.name, level="group", analysis=a)],
                    order=point_idx,
                )
                points.append(point)
                point_idx += 1

        db.session.add_all([s] + analyses + points + [base_study])
        # db.session.commit()

    # make a neuroquery studyset
    d = Studyset(
        name="neuroquery",
        description="TODO",
        publication="eLife",
        pmid="32129761",
        doi="10.7554/eLife.53385",
        public=True,
        studies=Study.query.filter_by(source="neuroquery").all(),
    )
    db.session.add(d)
    db.session.commit()


def load_ace_files(coordinates_file, metadata_file, text_file):
    coordinates_df = pd.read_table(coordinates_file, sep=",", dtype={"pmid": str})
    metadata_df = pd.read_table(metadata_file, sep=",", dtype={"pmid": str})
    text_df = pd.read_table(text_file, sep=",", dtype={"pmid": str})

    # preprocessing
    metadata_df.set_index("pmid", inplace=True)
    text_df.set_index("pmid", inplace=True)
    coordinates_df.set_index("pmid", inplace=True)

    # ensure same order
    text_df = text_df.reindex(metadata_df.index)

    return coordinates_df, metadata_df, text_df


def ace_ingestion_logic(coordinates_df, metadata_df, text_df):
    to_commit = []
    # see if there are duplicates for the newly created base_studies
    all_base_studies = []
    with db.session.no_autoflush:
        all_studies = {
            s.pmid: s for s in Study.query.filter_by(source="neurosynth").all()
        }
        for metadata_row, text_row in zip(
            metadata_df.itertuples(), text_df.itertuples()
        ):
            base_study = None
            doi = None if isinstance(metadata_row.doi, float) else metadata_row.doi
            id_ = pmid = metadata_row.Index
            year = (
                None
                if np.isnan(metadata_row.publication_year)
                else int(metadata_row.publication_year)
            )
            # find an base_study based on available information
            if doi is not None:
                base_studies = BaseStudy.query.filter(
                    or_(BaseStudy.doi == doi, BaseStudy.pmid == pmid)
                ).all()

                if len(base_studies) == 1:
                    base_study = base_studies[0]
                elif len(base_studies) > 1:
                    # find the first abstract study with both pmid and doi
                    source_base_study = next(
                        filter(
                            lambda bs: bs.pmid == pmid and bs.doi == doi, base_studies
                        ),
                        base_studies[0],
                    )
                    other_base_studies = [
                        bs for bs in base_studies if bs.id != source_base_study.id
                    ]
                    # do not overwrite the versions column
                    # we want to append to this column
                    columns = [
                        c.name
                        for c in source_base_study.__table__.columns
                        if c != "versions"
                    ]
                    for ab in other_base_studies:
                        for col in columns:
                            source_attr = getattr(source_base_study, col)
                            new_attr = getattr(ab, col)
                            setattr(source_base_study, col, source_attr or new_attr)
                        source_base_study.versions.extend(ab.versions)
                        # delete the extraneous record
                        db.session.delete(ab)

                    base_study = source_base_study
                else:
                    # see if it exists in the already created base_studies
                    created_bs = [
                        bs
                        for bs in all_base_studies
                        if bs.doi == doi and bs.pmid == pmid
                    ]
                    if created_bs:
                        base_study = created_bs[0]

            if doi is None:
                base_study = BaseStudy.query.filter_by(pmid=pmid).one_or_none()

            if base_study is None:
                base_study = BaseStudy(
                    name=metadata_row.title,
                    doi=doi,
                    pmid=pmid,
                    authors=metadata_row.authors,
                    publication=metadata_row.journal,
                    description=text_row.abstract,
                    year=year,
                    level="group",
                )
            else:
                # try to update the abstract study if information is missing
                study_info = {
                    "name": metadata_row.title,
                    "doi": doi,
                    "pmid": pmid,
                    "description": text_row.abstract,
                    "authors": metadata_row.authors,
                    "publication": metadata_row.journal,
                    "year": year,
                    "level": "group",
                }
                for col, value in study_info.items():
                    source_attr = getattr(base_study, col)
                    setattr(base_study, col, source_attr or value)

            # append base study to commit
            to_commit.append(base_study)

            s = all_studies.get(pmid, Study())

            # try to update the study if information is missing
            study_info = {
                "name": metadata_row.title,
                "doi": doi,
                "pmid": pmid,
                "description": text_row.abstract,
                "authors": metadata_row.authors,
                "publication": metadata_row.journal,
                "year": year,
                "level": "group",
                "source": "neurosynth",
            }
            for col, value in study_info.items():
                source_attr = getattr(s, col)
                setattr(s, col, source_attr or value)

            analyses = []
            points = []

            try:
                study_coord_data = coordinates_df.loc[[id_]]
            except KeyError:
                print(f"pmid: {id_} has no coordinates")
                continue
            for order, (t_id, df) in enumerate(study_coord_data.groupby("table_id")):
                a = (
                    Analysis.query.filter_by(table_id=str(t_id)).one_or_none()
                    or Analysis()
                )
                a.name = df["table_label"][0] or str(t_id)
                a.table_id = str(t_id)
                a.order = a.order or order
                a.description = (
                    df["table_caption"][0]
                    if not df["table_caption"].isna()[0]
                    else None
                )
                if not a.study:
                    a.study = s
                analyses.append(a)
                point_idx = 0
                for _, p in df.iterrows():
                    point = Point(
                        x=p["x"],
                        y=p["y"],
                        z=p["z"],
                        space=metadata_row.coordinate_space,
                        kind=(
                            df["statistic"][0]
                            if not df["statistic"].isna()[0]
                            else "unknown"
                        ),
                        analysis=a,
                        entities=[Entity(label=a.name, level="group", analysis=a)],
                        order=point_idx,
                    )
                    points.append(point)
                    point_idx += 1
            to_commit.extend(points)
            to_commit.extend(analyses)
            # append study as version of study
            base_study.versions.append(s)

    db.session.add_all(to_commit)
    db.session.commit()


def ingest_ace(max_rows=None):
    coords_file = (
        Path(__file__).parent.parent / "data" / "ace" / "sample_coordinates.csv"
    )

    metadata_file = (
        Path(__file__).parent.parent / "data" / "ace" / "sample_metadata.csv"
    )

    text_file = Path(__file__).parent.parent / "data" / "ace" / "sample_text.csv"

    coordinates_df, metadata_df, text_df = load_ace_files(
        coords_file, metadata_file, text_file
    )

    ace_ingestion_logic(coordinates_df, metadata_df, text_df)
