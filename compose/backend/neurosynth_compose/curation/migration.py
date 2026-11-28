"""Move every project's provenance into the curation tables, and back.

Used by the Alembic revision that creates the tables. Both directions work on
reflected tables and a plain connection, one project at a time, so memory
stays at about one project's document.
"""

from __future__ import annotations

import logging
from collections import Counter, defaultdict

import orjson
import sqlalchemy as sa

from neurosynth_compose.curation import codec, ordering

logger = logging.getLogger(__name__)

TABLES = (
    "curation_citations",
    "curation_columns",
    "curation_stubs",
    "curation_stub_tags",
    "curation_tags",
    "curation_sources",
    "curation_imports",
    "extraction_study_statuses",
)
LISTS = {
    "tags": "curation_tags",
    "sources": "curation_sources",
    "imports": "curation_imports",
    "statuses": "extraction_study_statuses",
}
BATCH_STUBS = 20000


def _tables(bind):
    meta = sa.MetaData()
    names = TABLES + ("projects",)
    return {name: sa.Table(name, meta, autoload_with=bind) for name in names}


def _project_ids(bind):
    return bind.execute(sa.text("SELECT id FROM projects ORDER BY id")).scalars().all()


def _provenance(bind, project_id):
    text = bind.execute(
        sa.text("SELECT provenance::text FROM projects WHERE id = :id"), {"id": project_id}
    ).scalar_one()
    return None if text is None else orjson.loads(text)


def _citation_votes(bind, project_ids):
    """The most common value of each citation field, per Neurostore id."""
    votes: dict[str, dict[str, Counter]] = defaultdict(lambda: defaultdict(Counter))
    for project_id in project_ids:
        _, stub_lists = codec.split(_provenance(bind, project_id))
        for _, stubs in stub_lists:
            for stub in stubs:
                nsid = stub.get("neurostoreId") if isinstance(stub, dict) else None
                if not isinstance(nsid, str) or not nsid:
                    continue
                fields = votes[nsid]
                for key, column in codec.CITATION_FIELDS:
                    if isinstance(stub.get(key), str):
                        fields[column][stub[key]] += 1
    return {
        nsid: {
            column: (fields[column].most_common(1)[0][0] if fields[column] else None)
            for _, column in codec.CITATION_FIELDS
        }
        for nsid, fields in votes.items()
    }


class _StubWriter:
    """Buffers stub rows and inserts them in batches, then their tags."""

    def __init__(self, bind, tables):
        self.bind = bind
        self.stubs = tables["curation_stubs"]
        self.tags = tables["curation_stub_tags"]
        self.rows: list[dict] = []
        self.tag_rows: list[list[dict]] = []

    def add(self, row, tag_rows):
        self.rows.append(row)
        self.tag_rows.append(tag_rows)
        if len(self.rows) >= BATCH_STUBS:
            self.flush()

    def flush(self):
        if not self.rows:
            return
        pks = self.bind.execute(
            self.stubs.insert().returning(self.stubs.c.pk, sort_by_parameter_order=True),
            self.rows,
        ).scalars().all()
        tags = [{**t, "stub_pk": pk} for pk, ts in zip(pks, self.tag_rows) for t in ts]
        if tags:
            self.bind.execute(self.tags.insert(), tags)
        self.rows, self.tag_rows = [], []


def _rescaled(position):
    return ordering.GAP * (position + 1)


def upgrade(bind):
    """Fill the curation tables from ``projects.provenance``."""
    tables = _tables(bind)
    project_ids = _project_ids(bind)
    cited = _citation_votes(bind, project_ids)
    if cited:
        bind.execute(
            tables["curation_citations"].insert(),
            [{"neurostore_id": nsid, **fields} for nsid, fields in cited.items()],
        )
    logger.info("curation citations: %d", len(cited))

    writer = _StubWriter(bind, tables)
    stub_total = 0
    for project_id in project_ids:
        d = codec.decompose(_provenance(bind, project_id), cited.get)
        for name, table in LISTS.items():
            rows = getattr(d, name)
            if rows:
                bind.execute(
                    tables[table].insert(), [{**r, "project_id": project_id} for r in rows]
                )
        if d.columns:
            bind.execute(
                tables["curation_columns"].insert(),
                [{**c, "project_id": project_id} for c in d.columns],
            )
        for row, tag_rows in zip(d.stubs, d.stub_tags):
            writer.add(
                {**row, "project_id": project_id, "position": _rescaled(row["position"])},
                tag_rows,
            )
        stub_total += len(d.stubs)
        bind.execute(
            tables["projects"].update()
            .where(tables["projects"].c.id == project_id)
            .values(provenance_extra=d.extra)
        )
    writer.flush()
    logger.info("curation stubs: %d across %d projects", stub_total, len(project_ids))


def _rows(bind, table, project_id, order):
    query = sa.select(table).where(table.c.project_id == project_id).order_by(*order)
    return [
        {k: v for k, v in r._mapping.items() if k != "project_id"}
        for r in bind.execute(query)
    ]


def assemble_project(bind, tables, project_id, extra):
    """The provenance document stored in the tables for one project."""
    d = codec.Decomposed(extra=extra)
    d.columns = _rows(bind, tables["curation_columns"], project_id, [sa.text("position")])
    for name, table in LISTS.items():
        t = tables[table]
        order = [t.c.tag_list, t.c.position] if name == "tags" else [t.c.position]
        setattr(d, name, _rows(bind, t, project_id, order))
    stubs = tables["curation_stubs"]
    d.stubs = [
        dict(r._mapping)
        for r in bind.execute(
            sa.select(stubs).where(stubs.c.project_id == project_id).order_by(stubs.c.pk)
        )
    ]
    tag_table = tables["curation_stub_tags"]
    by_pk = defaultdict(list)
    for r in bind.execute(
        sa.select(tag_table)
        .join(stubs, stubs.c.pk == tag_table.c.stub_pk)
        .where(stubs.c.project_id == project_id)
    ):
        by_pk[r.stub_pk].append({"position": r.position, "tag_id": r.tag_id, "tag": r.tag})
    d.stub_tags = [by_pk.get(s["pk"], []) for s in d.stubs]
    citation_table = tables["curation_citations"]
    nsids = sorted({s["neurostore_id"] for s in d.stubs if s["neurostore_id"]})
    citations = {}
    for start in range(0, len(nsids), 5000):
        for r in bind.execute(
            sa.select(citation_table).where(
                citation_table.c.neurostore_id.in_(nsids[start:start + 5000])
            )
        ):
            citations[r.neurostore_id] = dict(r._mapping)
    return codec.assemble(d, citations)


def downgrade(bind):
    """Write each project's assembled document back to ``projects.provenance``."""
    tables = _tables(bind)
    projects = tables["projects"]
    for project_id in _project_ids(bind):
        extra = bind.execute(
            sa.select(projects.c.provenance_extra).where(projects.c.id == project_id)
        ).scalar_one()
        document = assemble_project(bind, tables, project_id, extra)
        bind.execute(
            sa.text("UPDATE projects SET provenance = CAST(:doc AS json) WHERE id = :id"),
            {"doc": orjson.dumps(document).decode(), "id": project_id},
        )
