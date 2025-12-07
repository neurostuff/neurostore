"""
Backfill `curation_stub_uuid` in the neurostore DB by matching curation stubs
stored in the compose DB.

Matching priority: pmid -> doi -> pmcid -> name (all normalized/lowercased).
We only assign when there is exactly one stub candidate for the chosen key within
the same studyset; ambiguous or missing keys are skipped.

Requires network access to both databases (same docker network). By default this
script runs in dry-run mode; pass `--execute` to write changes.

Suggested invocation (run from repo root; containers must be up):
    docker compose -f store/docker-compose.yml run --rm neurostore \
        python /store/scripts/backfill_curation_stub_uuid_crossdb.py --execute
"""

from __future__ import annotations

import argparse
import os
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Set, Tuple

import psycopg2


# Connection helpers ---------------------------------------------------------


@dataclass
class DbConfig:
    host: str
    dbname: str
    user: str
    password: str
    port: int = 5432


def load_db_config(prefix: str, defaults: Optional[dict] = None) -> DbConfig:
    defaults = defaults or {}
    return DbConfig(
        host=os.environ.get(f"{prefix}_HOST", defaults.get("host", "")),
        dbname=os.environ.get(f"{prefix}_DB", defaults.get("dbname", "")),
        user=os.environ.get(f"{prefix}_USER", defaults.get("user", "")),
        password=os.environ.get(f"{prefix}_PASSWORD", defaults.get("password", "")),
        port=int(os.environ.get(f"{prefix}_PORT", defaults.get("port", 5432))),
    )


def connect(cfg: DbConfig):
    return psycopg2.connect(
        host=cfg.host,
        dbname=cfg.dbname,
        user=cfg.user,
        password=cfg.password,
        port=cfg.port,
    )


# Data access ---------------------------------------------------------------


def fetch_compose_stubs(cur) -> List[dict]:
    """
    Returns rows with: project_id, studyset_id, stub_id, pmid, doi, pmcid, title(name)
    """
    sql = """
    WITH proj AS (
        SELECT
            id AS project_id,
            provenance->'extractionMetadata'->>'studysetId' AS studyset_id,
            jsonb_array_elements(provenance->'curationMetadata'->'columns') AS col
        FROM projects
    )
    SELECT
        project_id,
        studyset_id,
        stub->>'id' AS stub_id,
        lower(nullif(stub->>'pmid','')) AS pmid,
        lower(nullif(stub->>'doi','')) AS doi,
        lower(nullif(stub->>'pmcid','')) AS pmcid,
        lower(nullif(stub->>'title','')) AS title
    FROM proj
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(col->'stubStudies','[]')) stub;
    """
    cur.execute(sql)
    cols = [c.name for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def fetch_neurostore_missing(cur) -> List[dict]:
    """
    Returns rows with: studyset_id, study_id, pmid, doi, pmcid, name
    Only where curation_stub_uuid is NULL.
    """
    sql = """
    SELECT
        ss.studyset_id,
        ss.study_id,
        lower(nullif(s.pmid,'')) AS pmid,
        lower(nullif(s.doi,'')) AS doi,
        lower(nullif(s.pmcid,'')) AS pmcid,
        lower(nullif(s.name,'')) AS name
    FROM studyset_studies ss
    JOIN studies s ON s.id = ss.study_id
    WHERE ss.curation_stub_uuid IS NULL;
    """
    cur.execute(sql)
    cols = [c.name for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


# Matching -------------------------------------------------------------------


def norm(val: Optional[str]) -> Optional[str]:
    if val is None:
        return None
    val = val.strip()
    return val.lower() if val else None


def pick_key(row: dict) -> Optional[Tuple[str, str]]:
    """
    Choose the best identifier key based on priority pmid -> doi -> pmcid -> name.
    Returns (field, value) or None.
    """
    for field in ("pmid", "doi", "pmcid", "name"):
        v = norm(row.get(field))
        if v:
            return (field, v)
    return None


def build_stub_map(stubs: Iterable[dict]) -> Dict[str, Dict[Tuple[str, str], Set[str]]]:
    """
    Map: studyset_id -> (key -> set(stub_ids))
    """
    out: Dict[str, Dict[Tuple[str, str], Set[str]]] = defaultdict(lambda: defaultdict(set))
    for stub in stubs:
        studyset_id = stub.get("studyset_id")
        stub_id = stub.get("stub_id")
        if not studyset_id or not stub_id:
            continue
        key = pick_key(
            {
                "pmid": stub.get("pmid"),
                "doi": stub.get("doi"),
                "pmcid": stub.get("pmcid"),
                "name": stub.get("title"),
            }
        )
        if key:
            out[studyset_id][key].add(stub_id)
    return out


def plan_updates(stub_map, missing_rows):
    updates = []
    skipped = []
    for row in missing_rows:
        ssid = row["studyset_id"]
        key = pick_key(row)
        if not ssid or not key:
            skipped.append((row, "no_key"))
            continue
        candidates = stub_map.get(ssid, {}).get(key, set())
        if len(candidates) == 1:
            stub_uuid = next(iter(candidates))
            updates.append((stub_uuid, ssid, row["study_id"]))
        else:
            reason = "ambiguous" if candidates else "no_match"
            skipped.append((row, reason))
    return updates, skipped


def apply_updates(cur, updates, execute: bool):
    if not execute or not updates:
        return
    for stub_uuid, studyset_id, study_id in updates:
        cur.execute(
            """
            UPDATE studyset_studies
            SET curation_stub_uuid = %s
            WHERE studyset_id = %s AND study_id = %s AND curation_stub_uuid IS NULL
            """,
            (stub_uuid, studyset_id, study_id),
        )


# Main ----------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Backfill curation_stub_uuid from compose stubs")
    parser.add_argument("--execute", action="store_true", help="Apply updates (otherwise dry-run)")
    args = parser.parse_args()

    compose_cfg = load_db_config(
        "COMPOSE_DB",
        defaults={
            "host": "compose_pgsql17",
            "dbname": os.environ.get("COMPOSE_DB", "compose"),
            "user": os.environ.get("POSTGRES_USER", "postgres"),
            "password": os.environ.get("POSTGRES_PASSWORD", "postgres"),
            "port": 5432,
        },
    )
    neuro_cfg = load_db_config(
        "NEUROSTORE_DB",
        defaults={
            "host": "store-pgsql17",
            "dbname": os.environ.get("POSTGRES_DB", "neurostore"),
            "user": os.environ.get("POSTGRES_USER", "postgres"),
            "password": os.environ.get("POSTGRES_PASSWORD", "postgres"),
            "port": 5432,
        },
    )

    with connect(compose_cfg) as compose_conn, connect(neuro_cfg) as neuro_conn:
        with compose_conn.cursor() as ccur:
            stubs = fetch_compose_stubs(ccur)
        with neuro_conn.cursor() as ncur:
            missing = fetch_neurostore_missing(ncur)

        stub_map = build_stub_map(stubs)
        updates, skipped = plan_updates(stub_map, missing)

        print(f"Found {len(stubs)} stubs across compose projects")
        print(f"Found {len(missing)} neurostore associations missing stub uuid")
        print(f"Planned updates: {len(updates)}; Skipped: {len(skipped)}")
        if skipped:
            reason_counts = defaultdict(int)
            for _, reason in skipped:
                reason_counts[reason] += 1
            print("Skip reasons:", dict(reason_counts))

        if updates and args.execute:
            with neuro_conn.cursor() as ncur:
                apply_updates(ncur, updates, execute=True)
            neuro_conn.commit()
            print(f"Applied {len(updates)} updates.")
        else:
            print("Dry-run (no updates applied). Use --execute to write changes.")


if __name__ == "__main__":
    main()
