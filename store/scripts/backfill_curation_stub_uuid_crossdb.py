"""
Backfill `curation_stub_uuid` in the neurostore DB by matching curation stubs
stored in the compose DB.

Matching priority: pmid -> doi -> pmcid -> name (all normalized/lowercased).
We only assign when there is exactly one stub candidate for the chosen key within
the same studyset; ambiguous or missing keys are skipped.

Requires network access to both databases (same docker network). By default this
script runs in dry-run mode; pass `--execute` to write changes.

Suggested invocation (run from repo root; containers must be up):
    docker compose -f store/docker-compose.yml run --rm \
        -v "$(pwd)":/workspace -w /workspace   neurostore \
            python store/scripts/backfill_curation_stub_uuid_crossdb.py
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple

import psycopg2


# Connection helpers ---------------------------------------------------------


@dataclass
class DbConfig:
    host: str
    dbname: str
    user: str
    password: str
    port: int


def load_env_file(path: Path) -> dict:
    """Minimal .env parser (no dependency on python-dotenv)."""
    env = {}
    if not path.exists():
        return env
    with path.open() as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            env[key.strip()] = val.strip().strip('"').strip("'")
    return env


def load_db_config(env: dict, label: str) -> DbConfig:
    """
    Build DbConfig from a single, canonical set of keys in the provided env mapping.
    Required keys: POSTGRES_HOST, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD.
    Optional: POSTGRES_PORT (defaults to 5432, matching the app config).
    """
    required_present = {
        "host": "POSTGRES_HOST",
        "dbname": "POSTGRES_DB",
        "user": "POSTGRES_USER",
        "password": "POSTGRES_PASSWORD",
    }
    missing_required = [env_key for env_key in required_present.values() if not env.get(env_key)]
    if missing_required:
        raise RuntimeError(
            f"Missing required environment variables for {label} database: {', '.join(missing_required)}"
        )

    port_raw = env.get("POSTGRES_PORT", "5432")
    try:
        port = int(port_raw)
    except ValueError as exc:
        raise RuntimeError(f"Invalid port for {label} database; expected integer in POSTGRES_PORT") from exc

    return DbConfig(
        host=env[required_present["host"]],
        dbname=env[required_present["dbname"]],
        user=env[required_present["user"]],
        password=env[required_present["password"]],
        port=port,
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
    cur.execute("SELECT to_regclass('public.projects')")
    if not cur.fetchone()[0]:
        print("Compose DB: no projects table found; skipping stub fetch.")
        return []

    sql = """
    WITH proj AS (
        SELECT
            id AS project_id,
            provenance->'extractionMetadata'->>'studysetId' AS studyset_id,
            jsonb_array_elements(
                COALESCE((provenance->'curationMetadata'->'columns')::jsonb, '[]'::jsonb)
            ) AS col
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
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(col->'stubStudies','[]'::jsonb)) stub;
    """
    cur.execute(sql)
    cols = [c.name for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def fetch_neurostore_missing(cur) -> List[dict]:
    """
    Returns rows with: studyset_id, study_id, pmid, doi, pmcid, name
    Only where curation_stub_uuid is NULL.
    """
    cur.execute("SELECT to_regclass('public.studyset_studies'), to_regclass('public.studies')")
    ss_table, s_table = cur.fetchone()
    if not ss_table or not s_table:
        print("Neurostore DB: required tables missing; skipping missing-stub fetch.")
        return []

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


def iter_keys(row: dict):
    """
    Yield available identifier keys in priority order.
    """
    for field in ("pmid", "doi", "pmcid", "name"):
        v = norm(row.get(field))
        if v:
            yield field, v


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
        stub_keys = {
            "pmid": stub.get("pmid"),
            "doi": stub.get("doi"),
            "pmcid": stub.get("pmcid"),
            "name": stub.get("title"),
        }
        for key in iter_keys(stub_keys):
            out[studyset_id][key].add(stub_id)
    return out


def plan_updates(stub_map, missing_rows):
    updates = []
    skipped = []
    for row in missing_rows:
        ssid = row["studyset_id"]
        if not ssid:
            skipped.append((row, "no_key"))
            continue
        keys = list(iter_keys(row))
        if not keys:
            skipped.append((row, "no_key"))
            continue
        matched = False
        saw_ambiguous = False
        key_map = stub_map.get(ssid, {})
        for key in keys:
            candidates = key_map.get(key, set())
            if len(candidates) == 1:
                stub_uuid = next(iter(candidates))
                updates.append((stub_uuid, ssid, row["study_id"]))
                matched = True
                break
            if len(candidates) > 1:
                saw_ambiguous = True
        if not matched:
            skipped.append((row, "ambiguous" if saw_ambiguous else "no_match"))
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


def find_repo_root() -> Path:
    """Locate repo root by walking parents until both compose/ and store/ are found."""
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "store").is_dir() and (parent / "compose").is_dir():
            return parent
    return current.parents[2]


def main():
    parser = argparse.ArgumentParser(description="Backfill curation_stub_uuid from compose stubs")
    parser.add_argument("--execute", action="store_true", help="Apply updates (otherwise dry-run)")
    args = parser.parse_args()

    repo_root = find_repo_root()
    compose_env = load_env_file(repo_root / "compose" / ".env")
    store_env = load_env_file(repo_root / "store" / ".env")

    if not compose_env:
        raise RuntimeError("compose/.env is required to configure the compose database connection.")
    if not store_env:
        raise RuntimeError("store/.env is required to configure the neurostore database connection.")

    compose_cfg = load_db_config(compose_env, "compose")
    neuro_cfg = load_db_config(store_env, "neurostore")

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
