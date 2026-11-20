"""Load ns-pond's modality export (`ingest modality export`) into `base_studies`.

The TSV has one row per base study: base_study_id, modalities ('|'-separated), source
(record, methods, full_text or none) and papers (ns-pond's article ids, not read here). A
row overwrites its base study's `modalities` and `modalities_source`; base studies the file
does not name keep theirs. A row naming a merged base study goes to the active base study
it was merged into, unless the file has a row for that one too. A value outside MODALITY,
or a source outside MODALITY_SOURCES, refuses the whole file before anything is written.
"""

import csv
from dataclasses import dataclass, field

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

from neurostore.database import db
from neurostore.models import BaseStudy
from neurostore.models.data import MODALITIES, MODALITY, MODALITY_SOURCES

#: When merged papers meet in one base study, the best source's modalities are kept.
SOURCES = MODALITY_SOURCES
CHUNK = 5000


@dataclass
class LoadResult:
    updated: set = field(default_factory=set)
    unchanged: int = 0
    #: A merged base study's id, by the id its row was written to.
    redirected: dict = field(default_factory=dict)
    unknown: list = field(default_factory=list)


def _modalities(cell):
    return sorted({value.strip().lower() for value in (cell or "").split("|") if value.strip()})


def _chunks(ids):
    ids = list(ids)
    for start in range(0, len(ids), CHUNK):
        yield ids[start:start + CHUNK]


def _targets(ids):
    """Each id's base study to write: the active one a merged base study points to, else
    itself; ids with no base study are left out."""
    links = {}
    pending = set(ids)
    while pending:
        found = []
        for chunk in _chunks(pending):
            found += db.session.execute(
                sa.select(BaseStudy.id, BaseStudy.is_active, BaseStudy.superseded_by).where(
                    BaseStudy.id.in_(chunk)
                )
            ).all()
        pending = set()
        for id_, active, superseded_by in found:
            links[id_] = None if active else superseded_by
            if links[id_] is not None and links[id_] not in links:
                pending.add(links[id_])

    targets = {}
    for id_ in ids:
        if id_ not in links:
            continue
        current, seen = id_, {id_}
        while links.get(current) in links and links[current] not in seen:
            current = links[current]
            seen.add(current)
        targets[id_] = current
    return targets


def _refuse_unknown_values(rows):
    rows = list(rows)
    values = {value for row in rows for value in _modalities(row.get("modalities"))}
    sources = {row.get("source") or "none" for row in rows}
    unknown = sorted(values - set(MODALITIES)) + sorted(sources - set(SOURCES))
    if unknown:
        raise ValueError(f"values outside the modality vocabulary: {unknown}")


def _merge(held, values):
    """Merged papers meeting in one base study: the best source wins; equal sources join."""
    if held is None:
        return values
    rank = SOURCES.index
    if rank(values["source"]) < rank(held["source"]):
        return values
    if rank(values["source"]) == rank(held["source"]):
        return {**held, "modalities": sorted(set(held["modalities"]) | set(values["modalities"]))}
    return held


def load_modalities(path):
    """Write the export at ``path`` to the base studies it names; the caller commits."""
    with open(path, encoding="utf-8", newline="") as f:
        named = {
            row["base_study_id"]: row
            for row in csv.DictReader(f, delimiter="\t")
            if row.get("base_study_id")
        }
    _refuse_unknown_values(named.values())
    targets = _targets(named)
    result = LoadResult()
    writes = {}
    for id_, row in named.items():
        target = targets.get(id_)
        if target is None:
            result.unknown.append(id_)
            continue
        if target != id_:
            if target in named:
                continue
            result.redirected[id_] = target
        values = {
            "modalities": _modalities(row.get("modalities")),
            "source": row.get("source") or "none",
        }
        writes[target] = values if target == id_ else _merge(writes.get(target), values)

    current = {}
    for chunk in _chunks(writes):
        current.update(
            (id_, (modalities, source))
            for id_, modalities, source in db.session.execute(
                sa.select(
                    BaseStudy.id,
                    sa.cast(BaseStudy.modalities, ARRAY(sa.Text)),
                    BaseStudy.modalities_source,
                ).where(BaseStudy.id.in_(chunk))
            )
        )
    changed = [
        {"b_id": id_, "b_modalities": v["modalities"], "b_source": v["source"]}
        for id_, v in writes.items()
        if current[id_] != (v["modalities"], v["source"])
    ]
    table = BaseStudy.__table__
    statement = (
        sa.update(table)
        .where(table.c.id == sa.bindparam("b_id"))
        .values(
            modalities=sa.cast(
                sa.bindparam("b_modalities", type_=ARRAY(sa.Text)), ARRAY(MODALITY)
            ),
            modalities_source=sa.bindparam("b_source"),
        )
    )
    for start in range(0, len(changed), CHUNK):
        db.session.execute(statement, changed[start:start + CHUNK])
    result.updated = {row["b_id"] for row in changed}
    result.unchanged = len(writes) - len(changed)
    result.unknown.sort()
    return result
