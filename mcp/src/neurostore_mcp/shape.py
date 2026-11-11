"""Compact projections of API records, so responses fit an agent's context."""

from __future__ import annotations

from typing import Any

ABSTRACT_CHARS = 400


def truncate(text: str | None, limit: int) -> str | None:
    if text is None:
        return None
    text = text.strip()
    return text if len(text) <= limit else text[:limit].rstrip() + "…"


def drop_empty(record: dict[str, Any]) -> dict[str, Any]:
    """Drop keys whose value is None, an empty list or an empty dict."""
    return {k: v for k, v in record.items() if v is not None and v != [] and v != {}}


def page(
    body: dict[str, Any], results: list[Any], page_number: int, page_size: int
) -> dict[str, Any]:
    """The paging envelope every list tool returns."""
    total = (body.get("metadata") or {}).get("total_count")
    more = total is not None and page_number * page_size < total
    return {
        "total": total,
        "page": page_number,
        "page_size": page_size,
        "next_page": page_number + 1 if more else None,
        "results": results,
    }


def slice_page(items: list[Any], page_number: int, page_size: int) -> dict[str, Any]:
    """Page a list the API returns whole."""
    start = (page_number - 1) * page_size
    return page(
        {"metadata": {"total_count": len(items)}},
        items[start : start + page_size],
        page_number,
        page_size,
    )


def journal(record: dict[str, Any]) -> str | None:
    j = record.get("journal")
    if isinstance(j, dict):
        return j.get("title") or j.get("abbreviation")
    return record.get("publication")


def paper(record: dict[str, Any], abstract_chars: int = ABSTRACT_CHARS) -> dict[str, Any]:
    """The bibliographic fields shared by base studies and studies."""
    return drop_empty(
        {
            "id": record.get("id"),
            "name": record.get("name"),
            "authors": truncate(record.get("authors"), 200),
            "year": record.get("year"),
            "journal": journal(record),
            "doi": record.get("doi"),
            "pmid": record.get("pmid"),
            "pmcid": record.get("pmcid"),
            "level": record.get("level"),
            "has_coordinates": record.get("has_coordinates"),
            "has_images": record.get("has_images"),
            "abstract": (
                truncate(record.get("description"), abstract_chars) if abstract_chars else None
            ),
        }
    )


def base_study(record: dict[str, Any], abstract_chars: int = ABSTRACT_CHARS) -> dict[str, Any]:
    out = paper(record, abstract_chars)
    versions = record.get("versions") or []
    out["study_ids"] = [v["id"] if isinstance(v, dict) else v for v in versions]
    return out


def study(record: dict[str, Any], abstract_chars: int = ABSTRACT_CHARS) -> dict[str, Any]:
    out = paper(record, abstract_chars)
    out.update(
        drop_empty(
            {
                "base_study_id": record.get("base_study"),
                "source": record.get("source"),
                "owner": record.get("username"),
            }
        )
    )
    return out


def point(record: dict[str, Any]) -> dict[str, Any]:
    values = [
        drop_empty({"kind": v.get("kind"), "value": v.get("value")})
        for v in record.get("values") or []
        if isinstance(v, dict)
    ]
    return drop_empty(
        {
            "xyz": record.get("coordinates"),
            "space": record.get("space"),
            "kind": record.get("kind"),
            "values": values,
            "cluster_size": record.get("cluster_size"),
            "subpeak": record.get("subpeak") or None,
            "deactivation": record.get("deactivation") or None,
            "is_seed": record.get("is_seed") or None,
        }
    )


def image(record: dict[str, Any]) -> dict[str, Any]:
    return drop_empty(
        {
            "id": record.get("id"),
            "value_type": record.get("value_type"),
            "space": record.get("space"),
            "url": record.get("url"),
        }
    )


def analysis(record: dict[str, Any], max_points: int) -> dict[str, Any]:
    points = sorted(record.get("points") or [], key=lambda p: p.get("order") or 0)
    out = drop_empty(
        {
            "id": record.get("id"),
            "name": record.get("name"),
            "description": truncate(record.get("description"), 300),
            "role": record.get("role"),
            "metadata": record.get("metadata"),
            "conditions": [
                c.get("name") if isinstance(c, dict) else c for c in record.get("conditions") or []
            ],
            "weights": record.get("weights"),
            "images": [image(i) for i in record.get("images") or [] if isinstance(i, dict)],
        }
    )
    out["n_points"] = len(points)
    shown = [point(p) for p in points[:max_points]]
    spaces = {p.get("space") for p in shown}
    if len(spaces) == 1 and None not in spaces:
        # One space for the whole analysis: say it once.
        out["space"] = spaces.pop()
        for p in shown:
            del p["space"]
    out["points"] = shown
    if len(points) > max_points:
        out["points_truncated"] = True
    return out


def project(record: dict[str, Any], description_chars: int = 400) -> dict[str, Any]:
    return drop_empty(
        {
            "id": record.get("id"),
            "name": record.get("name"),
            "description": truncate(record.get("description"), description_chars),
            "type": record.get("type"),
            "owner": record.get("username"),
            "public": record.get("public"),
            "draft": record.get("draft"),
            "tags": [
                t.get("name") if isinstance(t, dict) else t for t in record.get("tags") or []
            ],
            "meta_analysis_ids": [
                m.get("id") if isinstance(m, dict) else m
                for m in record.get("meta_analyses") or []
            ],
            "neurostore_studyset_id": record.get("neurostore_studyset_id"),
            "neurostore_annotation_id": record.get("neurostore_annotation_id"),
            "created_at": record.get("created_at"),
            "updated_at": record.get("updated_at"),
        }
    )


def meta_analysis(record: dict[str, Any]) -> dict[str, Any]:
    # `run_key` is left out on purpose: it authorizes running the meta-analysis.
    spec = record.get("specification")
    if isinstance(spec, dict):
        spec = drop_empty(
            {
                "id": spec.get("id"),
                "type": spec.get("type"),
                "estimator": spec.get("estimator"),
                "corrector": spec.get("corrector"),
                "filter": spec.get("filter"),
                "conditions": spec.get("conditions"),
                "weights": spec.get("weights"),
                "database_studyset": spec.get("database_studyset"),
            }
        )
    studyset = record.get("neurostore_studyset")
    annotation = record.get("neurostore_annotation")
    return drop_empty(
        {
            "id": record.get("id"),
            "name": record.get("name"),
            "description": truncate(record.get("description"), 600),
            "owner": record.get("username"),
            "project_id": record.get("project"),
            "specification": spec,
            "neurostore_studyset_id": (
                studyset.get("id") if isinstance(studyset, dict) else studyset
            ),
            "neurostore_annotation_id": (
                annotation.get("id") if isinstance(annotation, dict) else annotation
            ),
            "result_ids": [
                r.get("id") if isinstance(r, dict) else r for r in record.get("results") or []
            ],
            "created_at": record.get("created_at"),
            "updated_at": record.get("updated_at"),
        }
    )


def meta_analysis_result(record: dict[str, Any], diagnostic_chars: int) -> dict[str, Any]:
    collection = record.get("neurovault_collection") or {}
    maps = [
        drop_empty(
            {
                "map_type": f.get("map_type"),
                "neurovault_image_id": f.get("image_id"),
                "url": f.get("url"),
                "status": f.get("status"),
            }
        )
        for f in collection.get("files") or []
    ]
    table = record.get("diagnostic_table")
    return drop_empty(
        {
            "id": record.get("id"),
            "meta_analysis_id": record.get("meta_analysis_id"),
            "created_at": record.get("created_at"),
            "cli_version": record.get("cli_version"),
            "neurovault_collection_id": collection.get("collection_id"),
            "neurovault_collection_url": (
                f"https://neurovault.org/collections/{collection['collection_id']}/"
                if collection.get("collection_id")
                else None
            ),
            "maps": maps,
            "method_description": record.get("method_description"),
            "method_references": record.get("method_references"),
            "snapshot_studyset_id": record.get("snapshot_studyset_id"),
            "snapshot_annotation_id": record.get("snapshot_annotation_id"),
            "diagnostic_table": truncate(table, diagnostic_chars) if diagnostic_chars else None,
            "diagnostic_table_chars": len(table) if table else None,
        }
    )
