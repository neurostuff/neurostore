from __future__ import annotations

import pathlib
from datetime import datetime
from operator import itemgetter

from flask import abort, current_app, request
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from neurosynth_compose.database import db
from neurosynth_compose.models.analysis import (
    SnapshotAnnotation,
    NeurovaultCollection,
    NeurovaultFile,
    SnapshotStudyset,
    generate_id,
)
from neurosynth_compose.utils.snapshots import md5_of_snapshot

# NiMARE 0.9.0 emits table files from MetaResult.save_tables using:
# <table_key>.tsv where table_key comes from Diagnostics.transform.
NIMARE_TABLE_FILENAME_PATTERNS = {
    "cluster": "<target_image>_tab-clust.tsv",
    "diagnostic": (
        "<target_image>_diag-<FocusCounter|Jackknife>_tab-counts.tsv",
        "<target_image>_diag-<FocusCounter|Jackknife>_tab-counts_tail-"
        "<positive|negative>.tsv",
    ),
}

NIMARE_CLUSTER_TABLE_TARGET_NAME = {
    "uncorrected": {
        "single": ["z"],
        "pairwise": [
            "z_desc-group1MinusGroup2",
            "z_desc-association",
            "z_desc-uniformity",
            "z",
        ],
    },
    "fwe_montecarlo": {
        "pairwise_mass": [
            "z_desc-group1MinusGroup2Mass_level-cluster_corr-FWE_method-montecarlo",
            "z_desc-associationMass_level-cluster_corr-FWE_method-montecarlo",
        ],
        "pairwise_size": [
            "z_desc-group1MinusGroup2Size_level-cluster_corr-FWE_method-montecarlo",
            "z_desc-associationSize_level-cluster_corr-FWE_method-montecarlo",
        ],
        "single_mass": ["z_desc-mass_level-cluster_corr-FWE_method-montecarlo"],
        "single_size": ["z_desc-size_level-cluster_corr-FWE_method-montecarlo"],
        "pairwise_voxel": [
            "z_desc-group1MinusGroup2_level-voxel_corr-FWE_method-montecarlo",
            "z_desc-association_level-voxel_corr-FWE_method-montecarlo",
        ],
        "single_voxel": ["z_level-voxel_corr-FWE_method-montecarlo"],
    },
    "pairwise_corrected_prefixes": [
        "z_desc-group1MinusGroup2",
        "z_desc-association",
        "z_desc-uniformity",
    ],
    "single_corrected_prefixes": ["z"],
}


def _as_specification_dict(specification):
    if specification is None:
        return {}
    if isinstance(specification, dict):
        return specification
    return {
        "corrector": getattr(specification, "corrector", None),
        "estimator": getattr(specification, "estimator", None),
    }


def _canonical_corrector_type(corrector):
    if not isinstance(corrector, dict):
        return None
    corr_type = str(corrector.get("type") or "").strip()
    if not corr_type:
        return None
    corr_type_lower = corr_type.lower()
    if corr_type_lower.endswith("corrector"):
        corr_type_lower = corr_type_lower[: -len("corrector")]
    if corr_type_lower in {"fdr", "fwe"}:
        return corr_type_lower.upper()
    return corr_type.upper()


def _corrector_method(corrector, corr_type):
    if not isinstance(corrector, dict):
        return None
    args = corrector.get("args")
    if isinstance(args, dict) and args.get("method"):
        return str(args["method"])
    if corr_type == "FDR":
        return "indep"
    if corr_type == "FWE":
        return "bonferroni"
    return None


def _is_pairwise_estimator(specification_dict):
    estimator = specification_dict.get("estimator")
    if not isinstance(estimator, dict):
        return False
    est_type = str(estimator.get("type") or "").lower()
    return any(hint in est_type for hint in ("subtraction", "chi2", "pairwise"))


def _expected_cluster_table_targets(specification):
    specification_provided = specification is not None
    specification_dict = _as_specification_dict(specification)
    corrector = specification_dict.get("corrector")
    corr_type = _canonical_corrector_type(corrector)
    corr_method = _corrector_method(corrector, corr_type)
    is_pairwise = _is_pairwise_estimator(specification_dict)

    if not corr_type:
        if specification_provided:
            if is_pairwise:
                return list(NIMARE_CLUSTER_TABLE_TARGET_NAME["uncorrected"]["pairwise"])
            return list(NIMARE_CLUSTER_TABLE_TARGET_NAME["uncorrected"]["single"])
        return []
    if not corr_method:
        return []

    if corr_type == "FWE" and corr_method == "montecarlo":
        if is_pairwise:
            return list(
                NIMARE_CLUSTER_TABLE_TARGET_NAME["fwe_montecarlo"]["pairwise_mass"]
            ) + list(
                NIMARE_CLUSTER_TABLE_TARGET_NAME["fwe_montecarlo"]["pairwise_voxel"]
            )
        return (
            list(NIMARE_CLUSTER_TABLE_TARGET_NAME["fwe_montecarlo"]["single_mass"])
            + list(NIMARE_CLUSTER_TABLE_TARGET_NAME["fwe_montecarlo"]["single_size"])
            + list(NIMARE_CLUSTER_TABLE_TARGET_NAME["fwe_montecarlo"]["single_voxel"])
        )

    suffix = f"_corr-{corr_type}_method-{corr_method}"
    if is_pairwise:
        return [
            f"{prefix}{suffix}"
            for prefix in NIMARE_CLUSTER_TABLE_TARGET_NAME[
                "pairwise_corrected_prefixes"
            ]
        ]
    return [
        f"{prefix}{suffix}"
        for prefix in NIMARE_CLUSTER_TABLE_TARGET_NAME["single_corrected_prefixes"]
    ]


def select_cluster_table_for_specification(cluster_table_fnames, specification):
    if not cluster_table_fnames:
        return None

    named_paths = sorted(
        [
            (pathlib.Path(path).name.lower(), pathlib.Path(path))
            for path in cluster_table_fnames
        ],
        key=itemgetter(0),
    )

    def _select_by_suffixes(expected_suffixes):
        for expected_suffix in expected_suffixes:
            for name, path in named_paths:
                if name == expected_suffix or name.endswith(expected_suffix):
                    return path
        return None

    expected_targets = _expected_cluster_table_targets(specification)
    expected_suffixes = [
        f"{target}_tab-clust.tsv".lower() for target in expected_targets
    ]
    selected = _select_by_suffixes(expected_suffixes)
    if expected_targets:
        return selected
    if selected is not None:
        return selected

    preferred_corrected_targets = [
        f"{target}_tab-clust.tsv".lower()
        for target in (
            list(NIMARE_CLUSTER_TABLE_TARGET_NAME["fwe_montecarlo"]["pairwise_mass"])
            + list(NIMARE_CLUSTER_TABLE_TARGET_NAME["fwe_montecarlo"]["single_mass"])
            + list(NIMARE_CLUSTER_TABLE_TARGET_NAME["fwe_montecarlo"]["pairwise_size"])
            + list(NIMARE_CLUSTER_TABLE_TARGET_NAME["fwe_montecarlo"]["single_size"])
        )
    ]
    selected = _select_by_suffixes(preferred_corrected_targets)
    if selected is not None:
        return selected

    corrected_tables = [
        path
        for name, path in named_paths
        if "_corr-" in name and name.endswith("_tab-clust.tsv")
    ]
    if corrected_tables:
        return corrected_tables[0]
    return None


def create_neurovault_collection(nv_collection):
    import flask
    from pynv import Client

    meta_analysis = nv_collection.result.meta_analysis

    def build_collection_name(base_name, created_at, suffix_number, max_length):
        suffix = "" if suffix_number is None else f" ({suffix_number})"
        tail = f" : {created_at}{suffix}"
        if max_length <= 0:
            return (base_name or "") + tail
        base_name = base_name or "Untitled"
        remaining = max_length - len(tail)
        if remaining <= 0:
            return tail[-max_length:]
        if len(base_name) > remaining:
            base_name = base_name[:remaining].rstrip() or "Untitled"
        return base_name + tail

    created_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    base_name = getattr(meta_analysis, "name", None) or "Untitled"
    max_length = int(current_app.config["NEUROVAULT_COLLECTION_NAME_MAX_LEN"])
    max_suffix = int(current_app.config["NEUROVAULT_COLLECTION_CREATE_MAX_SUFFIX"])
    name_length_candidates = [max_length] + [
        fallback for fallback in (200, 150, 120, 100, 80) if fallback < max_length
    ]

    url = f"{flask.request.host_url.rstrip('/')}/meta-analyses/{meta_analysis.id}"
    last_exception = None
    last_attempted_name = None
    try:
        api = Client(access_token=current_app.config["NEUROVAULT_ACCESS_TOKEN"])
        tried_names = set()
        for suffix_number in [None, *range(1, max_suffix + 1)]:
            for name_length in name_length_candidates:
                collection_name = build_collection_name(
                    base_name=base_name,
                    created_at=created_at,
                    suffix_number=suffix_number,
                    max_length=name_length,
                )
                if collection_name in tried_names:
                    continue
                tried_names.add(collection_name)
                last_attempted_name = collection_name
                try:
                    collection = api.create_collection(
                        collection_name,
                        description=meta_analysis.description,
                        full_dataset_url=url,
                    )
                    nv_collection.collection_id = collection["id"]
                    return nv_collection
                except Exception as exception:  # noqa: BLE001
                    last_exception = exception
                    current_app.logger.warning(
                        "Neurovault collection create failed for name=%r: %s",
                        collection_name,
                        str(exception),
                    )
    except Exception as exception:  # noqa: BLE001
        last_exception = exception

    abort(
        422,
        (
            "Error creating Neurovault collection after retries. "
            f"Last attempted name: {last_attempted_name}. "
            f"Last error: {last_exception}"
        ),
    )


def create_or_update_neurostore_study(ns_study):
    from auth0.authentication.get_token import GetToken

    from neurosynth_compose.resources.neurostore import neurostore_session

    access_token = request.headers.get("Authorization")
    if not access_token:
        domain = current_app.config["AUTH0_BASE_URL"].lstrip("https://")
        g_token = GetToken(
            domain,
            current_app.config["AUTH0_CLIENT_ID"],
            client_secret=current_app.config["AUTH0_CLIENT_SECRET"],
        )
        token_resp = g_token.client_credentials(
            audience=current_app.config["AUTH0_API_AUDIENCE"],
        )
        access_token = " ".join([token_resp["token_type"], token_resp["access_token"]])

    ns_ses = neurostore_session(access_token)
    study_data = {
        "name": getattr(ns_study.project, "name", "Untitled"),
        "description": getattr(ns_study.project, "description", None),
        "level": "meta",
    }

    try:
        if ns_study.neurostore_id:
            ns_ses.put(f"/api/studies/{ns_study.neurostore_id}", json=study_data)
        else:
            ns_study_res = ns_ses.post("/api/studies/", json=study_data)
            ns_study.neurostore_id = ns_study_res.json()["id"]
        ns_study.status = "OK"
        ns_study.exception = None
        ns_study.traceback = None
    except Exception as exception:  # noqa: BLE001
        import traceback

        ns_study.exception = str(exception)
        ns_study.traceback = traceback.format_exc()
        ns_study.status = "FAILED"

    return ns_study


def parse_upload_files(result, stat_maps, cluster_tables, diagnostic_tables):
    records = []
    file_dir = pathlib.Path(current_app.config["FILE_DIR"], result.id)
    file_dir.mkdir(parents=True, exist_ok=True)

    stat_map_fnames = {}
    for stat_map in stat_maps:
        map_path = file_dir / stat_map.filename
        stat_map.save(map_path)
        stat_map_fnames[map_path] = NeurovaultFile()

    cluster_table_fnames = []
    for cluster_table in cluster_tables:
        cluster_path = file_dir / cluster_table.filename
        cluster_table.save(cluster_path)
        cluster_table_fnames.append(cluster_path)

    diagnostic_table_fnames = []
    for diagnostic_table in diagnostic_tables:
        diagnostic_path = file_dir / diagnostic_table.filename
        diagnostic_table.save(diagnostic_path)
        diagnostic_table_fnames.append(diagnostic_path)

    if result.neurovault_collection:
        nv_collection = result.neurovault_collection
    else:
        nv_collection = NeurovaultCollection(result=result)
        create_neurovault_collection(nv_collection)
        existing = db.session.execute(
            select(NeurovaultCollection).where(
                NeurovaultCollection.collection_id == nv_collection.collection_id
            )
        ).scalar_one_or_none()
        if existing is not None:
            nv_collection = existing
            nv_collection.result = result
        else:
            records.append(nv_collection)

    for record in stat_map_fnames.values():
        record.neurovault_collection = nv_collection
        records.append(record)

    return records, stat_map_fnames, cluster_table_fnames, diagnostic_table_fnames


def ensure_canonical_studyset(
    session, snapshot, user_id=None, neurostore_id=None, version=None
):
    """Return the canonical Studyset for *snapshot*, inserting one if needed.

    Uses INSERT … ON CONFLICT DO NOTHING so concurrent callers with identical
    snapshots always converge on the same row.  Returns None when snapshot is falsy.
    """
    if not snapshot:
        return None

    ss_md5 = md5_of_snapshot(snapshot)

    canonical = session.execute(
        select(SnapshotStudyset).where(SnapshotStudyset.md5 == ss_md5)
    ).scalar_one_or_none()

    if canonical is None:
        stmt = (
            pg_insert(SnapshotStudyset.__table__)
            .values(
                id=generate_id(),
                snapshot=snapshot,
                md5=ss_md5,
                user_id=user_id,
                neurostore_id=neurostore_id,
                version=version,
            )
            .on_conflict_do_nothing(index_elements=["md5"])
        )
        session.execute(stmt)
        session.flush()
        # After ON CONFLICT DO NOTHING + flush the row is guaranteed to exist,
        # whether this insert won or a concurrent one did.
        canonical = session.execute(
            select(SnapshotStudyset).where(SnapshotStudyset.md5 == ss_md5)
        ).scalar_one()

    return canonical


def ensure_canonical_annotation(
    session, snapshot, user_id=None, neurostore_id=None, snapshot_studyset_id=None
):
    """Return the canonical Annotation for *snapshot*, inserting one if needed.

    Works identically to ensure_canonical_studyset but for Annotation rows.
    Returns None when snapshot is falsy.
    """
    if not snapshot:
        return None

    ann_md5 = md5_of_snapshot(snapshot)

    canonical = session.execute(
        select(SnapshotAnnotation).where(SnapshotAnnotation.md5 == ann_md5)
    ).scalar_one_or_none()

    if canonical is None:
        stmt = (
            pg_insert(SnapshotAnnotation.__table__)
            .values(
                id=generate_id(),
                snapshot=snapshot,
                md5=ann_md5,
                user_id=user_id,
                neurostore_id=neurostore_id,
                snapshot_studyset_id=snapshot_studyset_id,
            )
            .on_conflict_do_nothing(index_elements=["md5"])
        )
        session.execute(stmt)
        session.flush()
        # After ON CONFLICT DO NOTHING + flush the row is guaranteed to exist,
        # whether this insert won or a concurrent one did.
        canonical = session.execute(
            select(SnapshotAnnotation).where(SnapshotAnnotation.md5 == ann_md5)
        ).scalar_one()

    return canonical
