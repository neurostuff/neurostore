"""drop fulltexts.tier, point each base study at its preferred full text, and store
review_sources.judgeable_keys

A full text's tier was a fixed map of its source, so the stored column only mirrored it. The
preference that replaces it is applied to each base study's pointer once, here, and then by
refresh_fulltext_pointer. The judgeable keys of a source are computed once at import, so the
paper list reads them without loading the record. The upgrade backfills them from each record
and coordinate parse, in batches. The downgrade restores the tier from the source name and
drops the keys.

Revision ID: e8a2c6d4f1b9
Revises: b4e1f7a9c2d6
Create Date: 2026-10-15

"""

import json
from collections import namedtuple
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "e8a2c6d4f1b9"
down_revision = "b4e1f7a9c2d6"
branch_labels = None
depends_on = None

# Frozen copies of the review core's rules as of this revision. They must not import from
# neurostore or study_schema: a later change there must not change what this migration writes.
# The schema inputs of the judgeable_keys walk are a snapshot of study_schema's pinned commit,
# kept beside this file in e8a2c6d4f1b9_schema_inputs.json.
_SOURCE_PREFERENCE = {
    "pubget": 0,
    "pmc": 0,
    "europepmc": 0,
    "elsevier": 0,
    "springer": 0,
    "ace": 1,
    "pdf": 2,
}
_SCHEMA_INPUTS = json.loads(
    Path(__file__).with_name("e8a2c6d4f1b9_schema_inputs.json").read_text(encoding="utf-8")
)
_DEFS = _SCHEMA_INPUTS["extraction_record_defs"]
_DECLARED_KEYS = _SCHEMA_INPUTS["declared_keys"]
_BATCH_SIZE = 500
_STUDY = "study"
_CHILD_LISTS = {
    "Study": (
        ("groups", "Group"),
        ("tasks", "Task"),
        ("assessments", "Assessment"),
        ("regions", "Region"),
        ("devices", "Device"),
        ("acquisitions", "Acquisition"),
        ("preprocessings", "Preprocessing"),
        ("model_estimations", "ModelEstimation"),
        ("inference_settings", "InferenceSettings"),
        ("measures", "Measure"),
        ("tables", "Table"),
        ("analyses", "Analysis"),
        ("coordinate_sets", "CoordinateSet"),
        ("design.arms", "Arm"),
        ("design.timepoints", "Timepoint"),
    ),
    "Task": (("conditions", "Condition"),),
    "ModelEstimation": (("terms", "ModelTerm"),),
}
_Entity = namedtuple(
    "_Entity", "local_id entity_class schema_class parent list_path item location"
)

fulltexts = sa.table(
    "fulltexts",
    sa.column("base_study_id"),
    sa.column("source"),
    sa.column("tier"),
    sa.column("created_at"),
    sa.column("id"),
)
base_studies = sa.table("base_studies", sa.column("id"), sa.column("fulltext_id"))


def _is_extracted(cls):
    props = _DEFS.get(cls, {}).get("properties", {})
    return "extraction_status" in props and "evidence" in props


def _refs(schema):
    out = []
    if "$ref" in schema:
        out.append(schema["$ref"].rsplit("/", 1)[-1])
    for option in schema.get("anyOf", []):
        out.extend(_refs(option))
    return out


def _fixed(schema):
    allowed = [schema["const"]] if "const" in schema else schema.get("enum")
    return allowed if allowed is not None and len(allowed) == 1 else None


def _pins(props, value):
    return any(k in value and _fixed(schema) == [value[k]] for k, schema in props.items())


def _contradicts(schema, value):
    fixed = _fixed(schema)
    return fixed is not None and fixed != [value]


def _pick(names, value):
    classes = [n for n in names if _DEFS.get(n, {}).get("type") == "object"]
    for name in classes:
        if _pins(_DEFS[name].get("properties", {}), value):
            return name
    for name in classes:
        props = _DEFS[name].get("properties", {})
        required = _DEFS[name].get("required", [])
        if (
            all(r in value for r in required)
            and set(value) <= set(props)
            and not any(_contradicts(props[k], value[k]) for k in value)
        ):
            return name
    return classes[0] if classes else None


def _class_of(cls, attribute, value):
    schema = _DEFS.get(cls, {}).get("properties", {}).get(attribute)
    if schema is None or not isinstance(value, dict):
        return None
    names = _refs(schema)
    names.extend(_refs(schema.get("items", {})))
    return _pick(names, value)


def _extracted_value(wrapper):
    return wrapper.get("value") if isinstance(wrapper, dict) else wrapper


def _key_value(slot):
    value = _extracted_value(slot)
    return "" if value is None else str(value)


def _format_path(steps):
    parts = []
    for attribute, selector in steps:
        if selector is None:
            parts.append(attribute)
        elif isinstance(selector, int):
            parts.append(f"{attribute}[#{selector}]")
        else:
            parts.append(f"{attribute}[{','.join(f'{s}={v}' for s, v in selector)}]")
    return ".".join(parts)


def _get(obj, dotted):
    for part in dotted.split("."):
        if not isinstance(obj, dict):
            return None
        obj = obj.get(part)
    return obj


def _item_path(owner_path, list_path, index=None):
    path = f"{owner_path}.{list_path}" if owner_path else list_path
    return path if index is None else f"{path}[{index}]"


def _entity_lists(record):
    def walk(owner_class, owner_path, owner):
        for list_path, entity_class in _CHILD_LISTS.get(owner_class, ()):
            items = _get(owner, list_path)
            yield owner_path, list_path, entity_class, items
            if not isinstance(items, list):
                continue
            for index, item in enumerate(items):
                if isinstance(item, dict):
                    yield from walk(entity_class, _item_path(owner_path, list_path, index), item)

    yield from walk("Study", "", record)


def _index(record):
    entities = {_STUDY: _Entity(_STUDY, "Study", "Study", None, None, record, ())}
    owners = {"": entities[_STUDY]}
    for owner_path, list_path, entity_class, items in _entity_lists(record):
        if not isinstance(items, list):
            continue
        owner = owners[owner_path]
        holder, owner_class = owner.item, owner.schema_class
        *nesting, attribute = list_path.split(".")
        steps = (*owner.location, *list_path.split("."))
        for step in nesting:
            owner_class = _class_of(owner_class, step, holder.get(step)) or step
            holder = holder.get(step) or {}
        for position, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            local_id = item.get("local_id")
            if not local_id:
                raise ValueError(f"an item of {owner.local_id}.{list_path} has no local_id")
            if local_id in entities:
                raise ValueError(f"duplicate local_id {local_id!r}")
            child = _Entity(
                local_id,
                entity_class,
                _class_of(owner_class, attribute, item) or entity_class,
                owner.local_id,
                list_path,
                item,
                (*steps, position),
            )
            entities[local_id] = child
            owners[_item_path(owner_path, list_path, position)] = child
    return entities


def _found(local_id, steps, cls, wrappers):
    if _is_extracted(cls):
        wrappers.append({"entity": local_id, "path": _format_path(steps), "class": cls})


def _walk(cls, obj, steps, local_id, skip, wrappers):
    for attribute, value in obj.items():
        here = (*steps, (attribute, None))
        if value is None or ".".join(a for a, _ in here) in skip:
            continue
        if isinstance(value, dict):
            inner = _class_of(cls, attribute, value)
            if inner is None:
                continue
            _found(local_id, here, inner, wrappers)
            if not _is_extracted(inner):
                _walk(inner, value, here, local_id, skip, wrappers)
        elif isinstance(value, list):
            for position, item in enumerate(value):
                if not isinstance(item, dict):
                    continue
                inner = _class_of(cls, attribute, item)
                if inner is None:
                    continue
                slots = _DECLARED_KEYS.get(inner)
                selector = (
                    tuple((s, _key_value(item.get(s))) for s in slots) if slots else position
                )
                step = (*steps, (attribute, selector))
                _found(local_id, step, inner, wrappers)
                if not _is_extracted(inner):
                    _walk(inner, item, step, local_id, skip, wrappers)


def _wrappers(record):
    wrappers = []
    for local_id, entity in _index(record).items():
        skip = {path for path, _ in _CHILD_LISTS.get(entity.entity_class, ())}
        _walk(entity.schema_class, entity.item, (), local_id, skip, wrappers)
    return wrappers


def judgeable_keys(record, parse):
    """The sorted provenance keys a reviewer can judge in a source: each extracted value of its
    record's entities, and each analysis of its coordinate parse."""
    values = {f"slot:{wrapper['entity']}:{wrapper['path']}" for wrapper in _wrappers(record)}
    analyses = {
        f"coordinate_analysis:{analysis['key']}"
        for analysis in (parse or {}).get("analyses") or []
    }
    return sorted(values | analyses)


def _recompute_pointers():
    best = (
        sa.select(fulltexts.c.id)
        .where(fulltexts.c.base_study_id == base_studies.c.id)
        .order_by(
            sa.case(_SOURCE_PREFERENCE, value=fulltexts.c.source),
            fulltexts.c.created_at.desc(),
            fulltexts.c.id,
        )
        .limit(1)
        .scalar_subquery()
    )
    op.execute(sa.update(base_studies).values(fulltext_id=best))


def backfill_judgeable_keys(bind, batch_size=_BATCH_SIZE):
    """Set each source's judgeable_keys from its own record and coordinate parse, a batch of
    sources at a time, in id order."""
    last_id = ""
    while True:
        rows = bind.execute(
            sa.text(
                "SELECT id, record, coordinate_parse FROM review_sources"
                " WHERE id > :last ORDER BY id LIMIT :limit"
            ),
            {"last": last_id, "limit": batch_size},
        ).all()
        if not rows:
            return
        for row in rows:
            bind.execute(
                sa.text(
                    "UPDATE review_sources SET judgeable_keys = CAST(:keys AS jsonb)"
                    " WHERE id = :id"
                ),
                {
                    "keys": json.dumps(judgeable_keys(row.record, row.coordinate_parse)),
                    "id": row.id,
                },
            )
        last_id = rows[-1].id


def upgrade():
    op.drop_index("ix_fulltexts_base_study_tier_created", table_name="fulltexts")
    op.drop_constraint("ck_fulltexts_tier", "fulltexts", type_="check")
    op.drop_column("fulltexts", "tier")
    op.create_index(
        "ix_fulltexts_base_study_created", "fulltexts", ["base_study_id", "created_at"]
    )
    _recompute_pointers()

    op.add_column("review_sources", sa.Column("judgeable_keys", JSONB(), nullable=True))
    backfill_judgeable_keys(op.get_bind())
    op.alter_column("review_sources", "judgeable_keys", nullable=False)


def downgrade():
    op.drop_column("review_sources", "judgeable_keys")

    op.add_column("fulltexts", sa.Column("tier", sa.SmallInteger(), nullable=True))
    op.execute(
        sa.update(fulltexts).values(
            tier=sa.case(
                {source: rank + 1 for source, rank in _SOURCE_PREFERENCE.items()},
                value=fulltexts.c.source,
            )
        )
    )
    op.alter_column("fulltexts", "tier", nullable=False)
    op.create_check_constraint("ck_fulltexts_tier", "fulltexts", "tier IN (1, 2, 3)")
    op.drop_index("ix_fulltexts_base_study_created", table_name="fulltexts")
    op.create_index(
        "ix_fulltexts_base_study_tier_created",
        "fulltexts",
        ["base_study_id", "tier", "created_at"],
    )
