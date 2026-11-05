"""Load data sources from a dictionary TSV, and link matcher results to analyses.

The dictionary TSV (data_sources.tsv beside this module) has one row per data source:
id, name, roles, modality, hosted_by (an id), rrid, re3data_id, url, url_source; list
cells are '|'-separated, and other columns are ignored. It seeds the table once: the
database is the source of truth after that, so rows whose id exists are skipped unless
``update``.

A matcher TSV (paper_entities.tsv) names a data source id per paper, with the paper's
pmid and doi; each match of the given statuses is linked to every analysis of the
paper's base study.
"""

import csv
from dataclasses import dataclass, field

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert

from neurostore.database import db
from neurostore.models import Analysis, AnalysisDataSource, BaseStudy, DataSource, Study
from neurostore.services.data_source_links import recompute_data_source_links


def split(cell):
    return [x.strip() for x in (cell or "").split("|") if x.strip()]


def read_tsv(path):
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter="\t"))


@dataclass
class LoadResult:
    created: list = field(default_factory=list)
    updated: list = field(default_factory=list)
    skipped: list = field(default_factory=list)


def _columns(row):
    return {
        "name": row["name"],
        "kinds": split(row.get("roles")),
        "modalities": split(row.get("modality")),
        "url": row.get("url") or None,
        "url_kind": row.get("url_source") or None,
        "rrids": split(row.get("rrid")),
        "re3data_ids": split(row.get("re3data_id")),
    }


def load_data_sources(path, update=False):
    """Create the data sources of a dictionary TSV; with ``update``, overwrite existing ones."""
    rows = read_tsv(path)
    existing = {ds.id: ds for ds in DataSource.query}
    result = LoadResult()
    known = set(existing) | {row["id"] for row in rows}
    for row in rows:
        id_, parent = row["id"], row.get("hosted_by") or None
        if parent and parent not in known:
            raise ValueError(f"{id_}: hosted_by names unknown data source {parent!r}")
        record = existing.get(id_)
        if record is not None and not update:
            result.skipped.append(id_)
            continue
        if record is None:
            record = DataSource(id=id_)
            db.session.add(record)
            result.created.append(id_)
        else:
            result.updated.append(id_)
        for key, value in _columns(row).items():
            setattr(record, key, value)
    db.session.flush()

    # parents after every row exists, since a row may name one listed after it
    skipped = set(result.skipped)
    for row in rows:
        if row["id"] not in skipped:
            db.session.get(DataSource, row["id"]).part_of_id = row.get("hosted_by") or None
    db.session.flush()
    return result


@dataclass
class LinkResult:
    links: int = 0
    base_studies: set = field(default_factory=set)
    studies: set = field(default_factory=set)
    analyses: set = field(default_factory=set)
    unknown_data_sources: set = field(default_factory=set)
    unmatched_papers: set = field(default_factory=set)


def _base_study_ids(rows):
    """Base study id per (pmid, doi), looked up by pmid, then by doi."""
    pmids = {r["pmid"] for r in rows if r.get("pmid")}
    dois = {r["doi"].lower() for r in rows if r.get("doi")}
    by_pmid, by_doi = {}, {}
    active = BaseStudy.is_active.is_(True)
    if pmids:
        for id_, pmid in db.session.execute(
            sa.select(BaseStudy.id, BaseStudy.pmid).where(
                BaseStudy.pmid.in_(pmids), active
            )
        ):
            by_pmid.setdefault(pmid, id_)
    if dois:
        for id_, doi in db.session.execute(
            sa.select(BaseStudy.id, sa.func.lower(BaseStudy.doi)).where(
                sa.func.lower(BaseStudy.doi).in_(dois), active
            )
        ):
            by_doi.setdefault(doi, id_)
    return lambda r: by_pmid.get(r.get("pmid")) or by_doi.get(
        (r.get("doi") or "").lower()
    )


def link_matches(path, statuses=("used",)):
    """Link each match of ``statuses`` to all analyses of the paper's base study."""
    rows = [r for r in read_tsv(path) if r["status"] in statuses]
    known = set(db.session.scalars(sa.select(DataSource.id)))
    base_study_of = _base_study_ids(rows)
    result = LinkResult()
    pairs = set()
    for r in rows:
        data_source_id = r["entity"]
        base_study_id = base_study_of(r)
        if data_source_id not in known:
            result.unknown_data_sources.add(r["entity"])
        elif base_study_id is None:
            result.unmatched_papers.add(r["paper"])
        else:
            pairs.add((base_study_id, data_source_id))
    if not pairs:
        return result

    by_base_study = {}
    for base_study_id, data_source_id in pairs:
        by_base_study.setdefault(base_study_id, set()).add(data_source_id)
    analyses = db.session.execute(
        sa.select(Study.base_study_id, Study.id, Analysis.id)
        .join(Analysis, Analysis.study_id == Study.id)
        .where(Study.base_study_id.in_(by_base_study))
    ).all()
    values = [
        {"analysis_id": analysis_id, "data_source_id": data_source_id}
        for base_study_id, _study_id, analysis_id in analyses
        for data_source_id in by_base_study[base_study_id]
    ]
    result.studies = {study_id for _, study_id, _ in analyses}
    result.analyses = {analysis_id for _, _, analysis_id in analyses}
    for start in range(0, len(values), 5000):
        inserted = db.session.execute(
            pg_insert(AnalysisDataSource)
            .values(values[start : start + 5000])  # noqa: E203
            .on_conflict_do_nothing()
            .returning(AnalysisDataSource.analysis_id)
        )
        result.links += len(inserted.all())
    result.base_studies = set(by_base_study)
    recompute_data_source_links(result.base_studies)
    return result
