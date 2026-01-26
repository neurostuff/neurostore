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
    Table,
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

META_ANALYSIS_WORDS = ["meta analysis", "meta-analysis", "systematic review"]


def _coerce_optional(value):
    if pd.isna(value):
        return None
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


def _coerce_optional_int(value):
    value = _coerce_optional(value)
    if value is None:
        return None
    return int(float(value))


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

        base_study.update_has_images_and_points()
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
    base_studies = []
    with db.session.no_autoflush:
        for metadata_row, annotation_row in zip(
            metadata.itertuples(), annotations.itertuples(index=False)
        ):
            base_study = None
            doi = _coerce_optional(metadata_row.doi)
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
                        if c not in ("versions", "__ts_vector__")
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
            base_studies.append(base_study)
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
            tables = {}

            for order, (t_id, df) in enumerate(study_coord_data.groupby("table_id")):
                table = tables.get(t_id) or Table(
                    t_id=str(t_id), name=str(t_id), study=s, user_id=s.user_id
                )
                tables[t_id] = table
                a = Analysis(name=str(t_id), study=s, order=order, table=table)
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
            to_commit.extend(tables.values())
            to_commit.extend(points)
            to_commit.extend(analyses)
            studies.append(s)

        # add studies to studyset via association objects
        d.studyset_studies = [StudysetStudy(study=s, studyset=d) for s in studies]
        db.session.add_all([d] + studies + to_commit + d.studyset_studies)
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
                to_commit.append(analysis)
                # add note
                aa = AnnotationAnalysis(
                    annotation=annot,
                    studyset_study=studyset_study,
                    analysis=analysis,
                    note=annotation_row._asdict(),
                )
                notes.append(aa)

        # add notes to annotation
        annot.note_keys = {
            k: {"type": _check_type(v) or "string", "order": idx}
            for idx, (k, v) in enumerate(annotation_row._asdict().items())
        }
        annot.annotation_analyses = notes
        for note in notes:
            to_commit.append(note.analysis)
        db.session.add_all([annot] + notes + to_commit + [d])
        db.session.commit()
        for bs in base_studies:
            bs.update_has_images_and_points()
            db.session.add_all(base_studies)
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

    base_studies = []
    if max_rows is not None:
        metadata = metadata.iloc[:max_rows]

    # all_studies = {s.pmid: s for s in Study.query.filter(source="neuroquery").all()}
    for id_, metadata_row in metadata.iterrows():
        base_study = BaseStudy.query.filter_by(pmid=id_).one_or_none()

        if base_study is None:
            base_study = BaseStudy(name=metadata_row["title"], level="group", pmid=id_)
        base_studies.append(base_study)
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
        tables = {}

        for order, (t_id, df) in enumerate(study_coord_data.groupby("table_id")):
            table = tables.get(t_id) or Table(
                t_id=str(t_id), name=str(t_id), study=s, user_id=s.user_id
            )
            tables[t_id] = table
            a = Analysis(name=str(t_id), table=table, order=order, study=s)
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

        db.session.add_all(
            [s] + analyses + points + list(tables.values()) + [base_study]
        )
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
    for bs in base_studies:
        bs.update_has_images_and_points()
        db.session.add_all(base_studies)
    db.session.commit()


def load_ace_files(coordinates_file, metadata_file, text_file):
    coordinates_df = pd.read_table(coordinates_file, sep=",", dtype=str)
    metadata_df = pd.read_table(metadata_file, sep=",", dtype=str)
    text_df = pd.read_table(text_file, sep=",", dtype=str)

    for col in ["x", "y", "z"]:
        if col in coordinates_df.columns:
            coordinates_df[col] = pd.to_numeric(coordinates_df[col], errors="coerce")

    text_df.fillna("", inplace=True)
    metadata_df.fillna("", inplace=True)
    coordinates_df.fillna("", inplace=True)

    for df in [coordinates_df, metadata_df, text_df]:
        df.pmid = df.pmid.str.split(".").str[0]
    # preprocessing
    metadata_df.set_index("pmid", inplace=True)
    text_df.set_index("pmid", inplace=True)
    coordinates_df.set_index("pmid", inplace=True)

    # ensure same order
    text_df = text_df.reindex(metadata_df.index)

    return coordinates_df, metadata_df, text_df


def ace_ingestion_logic(coordinates_df, metadata_df, text_df, skip_existing=False):
    def get_base_study(metadata_row):
        doi = _coerce_optional(metadata_row.doi)
        pmid = metadata_row.Index
        base_studies = BaseStudy.query.filter(
            or_(BaseStudy.doi == doi, BaseStudy.pmid == pmid)
        ).all()

        if len(base_studies) == 1:
            return base_studies[0]
        elif len(base_studies) > 1:
            return merge_base_studies(base_studies, doi, pmid)

        else:
            created_bs = [
                bs for bs in all_base_studies if bs.doi == doi and bs.pmid == pmid
            ]
            if created_bs:
                return created_bs[0]
            return BaseStudy.query.filter_by(pmid=pmid).one_or_none()

    def merge_base_studies(base_studies, doi, pmid):
        if doi is None:
            source_base_study = next(
                filter(lambda bs: bs.pmid == pmid and bs.doi is not None, base_studies),
                base_studies[0],
            )
        else:
            source_base_study = next(
                filter(lambda bs: bs.pmid == pmid and bs.doi == doi, base_studies),
                base_studies[0],
            )

        other_base_studies = [
            bs for bs in base_studies if bs.id != source_base_study.id
        ]
        columns = [
            c.name
            for c in source_base_study.__table__.columns
            if c.name not in ("versions", "__ts_vector__")
        ]
        for ab in other_base_studies:
            for col in columns:
                source_attr = getattr(source_base_study, col)
                new_attr = getattr(ab, col)
                setattr(source_base_study, col, source_attr or new_attr)
            source_base_study.versions.extend(ab.versions)
            db.session.delete(ab)
        return source_base_study

    def update_study_info(study, metadata_row, text_row, doi, pmcid, year, level):
        study_info = {
            "name": metadata_row.title,
            "doi": doi,
            "pmid": metadata_row.Index,
            "pmcid": pmcid,
            "description": text_row.abstract,
            "authors": metadata_row.authors,
            "publication": metadata_row.journal,
            "year": year,
            "level": level,
        }
        if isinstance(study, Study):
            study_info["source"] = (
                "neurosynth" if "ace" in metadata_row.source else "pubget",
            )
        for col, value in study_info.items():
            source_attr = getattr(study, col)
            setattr(study, col, source_attr or value)

    def process_coordinates(id_, s, metadata_row):
        analyses = []
        points = []
        tables = []
        try:
            study_coord_data = coordinates_df.loc[[id_]]
        except KeyError:
            print(f"pmid: {id_} has no coordinates")
            return analyses, points, tables
        for order, (t_id, df) in enumerate(study_coord_data.groupby("table_id")):
            first_row = df.iloc[0]
            table_label = _coerce_optional(first_row["table_label"])
            table_caption = _coerce_optional(first_row["table_caption"])
            statistic = _coerce_optional(first_row["statistic"])
            resolved_table_label = table_label if table_label is not None else str(t_id)
            table = Table.query.filter_by(
                t_id=str(t_id), study_id=s.id
            ).one_or_none() or Table(t_id=str(t_id), study=s, user_id=s.user_id)
            if table not in tables:
                tables.append(table)
            if not table.table_label:
                table.table_label = resolved_table_label
            if not table.name:
                table.name = resolved_table_label
            if table.caption is None:
                table.caption = table_caption
            existing_analysis = (
                Analysis.query.filter_by(table_id=table.id, study_id=s.id).one_or_none()
                if table.id
                else None
            )
            a = existing_analysis or Analysis()
            a.name = resolved_table_label
            a.table = table
            a.order = a.order or order
            a.description = table_caption
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
                    kind=statistic if statistic is not None else "unknown",
                    analysis=a,
                    order=point_idx,
                )
                points.append(point)
                point_idx += 1
        return analyses, points, tables

    to_commit = []
    all_base_studies = []

    with db.session.no_autoflush:
        all_studies = {
            s.pmid: s for s in Study.query.filter_by(source="neurosynth").all()
        }
        for metadata_row, text_row in zip(
            metadata_df.itertuples(), text_df.itertuples()
        ):
            level = (
                "meta"
                if any(
                    word in metadata_row.title.lower() for word in META_ANALYSIS_WORDS
                )
                else "group"
            )
            base_study = get_base_study(metadata_row)
            pmid = metadata_row.Index
            pmcid = _coerce_optional(metadata_row.pmcid)
            doi = _coerce_optional(metadata_row.doi)
            year = _coerce_optional_int(metadata_row.publication_year)

            if (
                skip_existing
                and base_study is not None
                and any(s.source == "neurosynth" for s in base_study.versions)
            ):
                continue

            if base_study is None:

                base_study = BaseStudy(
                    name=metadata_row.title,
                    doi=doi,
                    pmid=pmid,
                    pmcid=pmcid,
                    authors=metadata_row.authors or None,
                    publication=metadata_row.journal or None,
                    description=text_row.abstract or None,
                    ace_fulltext=text_row.body or None,
                    year=year,
                    level=level,
                )
            else:
                update_study_info(
                    base_study, metadata_row, text_row, doi, pmcid, year, level
                )

            to_commit.append(base_study)

            s = all_studies.get(pmid, Study())
            update_study_info(s, metadata_row, text_row, doi, pmcid, year, level)

            analyses, points, tables = process_coordinates(pmid, s, metadata_row)
            to_commit.extend(points)
            to_commit.extend(analyses)
            to_commit.extend(tables)
            base_study.versions.append(s)

    db.session.add_all(to_commit)
    db.session.commit()
    for bs in all_base_studies:
        bs.update_has_images_and_points()
        db.session.add_all(all_base_studies)
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
