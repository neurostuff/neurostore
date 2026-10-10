"""Generate the projection DDL from the study_schema LinkML source.

The projection is derived and disposable: a schema shape change is meant to be
regenerate, drop, rebuild -- not ALTER TABLE plus a backfill. That only holds if
regenerating is a command rather than a hand-editing pass, so the fixes
`gen-sqlddl` output needs are applied here instead of to a checked-in copy.

    python scripts/generate_projection_ddl.py \\
        --schema ~/projects/study_schema/neuroimaging-study-storage.yaml \\
        --out projection.sql

What it changes, and why:

1. **A facet column on classes reached by more than one slot of the same parent.**
   `Group` has five distribution slots -- sex, gender, handedness, race,
   ethnicity -- all ranging on `CategoryDistribution`. The generator emits one
   table with one `Group_id` and no record of which slot a row came from, so a
   handedness row and a sex row become indistinguishable once written. That is
   silent data loss, not redundancy: a filter for "majority female" matches a
   right-handed 60%.

2. **Multivalued scalars become array columns.** The generator gives each its own
   two-column side table (46 of 91 tables here). An array column on the parent
   holds the same data, and `Study_authors`/`Group_medical_condition` are read
   with the parent every time they are read at all.

3. **NOT NULL relaxed.** `required: true` is a statement about a complete record.
   A projection holds *extracted* records, where `extraction_status:
   not_reported` is a legitimate outcome for a slot the schema calls required.
   Primary keys keep theirs.

4. **Projection plumbing added**: `base_study_id` to scope a row to a study, and
   `claim_watermark` so staleness is detectable rather than assumed.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

# gen-sqlddl names a multivalued-scalar side table "<Class>_<slot>", with the
# parent key and the value as its only columns.
_CREATE_TABLE = re.compile(r'^CREATE TABLE "?([A-Za-z_]+)"? \($', re.M)

_SCALAR_SQL_TYPE = {
    "string": "TEXT",
    "uriorcurie": "TEXT",
    "uri": "TEXT",
    "integer": "INTEGER",
    "float": "FLOAT",
    "double": "FLOAT",
    "decimal": "FLOAT",
    "boolean": "BOOLEAN",
    "date": "DATE",
    "datetime": "TIMESTAMP",
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument(
        "--gen-sqlddl",
        default="gen-sqlddl",
        help="Path to linkml's gen-sqlddl, if it is not on PATH.",
    )
    args = parser.parse_args(argv)

    from linkml_runtime import SchemaView

    view = SchemaView(str(args.schema))
    raw = _generate(args.gen_sqlddl, args.schema)

    sql = _add_facet_columns(raw, _multi_slot_ranges(view))
    sql, arrays = _collapse_scalar_side_tables(sql, view)
    sql = _relax_not_null(sql)
    sql = _add_projection_columns(sql, view)

    args.out.write_text(_header(args.schema, arrays) + sql, encoding="utf-8")
    print(
        f"{args.out}: {len(_CREATE_TABLE.findall(sql))} tables "
        f"({arrays} scalar side tables folded into array columns)"
    )
    return 0


def _generate(gen_sqlddl: str, schema: Path) -> str:
    result = subprocess.run(
        [gen_sqlddl, "--dialect", "postgresql", str(schema)],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def _multi_slot_ranges(view) -> dict[str, dict[str, list[str]]]:
    """Classes reached by more than one slot of the same parent class.

    Returns {range_class: {parent_class: [slot, ...]}}, which is exactly the
    case where the generated foreign key cannot say which slot a row came from.
    """
    reached: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for class_name in view.all_classes():
        for slot in view.class_induced_slots(class_name):
            if slot.range in view.all_classes():
                reached[slot.range][class_name].append(slot.name)
    return {
        range_class: {
            parent: slots for parent, slots in parents.items() if len(slots) > 1
        }
        for range_class, parents in reached.items()
        if any(len(slots) > 1 for slots in parents.values())
    }


def _add_facet_columns(sql: str, multi: dict[str, dict[str, list[str]]]) -> str:
    """Give each ambiguous range class a column naming the slot it came from."""
    for range_class, parents in multi.items():
        for parent, slots in parents.items():
            column = f"{_snake(parent)}_facet"
            comment = ", ".join(sorted(slots))
            sql = _add_column(
                sql,
                range_class,
                f'\t{column} TEXT, -- which {parent} slot: {comment}',
            )
    return sql


def _collapse_scalar_side_tables(sql: str, view) -> tuple[str, int]:
    """Replace `<Class>_<slot>` side tables with an array column on the parent."""
    collapsed = 0
    for class_name in view.all_classes():
        for slot in view.class_induced_slots(class_name):
            if not slot.multivalued or slot.range in view.all_classes():
                continue
            sql_type = _SCALAR_SQL_TYPE.get(str(slot.range))
            if sql_type is None:
                continue
            side_table = f"{class_name}_{slot.name}"
            if f'CREATE TABLE "{side_table}"' not in sql:
                continue
            sql = _drop_table(sql, side_table)
            sql = _add_column(sql, class_name, f"\t{slot.name} {sql_type}[],")
            collapsed += 1
    return sql, collapsed


def _relax_not_null(sql: str) -> str:
    """Drop NOT NULL everywhere except primary keys.

    A projection over extracted records cannot require what the schema requires
    of a complete one.
    """
    out = []
    for line in sql.splitlines():
        if "NOT NULL" in line and "PRIMARY KEY" not in line and "SERIAL" not in line:
            line = line.replace(" NOT NULL", "")
        out.append(line)
    return "\n".join(out) + "\n"


def _add_projection_columns(sql: str, view) -> str:
    """Scope each entity row to a base study, and stamp what it was built from."""
    for class_name in view.all_classes():
        if f'CREATE TABLE "{class_name}"' not in sql:
            continue
        sql = _add_column(
            sql,
            class_name,
            "\tbase_study_id TEXT,\n"
            "\tclaim_watermark BIGINT, -- the claim state this row was built from",
        )
    return sql


def _add_column(sql: str, table: str, column_sql: str) -> str:
    marker = f'CREATE TABLE "{table}" (\n'
    if marker not in sql:
        return sql
    return sql.replace(marker, marker + column_sql + "\n", 1)


def _drop_table(sql: str, table: str) -> str:
    """Remove a table and every statement that would outlive it.

    gen-sqlddl emits comments and indexes as separate statements, so dropping
    only the CREATE TABLE leaves several referring to a relation that no longer
    exists. Comment bodies are reflowed across lines, hence matching to the
    closing quote-semicolon rather than to end of line.
    """
    quoted = re.escape(table)
    sql = re.sub(rf'CREATE TABLE "{quoted}" \(.*?\n\);\n', "", sql, flags=re.S)
    sql = re.sub(
        rf"^COMMENT ON TABLE \"{quoted}\" IS .*?';\n", "", sql, flags=re.M | re.S
    )
    sql = re.sub(
        rf"^COMMENT ON COLUMN \"{quoted}\"\..*?';\n", "", sql, flags=re.M | re.S
    )
    sql = re.sub(rf'^CREATE INDEX .*? ON "{quoted}" .*?;\n', "", sql, flags=re.M)
    return sql


def _snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def _header(schema: Path, arrays: int) -> str:
    return (
        f"-- Generated from {schema.name} by scripts/generate_projection_ddl.py.\n"
        f"-- Do not edit: regenerate. {arrays} multivalued-scalar side tables were\n"
        f"-- folded into array columns; see the script for the other fixes applied.\n\n"
    )


if __name__ == "__main__":
    sys.exit(main())
