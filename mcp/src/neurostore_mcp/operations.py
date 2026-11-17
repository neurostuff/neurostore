"""The REST operations the server exposes as tools, and how each is annotated."""

from __future__ import annotations

from mcp.types import ToolAnnotations

# (service, method, path) -> (tool name, description). Anything not listed is not exposed.
# The description leads the tool's; the spec's own description follows it.
OPERATIONS: dict[tuple[str, str, str], tuple[str, str]] = {
    # Neurostore: papers, studies, analyses
    ("store", "GET", "/base-studies/"): (
        "search_base_studies",
        "Search papers (base studies, one per paper) by text, authors, journal, year, DOI/PMID,"
        " data type or an MNI sphere (x, y, z, radius).",
    ),
    ("store", "GET", "/base-studies/{id}"): (
        "get_base_study",
        "Get one paper and its study versions (pass nested=true for their analyses).",
    ),
    ("store", "GET", "/studies/"): (
        "search_studies",
        "Search study versions (several can share one paper), e.g. by source or owner.",
    ),
    ("store", "GET", "/studies/{id}"): (
        "get_study",
        "Get one study with its analyses, coordinates (points), images and metadata (pass "
        "nested=true).",
    ),
    ("store", "POST", "/studies/"): (
        "create_study",
        "Create a study you own; pass source_id to clone an existing study.",
    ),
    ("store", "PUT", "/studies/{id}"): (
        "update_study",
        "Update a study you own, including its analyses and their points.",
    ),
    ("store", "DELETE", "/studies/{id}"): (
        "delete_study",
        "Delete a study you own.",
    ),
    ("store", "GET", "/analyses/{id}"): (
        "get_analysis",
        "Get one analysis (contrast) with its points, images and conditions.",
    ),
    ("store", "POST", "/analyses/"): (
        "create_analysis",
        "Add an analysis to a study you own.",
    ),
    ("store", "PUT", "/analyses/{id}"): (
        "update_analysis",
        "Update an analysis you own, including its points.",
    ),
    ("store", "DELETE", "/analyses/{id}"): (
        "delete_analysis",
        "Delete an analysis you own.",
    ),
    # Neurostore: selecting analyses, public aggregates
    ("store", "POST", "/analysis-queries/"): (
        "query_analyses",
        "Select analyses by their papers' extracted features (task, condition, sample, "
        "acquisition, statistics, ...) and list the studies that have them. Stores nothing.",
    ),
    ("store", "GET", "/analysis-terms/"): (
        "list_analysis_terms",
        "List the values (ids, labels, synonyms, counts) a query_analyses field takes.",
    ),
    ("store", "GET", "/query/"): (
        "list_public_datasets",
        "List the public datasets run_public_query reads, with their columns.",
    ),
    ("store", "GET", "/query/{dataset}"): (
        "run_public_query",
        "Run a SoQL aggregate ($select, $where, $group, $order, ...) over one public dataset.",
    ),
    # Neurostore: studysets and annotations
    ("store", "GET", "/studysets/"): (
        "search_studysets",
        "Search studysets (curated lists of studies).",
    ),
    ("store", "GET", "/studysets/{id}"): (
        "get_studyset",
        "Get a studyset and its studies.",
    ),
    ("store", "POST", "/studysets/"): (
        "create_studyset",
        "Create a studyset you own; pass source_id to copy one.",
    ),
    ("store", "PUT", "/studysets/{id}"): (
        "update_studyset",
        "Update a studyset you own, e.g. its name or its list of studies.",
    ),
    ("store", "DELETE", "/studysets/{id}"): (
        "delete_studyset",
        "Delete a studyset you own.",
    ),
    ("store", "GET", "/annotations/"): (
        "list_annotations",
        "List annotations (per-analysis labels over a studyset), optionally of one studyset.",
    ),
    ("store", "GET", "/annotations/{id}"): (
        "get_annotation",
        "Get an annotation: its columns (note_keys) and one note per analysis.",
    ),
    ("store", "POST", "/annotations/"): (
        "create_annotation",
        "Create an annotation over a studyset you own.",
    ),
    ("store", "PUT", "/annotations/{id}"): (
        "update_annotation",
        "Update an annotation you own: its columns or its notes.",
    ),
    ("store", "DELETE", "/annotations/{id}"): (
        "delete_annotation",
        "Delete an annotation you own.",
    ),
    # Compose: projects, specifications, meta-analyses, runs
    ("compose", "GET", "/projects"): (
        "search_projects",
        "Search Neurosynth Compose projects.",
    ),
    ("compose", "GET", "/projects/{id}"): (
        "get_project",
        "Get a Compose project: its meta-analyses and the Neurostore studyset and annotation it"
        " draws on.",
    ),
    ("compose", "POST", "/projects"): (
        "create_project",
        "Create a Compose project you own, over a Neurostore studyset and annotation.",
    ),
    ("compose", "PUT", "/projects/{id}"): (
        "update_project",
        "Update a Compose project you own.",
    ),
    ("compose", "DELETE", "/projects/{id}"): (
        "delete_project",
        "Delete a Compose project you own.",
    ),
    ("compose", "GET", "/specifications/{id}"): (
        "get_specification",
        "Get a meta-analysis specification: CBMA/IBMA type, NiMARE estimator, corrector and "
        "their arguments, and the annotation column that filters analyses.",
    ),
    ("compose", "POST", "/specifications"): (
        "create_specification",
        "Create a meta-analysis specification.",
    ),
    ("compose", "PUT", "/specifications/{id}"): (
        "update_specification",
        "Update a meta-analysis specification you own.",
    ),
    ("compose", "GET", "/meta-analyses/{id}"): (
        "get_meta_analysis",
        "Get a Compose meta-analysis: its specification, studyset, annotation and results (pass"
        " nested=true).",
    ),
    ("compose", "POST", "/meta-analyses"): (
        "create_meta_analysis",
        "Create a meta-analysis in a project you own, from a specification, studyset and "
        "annotation.",
    ),
    ("compose", "PUT", "/meta-analyses/{id}"): (
        "update_meta_analysis",
        "Update a meta-analysis you own.",
    ),
    ("compose", "GET", "/meta-analysis-results"): (
        "list_meta_analysis_results",
        "List the results (runs) of a meta-analysis.",
    ),
    ("compose", "GET", "/meta-analysis-results/{id}"): (
        "get_meta_analysis_result",
        "Get one run of a meta-analysis: its NeuroVault maps, methods text and the snapshots it"
        " ran on.",
    ),
    ("compose", "POST", "/meta-analysis-jobs"): (
        "run_meta_analysis",
        "Submit a meta-analysis you own to run on Compose's workers.",
    ),
    ("compose", "GET", "/meta-analysis-jobs"): (
        "list_meta_analysis_jobs",
        "List your meta-analysis jobs.",
    ),
    ("compose", "GET", "/meta-analysis-jobs/{job_id}"): (
        "get_meta_analysis_job",
        "Get the status and logs of a meta-analysis job.",
    ),
}

# How many levels of fields a tool's input schema lists (schema.compact); 2 unless named.
# query_analyses gets one more, so its nested criteria (acquisitions.modality,
# groups.age_mean, ...) are listed, not just accepted.
SCHEMA_DEPTH = {"query_analyses": 3}

# POSTs that only read: the analysis query stores nothing.
READ_ONLY_POSTS = {("store", "POST", "/analysis-queries/")}


def reads(service: str, method: str, path: str) -> bool:
    return method == "GET" or (service, method, path) in READ_ONLY_POSTS


def annotations(service: str, method: str, path: str) -> ToolAnnotations:
    """MCP hints, so clients can let reads run and ask before writes."""
    if reads(service, method, path):
        return ToolAnnotations(
            readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=True
        )
    return ToolAnnotations(
        readOnlyHint=False,
        # PUT replaces fields and DELETE removes; POST only adds.
        destructiveHint=method in ("PUT", "DELETE"),
        idempotentHint=method in ("PUT", "DELETE"),
        openWorldHint=True,
    )
