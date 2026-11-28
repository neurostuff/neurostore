"""Read and write a project's curation rows.

``document`` assembles the provenance document the frontend reads; ``save``
writes one back, touching only rows that changed. ``apply_changes`` edits
stubs without the rest of the document, and ``stub_page`` reads them in pages.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Iterable, Mapping

from sqlalchemy import bindparam, delete, func, insert, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert

from neurosynth_compose.asgi_requests import raise_http_error
from neurosynth_compose.curation import codec, ordering
from neurosynth_compose.database import db
from neurosynth_compose.models.analysis import Project
from neurosynth_compose.models.curation import (
    CurationCitation,
    CurationColumn,
    CurationImport,
    CurationSource,
    CurationStub,
    CurationStubTag,
    CurationTag,
    ExtractionStudyStatus,
)

STUBS = CurationStub.__table__
STUB_TAGS = CurationStubTag.__table__
CITATIONS = CurationCitation.__table__
COLUMNS = CurationColumn.__table__
# Lists replaced whole when they change; each is small.
LIST_TABLES = {
    "tags": CurationTag.__table__,
    "sources": CurationSource.__table__,
    "imports": CurationImport.__table__,
    "statuses": ExtractionStudyStatus.__table__,
}
STUB_DATA_COLUMNS = [
    c.name for c in STUBS.columns if c.name not in ("pk", "project_id", "column_id", "position")
]
CITATION_COLUMNS = [column for _, column in codec.CITATION_FIELDS]


def _plain(row: Mapping, drop=("project_id",)) -> dict:
    return {k: v for k, v in row.items() if k not in drop}


def _select_rows(table, project_id, order_by):
    return [
        _plain(r._mapping)
        for r in db.session.execute(
            select(table).where(table.c.project_id == project_id).order_by(*order_by)
        )
    ]


def load(project_id: str, *, extra, stubs: bool = True, text: bool = True) -> codec.Decomposed:
    """The project's rows; stubs (and their tags) only when ``stubs``.

    ``text=False`` leaves the stubs' citation fields NULL, for readers that only
    need placement, exclusions and tags.
    """
    d = codec.Decomposed(extra=extra)
    d.columns = _select_rows(COLUMNS, project_id, [COLUMNS.c.position])
    for name, table in LIST_TABLES.items():
        order = [table.c.tag_list, table.c.position] if name == "tags" else [table.c.position]
        setattr(d, name, _select_rows(table, project_id, order))
    if stubs:
        columns = list(STUBS.c) if text else [
            c for c in STUBS.c if c.name not in CITATION_COLUMNS
        ]
        d.stubs = [
            {**dict.fromkeys(CITATION_COLUMNS), **r._mapping}
            for r in db.session.execute(
                select(*columns)
                .where(STUBS.c.project_id == project_id)
                .order_by(STUBS.c.column_id, STUBS.c.position)
            )
        ]
        d.stub_tags = _tags_for([s["pk"] for s in d.stubs], project_id=project_id)
    return d


def _tags_for(pks: list[int], *, project_id: str | None = None) -> list[list[dict]]:
    """Tag rows per stub pk, aligned with ``pks``."""
    query = select(STUB_TAGS)
    if project_id is not None:
        query = query.join(STUBS, STUBS.c.pk == STUB_TAGS.c.stub_pk).where(
            STUBS.c.project_id == project_id
        )
    else:
        query = query.where(STUB_TAGS.c.stub_pk.in_(pks))
    by_pk: dict[int, list[dict]] = defaultdict(list)
    for r in db.session.execute(query):
        by_pk[r.stub_pk].append({"position": r.position, "tag_id": r.tag_id, "tag": r.tag})
    return [by_pk.get(pk, []) for pk in pks]


def citations(nsids: Iterable[str]) -> dict[str, dict]:
    nsids = sorted({n for n in nsids if n})
    if not nsids:
        return {}
    rows = db.session.execute(
        select(CITATIONS).where(CITATIONS.c.neurostore_id.in_(nsids))
    )
    return {r.neurostore_id: dict(r._mapping) for r in rows}


def document(project: Project, *, include_stubs: bool = True) -> Any:
    """The provenance document, as the frontend saved it.

    Without ``include_stubs`` each column's ``stubStudies`` key is left out.
    """
    d = load(project.id, extra=project.provenance_extra, stubs=include_stubs)
    doc = codec.assemble(d, citations(s["neurostore_id"] for s in d.stubs))
    if not include_stubs:
        for column in _columns_of(doc):
            column.pop("stubStudies", None)
    return doc


def _columns_of(doc):
    curation = doc.get("curationMetadata") if isinstance(doc, dict) else None
    columns = curation.get("columns") if isinstance(curation, dict) else None
    return [c for c in columns or () if isinstance(c, dict)] if isinstance(columns, list) else []


def placement_document(project: Project) -> Any:
    """The document with stub citation fields left out (each is NULL or
    absent), for readers of placement, exclusions and tags only."""
    d = load(project.id, extra=project.provenance_extra, text=False)
    return codec.assemble(d, {})


def lock(project: Project) -> None:
    """Hold the project's row until the transaction ends, so one writer at a
    time changes its curation rows."""
    db.session.execute(
        select(Project.__table__.c.id)
        .where(Project.__table__.c.id == project.id)
        .with_for_update()
    )


def touch(project: Project) -> None:
    db.session.execute(
        update(Project.__table__)
        .where(Project.__table__.c.id == project.id)
        .values(updated_at=func.now())
    )


# ---------------------------------------------------------------- citations


def ensure_citations(stubs: Iterable[Any]) -> dict[str, dict]:
    """Citation rows for these stubs' Neurostore ids, creating missing ones
    from the first stub that names each id."""
    first: dict[str, dict] = {}
    for stub in stubs:
        nsid = stub.get("neurostoreId") if isinstance(stub, dict) else None
        if isinstance(nsid, str) and nsid and nsid not in first:
            first[nsid] = stub
    found = citations(first)
    new = [
        {
            "neurostore_id": nsid,
            **{
                column: stub[key] if isinstance(stub.get(key), str) else None
                for key, column in codec.CITATION_FIELDS
            },
        }
        for nsid, stub in first.items()
        if nsid not in found
    ]
    if new:
        db.session.execute(
            pg_insert(CITATIONS).on_conflict_do_nothing(index_elements=["neurostore_id"]),
            new,
        )
        found.update(citations(row["neurostore_id"] for row in new))
    return found


# ---------------------------------------------------------------- stub writes


def _encode(stub, column_id, position, lookups, cited, addressable=True):
    tags_by_id, sources_by_id = lookups
    row, tag_rows = codec.encode_stub(
        stub,
        tags_by_id=tags_by_id,
        sources_by_id=sources_by_id,
        citation=cited.get,
        addressable=addressable,
    )
    row.update(column_id=column_id, position=position)
    return row, tag_rows


def _insert_stubs(project_id, encoded):
    """Insert encoded (row, tag_rows) pairs."""
    if not encoded:
        return
    pks = db.session.execute(
        insert(STUBS).returning(STUBS.c.pk, sort_by_parameter_order=True),
        [{**row, "project_id": project_id} for row, _ in encoded],
    ).scalars().all()
    _insert_tags(zip(pks, (tags for _, tags in encoded)))


def _insert_tags(pk_tags):
    rows = [{**t, "stub_pk": pk} for pk, tags in pk_tags for t in tags]
    if rows:
        db.session.execute(insert(STUB_TAGS), rows)


def _bulk_update(table, key, rows, columns):
    if not rows:
        return
    stmt = (
        update(table)
        .where(table.c[key] == bindparam("_key"))
        .values({c: bindparam("_v_" + c) for c in columns})
    )
    db.session.execute(
        stmt,
        [{"_key": r[key], **{"_v_" + c: r[c] for c in columns}} for r in rows],
        execution_options={"synchronize_session": False},
    )


def _rewrite_stubs(rewrites):
    """Replace the content (and tags) of existing stubs: (pk, row, tag_rows)."""
    if not rewrites:
        return
    _bulk_update(
        STUBS,
        "pk",
        [{**row, "pk": pk} for pk, row, _ in rewrites],
        STUB_DATA_COLUMNS + ["column_id", "position"],
    )
    db.session.execute(
        delete(STUB_TAGS).where(STUB_TAGS.c.stub_pk.in_([pk for pk, _, _ in rewrites]))
    )
    _insert_tags((pk, tags) for pk, _, tags in rewrites)


def _move_stubs(moves):
    """Set column and position: dicts with pk, column_id, position."""
    _bulk_update(STUBS, "pk", moves, ["column_id", "position"])


def _delete_stubs(pks):
    pks = list(pks)
    if pks:
        db.session.execute(delete(STUBS).where(STUBS.c.pk.in_(pks)))


# ---------------------------------------------------------------- save


def _changed_ids(old: Mapping[str, Any], new: Mapping[str, Any]) -> set[str]:
    return {k for k in old.keys() | new.keys() if old.get(k) != new.get(k)}


def _replace_list(table, project_id, old_rows, new_rows):
    if old_rows == new_rows:
        return
    db.session.execute(delete(table).where(table.c.project_id == project_id))
    if new_rows:
        db.session.execute(insert(table), [{**r, "project_id": project_id} for r in new_rows])


def _save_columns(project_id, old_rows, new_rows):
    """Upsert columns; returns ids of columns to delete once stubs have moved."""
    old_by_id = {c["id"]: c for c in old_rows}
    new_ids = {c["id"] for c in new_rows}
    added = [c for c in new_rows if c["id"] not in old_by_id]
    changed = [c for c in new_rows if c["id"] in old_by_id and old_by_id[c["id"]] != c]
    if added:
        db.session.execute(insert(COLUMNS), [{**c, "project_id": project_id} for c in added])
    for column in changed:
        db.session.execute(
            update(COLUMNS)
            .where(COLUMNS.c.project_id == project_id, COLUMNS.c.id == column["id"])
            .values(_plain(column, drop=("id",)))
        )
    return [cid for cid in old_by_id if cid not in new_ids]


def _drop_columns(project_id, column_ids):
    if column_ids:
        db.session.execute(
            delete(COLUMNS).where(
                COLUMNS.c.project_id == project_id, COLUMNS.c.id.in_(column_ids)
            )
        )


@dataclass
class _Existing:
    pk: int
    id: str | None
    column_id: str
    position: float
    content_hash: str


def save(project: Project, provenance: Any, *, keep_stubs: bool = False) -> None:
    """Make the project's rows hold ``provenance``.

    With ``keep_stubs`` the document's ``stubStudies`` are ignored and the
    stored stubs stay; dropping a column that still has stubs is refused.
    """
    lock(project)
    new, stub_lists = codec.split(provenance)
    old = load(project.id, extra=project.provenance_extra, stubs=False)
    old_lookups = codec.lookups(old)
    lookups = codec.lookups(new)

    if keep_stubs:
        old_columns = {c["id"]: c for c in old.columns}
        for column in new.columns:
            _keep_stub_key(column, old_columns.get(column["id"]))
    for name, table in LIST_TABLES.items():
        _replace_list(table, project.id, getattr(old, name), getattr(new, name))
    dropped = _save_columns(project.id, old.columns, new.columns)

    if keep_stubs:
        if dropped and db.session.execute(
            select(func.count())
            .select_from(STUBS)
            .where(STUBS.c.project_id == project.id, STUBS.c.column_id.in_(dropped))
        ).scalar_one():
            raise_http_error(409, "a column with stubs cannot be removed with keep_stubs")
    else:
        _save_stubs(
            project.id,
            stub_lists,
            lookups,
            stale_tags=_changed_ids(old_lookups[0], lookups[0]),
            stale_sources=_changed_ids(old_lookups[1], lookups[1]),
        )
    _drop_columns(project.id, dropped)

    db.session.execute(
        update(Project.__table__)
        .where(Project.__table__.c.id == project.id)
        .values(provenance_extra=new.extra, updated_at=func.now())
    )


def _keep_stub_key(column, old_column):
    """Give ``column`` the stored column's ``stubStudies`` state (present, absent,
    or a verbatim non-list value); a new column has its key present."""
    missing = [k for k in column.get("missing") or () if k != "stubStudies"]
    extra = {k: v for k, v in (column.get("extra") or {}).items() if k != "stubStudies"}
    if old_column is not None:
        if "stubStudies" in (old_column.get("missing") or ()):
            missing.append("stubStudies")
        if "stubStudies" in (old_column.get("extra") or {}):
            extra["stubStudies"] = old_column["extra"]["stubStudies"]
    column["missing"] = missing or None
    column["extra"] = extra or None


def _existing_stubs(project_id):
    return [
        _Existing(r.pk, r.id, r.column_id, r.position, r.content_hash)
        for r in db.session.execute(
            select(
                STUBS.c.pk, STUBS.c.id, STUBS.c.column_id, STUBS.c.position, STUBS.c.content_hash
            ).where(STUBS.c.project_id == project_id)
        )
    ]


def _stale_stub_pks(project_id, stale_tags, stale_sources):
    """Stubs whose stored form refers to a project tag or source that changed."""
    pks = set()
    if stale_tags:
        pks.update(
            db.session.execute(
                select(STUB_TAGS.c.stub_pk)
                .join(STUBS, STUBS.c.pk == STUB_TAGS.c.stub_pk)
                .where(STUBS.c.project_id == project_id, STUB_TAGS.c.tag_id.in_(stale_tags))
            ).scalars()
        )
    if stale_sources:
        pks.update(
            db.session.execute(
                select(STUBS.c.pk).where(
                    STUBS.c.project_id == project_id,
                    STUBS.c.identification_source_id.in_(stale_sources),
                )
            ).scalars()
        )
    return pks


def _save_stubs(project_id, stub_lists, lookups, *, stale_tags, stale_sources):
    existing = _existing_stubs(project_id)
    by_id = {e.id: e for e in existing if e.id is not None}
    unnamed: dict[tuple, list[_Existing]] = defaultdict(list)
    for e in existing:
        if e.id is None:
            unnamed[(e.column_id, e.content_hash)].append(e)
    stale = _stale_stub_pks(project_id, stale_tags, stale_sources)

    matched: set[int] = set()
    seen_ids: set[str] = set()
    placed = []  # (column_id, stub, existing or None, needs_encode, addressable)
    for column_id, stubs in stub_lists:
        for stub in stubs:
            digest = codec.stub_hash(stub)
            addressable = codec.first_use(stub, seen_ids)
            stub_id = stub.get("id") if isinstance(stub, dict) else None
            if addressable and isinstance(stub_id, str):
                found = by_id.get(stub_id)
            else:
                candidates = unnamed.get((column_id, digest))
                found = candidates.pop() if candidates else None
            if found is not None:
                matched.add(found.pk)
            needs_encode = found is None or found.content_hash != digest or found.pk in stale
            placed.append((column_id, stub, found, needs_encode, addressable))

    positions: dict[Any, float] = {}
    by_column: dict[str, list] = defaultdict(list)
    for index, (column_id, _, found, _, _) in enumerate(placed):
        by_column[column_id].append(found.pk if found is not None else ("new", index))
    current_positions = {e.pk: (e.column_id, e.position) for e in existing}
    for column_id, keys in by_column.items():
        current = {
            k: current_positions[k][1]
            for k in keys
            if not isinstance(k, tuple) and current_positions[k][0] == column_id
        }
        positions.update(ordering.assign_positions(keys, current))

    cited = ensure_citations(stub for _, stub, _, needs, _ in placed if needs)
    inserts, rewrites, moves = [], [], []
    for index, (column_id, stub, found, needs_encode, addressable) in enumerate(placed):
        key = found.pk if found is not None else ("new", index)
        position = positions.get(key, found.position if found is not None else None)
        if found is None:
            inserts.append(_encode(stub, column_id, position, lookups, cited, addressable))
        elif needs_encode:
            row, tags = _encode(stub, column_id, position, lookups, cited, addressable)
            rewrites.append((found.pk, row, tags))
        elif key in positions or found.column_id != column_id:
            moves.append({"pk": found.pk, "column_id": column_id, "position": position})

    _delete_stubs(e.pk for e in existing if e.pk not in matched)
    _rewrite_stubs(rewrites)
    _move_stubs(moves)
    _insert_stubs(project_id, inserts)


# ---------------------------------------------------------------- changes


def _lookups_for(project_id):
    return codec.lookups(load(project_id, extra=None, stubs=False))


def _stubs_by_id(project_id, ids):
    ids = list(ids)
    if not ids:
        return {}
    rows = [
        dict(r._mapping)
        for r in db.session.execute(
            select(STUBS).where(STUBS.c.project_id == project_id, STUBS.c.id.in_(ids))
        )
    ]
    for row, tags in zip(rows, _tags_for([r["pk"] for r in rows])):
        row["_tags"] = tags
    return {row["id"]: row for row in rows}


def _column_order(project_id, column_id):
    """(pk, position) of a column's stubs, top first."""
    return [
        (r.pk, r.position)
        for r in db.session.execute(
            select(STUBS.c.pk, STUBS.c.position)
            .where(STUBS.c.project_id == project_id, STUBS.c.column_id == column_id)
            .order_by(STUBS.c.position)
        )
    ]


def _insert_at(order, index, key):
    if index is None or index < 0:
        index = len(order) + 1 + (index if index is not None else -1)
    order.insert(max(0, min(index, len(order))), key)


def apply_changes(project: Project, changes: Mapping) -> dict:
    """Apply a changeset to the project's stubs, in the order remove, add,
    update, move. Returns how many stubs each step touched."""
    lock(project)
    remove = list(changes.get("remove") or ())
    add = list(changes.get("add") or ())
    edits = list(changes.get("update") or ())
    moves = list(changes.get("move") or ())

    column_ids = [c["id"] for c in _select_rows(COLUMNS, project.id, [COLUMNS.c.position])]
    if not column_ids and (add or moves):
        raise_http_error(422, "the project has no curation columns")

    added_ids = [a["stub"].get("id") for a in add]
    if any(not isinstance(i, str) for i in added_ids) or len(set(added_ids)) != len(added_ids):
        raise_http_error(422, "each added stub needs a unique string id")
    touched = set(remove) | {e["id"] for e in edits} | {m["id"] for m in moves}
    existing = _stubs_by_id(project.id, touched | set(added_ids))
    for stub_id in touched - set(existing) - set(added_ids):
        raise_http_error(404, f"stub {stub_id} not found in this project")
    removed = set(remove)
    for stub_id in added_ids:
        if stub_id in existing and stub_id not in removed:
            raise_http_error(409, f"stub {stub_id} already exists in this project")
    for stub_id in {e["id"] for e in edits} | {m["id"] for m in moves}:
        if stub_id in removed and stub_id not in added_ids:
            raise_http_error(404, f"stub {stub_id} is removed in this changeset")

    orders: dict[str, list] = {}

    def order_of(column_id):
        if column_id not in column_ids:
            raise_http_error(422, f"column {column_id} not found in this project")
        if column_id not in orders:
            orders[column_id] = _column_order(project.id, column_id)
        return orders[column_id]

    # remove (before any column order is read, so orders never hold them)
    _delete_stubs(existing[i]["pk"] for i in remove)

    # add: stubs without an index go to the top of their column, in request order
    stubs_json = {}
    top_count: dict[str, int] = defaultdict(int)
    for item in add:
        stub = item["stub"]
        column_id = item.get("column_id") or column_ids[0]
        order = order_of(column_id)
        if "index" in item and item["index"] is not None:
            index = item["index"]
        else:
            index = top_count[column_id]
            top_count[column_id] += 1
        key = ("new", stub["id"])
        _insert_at(order, index, (key, None))
        stubs_json[key] = (stub, column_id)

    # update
    lookups = _lookups_for(project.id)
    tags_by_id, sources_by_id = lookups
    edited = {}
    if edits:
        cited = citations(
            existing[e["id"]]["neurostore_id"] for e in edits if e["id"] in existing
        )
        for e in edits:
            key = ("new", e["id"]) if ("new", e["id"]) in stubs_json else e["id"]
            if isinstance(key, tuple):
                stub, column_id = stubs_json[key]
                stubs_json[key] = ({**stub, **_fields(e)}, column_id)
                continue
            row = existing[e["id"]]
            current = edited.get(e["id"]) or codec.decode_stub(
                row,
                row["_tags"],
                tags_by_id=tags_by_id,
                sources_by_id=sources_by_id,
                citation=cited.get(row["neurostore_id"]),
            )
            edited[e["id"]] = {**current, **_fields(e)}

    # move
    for m in moves:
        target = order_of(m["column_id"])
        if ("new", m["id"]) in stubs_json:
            key = ("new", m["id"])
            stub, source_column = stubs_json[key]
            order_of(source_column).remove((key, None))
            stubs_json[key] = (stub, m["column_id"])
            _insert_at(target, m.get("index", 0), (key, None))
            continue
        row = existing[m["id"]]
        source = order_of(row["column_id"])
        source.remove(next(k for k in source if k[0] == row["pk"]))
        _insert_at(target, m.get("index", 0), (row["pk"], None))
        row["column_id"] = m["column_id"]

    # positions for every column whose order changed
    new_positions: dict[Any, tuple[str, float]] = {}
    for column_id, order in orders.items():
        keys = [k for k, _ in order]
        current = {k: p for k, p in order if p is not None}
        for key, position in ordering.assign_positions(keys, current).items():
            new_positions[key] = (column_id, position)

    cited = ensure_citations(
        [stub for stub, _ in stubs_json.values()] + list(edited.values())
    )
    inserts = []
    for key, (stub, column_id) in stubs_json.items():
        inserts.append(_encode(stub, column_id, new_positions[key][1], lookups, cited))
    rewrites = []
    for stub_id, stub in edited.items():
        row = existing[stub_id]
        column_id, position = new_positions.get(row["pk"], (row["column_id"], row["position"]))
        encoded, tags = _encode(stub, column_id, position, lookups, cited)
        rewrites.append((row["pk"], encoded, tags))
    rewritten = {pk for pk, _, _ in rewrites}
    _rewrite_stubs(rewrites)
    _move_stubs(
        [
            {"pk": key, "column_id": column_id, "position": position}
            for key, (column_id, position) in new_positions.items()
            if not isinstance(key, tuple) and key not in rewritten
        ]
    )
    _insert_stubs(project.id, inserts)
    touch(project)
    return {
        "removed": len(remove),
        "added": len(add),
        "updated": len(edits),
        "moved": len(moves),
    }


def _fields(edit):
    return {k: v for k, v in edit.items() if k != "id"}


# ---------------------------------------------------------------- reads


def stub_page(project: Project, *, column_id=None, page=1, page_size=100):
    """One page of stubs, ordered by column then position."""
    base = select(STUBS).where(STUBS.c.project_id == project.id)
    if column_id is not None:
        base = base.where(STUBS.c.column_id == column_id)
    total = db.session.execute(
        select(func.count()).select_from(base.subquery())
    ).scalar_one()
    rows = [
        dict(r._mapping)
        for r in db.session.execute(
            base.join(
                COLUMNS,
                (COLUMNS.c.project_id == STUBS.c.project_id)
                & (COLUMNS.c.id == STUBS.c.column_id),
            )
            .order_by(COLUMNS.c.position, STUBS.c.position)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ]
    tags_by_id, sources_by_id = _lookups_for(project.id)
    cited = citations(r["neurostore_id"] for r in rows)
    results = [
        {
            "column_id": row["column_id"],
            "stub": codec.decode_stub(
                row,
                tags,
                tags_by_id=tags_by_id,
                sources_by_id=sources_by_id,
                citation=cited.get(row["neurostore_id"]),
            ),
        }
        for row, tags in zip(rows, _tags_for([r["pk"] for r in rows]))
    ]
    return total, results


def summary(project: Project) -> dict:
    """Per column: how many stubs, and how many carry each exclusion and tag id."""
    exclusion = func.coalesce(
        STUBS.c.exclusion_tag_id, STUBS.c.extra["exclusionTag"]["id"].astext
    )
    columns = {
        c["id"]: {"id": c["id"], "name": c["name"], "stub_count": 0, "exclusions": {}, "tags": {}}
        for c in _select_rows(COLUMNS, project.id, [COLUMNS.c.position])
    }
    for column_id, count in db.session.execute(
        select(STUBS.c.column_id, func.count())
        .where(STUBS.c.project_id == project.id)
        .group_by(STUBS.c.column_id)
    ):
        columns[column_id]["stub_count"] = count
    for column_id, tag_id, count in db.session.execute(
        select(STUBS.c.column_id, exclusion, func.count())
        .where(STUBS.c.project_id == project.id, exclusion.is_not(None))
        .group_by(STUBS.c.column_id, exclusion)
    ):
        columns[column_id]["exclusions"][tag_id] = count
    for column_id, tag_id, count in db.session.execute(
        select(STUBS.c.column_id, STUB_TAGS.c.tag_id, func.count(func.distinct(STUBS.c.pk)))
        .join(STUB_TAGS, STUB_TAGS.c.stub_pk == STUBS.c.pk)
        .where(STUBS.c.project_id == project.id, STUB_TAGS.c.tag_id.is_not(None))
        .group_by(STUBS.c.column_id, STUB_TAGS.c.tag_id)
    ):
        columns[column_id]["tags"][tag_id] = count
    return {"columns": list(columns.values())}
