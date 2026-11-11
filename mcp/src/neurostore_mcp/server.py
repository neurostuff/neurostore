"""The read-only Neurostore and Compose MCP server."""

from __future__ import annotations

import argparse
from typing import Annotated, Any, Literal

from fastmcp import FastMCP
from pydantic import Field

from neurostore_mcp import __version__, shape
from neurostore_mcp.client import request

INSTRUCTIONS = """\
Read-only access to Neurostore (neurostore.org), a database of neuroimaging papers with
their reported coordinates, analyses and extracted study features, and to Neurosynth
Compose (compose.neurosynth.org), where users build and run meta-analyses over Neurostore
studysets.

Vocabulary: a *base study* is one paper; it has one or more *study* versions (the
neurostore copy, a pubmed or neurosynth import, user clones). A study has *analyses*
(contrasts), each with *points* (peak coordinates) and/or images. A *studyset* is a list of
studies; an *annotation* labels each analysis in a studyset. A Compose *project* holds
*meta-analyses*, each a specification run over a studyset snapshot, producing *results*
(maps on NeuroVault).

Start with search_base_studies or query_analyses; drill down with get_base_study and
get_study. List tools page their results: pass `page` to continue while `next_page` is set.
"""

mcp = FastMCP("neurostore", instructions=INSTRUCTIONS, version=__version__)

READ_ONLY = {
    "readOnlyHint": True,
    "destructiveHint": False,
    "idempotentHint": True,
    "openWorldHint": True,
}

Page = Annotated[int, Field(ge=1, description="Page number, from 1.")]
PageSize = Annotated[int, Field(ge=1, le=50, description="Results per page (at most 50).")]
Id = Annotated[
    str,
    Field(min_length=1, description="The record's Neurostore or Compose id, e.g. 'cTgsCR4mf54E'."),
]
AbstractChars = Annotated[
    int,
    Field(
        ge=0,
        le=5000,
        description="Characters of each abstract to include; 0 leaves abstracts out.",
    ),
]


# --- Neurostore: papers and studies -------------------------------------------------


@mcp.tool(annotations=READ_ONLY)
async def search_base_studies(
    search: Annotated[
        str | None,
        Field(
            description="Words to find in title and abstract; whole words after stemming, "
            "all must match."
        ),
    ] = None,
    authors: Annotated[str | None, Field(description="Text to find in the author list.")] = None,
    journal: Annotated[str | None, Field(description="Text to find in the journal name.")] = None,
    year_min: Annotated[
        int | None, Field(description="Earliest publication year (inclusive).")
    ] = None,
    year_max: Annotated[
        int | None, Field(description="Latest publication year (inclusive).")
    ] = None,
    doi: Annotated[str | None, Field(description="Exact DOI.")] = None,
    pmid: Annotated[str | None, Field(description="Exact PubMed id.")] = None,
    data_type: Annotated[
        Literal["coordinate", "image", "both"] | None,
        Field(description="Only papers with coordinates, images, or both."),
    ] = None,
    level: Annotated[
        Literal["group", "meta"] | None,
        Field(description="'group' for primary studies, 'meta' for meta-analyses."),
    ] = None,
    x: Annotated[
        float | None, Field(description="MNI x of a sphere; needs y, z and radius.")
    ] = None,
    y: Annotated[float | None, Field(description="MNI y of a sphere.")] = None,
    z: Annotated[float | None, Field(description="MNI z of a sphere.")] = None,
    radius: Annotated[
        float | None, Field(description="Sphere radius in mm: papers with a point inside.")
    ] = None,
    sort: Annotated[
        Literal["year", "name", "created_at"] | None,
        Field(description="Field to sort on (default: relevance/created)."),
    ] = None,
    desc: Annotated[bool, Field(description="Sort descending.")] = True,
    abstract_chars: AbstractChars = 300,
    page: Page = 1,
    page_size: PageSize = 10,
) -> dict[str, Any]:
    """Search Neurostore papers (base studies), one record per paper.

    Each result has the paper's bibliographic fields, whether it has coordinates or images,
    and `study_ids`, its study versions; pass one to get_study for analyses and coordinates.
    """
    body = await request(
        "neurostore",
        "GET",
        "/base-studies/",
        params={
            "search": search,
            "authors": authors,
            "publication": journal,
            "year_min": year_min,
            "year_max": year_max,
            "doi": doi,
            "pmid": pmid,
            "data_type": data_type,
            "level": level,
            "x": x,
            "y": y,
            "z": z,
            "radius": radius,
            "sort": sort,
            "desc": desc if sort else None,
            "page": page,
            "page_size": page_size,
        },
    )
    return shape.page(
        body, [shape.base_study(r, abstract_chars) for r in body["results"]], page, page_size
    )


@mcp.tool(annotations=READ_ONLY)
async def get_base_study(
    base_study_id: Id,
    abstract_chars: AbstractChars = 2000,
) -> dict[str, Any]:
    """Get one paper (base study): its bibliographic fields, abstract, other identifiers
    (preprint and alternative DOIs/PMIDs) and its study versions with their source and owner.
    """
    record = await request(
        "neurostore", "GET", f"/base-studies/{base_study_id}", params={"nested": True}
    )
    out = shape.paper(record, abstract_chars)
    out.update(
        shape.drop_empty(
            {
                "is_oa": record.get("is_oa"),
                "publication_status": record.get("publication_status"),
                "preprint_dois": record.get("preprint_dois"),
                "alternative_dois": record.get("alternative_dois"),
                "alternative_pmids": record.get("alternative_pmids"),
            }
        )
    )
    out["studies"] = [
        shape.drop_empty(
            {
                "id": v.get("id"),
                "source": v.get("source"),
                "owner": v.get("username"),
                "n_analyses": len(v.get("analyses") or []),
                "has_coordinates": v.get("has_coordinates"),
                "has_images": v.get("has_images"),
                "updated_at": v.get("updated_at"),
            }
        )
        for v in record.get("versions") or []
        if isinstance(v, dict)
    ]
    return out


@mcp.tool(annotations=READ_ONLY)
async def search_studies(
    search: Annotated[
        str | None, Field(description="Words to find in title and abstract.")
    ] = None,
    authors: Annotated[str | None, Field(description="Text to find in the author list.")] = None,
    doi: Annotated[str | None, Field(description="Exact DOI.")] = None,
    pmid: Annotated[str | None, Field(description="Exact PubMed id.")] = None,
    source: Annotated[
        Literal["neurostore", "neurovault", "pubmed", "neurosynth", "neuroquery", "pubget"] | None,
        Field(description="Only study versions imported from this source."),
    ] = None,
    user_id: Annotated[
        str | None, Field(description="Only studies owned by this user id.")
    ] = None,
    data_type: Annotated[Literal["coordinate", "image", "both"] | None, Field()] = None,
    level: Annotated[Literal["group", "meta"] | None, Field()] = None,
    abstract_chars: AbstractChars = 0,
    page: Page = 1,
    page_size: PageSize = 10,
) -> dict[str, Any]:
    """Search study versions. Several studies can share one paper (base study); use this
    when the source or owner of a version matters, otherwise prefer search_base_studies.
    """
    body = await request(
        "neurostore",
        "GET",
        "/studies/",
        params={
            "search": search,
            "authors": authors,
            "doi": doi,
            "pmid": pmid,
            "source": source,
            "user_id": user_id,
            "data_type": data_type,
            "level": level,
            "page": page,
            "page_size": page_size,
            "flat": True,
        },
    )
    return shape.page(
        body, [shape.study(r, abstract_chars) for r in body["results"]], page, page_size
    )


@mcp.tool(annotations=READ_ONLY)
async def get_study(
    study_id: Id,
    max_points_per_analysis: Annotated[
        int,
        Field(
            ge=0,
            le=1000,
            description="Coordinates to list per analysis; 0 lists none (counts stay).",
        ),
    ] = 100,
    abstract_chars: AbstractChars = 1000,
) -> dict[str, Any]:
    """Get one study with its analyses (contrasts) and their coordinates.

    Each analysis has its name, metadata (e.g. sample size), conditions, images, `n_points`
    and `points` as {xyz, space, values, cluster_size}; `points_truncated` marks a list cut
    to `max_points_per_analysis`.
    """
    record = await request("neurostore", "GET", f"/studies/{study_id}", params={"nested": True})
    out = shape.study(record, abstract_chars)
    analyses = sorted(record.get("analyses") or [], key=lambda a: a.get("order") or 0)
    out["analyses"] = [shape.analysis(a, max_points_per_analysis) for a in analyses]
    return out


# --- Neurostore: analysis queries over extracted features --------------------------

QUERY_DESCRIPTION = """\
Criteria on each analysis's extracted features (study_schema paths); all optional, combined
with AND; `or` takes a list of sub-queries.
Top-level criteria: name, medical_condition, has_patients, has_healthy, species, task,
spatial_scope, coordinate_space, measure_type, measure_family, details_type,
is_meta_analysis, n {min,max}, has_coordinates, role, contrast {positive, negative, key, set,
kind, groups}, design {allocation, assignment_structure, blinding, arm_kind, longitudinal},
acquisitions {modality, magnetic_field_strength_tesla, repetition_time_seconds,
echo_time_seconds, acquisition_voxel_size_mm, device}, groups {age_mean, age_minimum,
age_maximum, female_percent, handedness, enrolled_count, diagnostic_system, ...},
inference_settings {multiple_comparison_method, correction_scope, tfce_used, ...},
model_estimation {software, model_type, ...}, preprocessing {smoothing_fwhm_mm, software},
regions {name, atlas, region_type}, tasks {stimulus_modality, response_modality, design_type},
coordinate_sets {role, result_kind}, details {connectivity_method, seed_regions}, effect.
Value forms: a value or list (any of them), or {"any"|"all"|"none": [...]}; numbers take
{"min", "max"}; normalized criteria (medical_condition, task, contrast.key, contrast.set)
take {"ids": [...], "text": [...]} where ids come from list_analysis_terms and text is a
whole-word pattern ("*" wildcard, at least 3 letters). Add "when_silent": "include" to keep
analyses whose record says nothing on a criterion.
Examples: {"task": {"text": "n-back"}, "species": "human"};
{"medical_condition": {"ids": ["schizophrenia"]}, "acquisitions": {"modality": "fmri"}};
{"groups": {"age_mean": {"min": 60}}, "has_coordinates": true}."""


@mcp.tool(annotations=READ_ONLY)
async def query_analyses(
    query: Annotated[dict[str, Any], Field(description=QUERY_DESCRIPTION)],
    base_study_ids: Annotated[
        list[str] | None,
        Field(
            description="Only analyses of these papers; with an empty query, lists all their "
            "analyses' features."
        ),
    ] = None,
    study_ids: Annotated[
        list[str] | None, Field(description="Only analyses of these studies.")
    ] = None,
    detail: Annotated[
        Literal["studies", "analyses", "features"],
        Field(
            description="'studies': ids only; 'analyses': also each selected analysis's id, "
            "name and how it matched; 'features': also its extracted features (about 2 KB "
            "per analysis)."
        ),
    ] = "analyses",
    funnel: Annotated[
        bool,
        Field(
            description="Also report how many analyses and papers each criterion keeps and drops."
        ),
    ] = False,
    page: Page = 1,
    page_size: PageSize = 10,
) -> dict[str, Any]:
    """Select analyses by what their papers' extraction records say (task, condition,
    sample, acquisition, statistics, ...) and list the studies that have them.

    Read-only: nothing is stored. Returns `total` studies and `analysis_count` analyses
    over all pages, the canonical `query`, and per study its `study` id, `base_study` id
    and selected analyses. With `funnel`, `searched` and `funnel` say what each criterion
    dropped, useful for loosening a query that finds too little. Get coordinates for a
    result with get_study(study).
    """
    if detail == "features" and page_size > 20:
        page_size = 20
    payload: dict[str, Any] = {
        "query": query,
        "page": page,
        "page_size": page_size,
        "detail": detail,
    }
    if base_study_ids:
        payload["base_study_ids"] = base_study_ids
    if study_ids:
        payload["study_ids"] = study_ids
    if funnel:
        payload["funnel"] = True
    body = await request("neurostore", "POST", "/analysis-queries/", json=payload)
    out = shape.page(body, body.get("results") or [], page, page_size)
    out["analysis_count"] = (body.get("metadata") or {}).get("analysis_count")
    out["query"] = body.get("query")
    for key in ("searched", "funnel"):
        if key in body:
            out[key] = body[key]
    return out


@mcp.tool(annotations=READ_ONLY)
async def list_analysis_terms(
    field: Annotated[
        Literal[
            "medical_condition",
            "task",
            "task_family",
            "contrast_key",
            "contrast_set",
            "contrast_positive_facet",
            "contrast_negative_facet",
            "arm_kind",
            "species",
            "spatial_scope",
            "measure_type",
            "measure_family",
            "details_type",
            "effect_kind",
            "allocation",
            "assignment_structure",
            "blinding",
            "groups.handedness",
            "inference_settings.correction_scope",
            "acquisitions.modality",
            "model_estimation.terms.type",
            "effect.statistic.family",
            "details.connectivity_method",
            "details.inference_target",
            "regions.region_type",
            "regions.definition_method",
            "coordinate_sets.role",
            "coordinate_sets.result_kind",
            "coordinate_sets.anchor_kind",
            "tasks.stimulus_modality",
            "tasks.response_modality",
            "tasks.design_type",
        ],
        Field(description="The query_analyses field whose values to list."),
    ],
    search: Annotated[
        str | None,
        Field(description="Keep values whose id, label or a synonym contains this text."),
    ] = None,
    parent: Annotated[
        str | None, Field(description="Keep values directly under this term id.")
    ] = None,
    limit: Annotated[int, Field(ge=1, le=200)] = 25,
) -> dict[str, Any]:
    """List the values a query_analyses field takes, most common first, each with its id
    (`value`), label, parent, children, synonyms and how many analyses and papers carry it.
    Use it to find the ids for a normalized criterion, e.g. field='task', search='stroop'.
    """
    body = await request(
        "neurostore",
        "GET",
        "/analysis-terms/",
        params={"field": field, "search": search, "parent": parent, "limit": limit},
    )
    return {"field": field, "results": body.get("results") or []}


# --- Neurostore: public aggregate queries ------------------------------------------


@mcp.tool(annotations=READ_ONLY)
async def list_public_datasets() -> dict[str, Any]:
    """List the datasets run_public_query can read, with each one's description and columns."""
    body = await request("neurostore", "GET", "/query/")
    return {
        "refreshed_at": body.get("refreshed_at"),
        "datasets": [
            {
                "name": d.get("name"),
                "description": d.get("description"),
                "columns": {c["name"]: c["type"] for c in d.get("columns") or []},
            }
            for d in body.get("results") or []
        ],
    }


@mcp.tool(annotations=READ_ONLY)
async def run_public_query(
    dataset: Annotated[
        str, Field(description="A dataset name from list_public_datasets, e.g. 'base-studies'.")
    ],
    select: Annotated[
        str | None,
        Field(description='SoQL $select, e.g. "journal, count(*) AS n". Default: all columns.'),
    ] = None,
    where: Annotated[
        str | None, Field(description='SoQL $where, e.g. "year >= 2020 AND has_coordinates".')
    ] = None,
    group: Annotated[str | None, Field(description='SoQL $group, e.g. "journal".')] = None,
    having: Annotated[str | None, Field(description="SoQL $having over aggregates.")] = None,
    order: Annotated[str | None, Field(description='SoQL $order, e.g. "n DESC".')] = None,
    q: Annotated[
        str | None, Field(description="Words to find in titles and abstracts (base-studies only).")
    ] = None,
    limit: Annotated[int, Field(ge=1, le=500)] = 50,
    offset: Annotated[int, Field(ge=0)] = 0,
) -> dict[str, Any]:
    """Run an aggregate query (a subset of Socrata SoQL) over a public Neurostore dataset:
    counts, groupings and filters over papers, journals, authors, data sources and more.
    Operators: = != < <= > >= + -, AND OR NOT, IS [NOT] NULL, [NOT] IN (...), BETWEEN,
    LIKE, starts_with(col, 'x'); aggregates count(*), count(col), count(distinct col),
    sum, avg, min, max. Returns `columns` and `rows`.
    """
    body = await request(
        "neurostore",
        "GET",
        f"/query/{dataset}",
        params={
            "$select": select,
            "$where": where,
            "$group": group,
            "$having": having,
            "$order": order,
            "$q": q,
            "$limit": limit,
            "$offset": offset,
        },
    )
    return {
        k: body.get(k)
        for k in ("dataset", "query", "columns", "rows", "limit", "offset", "refreshed_at")
    }


# --- Neurostore: studysets and annotations -----------------------------------------


@mcp.tool(annotations=READ_ONLY)
async def get_studyset(
    studyset_id: Id,
    page: Page = 1,
    page_size: Annotated[int, Field(ge=1, le=200, description="Study ids per page.")] = 100,
) -> dict[str, Any]:
    """Get a studyset (a curated list of studies, e.g. a Compose project's input): its name,
    description, owner and a page of its study ids.
    """
    record = await request("neurostore", "GET", f"/studysets/{studyset_id}")
    out = shape.drop_empty(
        {
            "id": record.get("id"),
            "name": record.get("name"),
            "description": shape.truncate(record.get("description"), 1000),
            "owner": record.get("username"),
            "doi": record.get("doi"),
            "pmid": record.get("pmid"),
            "created_at": record.get("created_at"),
            "updated_at": record.get("updated_at"),
        }
    )
    out["study_ids"] = shape.slice_page(record.get("studies") or [], page, page_size)
    return out


@mcp.tool(annotations=READ_ONLY)
async def list_annotations(
    studyset_id: Annotated[
        str | None, Field(description="Only annotations of this studyset.")
    ] = None,
    page: Page = 1,
    page_size: PageSize = 10,
) -> dict[str, Any]:
    """List annotations (per-analysis labels over a studyset, such as an 'included' column),
    each with its studyset, its columns (`note_keys`) and how many notes it has.
    """
    body = await request(
        "neurostore",
        "GET",
        "/annotations/",
        params={"studyset_id": studyset_id, "page": page, "page_size": page_size},
    )
    results = [
        shape.drop_empty(
            {
                "id": a.get("id"),
                "name": a.get("name"),
                "description": shape.truncate(a.get("description"), 300),
                "owner": a.get("username"),
                "studyset_id": a.get("studyset"),
                "note_keys": a.get("note_keys"),
                "n_notes": len(a.get("notes") or []),
                "created_at": a.get("created_at"),
            }
        )
        for a in body.get("results") or []
    ]
    return shape.page(body, results, page, page_size)


@mcp.tool(annotations=READ_ONLY)
async def get_annotation(
    annotation_id: Id,
    page: Page = 1,
    page_size: Annotated[int, Field(ge=1, le=200, description="Notes per page.")] = 50,
) -> dict[str, Any]:
    """Get an annotation: its columns (`note_keys` with types) and a page of its notes, one
    per analysis, each with the analysis and study ids and names and the note's values.
    """
    record = await request("neurostore", "GET", f"/annotations/{annotation_id}")
    notes = [
        shape.drop_empty(
            {
                "analysis_id": n.get("analysis"),
                "analysis_name": shape.truncate(n.get("analysis_name"), 200),
                "study_id": n.get("study"),
                "study_name": shape.truncate(n.get("study_name"), 200),
                "study_year": n.get("study_year"),
                "note": n.get("note"),
            }
        )
        for n in record.get("notes") or []
    ]
    out = shape.drop_empty(
        {
            "id": record.get("id"),
            "name": record.get("name"),
            "description": shape.truncate(record.get("description"), 1000),
            "owner": record.get("username"),
            "studyset_id": record.get("studyset"),
            "note_keys": record.get("note_keys"),
            "metadata": record.get("metadata"),
        }
    )
    out["notes"] = shape.slice_page(notes, page, page_size)
    return out


# --- Compose: projects, meta-analyses, results -------------------------------------


@mcp.tool(annotations=READ_ONLY)
async def search_projects(
    search: Annotated[
        str | None, Field(description="Text to find in the project's name or description.")
    ] = None,
    user_id: Annotated[
        str | None, Field(description="Only projects owned by this user id.")
    ] = None,
    tag: Annotated[
        list[str] | None, Field(description="Only projects carrying every one of these tags.")
    ] = None,
    sort: Annotated[Literal["created_at", "updated_at", "name"] | None, Field()] = None,
    desc: Annotated[bool, Field(description="Sort descending.")] = True,
    page: Page = 1,
    page_size: PageSize = 10,
) -> dict[str, Any]:
    """Search public Neurosynth Compose projects. Each has its meta-analysis ids and the
    Neurostore studyset and annotation it draws on.
    """
    body = await request(
        "compose",
        "GET",
        "/projects",
        params={
            "search": search,
            "user_id": user_id,
            "tag": tag,
            "sort": sort,
            "desc": desc if sort else None,
            "page": page,
            "page_size": page_size,
        },
    )
    return shape.page(body, [shape.project(r) for r in body["results"]], page, page_size)


@mcp.tool(annotations=READ_ONLY)
async def get_project(project_id: Id) -> dict[str, Any]:
    """Get a Compose project with its full description, meta-analysis ids and the Neurostore
    studyset and annotation it draws on.
    """
    record = await request("compose", "GET", f"/projects/{project_id}")
    return shape.project(record, description_chars=4000)


@mcp.tool(annotations=READ_ONLY)
async def get_meta_analysis(meta_analysis_id: Id) -> dict[str, Any]:
    """Get a Compose meta-analysis: its specification (CBMA/IBMA type, NiMARE estimator and
    corrector with arguments, the annotation column filtering analyses), the Neurostore
    studyset and annotation it reads, and the ids of its results, newest last.
    """
    record = await request(
        "compose", "GET", f"/meta-analyses/{meta_analysis_id}", params={"nested": True}
    )
    return shape.meta_analysis(record)


@mcp.tool(annotations=READ_ONLY)
async def get_meta_analysis_result(
    result_id: Id,
    diagnostic_chars: Annotated[
        int,
        Field(
            ge=0,
            le=100000,
            description="Characters of the diagnostic (contribution) table to include.",
        ),
    ] = 0,
) -> dict[str, Any]:
    """Get one run of a meta-analysis: its NeuroVault collection and maps (z, p, ... with
    URLs), the methods text and references NiMARE wrote, and the studyset and annotation
    snapshots it ran on. The diagnostic table is withheld unless `diagnostic_chars` > 0.
    """
    record = await request("compose", "GET", f"/meta-analysis-results/{result_id}")
    return shape.meta_analysis_result(record, diagnostic_chars)


def main() -> None:
    parser = argparse.ArgumentParser(prog="neurostore-mcp", description=__doc__)
    parser.add_argument("--transport", choices=["stdio", "http"], default="stdio")
    parser.add_argument("--host", default="127.0.0.1", help="HTTP bind address.")
    parser.add_argument("--port", type=int, default=8000, help="HTTP port.")
    parser.add_argument("--path", default="/mcp", help="HTTP endpoint path.")
    args = parser.parse_args()
    if args.transport == "stdio":
        mcp.run("stdio", show_banner=False)
    else:
        mcp.run("http", host=args.host, port=args.port, path=args.path, show_banner=False)


if __name__ == "__main__":
    main()
