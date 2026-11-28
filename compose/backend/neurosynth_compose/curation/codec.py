"""Split a project's provenance document into table rows, and join it back.

``decompose(provenance, citations)`` returns a :class:`Decomposed` holding the
rows for every curation table plus ``extra``: the document with each list that
became rows replaced by ``[]``. ``assemble(decomposed, citations)`` is its exact
inverse, so ``assemble(decompose(p)) == p`` for any JSON value ``p``.

Each row keeps the item's known keys in typed columns. A value whose type does
not fit its column, and any key the codec does not know, goes to the row's
``extra``; a known key the item lacks is listed in ``missing``. Stub citation
fields equal to the shared Neurostore citation are stored as NULL (inherited).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Mapping

import orjson

# (json key, column, kind). kinds: str, int, bool, nullable_str (NULL is JSON null)
COLUMN_FIELDS = (("id", "id", "str"), ("name", "name", "str"))
TAG_FIELDS = (
    ("id", "id", "str"),
    ("label", "label", "str"),
    ("isExclusionTag", "is_exclusion_tag", "bool"),
    ("isAssignable", "is_assignable", "bool"),
)
SOURCE_FIELDS = (("id", "id", "str"), ("label", "label", "str"))
IMPORT_FIELDS = (
    ("id", "id", "str"),
    ("name", "name", "str"),
    ("date", "date", "str"),
    ("importModeUsed", "import_mode", "str"),
    ("numImported", "num_imported", "int"),
)
IMPORT_OPTIONAL = (
    ("neurostoreSearchParams", "neurostore_search_params", "str"),
    ("fileName", "file_name", "str"),
)
STATUS_FIELDS = (("id", "study_id", "str"), ("status", "status", "str"))

# Stub keys whose value Neurostore already holds; NULL means "same as the citation".
CITATION_FIELDS = (
    ("title", "title"),
    ("authors", "authors"),
    ("abstractText", "abstract"),
    ("journal", "journal"),
    ("articleYear", "year"),
    ("doi", "doi"),
    ("pmid", "pmid"),
    ("pmcid", "pmcid"),
)
STUB_FIELDS = (
    ("id", "id", "str"),
    ("keywords", "keywords", "str"),
    ("articleLink", "article_link", "str"),
    ("exclusionTag", "exclusion_tag_id", "nullable_str"),
)
STUB_OPTIONAL = (
    ("neurostoreId", "neurostore_id", "str"),
    ("importId", "import_id", "str"),
    ("searchTerm", "search_term", "str"),
)
STUB_STRUCTURED = ("identificationSource", "tags")

TAG_LISTS = ("info", "exclusion", "identification", "screening", "eligibility")
PRISMA_PHASES = ("identification", "screening", "eligibility")


class UnstorableText(ValueError):
    """The document holds a NUL character, which Postgres text and jsonb refuse."""


def check_storable(value: Any) -> bytes:
    """``value`` as JSON, refusing a NUL character anywhere in it."""
    dumped = orjson.dumps(value)
    if b"\\u0000" in dumped:
        raise UnstorableText("text holds a NUL character (\\u0000), which cannot be stored")
    return dumped


def _fits(kind, value):
    if kind == "str":
        return isinstance(value, str)
    if kind == "nullable_str":
        return value is None or isinstance(value, str)
    if kind == "int":
        return isinstance(value, int) and not isinstance(value, bool) and -2**31 <= value < 2**31
    if kind == "bool":
        return isinstance(value, bool)
    raise ValueError(kind)


def _encode(obj: Mapping, required, optional=(), handled=()):
    """Typed columns, extra and missing for one JSON object.

    ``handled`` names keys the caller encodes itself; they are left out of extra.
    """
    row: dict[str, Any] = {}
    extra: dict[str, Any] = {}
    missing: list[str] = []
    known = set(handled)
    for fields, track_missing in ((required, True), (optional, False)):
        for key, column, kind in fields:
            known.add(key)
            row[column] = None
            if key not in obj:
                if track_missing:
                    missing.append(key)
                continue
            value = obj[key]
            if _fits(kind, value):
                row[column] = value
            else:
                extra[key] = value
    for key, value in obj.items():
        if key not in known:
            extra[key] = value
    return row, extra, missing


def _decode(row: Mapping, required, optional=()):
    extra = row.get("extra") or {}
    missing = row.get("missing") or ()
    obj: dict[str, Any] = {}
    for key, column, _ in required:
        if key not in missing and key not in extra:
            obj[key] = row[column]
    for key, column, _ in optional:
        if row[column] is not None and key not in extra:
            obj[key] = row[column]
    obj.update(extra)
    return obj


def _finish(row, extra, missing):
    row["extra"] = extra or None
    row["missing"] = missing or None
    return row


@dataclass
class Decomposed:
    """Rows for one project. Positions are list indexes; callers may rescale."""

    extra: Any
    columns: list[dict] = field(default_factory=list)
    stubs: list[dict] = field(default_factory=list)
    stub_tags: list[dict] = field(default_factory=list)
    tags: list[dict] = field(default_factory=list)
    sources: list[dict] = field(default_factory=list)
    imports: list[dict] = field(default_factory=list)
    statuses: list[dict] = field(default_factory=list)


def _is_dict_list(value):
    return isinstance(value, list) and all(isinstance(v, dict) for v in value)


def _take_list(container: dict, key: str):
    """Pop a list of objects out of ``container``, leaving ``[]`` as its marker.

    Returns None (and leaves the value in place) when the key is absent or its
    value is not a list of objects; such values stay in ``extra`` verbatim.
    """
    value = container.get(key)
    if not _is_dict_list(value) or not value:
        return None
    container[key] = []
    return value


def stub_hash(stub: Any) -> str:
    """Fingerprint of a stub's JSON, independent of key order."""
    return hashlib.md5(orjson.dumps(stub, option=orjson.OPT_SORT_KEYS)).hexdigest()


def tag_lookup(tags: Iterable[Mapping]) -> dict[str, dict]:
    """First project tag object per id, in TAG_LISTS order."""
    lookup: dict[str, dict] = {}
    for tag in tags:
        decoded = decode_tag(tag)
        if isinstance(decoded.get("id"), str):
            lookup.setdefault(decoded["id"], decoded)
    return lookup


def decode_tag(row):
    return _decode(row, TAG_FIELDS)


def decode_source(row):
    return _decode(row, SOURCE_FIELDS)


def encode_stub(
    stub: Any,
    *,
    tags_by_id: Mapping[str, Mapping],
    sources_by_id: Mapping[str, Mapping],
    citation: Callable[[str], Mapping | None],
    addressable: bool = True,
):
    """One stub row and its tag rows (``stub_pk`` is left to the caller).

    A stub that is not a JSON object is kept whole as ``raw = [stub]``. A stub
    that repeats an earlier stub's id is not ``addressable``: its id is kept in
    ``extra`` and the row's ``id`` is NULL.
    """
    if not isinstance(stub, dict):
        row = {column: None for _, column, _ in STUB_FIELDS + STUB_OPTIONAL}
        row.update({column: None for _, column in CITATION_FIELDS})
        row.update(identification_source_id=None, raw=[stub], extra=None, missing=None)
        row["content_hash"] = stub_hash(stub)
        return row, []

    row, extra, missing = _encode(
        stub,
        STUB_FIELDS,
        STUB_OPTIONAL,
        handled=[k for k, _ in CITATION_FIELDS] + list(STUB_STRUCTURED),
    )
    row["raw"] = None
    if row["neurostore_id"] == "":
        # names no Neurostore paper, so it cannot reference a citation row
        extra["neurostoreId"] = ""
        row["neurostore_id"] = None

    cited = citation(row["neurostore_id"]) if row["neurostore_id"] else None
    for key, column in CITATION_FIELDS:
        row[column] = None
        if key not in stub:
            missing.append(key)
        elif not isinstance(stub[key], str):
            extra[key] = stub[key]
        elif cited is None or cited.get(column) != stub[key]:
            row[column] = stub[key]

    row["identification_source_id"] = None
    if "identificationSource" not in stub:
        missing.append("identificationSource")
    else:
        source = stub["identificationSource"]
        source_id = source.get("id") if isinstance(source, dict) else None
        if isinstance(source_id, str) and sources_by_id.get(source_id) == source:
            row["identification_source_id"] = source_id
        else:
            extra["identificationSource"] = source

    tag_rows = []
    if "tags" not in stub:
        missing.append("tags")
    elif not isinstance(stub["tags"], list):
        extra["tags"] = stub["tags"]
    else:
        for position, tag in enumerate(stub["tags"]):
            tag_id = tag.get("id") if isinstance(tag, dict) else None
            tag_id = tag_id if isinstance(tag_id, str) else None
            known = tags_by_id.get(tag_id)
            tag_rows.append(
                {
                    "position": position,
                    "tag_id": tag_id,
                    # a tag that differs from the project's tag of that id is kept whole
                    "tag": None if known is not None and known == tag else tag,
                }
            )

    if not addressable and row["id"] is not None:
        extra["id"] = row["id"]
        row["id"] = None
    row["content_hash"] = stub_hash(stub)
    return _finish(row, extra, missing), tag_rows


def decode_stub(
    row: Mapping,
    tag_rows: Iterable[Mapping],
    *,
    tags_by_id: Mapping[str, Mapping],
    sources_by_id: Mapping[str, Mapping],
    citation: Mapping | None,
):
    if row.get("raw") is not None:
        return row["raw"][0]
    extra = row.get("extra") or {}
    missing = row.get("missing") or ()
    stub = _decode({**row, "extra": None}, STUB_FIELDS, STUB_OPTIONAL)
    for key, column in CITATION_FIELDS:
        if key in missing or key in extra:
            continue
        value = row[column]
        if value is None and citation is not None:
            value = citation.get(column)
        stub[key] = value
    if "identificationSource" not in missing and "identificationSource" not in extra:
        stub["identificationSource"] = dict(sources_by_id[row["identification_source_id"]])
    if "tags" not in missing and "tags" not in extra:
        stub["tags"] = [
            t["tag"] if t["tag"] is not None else dict(tags_by_id[t["tag_id"]])
            for t in sorted(tag_rows, key=lambda t: t["position"])
        ]
    stub.update(extra)
    return stub


def decompose(provenance: Any, citation: Callable[[str], Mapping | None]) -> Decomposed:
    """Rows for a provenance document. ``citation(nsid)`` returns the shared row."""
    d, stub_lists = split(provenance)
    tags_by_id, sources_by_id = lookups(d)
    seen: set[str] = set()
    for column_id, stubs in stub_lists:
        for position, stub in enumerate(stubs):
            stub_row, tag_rows = encode_stub(
                stub,
                tags_by_id=tags_by_id,
                sources_by_id=sources_by_id,
                citation=citation,
                addressable=first_use(stub, seen),
            )
            stub_row.update(column_id=column_id, position=float(position))
            d.stubs.append(stub_row)
            d.stub_tags.append(tag_rows)
    return d


def first_use(stub: Any, seen: set[str]) -> bool:
    """Whether ``stub``'s id is not yet in ``seen`` (and record it)."""
    stub_id = stub.get("id") if isinstance(stub, dict) else None
    if not isinstance(stub_id, str):
        return True
    if stub_id in seen:
        return False
    seen.add(stub_id)
    return True


def split(provenance: Any) -> tuple[Decomposed, list[tuple[str, list]]]:
    """Every row except the stubs, and each column's stubs as JSON, in order."""
    dumped = check_storable(provenance)
    if not isinstance(provenance, dict):
        return Decomposed(extra=provenance), []
    extra = orjson.loads(dumped)
    out = Decomposed(extra=extra)
    stub_lists: list[tuple[str, list]] = []

    curation = extra.get("curationMetadata")
    if isinstance(curation, dict):
        for list_name, key in (("info", "infoTags"), ("exclusion", "exclusionTags")):
            for position, tag in enumerate(_take_list(curation, key) or ()):
                row, x, m = _encode(tag, TAG_FIELDS)
                row.update(tag_list=list_name, position=position)
                out.tags.append(_finish(row, x, m))
        prisma = curation.get("prismaConfig")
        if isinstance(prisma, dict):
            for phase in PRISMA_PHASES:
                phase_obj = prisma.get(phase)
                if not isinstance(phase_obj, dict):
                    continue
                for position, tag in enumerate(_take_list(phase_obj, "exclusionTags") or ()):
                    row, x, m = _encode(tag, TAG_FIELDS)
                    row.update(tag_list=phase, position=position)
                    out.tags.append(_finish(row, x, m))
        for position, source in enumerate(_take_list(curation, "identificationSources") or ()):
            row, x, m = _encode(source, SOURCE_FIELDS)
            out.sources.append(_finish({**row, "position": position}, x, m))
        for position, item in enumerate(_take_list(curation, "imports") or ()):
            row, x, m = _encode(item, IMPORT_FIELDS, IMPORT_OPTIONAL)
            out.imports.append(_finish({**row, "position": position}, x, m))

        columns = curation.get("columns")
        if _is_dict_list(columns) and columns and _column_ids_unique(columns):
            curation["columns"] = []
            for col_position, column in enumerate(columns):
                stubs = column.get("stubStudies")
                row, x, m = _encode(column, COLUMN_FIELDS, handled=("stubStudies",))
                if not isinstance(stubs, list):
                    if "stubStudies" in column:
                        x["stubStudies"] = stubs
                    else:
                        m.append("stubStudies")
                    stubs = []
                out.columns.append(_finish({**row, "position": col_position}, x, m))
                stub_lists.append((row["id"], stubs))

    extraction = extra.get("extractionMetadata")
    if isinstance(extraction, dict):
        for position, status in enumerate(_take_list(extraction, "studyStatusList") or ()):
            row, x, m = _encode(status, STATUS_FIELDS)
            out.statuses.append(_finish({**row, "position": position}, x, m))
    return out, stub_lists


def lookups(d: Decomposed) -> tuple[dict[str, dict], dict[str, dict]]:
    """Project tags and identification sources by id, as stubs refer to them."""
    tags_by_id = tag_lookup(sorted(d.tags, key=_tag_order))
    sources_by_id = {}
    for source in sorted(d.sources, key=lambda s: s["position"]):
        decoded = decode_source(source)
        if isinstance(decoded.get("id"), str):
            sources_by_id[decoded["id"]] = decoded
    return tags_by_id, sources_by_id


def _column_ids_unique(columns):
    ids = [c.get("id") for c in columns]
    return all(isinstance(i, str) for i in ids) and len(set(ids)) == len(ids)


def assemble(d: Decomposed, citations: Mapping[str, Mapping]) -> Any:
    """The provenance document for rows produced by :func:`decompose`."""
    doc = d.extra
    if not isinstance(doc, dict):
        return doc
    doc = orjson.loads(orjson.dumps(doc))
    tags_by_id, sources_by_id = lookups(d)
    sources = [decode_source(s) for s in sorted(d.sources, key=lambda s: s["position"])]

    curation = doc.get("curationMetadata")
    if isinstance(curation, dict):
        by_list: dict[str, list] = {name: [] for name in TAG_LISTS}
        for tag in sorted(d.tags, key=_tag_order):
            by_list[tag["tag_list"]].append(decode_tag(tag))
        _fill(curation, "infoTags", by_list["info"])
        _fill(curation, "exclusionTags", by_list["exclusion"])
        prisma = curation.get("prismaConfig")
        if isinstance(prisma, dict):
            for phase in PRISMA_PHASES:
                if isinstance(prisma.get(phase), dict):
                    _fill(prisma[phase], "exclusionTags", by_list[phase])
        _fill(curation, "identificationSources", sources)
        _fill(
            curation,
            "imports",
            [
                _decode(i, IMPORT_FIELDS, IMPORT_OPTIONAL)
                for i in sorted(d.imports, key=lambda i: i["position"])
            ],
        )
        if d.columns:
            stubs_by_column: dict[str, list] = {}
            for stub, tag_rows in zip(d.stubs, d.stub_tags):
                stubs_by_column.setdefault(stub["column_id"], []).append((stub, tag_rows))
            columns = []
            for column in sorted(d.columns, key=lambda c: c["position"]):
                col = _decode(column, COLUMN_FIELDS)
                if "stubStudies" not in (column.get("missing") or ()) and (
                    "stubStudies" not in (column.get("extra") or {})
                ):
                    members = sorted(
                        stubs_by_column.get(column["id"], ()), key=lambda s: s[0]["position"]
                    )
                    col["stubStudies"] = [
                        decode_stub(
                            stub,
                            tag_rows,
                            tags_by_id=tags_by_id,
                            sources_by_id=sources_by_id,
                            citation=citations.get(stub.get("neurostore_id")),
                        )
                        for stub, tag_rows in members
                    ]
                columns.append(col)
            curation["columns"] = columns

    extraction = doc.get("extractionMetadata")
    if isinstance(extraction, dict):
        _fill(
            extraction,
            "studyStatusList",
            [_decode(s, STATUS_FIELDS) for s in sorted(d.statuses, key=lambda s: s["position"])],
        )
    return doc


def _tag_order(tag):
    return (TAG_LISTS.index(tag["tag_list"]), tag["position"])


def _fill(container, key, items):
    if isinstance(container.get(key), list) and not container[key] and items:
        container[key] = items
