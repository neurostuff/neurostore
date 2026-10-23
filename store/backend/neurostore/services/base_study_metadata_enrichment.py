import datetime as dt
import re
import threading
import time
from dataclasses import dataclass
from typing import NamedTuple
from xml.etree import ElementTree

import requests
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, insert as pg_insert
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import aliased
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from neurostore import corresponding_authors
from neurostore.cache_versioning import bump_cache_versions
from neurostore.database import db
from neurostore.models import (
    BaseStudy,
    BaseStudyFlagOutbox,
    BaseStudyMetadataOutbox,
    Fulltext,
    Pipeline,
    PipelineAnalysisResult,
    PipelineConfig,
    PipelineEmbedding,
    PipelineStudyResult,
    Review,
    ReviewAssignment,
    ReviewSource,
    Study,
    StudyEntity,
    StudysetStudy,
)
from neurostore.models.data import HISTORY_SOURCE, PARSE_PIPELINE, STUDY_SOURCE
from neurostore.models.fulltext import fulltext_preference, refresh_fulltext_pointer
from neurostore.base_studies import article_identifiers, attach_identifiers, held_by
from neurostore.resources.common import merge_unique_ids, normalize_ids
from neurostore.services.has_media_flags import enqueue_base_study_flag_updates

ID_FIELDS = ("pmid", "doi", "pmcid")
METADATA_FIELDS = ("name", "description", "publication", "authors", "year", "is_oa")
STUDY_METADATA_FIELDS = ("name", "description", "publication", "authors", "year")
CONTENT_FIELDS = METADATA_FIELDS + ("ace_fulltext", "pubget_fulltext")
TRANSIENT_HTTP_STATUS = {408, 409, 425, 429, 500, 502, 503, 504}
SEMANTIC_SCHOLAR_DEFAULT_RPS = 1.0
PUBMED_DEFAULT_RPS_WITH_KEY = 10.0
PUBMED_DEFAULT_RPS_WITHOUT_KEY = 3.0
RATE_LIMIT_SAFETY_MARGIN_SECONDS = 0.01


def _has_value(value):
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return True


def _normalize_year(value):
    year = _int_or_none(value)
    if year is None or year <= 0:
        return None
    return year


def _has_metadata_value(field, value):
    if field == "year":
        return _normalize_year(value) is not None
    return _has_value(value)


def _has_text_sql(column):
    return sa.func.nullif(sa.func.btrim(column), "").isnot(None)


def _missing_text_sql(column):
    return sa.or_(column.is_(None), sa.func.btrim(column) == "")


def _normalize_doi(value):
    if not _has_value(value):
        return None
    doi = str(value).strip()
    doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", doi, flags=re.IGNORECASE)
    doi = re.sub(r"^doi:\s*", "", doi, flags=re.IGNORECASE)
    return doi or None


def _normalize_pmid(value):
    if not _has_value(value):
        return None
    pmid = str(value).strip()
    match = re.search(r"pubmed\.ncbi\.nlm\.nih\.gov/(\d+)", pmid, flags=re.IGNORECASE)
    if match:
        pmid = match.group(1)
    digits = re.sub(r"[^0-9]", "", pmid)
    return digits or None


def _normalize_pmcid(value):
    if not _has_value(value):
        return None
    pmcid = str(value).strip().upper()
    match = re.search(r"(PMC\d+)", pmcid, flags=re.IGNORECASE)
    if match:
        pmcid = match.group(1).upper()
    if pmcid.isdigit():
        pmcid = f"PMC{pmcid}"
    if pmcid.startswith("PMC"):
        suffix = pmcid[3:]
        if suffix.isdigit():
            return f"PMC{suffix}"
    return pmcid or None


def _normalize_identifier_dict(values):
    values = values or {}
    return {
        "pmid": _normalize_pmid(values.get("pmid")),
        "doi": _normalize_doi(values.get("doi")),
        "pmcid": _normalize_pmcid(values.get("pmcid")),
    }


def _extract_identifiers(base_study):
    return _normalize_identifier_dict(
        {
            "pmid": base_study.pmid,
            "doi": base_study.doi,
            "pmcid": base_study.pmcid,
        }
    )


def _needs_enrichment(base_study):
    identifiers = _extract_identifiers(base_study)
    has_any_identifier = any(_has_value(identifiers.get(field)) for field in ID_FIELDS)
    if not has_any_identifier:
        return False

    missing_ids = any(not _has_value(identifiers.get(field)) for field in ID_FIELDS)
    missing_metadata = any(
        not _has_metadata_value(field, getattr(base_study, field, None))
        for field in METADATA_FIELDS
    )
    return missing_ids or missing_metadata


def _missing_id_fields(identifiers):
    return {field for field in ID_FIELDS if not _has_value(identifiers.get(field))}


def _missing_metadata_fields(base_study):
    return {
        field
        for field in METADATA_FIELDS
        if not _has_metadata_value(field, getattr(base_study, field, None))
    }


def _remaining_missing_fields(missing_fields, candidate):
    if not missing_fields:
        return set()
    return {
        field
        for field in missing_fields
        if not _has_metadata_value(field, candidate.get(field))
    }


def _is_retryable_request_exception(exc):
    if not isinstance(exc, requests.RequestException):
        return False
    response = getattr(exc, "response", None)
    if response is None:
        return True
    return response.status_code in TRANSIENT_HTTP_STATUS


@retry(
    reraise=True,
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.4, max=2),
    retry=retry_if_exception(_is_retryable_request_exception),
)
def _request_with_retry(settings, method, url, **kwargs):
    _apply_provider_rate_limit(settings, url, kwargs)
    response = requests.request(method, url, **kwargs)
    if response.status_code >= 400:
        error = requests.HTTPError(
            f"{response.status_code} error from {url}", response=response
        )
        raise error
    return response


def _request_timeout(settings):
    timeout = settings.get("BASE_STUDY_METADATA_REQUEST_TIMEOUT_SECONDS", 10)
    try:
        timeout = float(timeout)
    except (TypeError, ValueError):
        timeout = 10.0
    return max(1.0, timeout)


def _retry_delay_seconds(settings):
    delay = settings.get("BASE_STUDY_METADATA_RETRY_DELAY_SECONDS", 30)
    try:
        delay = float(delay)
    except (TypeError, ValueError):
        delay = 30.0
    return max(0.0, delay)


def _provider_error(logger, provider_name, exc):
    logger.warning("base-study metadata provider failed (%s): %s", provider_name, exc)


def _coerce_positive_float(value, default):
    try:
        value = float(value)
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


def _provider_rps_for_request(settings, url, kwargs):
    headers = kwargs.get("headers") or {}
    params = kwargs.get("params") or {}

    if "api.semanticscholar.org" in url:
        if headers.get("x-api-key"):
            rps = _coerce_positive_float(
                settings.get("SEMANTIC_SCHOLAR_API_RPS", SEMANTIC_SCHOLAR_DEFAULT_RPS),
                SEMANTIC_SCHOLAR_DEFAULT_RPS,
            )
            return "semantic_scholar", rps
        return None, None

    if "ncbi.nlm.nih.gov" in url and (
        "/pmc/utils/idconv/" in url or "/entrez/eutils/" in url
    ):
        has_api_key = bool(params.get("api_key"))
        config_key = (
            "PUBMED_API_RPS_WITH_KEY" if has_api_key else "PUBMED_API_RPS_WITHOUT_KEY"
        )
        default_rps = (
            PUBMED_DEFAULT_RPS_WITH_KEY
            if has_api_key
            else PUBMED_DEFAULT_RPS_WITHOUT_KEY
        )
        rps = _coerce_positive_float(settings.get(config_key, default_rps), default_rps)
        provider_name = "pubmed_with_key" if has_api_key else "pubmed_without_key"
        return provider_name, rps

    return None, None


class _ProviderRateLimiter:
    def __init__(self):
        self._lock = threading.Lock()
        self._next_allowed_at = {}

    def reset(self):
        with self._lock:
            self._next_allowed_at.clear()

    def wait(self, provider_name, requests_per_second):
        if not provider_name or not requests_per_second:
            return

        min_interval = (1.0 / requests_per_second) + RATE_LIMIT_SAFETY_MARGIN_SECONDS

        while True:
            with self._lock:
                now = time.monotonic()
                next_allowed_at = self._next_allowed_at.get(provider_name, 0.0)
                if now >= next_allowed_at:
                    self._next_allowed_at[provider_name] = now + min_interval
                    return
                sleep_for = next_allowed_at - now
            time.sleep(sleep_for)


_provider_rate_limiter = _ProviderRateLimiter()


def _reset_provider_rate_limits():
    _provider_rate_limiter.reset()


def _apply_provider_rate_limit(settings, url, kwargs):
    provider_name, requests_per_second = _provider_rps_for_request(
        settings, url, kwargs
    )
    _provider_rate_limiter.wait(provider_name, requests_per_second)


def lookup_ids_semantic_scholar(identifiers, *, settings, logger, api_key=None):
    request_ids = []
    doi = _normalize_doi(identifiers.get("doi"))
    pmid = _normalize_pmid(identifiers.get("pmid"))

    if doi:
        request_ids.append(f"DOI:{doi}")
    if pmid:
        request_ids.append(f"PMID:{pmid}")
    if not request_ids:
        return {}

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["x-api-key"] = api_key

    try:
        response = _request_with_retry(
            settings,
            "POST",
            "https://api.semanticscholar.org/graph/v1/paper/batch",
            params={"fields": "externalIds"},
            json={"ids": request_ids},
            headers=headers,
            timeout=_request_timeout(settings),
        )
        payload = response.json()
    except Exception as exc:  # noqa: BLE001
        _provider_error(logger, "semantic_scholar_id_lookup", exc)
        return {}

    if not isinstance(payload, list):
        return {}

    for record in payload:
        if not isinstance(record, dict):
            continue
        external_ids = record.get("externalIds") or {}
        if not isinstance(external_ids, dict):
            continue
        return _normalize_identifier_dict(
            {
                "doi": external_ids.get("DOI"),
                "pmid": external_ids.get("PubMed"),
                "pmcid": external_ids.get("PubMedCentral"),
            }
        )
    return {}


def lookup_ids_pubmed(
    identifiers, *, settings, logger, email=None, api_key=None, tool="neurostore"
):
    id_values = []
    for value in (
        _normalize_pmid(identifiers.get("pmid")),
        _normalize_doi(identifiers.get("doi")),
        _normalize_pmcid(identifiers.get("pmcid")),
    ):
        if value:
            id_values.append(value)

    if not id_values:
        return {}

    params = {
        "ids": ",".join(sorted(set(id_values))),
        "format": "json",
        "versions": "no",
        "tool": tool or "neurostore",
    }
    if email:
        params["email"] = email
    if api_key:
        params["api_key"] = api_key

    try:
        response = _request_with_retry(
            settings,
            "GET",
            "https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/",
            params=params,
            timeout=_request_timeout(settings),
        )
        payload = response.json()
    except Exception as exc:  # noqa: BLE001
        _provider_error(logger, "pubmed_id_lookup", exc)
        return {}

    records = payload.get("records") if isinstance(payload, dict) else None
    if not isinstance(records, list):
        return {}

    for record in records:
        if not isinstance(record, dict):
            continue
        if record.get("status") and record.get("status") != "ok":
            continue
        return _normalize_identifier_dict(
            {
                "doi": record.get("doi"),
                "pmid": record.get("pmid"),
                "pmcid": record.get("pmcid"),
            }
        )
    return {}


def lookup_ids_openalex(identifiers, *, settings, logger, email=None):
    doi = _normalize_doi(identifiers.get("doi"))
    pmid = _normalize_pmid(identifiers.get("pmid"))

    if doi:
        filter_value = f"doi:https://doi.org/{doi}"
    elif pmid:
        filter_value = f"pmid:{pmid}"
    else:
        return {}

    params = {"filter": filter_value, "per-page": 1}
    if email:
        params["mailto"] = email

    try:
        response = _request_with_retry(
            settings,
            "GET",
            "https://api.openalex.org/works",
            params=params,
            timeout=_request_timeout(settings),
        )
        payload = response.json()
    except Exception as exc:  # noqa: BLE001
        _provider_error(logger, "openalex_id_lookup", exc)
        return {}

    results = payload.get("results") if isinstance(payload, dict) else None
    if not isinstance(results, list) or not results:
        return {}

    ids_block = results[0].get("ids", {})
    if not isinstance(ids_block, dict):
        return {}

    openalex_doi = ids_block.get("doi")
    openalex_pmid = ids_block.get("pmid")
    openalex_pmcid = ids_block.get("pmcid")
    return _normalize_identifier_dict(
        {
            "doi": openalex_doi,
            "pmid": openalex_pmid,
            "pmcid": openalex_pmcid,
        }
    )


def _joined_text(element):
    if element is None:
        return None
    text = "".join(element.itertext()).strip()
    return text or None


def _int_or_none(value):
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        match = re.search(r"\b(\d{4})\b", str(value))
        if not match:
            return None
        return int(match.group(1))


def fetch_metadata_semantic_scholar(identifiers, *, settings, logger, api_key=None):
    request_ids = []
    doi = _normalize_doi(identifiers.get("doi"))
    pmid = _normalize_pmid(identifiers.get("pmid"))
    if doi:
        request_ids.append(f"DOI:{doi}")
    if pmid:
        request_ids.append(f"PMID:{pmid}")
    if not request_ids:
        return {}

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["x-api-key"] = api_key

    fields = ",".join(
        [
            "title",
            "abstract",
            "venue",
            "year",
            "authors",
            "isOpenAccess",
            "journal",
            "externalIds",
        ]
    )

    try:
        response = _request_with_retry(
            settings,
            "POST",
            "https://api.semanticscholar.org/graph/v1/paper/batch",
            params={"fields": fields},
            json={"ids": request_ids},
            headers=headers,
            timeout=_request_timeout(settings),
        )
        payload = response.json()
    except Exception as exc:  # noqa: BLE001
        _provider_error(logger, "semantic_scholar_metadata", exc)
        return {}

    if not isinstance(payload, list):
        return {}

    for record in payload:
        if not isinstance(record, dict):
            continue
        external_ids = record.get("externalIds") or {}
        journal = record.get("journal") or {}
        authors = record.get("authors") or []

        author_names = []
        if isinstance(authors, list):
            for author in authors:
                if isinstance(author, dict) and _has_value(author.get("name")):
                    author_names.append(author["name"].strip())

        metadata = {
            "name": record.get("title"),
            "description": record.get("abstract"),
            "publication": (
                journal.get("name")
                if isinstance(journal, dict)
                else record.get("venue")
            ),
            "authors": ", ".join(author_names) if author_names else None,
            "year": _normalize_year(record.get("year")),
            "is_oa": (
                bool(record.get("isOpenAccess"))
                if record.get("isOpenAccess") is not None
                else None
            ),
            "doi": external_ids.get("DOI") if isinstance(external_ids, dict) else None,
            "pmid": (
                external_ids.get("PubMed") if isinstance(external_ids, dict) else None
            ),
            "pmcid": (
                external_ids.get("PubMedCentral")
                if isinstance(external_ids, dict)
                else None
            ),
        }
        metadata.update(_normalize_identifier_dict(metadata))
        return metadata
    return {}


def fetch_metadata_pubmed(
    identifiers, *, settings, logger, email=None, api_key=None, tool="neurostore"
):
    pmid = _normalize_pmid(identifiers.get("pmid"))
    if not pmid:
        return {}

    params = {
        "db": "pubmed",
        "id": pmid,
        "retmode": "xml",
        "tool": tool or "neurostore",
    }
    if email:
        params["email"] = email
    if api_key:
        params["api_key"] = api_key

    try:
        response = _request_with_retry(
            settings,
            "GET",
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
            params=params,
            timeout=_request_timeout(settings),
        )
        root = ElementTree.fromstring(response.text)
    except Exception as exc:  # noqa: BLE001
        _provider_error(logger, "pubmed_metadata", exc)
        return {}

    article = root.find(".//PubmedArticle")
    if article is None:
        return {}

    title = _joined_text(article.find(".//ArticleTitle"))
    abstract_parts = []
    for abstract_text in article.findall(".//Abstract/AbstractText"):
        joined = _joined_text(abstract_text)
        if joined:
            abstract_parts.append(joined)
    abstract = "\n".join(abstract_parts) if abstract_parts else None

    publication = _joined_text(article.find(".//Journal/Title"))
    year = _normalize_year(_joined_text(article.find(".//PubDate/Year")))
    if year is None:
        year = _normalize_year(_joined_text(article.find(".//PubDate/MedlineDate")))

    authors = []
    for author in article.findall(".//AuthorList/Author"):
        last_name = _joined_text(author.find("./LastName"))
        fore_name = _joined_text(author.find("./ForeName"))
        initials = _joined_text(author.find("./Initials"))
        if last_name and fore_name:
            authors.append(f"{last_name} {fore_name}")
        elif last_name and initials:
            authors.append(f"{last_name} {initials}")
        elif last_name:
            authors.append(last_name)

    identifiers_from_article = {"pmid": pmid, "doi": None, "pmcid": None}
    for identifier in article.findall(".//ArticleIdList/ArticleId"):
        id_type = (identifier.attrib.get("IdType") or "").lower()
        value = _joined_text(identifier)
        if not value:
            continue
        if id_type == "doi":
            identifiers_from_article["doi"] = value
        elif id_type == "pmc":
            identifiers_from_article["pmcid"] = value
        elif id_type == "pubmed":
            identifiers_from_article["pmid"] = value

    metadata = {
        "name": title,
        "description": abstract,
        "publication": publication,
        "authors": ", ".join(authors) if authors else None,
        "year": year,
        "doi": identifiers_from_article.get("doi"),
        "pmid": identifiers_from_article.get("pmid"),
        "pmcid": identifiers_from_article.get("pmcid"),
    }
    metadata.update(_normalize_identifier_dict(metadata))
    return metadata


def _copy_missing_attrs(target, source, fields=CONTENT_FIELDS):
    changed = False
    for field in fields:
        target_value = getattr(target, field, None)
        source_value = getattr(source, field, None)
        if field == "year":
            target_value = _normalize_year(target_value)
            source_value = _normalize_year(source_value)
        if not _has_metadata_value(field, target_value) and _has_metadata_value(
            field, source_value
        ):
            setattr(target, field, source_value)
            changed = True

    target_metadata = target.metadata_ if isinstance(target.metadata_, dict) else None
    source_metadata = source.metadata_ if isinstance(source.metadata_, dict) else None
    if target_metadata is None and source_metadata:
        target.metadata_ = dict(source_metadata)
        changed = True
    elif target_metadata and source_metadata:
        added = {
            key: value
            for key, value in source_metadata.items()
            if key not in target_metadata and value is not None
        }
        if added:
            # A new dict: metadata_ is plain JSONB, so keys added in place go unsaved.
            target.metadata_ = {**target_metadata, **added}
            changed = True
    return changed


class Change(NamedTuple):
    """One field of one row a merge sets. ``deleted`` names a row it deletes, ``kept``
    a row it leaves on the old base study (``after`` says why)."""

    table: str
    row_id: str
    field: str
    before: object
    after: object


class BaseStudyMergeClash(Exception):
    """Merging would give the keeper two rows where it may hold one."""

    def __init__(self, keeper_id, old_id, clashes):
        self.clashes = clashes
        super().__init__(f"cannot merge {old_id} into {keeper_id}: " + "; ".join(clashes))


@dataclass
class BaseStudyMerge:
    cache_ids: dict
    changes: list


_PARSE_VERSIONS = (STUDY_SOURCE, HISTORY_SOURCE)

# (model, the columns two rows share when they would collide on the keeper, a filter on
# the old's row, a filter on the keeper's, what the collision means). Each mirrors a
# unique constraint or a one-per-paper rule of the study_schema ingest. The old's current
# parse version becomes a history version, so it clashes with the keeper's history.
_CLASH_RULES = (
    (
        Study,
        ("source_id",),
        lambda m: m.source.in_(_PARSE_VERSIONS),
        lambda m: m.source == HISTORY_SOURCE,
        "a history version of the same parse",
    ),
    (
        PipelineStudyResult,
        ("config_id", "run_id"),
        lambda m: m.run_id.is_not(None),
        lambda m: m.run_id.is_not(None),
        "a result of the same pipeline run",
    ),
    (
        PipelineAnalysisResult,
        ("config_id", "source_table_analysis"),
        None,
        None,
        "a result for the same pipeline config and analysis",
    ),
)

# Rows whose base_study_id names the paper; each moves to the keeper. Pipeline results
# and embeddings the keeper already has one of stay on the old base study (see
# _kept_pipeline_rows), and identical full texts and assignments are deduplicated first.
_MOVED = (
    Study,
    PipelineStudyResult,
    PipelineEmbedding,
    PipelineAnalysisResult,
    StudyEntity,
    Fulltext,
    ReviewAssignment,
)

# study_schema documents kept whole, whose header may name the paper's base study.
# Extraction records carry no header.
_HEADER_DOCUMENTS = (
    (PipelineStudyResult, "result_data"),
    (ReviewSource, "parsed_paper"),
    (ReviewSource, "coordinate_parse"),
    (ReviewSource, "coordinate_revision"),
    (Review, "coordinate_revision"),
)
_HEADER_ID_PATH = ("header", "neurostore_base_study_id")


def _clashes(keeper_id, old_id):
    found = []
    for model, columns, old_rows, keeper_rows, meaning in _CLASH_RULES:
        kept, moved = aliased(model), aliased(model)
        query = (
            sa.select(*(getattr(moved, c) for c in columns))
            .join(kept, sa.and_(*(getattr(kept, c) == getattr(moved, c) for c in columns)))
            .where(moved.base_study_id == old_id, kept.base_study_id == keeper_id)
        )
        if old_rows is not None:
            query = query.where(old_rows(moved), keeper_rows(kept))
        for row in db.session.execute(query.distinct()).all():
            shared = ", ".join(f"{c}={v!r}" for c, v in zip(columns, row))
            found.append(f"{model.__tablename__}: both hold {meaning} ({shared})")
    # Identical full texts are deduplicated by moving the old's review sources onto the
    # keeper's copy, which must not already hold the same record.
    kept_text, old_text = aliased(Fulltext), aliased(Fulltext)
    kept_source = aliased(ReviewSource)
    for (record_sha256,) in db.session.execute(
        sa.select(ReviewSource.record_sha256)
        .join(old_text, ReviewSource.fulltext_id == old_text.id)
        .join(kept_text, kept_text.sha256 == old_text.sha256)
        .join(
            kept_source,
            sa.and_(
                kept_source.fulltext_id == kept_text.id,
                kept_source.record_sha256 == ReviewSource.record_sha256,
            ),
        )
        .where(old_text.base_study_id == old_id, kept_text.base_study_id == keeper_id)
        .distinct()
    ).all():
        found.append(
            f"review_sources: both copies of the same full text hold the record "
            f"{record_sha256}"
        )
    # Two claim trees for one paper would need their entities matched; nothing does that.
    if all(
        db.session.scalar(sa.select(sa.exists().where(StudyEntity.base_study_id == bid)))
        for bid in (keeper_id, old_id)
    ):
        found.append("study_entities: both hold claim entities")
    return found


def _base_field_values(base_study):
    return {field: getattr(base_study, field) for field in CONTENT_FIELDS + ID_FIELDS}


def _kept_pipeline_rows(model, keeper_id, old_id):
    """The old's ``model`` rows that stay on it, by id, with the reason.

    Each stays where the keeper already has a row under the key its readers rank by
    recency, so a moved row would replace the keeper's: for pipeline results the
    pipeline (the release's features and latest-record lookups), for embeddings the
    config (semantic search). Stored parses always move: they are looked up by parse
    id, with the version they belong to."""
    if model is PipelineEmbedding:
        kept = aliased(PipelineEmbedding)
        rows = db.session.execute(
            sa.select(PipelineEmbedding.id, PipelineEmbedding.config_id).where(
                PipelineEmbedding.base_study_id == old_id,
                sa.exists().where(
                    kept.base_study_id == keeper_id,
                    kept.config_id == PipelineEmbedding.config_id,
                ),
            )
        ).all()
        return {
            row_id: f"keeper has an embedding of config {config_id}"
            for row_id, config_id in rows
        }
    keeper_pipelines = (
        sa.select(PipelineConfig.pipeline_id)
        .join(model, model.config_id == PipelineConfig.id)
        .where(model.base_study_id == keeper_id)
    )
    rows = db.session.execute(
        sa.select(model.id, Pipeline.name)
        .join(PipelineConfig, model.config_id == PipelineConfig.id)
        .join(Pipeline, PipelineConfig.pipeline_id == Pipeline.id)
        .where(
            model.base_study_id == old_id,
            PipelineConfig.pipeline_id.in_(keeper_pipelines),
            Pipeline.name != PARSE_PIPELINE,
        )
    ).all()
    return {row_id: f"keeper has a {name} result" for row_id, name in rows}


def _demote_current_parse(keeper, old):
    """The old's current parse version, when the keeper has one, becomes a history
    version superseded by the keeper's current parse, as the ingest keeps a parse it
    supersedes."""
    current = {
        study.base_study_id: study
        for study in Study.query.filter(
            Study.base_study_id.in_((keeper.id, old.id)), Study.source == STUDY_SOURCE
        )
    }
    demoted, kept = current.get(old.id), current.get(keeper.id)
    if demoted is None or kept is None:
        return []
    changes = [
        Change("studies", demoted.id, "source", STUDY_SOURCE, HISTORY_SOURCE),
        Change("studies", demoted.id, "public", demoted.public, False),
        Change("studies", demoted.id, "metadata.superseded_by", None, kept.source_id),
    ]
    demoted.source = HISTORY_SOURCE
    demoted.public = False
    demoted.metadata_ = {**(demoted.metadata_ or {}), "superseded_by": kept.source_id}
    return changes


def _deduplicate(keeper, old):
    """Delete the copies the keeper holds twice once the old's rows move: of two full
    texts of the same text, the one fulltext_preference ranks lower, after moving its
    review sources onto the other; and the old's assignment of a reviewer the keeper
    already has."""
    changes = []
    kept_text = aliased(Fulltext)
    pairs = db.session.execute(
        sa.select(Fulltext.id, kept_text.id)
        .join(kept_text, kept_text.sha256 == Fulltext.sha256)
        .where(Fulltext.base_study_id == old.id, kept_text.base_study_id == keeper.id)
        .order_by(Fulltext.id)
    ).all()
    for pair in pairs:
        better = db.session.scalar(
            sa.select(Fulltext.id)
            .where(Fulltext.id.in_(pair))
            .order_by(*fulltext_preference())
            .limit(1)
        )
        worse = pair[1] if better == pair[0] else pair[0]
        moved = db.session.scalars(
            sa.update(ReviewSource)
            .where(ReviewSource.fulltext_id == worse)
            .values(fulltext_id=better)
            .returning(ReviewSource.id)
        ).all()
        changes.extend(
            Change("review_sources", row_id, "fulltext_id", worse, better)
            for row_id in sorted(moved)
        )
        db.session.execute(sa.delete(Fulltext).where(Fulltext.id == worse))
        changes.append(Change("fulltexts", worse, "deleted", None, better))
    kept_assignment = aliased(ReviewAssignment)
    deleted = db.session.scalars(
        sa.delete(ReviewAssignment)
        .where(
            ReviewAssignment.base_study_id == old.id,
            sa.exists().where(
                kept_assignment.base_study_id == keeper.id,
                kept_assignment.user_id == ReviewAssignment.user_id,
            ),
        )
        .returning(ReviewAssignment.id)
        .execution_options(synchronize_session=False)
    ).all()
    changes.extend(
        Change("review_assignments", row_id, "deleted", None, None) for row_id in sorted(deleted)
    )
    return changes


def merge_base_study(keeper, old):
    """Make ``old`` a superseded copy of ``keeper``.

    Its versions move to the keeper, marked ``merged_from``, with its current parse version
    made history when the keeper has one. Its pipeline results, embeddings, entities,
    full texts, review assignments and corresponding-author emails move too, but for those
    the keeper already holds
    (see _kept_pipeline_rows and _deduplicate). Base studies it superseded are superseded
    by the keeper, study_schema document headers naming it name the keeper, each base
    study points at its best remaining full text, and the keeper gains only the fields
    and identifiers it lacks.

    Version and analysis ids are kept, so studysets, annotations and compose snapshots
    are untouched. Raises BaseStudyMergeClash, before writing anything, when a moved row
    would collide with one of the keeper's.
    """
    clashes = _clashes(keeper.id, old.id)
    if clashes:
        raise BaseStudyMergeClash(keeper.id, old.id, clashes)

    changes = []
    cache_ids = {"base-studies": {keeper.id, old.id}, "studies": set()}
    before = _base_field_values(keeper)
    before_metadata = dict(keeper.metadata_) if isinstance(keeper.metadata_, dict) else None
    fulltext_before = {keeper.id: keeper.fulltext_id, old.id: old.fulltext_id}

    old_state = (old.is_active, old.superseded_by)
    old_identifiers = _extract_identifiers(old)
    _copy_missing_attrs(keeper, old)
    # Deactivate first so the active-only doi+pmid index holds while the keeper
    # takes the identifiers it lacks.
    db.session.execute(
        sa.update(BaseStudy)
        .where(BaseStudy.id == old.id)
        .values(is_active=False, superseded_by=keeper.id)
    )
    changes.append(Change("base_studies", old.id, "is_active", old_state[0], False))
    changes.append(Change("base_studies", old.id, "superseded_by", old_state[1], keeper.id))
    old.is_active = False
    old.superseded_by = keeper.id
    _apply_missing_ids(keeper, old_identifiers)

    after = _base_field_values(keeper)
    changes.extend(
        Change("base_studies", keeper.id, field, before[field], after[field])
        for field in before
        if before[field] != after[field]
    )
    if isinstance(keeper.metadata_, dict):
        changes.extend(
            Change("base_studies", keeper.id, f"metadata.{key}", None, value)
            for key, value in keeper.metadata_.items()
            if before_metadata is None or key not in before_metadata
        )

    superseded = db.session.scalars(
        sa.update(BaseStudy)
        .where(BaseStudy.superseded_by == old.id)
        .values(superseded_by=keeper.id)
        .returning(BaseStudy.id)
    ).all()
    changes.extend(
        Change("base_studies", row_id, "superseded_by", old.id, keeper.id)
        for row_id in sorted(superseded)
    )
    cache_ids["base-studies"].update(superseded)

    changes.extend(_demote_current_parse(keeper, old))
    # A version merged in earlier keeps the base study it first came from.
    marked = db.session.scalars(
        sa.update(Study)
        .where(Study.base_study_id == old.id, Study.merged_from.is_(None))
        .values(merged_from=old.id)
        .returning(Study.id)
    ).all()
    changes.extend(
        Change("studies", row_id, "merged_from", None, old.id) for row_id in sorted(marked)
    )
    changes.extend(_deduplicate(keeper, old))

    for model in _MOVED:
        kept = {}
        if model in (PipelineStudyResult, PipelineEmbedding):
            kept = _kept_pipeline_rows(model, keeper.id, old.id)
            changes.extend(
                Change(model.__tablename__, row_id, "kept", None, reason)
                for row_id, reason in sorted(kept.items())
            )
        moved = db.session.scalars(
            sa.update(model)
            .where(model.base_study_id == old.id, model.id.not_in(list(kept)))
            .values(base_study_id=keeper.id)
            .returning(model.id)
        ).all()
        changes.extend(
            Change(model.__tablename__, row_id, "base_study_id", old.id, keeper.id)
            for row_id in sorted(moved)
        )
        if model is Study and moved:
            cache_ids["studies"].update(moved)
            studysets = db.session.scalars(
                sa.select(StudysetStudy.studyset_id).where(StudysetStudy.study_id.in_(moved))
            ).all()
            if studysets:
                cache_ids["studysets"] = set(studysets)
        if model is StudyEntity and moved:
            # Local so that importing the package does not load the ingest stack.
            from neurostore.ingest.study_entities import rehash_base_study_entities

            # An entity's hash covers its base study.
            rehash_base_study_entities([keeper.id])

    # Recorded by row id and mark only: an address is never read out of the table.
    for row_id, kept_id, marked in corresponding_authors.move_emails(old.id, keeper.id):
        if kept_id is None:
            changes.append(
                Change("corresponding_author_emails", row_id, "base_study_id", old.id, keeper.id)
            )
            continue
        changes.append(Change("corresponding_author_emails", row_id, "deleted", None, kept_id))
        changes.extend(
            Change("corresponding_author_emails", kept_id, mark, False, True) for mark in marked
        )

    for model, column in _HEADER_DOCUMENTS:
        document = getattr(model, column)
        rewritten = db.session.scalars(
            sa.update(model)
            .where(document[_HEADER_ID_PATH].astext == old.id)
            .values({
                column: sa.func.jsonb_set(
                    document,
                    sa.literal(list(_HEADER_ID_PATH), ARRAY(sa.Text)),
                    sa.func.to_jsonb(sa.cast(keeper.id, sa.Text)),
                )
            })
            .returning(model.id)
            .execution_options(synchronize_session=False)
        ).all()
        changes.extend(
            Change(
                model.__tablename__,
                row_id,
                f"{column}.header.neurostore_base_study_id",
                old.id,
                keeper.id,
            )
            for row_id in sorted(rewritten)
        )

    for outbox in (BaseStudyFlagOutbox, BaseStudyMetadataOutbox):
        deleted = db.session.scalars(
            sa.delete(outbox)
            .where(outbox.base_study_id == old.id)
            .returning(outbox.base_study_id)
        ).all()
        changes.extend(
            Change(outbox.__tablename__, row_id, "deleted", None, None) for row_id in deleted
        )

    db.session.flush()
    connection = db.session.connection()
    for base_study in (keeper, old):
        refresh_fulltext_pointer(connection, base_study.id)
        db.session.refresh(base_study, ["fulltext_id"])
        if base_study.fulltext_id != fulltext_before[base_study.id]:
            changes.append(
                Change(
                    "base_studies",
                    base_study.id,
                    "fulltext_id",
                    fulltext_before[base_study.id],
                    base_study.fulltext_id,
                )
            )

    return BaseStudyMerge(cache_ids=cache_ids, changes=changes)


def _merge_ids_in_place(target_identifiers, source_identifiers):
    changed = False
    source_identifiers = _normalize_identifier_dict(source_identifiers)
    for field in ID_FIELDS:
        source_value = source_identifiers.get(field)
        target_value = target_identifiers.get(field)
        if _has_value(source_value) and not _has_value(target_value):
            target_identifiers[field] = source_value
            changed = True
    return changed


def _apply_missing_ids(primary, identifiers):
    """Give ``primary`` the ids it lacks, but not one another base study holds: that id
    stays where it is and the pair is logged and recorded as a merge candidate."""
    gained = article_identifiers(
        {
            field: identifiers[field]
            for field in ID_FIELDS
            if _has_value(identifiers.get(field)) and not _has_value(getattr(primary, field, None))
        }
    )
    held = held_by(db.session, gained)
    return attach_identifiers(db.session, primary, gained, held, source="enrichment").wrote


def _apply_missing_metadata(primary, metadata_candidates):
    changed = False
    for field in METADATA_FIELDS:
        if _has_metadata_value(field, getattr(primary, field, None)):
            continue
        for candidate in metadata_candidates:
            value = candidate.get(field)
            if field == "year":
                value = _normalize_year(value)
            if _has_metadata_value(field, value):
                setattr(primary, field, value)
                changed = True
                break
    return changed


def _propagate_base_study_metadata_to_versions(base_study):
    source_values = {
        field: getattr(base_study, field, None)
        for field in ID_FIELDS + STUDY_METADATA_FIELDS
    }
    update_values = {}
    missing_conditions = []

    for field, source_value in source_values.items():
        if field == "year":
            source_value = _normalize_year(source_value)
            if source_value is None:
                continue
            missing_condition = sa.or_(Study.year.is_(None), Study.year <= 0)
        else:
            if not _has_metadata_value(field, source_value):
                continue
            missing_condition = _missing_text_sql(getattr(Study, field))

        column = getattr(Study, field)
        update_values[field] = sa.case(
            (missing_condition, source_value),
            else_=column,
        )
        missing_conditions.append(missing_condition)

    if not update_values:
        return set()

    changed_study_ids = set(
        db.session.scalars(
            sa.update(Study)
            .where(Study.base_study_id == base_study.id)
            .where(sa.or_(*missing_conditions))
            .values(**update_values)
            .returning(Study.id)
        ).all()
    )
    return changed_study_ids


def _propagate_base_study_metadata_to_versions_post_commit(
    base_study_ids,
    *,
    logger,
    max_attempts=5,
    retry_sleep_seconds=0.1,
):
    if not base_study_ids:
        return set()

    attempts = 0
    while True:
        try:
            changed_study_ids = set()
            active_base_studies = list(
                db.session.scalars(
                    sa.select(BaseStudy)
                    .where(BaseStudy.id.in_(base_study_ids))
                    .where(BaseStudy.is_active.is_(True))
                    .order_by(BaseStudy.id.asc())
                ).all()
            )
            for base_study in active_base_studies:
                changed_study_ids.update(
                    _propagate_base_study_metadata_to_versions(base_study)
                )
            db.session.commit()
            return changed_study_ids
        except OperationalError as exc:
            db.session.rollback()
            attempts += 1
            if getattr(getattr(exc, "orig", None), "pgcode", None) != "40P01":
                raise
            if attempts >= max_attempts:
                raise
            logger.warning(
                "retrying study metadata propagation after deadlock "
                "(attempt %s/%s) for %s base studies",
                attempts + 1,
                max_attempts,
                len(base_study_ids),
            )
            time.sleep(retry_sleep_seconds)


_NO_OP_ENRICHMENT = object()


class _GatheredEnrichment:
    """Result of the network-calling, lock-free gather phase for one base study."""

    __slots__ = ("base_study_id", "external_identifiers", "metadata_candidates")

    def __init__(self, base_study_id, external_identifiers, metadata_candidates):
        self.base_study_id = base_study_id
        self.external_identifiers = external_identifiers
        self.metadata_candidates = metadata_candidates


def _gather_base_study_enrichment(base_study_id, *, settings, logger):
    """Read-only phase: fetch external identifiers/metadata. Acquires no locks."""
    base_study_snapshot = db.session.scalar(
        sa.select(BaseStudy).where(BaseStudy.id == base_study_id)
    )
    if base_study_snapshot is None or base_study_snapshot.is_active is False:
        return None
    if not _needs_enrichment(base_study_snapshot):
        return _NO_OP_ENRICHMENT

    semantic_scholar_api_key = settings.get("SEMANTIC_SCHOLAR_API_KEY")
    contact_email = settings.get("EMAIL")
    pubmed_api_key = settings.get("PUBMED_TOOL_API_KEY")
    pubmed_tool = settings["PUBMED_TOOL"]

    external_identifiers = _extract_identifiers(base_study_snapshot)
    missing_ids = _missing_id_fields(external_identifiers)
    if missing_ids:
        _merge_ids_in_place(
            external_identifiers,
            lookup_ids_semantic_scholar(
                external_identifiers,
                settings=settings,
                logger=logger,
                api_key=semantic_scholar_api_key,
            ),
        )
        missing_ids = _missing_id_fields(external_identifiers)
    if missing_ids:
        _merge_ids_in_place(
            external_identifiers,
            lookup_ids_pubmed(
                external_identifiers,
                settings=settings,
                logger=logger,
                email=contact_email,
                api_key=pubmed_api_key,
                tool=pubmed_tool,
            ),
        )
        missing_ids = _missing_id_fields(external_identifiers)
    if missing_ids:
        _merge_ids_in_place(
            external_identifiers,
            lookup_ids_openalex(
                external_identifiers,
                settings=settings,
                logger=logger,
                email=contact_email,
            ),
        )

    metadata_candidates = []
    missing_metadata = _missing_metadata_fields(base_study_snapshot)
    if missing_metadata:
        semantic_metadata = fetch_metadata_semantic_scholar(
            external_identifiers,
            settings=settings,
            logger=logger,
            api_key=semantic_scholar_api_key,
        )
        if semantic_metadata:
            metadata_candidates.append(semantic_metadata)
            _merge_ids_in_place(external_identifiers, semantic_metadata)
            missing_metadata = _remaining_missing_fields(
                missing_metadata, semantic_metadata
            )

    if missing_metadata:
        pubmed_metadata = fetch_metadata_pubmed(
            external_identifiers,
            settings=settings,
            logger=logger,
            email=contact_email,
            api_key=pubmed_api_key,
            tool=pubmed_tool,
        )
        if pubmed_metadata:
            metadata_candidates.append(pubmed_metadata)
            _merge_ids_in_place(external_identifiers, pubmed_metadata)

    return _GatheredEnrichment(base_study_id, external_identifiers, metadata_candidates)


def _apply_base_study_enrichment(gathered):
    """Write phase: short, DB-only. Re-locks and applies gathered results."""
    base_study = db.session.scalar(
        sa.select(BaseStudy)
        .where(BaseStudy.id == gathered.base_study_id)
        .with_for_update(of=BaseStudy)
    )
    if base_study is None or base_study.is_active is False:
        return {"base-studies": set(), "studies": set()}
    if not _needs_enrichment(base_study):
        return {
            "base-studies": {base_study.id},
            "studies": set(),
        }

    cache_ids = {"base-studies": {base_study.id}, "studies": set()}
    identifiers = _extract_identifiers(base_study)
    _merge_ids_in_place(identifiers, gathered.external_identifiers)
    _apply_missing_ids(base_study, identifiers)
    _apply_missing_metadata(base_study, gathered.metadata_candidates)
    cache_ids.setdefault("base-studies", set()).add(base_study.id)
    return cache_ids


def enrich_base_study_metadata(base_study_id, *, settings, logger):
    gathered = _gather_base_study_enrichment(
        base_study_id, settings=settings, logger=logger
    )
    if gathered is None:
        return {"base-studies": set(), "studies": set()}
    if gathered is _NO_OP_ENRICHMENT:
        return {"base-studies": {base_study_id}, "studies": set()}
    return _apply_base_study_enrichment(gathered)


def enqueue_base_study_metadata_updates(base_study_ids, reason="api-write"):
    base_study_ids = normalize_ids(base_study_ids)
    if not base_study_ids:
        return 0

    has_identifier = sa.or_(
        _has_text_sql(BaseStudy.pmid),
        _has_text_sql(BaseStudy.doi),
        _has_text_sql(BaseStudy.pmcid),
    )
    missing_identifier = sa.or_(
        _missing_text_sql(BaseStudy.pmid),
        _missing_text_sql(BaseStudy.doi),
        _missing_text_sql(BaseStudy.pmcid),
    )
    missing_metadata = sa.or_(
        _missing_text_sql(BaseStudy.name),
        _missing_text_sql(BaseStudy.description),
        _missing_text_sql(BaseStudy.publication),
        _missing_text_sql(BaseStudy.authors),
        sa.or_(BaseStudy.year.is_(None), BaseStudy.year <= 0),
        BaseStudy.is_oa.is_(None),
    )

    eligible_ids = list(
        db.session.scalars(
            sa.select(BaseStudy.id).where(
                BaseStudy.id.in_(base_study_ids),
                BaseStudy.is_active.is_(True),
                has_identifier,
                sa.or_(missing_identifier, missing_metadata),
            )
        ).all()
    )
    if not eligible_ids:
        return 0

    rows = [
        {
            "base_study_id": base_study_id,
            "reason": reason,
        }
        for base_study_id in eligible_ids
    ]
    stmt = pg_insert(BaseStudyMetadataOutbox).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=[BaseStudyMetadataOutbox.base_study_id],
        set_={
            "reason": reason,
            "updated_at": sa.func.now(),
        },
    )
    db.session.execute(stmt)
    return len(eligible_ids)


def _enqueue_base_study_flag_updates_post_commit(
    base_study_ids,
    reason,
    *,
    logger,
    max_attempts=5,
    retry_sleep_seconds=0.1,
):
    attempts = 0
    while True:
        try:
            enqueue_base_study_flag_updates(base_study_ids, reason=reason)
            db.session.commit()
            return
        except OperationalError as exc:
            db.session.rollback()
            attempts += 1
            if getattr(getattr(exc, "orig", None), "pgcode", None) != "40P01":
                raise
            if attempts >= max_attempts:
                raise
            logger.warning(
                "retrying base-study flag enqueue after deadlock "
                "(attempt %s/%s) for %s base studies",
                attempts + 1,
                max_attempts,
                len(base_study_ids),
            )
            time.sleep(retry_sleep_seconds)


_GATHER_FAILED = object()


def process_base_study_metadata_outbox_batch(batch_size=50, *, settings, logger):
    batch_size = max(1, int(batch_size))

    successful_ids = []
    cache_ids = {"base-studies": set(), "studies": set()}
    flag_update_ids = set()
    queued_flag_ids = []
    propagation_base_study_ids = []

    claim_query = (
        sa.select(BaseStudyMetadataOutbox.base_study_id)
        .order_by(
            BaseStudyMetadataOutbox.updated_at.asc(),
            BaseStudyMetadataOutbox.base_study_id.asc(),
        )
        .limit(batch_size)
        .with_for_update(skip_locked=True)
    )
    claimed_ids = list(db.session.scalars(claim_query).all())
    if not claimed_ids:
        db.session.rollback()
        return 0

    # Release the claim lock immediately -- nothing below this point should
    # hold it open across the (potentially slow) external lookups in the
    # gather pass. Touching updated_at pushes these rows to the back of the
    # claim_query's ORDER BY so a concurrent worker replica doesn't
    # immediately re-claim them.
    db.session.execute(
        sa.update(BaseStudyMetadataOutbox)
        .where(BaseStudyMetadataOutbox.base_study_id.in_(claimed_ids))
        .values(updated_at=sa.func.now())
    )
    db.session.commit()

    gathered_by_id = {}
    for base_study_id in claimed_ids:
        try:
            gathered_by_id[base_study_id] = _gather_base_study_enrichment(
                base_study_id, settings=settings, logger=logger
            )
        except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            logger.warning(
                "base-study metadata gather failed for %s: %s",
                base_study_id,
                exc,
            )
            gathered_by_id[base_study_id] = _GATHER_FAILED

    for base_study_id in claimed_ids:
        gathered = gathered_by_id[base_study_id]
        try:
            with db.session.begin_nested():
                if gathered is _GATHER_FAILED:
                    raise RuntimeError("base-study metadata gather failed")
                elif gathered is None:
                    affected_ids = {"base-studies": set(), "studies": set()}
                elif gathered is _NO_OP_ENRICHMENT:
                    affected_ids = {"base-studies": {base_study_id}, "studies": set()}
                else:
                    affected_ids = _apply_base_study_enrichment(gathered)
                cache_ids = merge_unique_ids(cache_ids, affected_ids)
                flag_update_ids.update(affected_ids.get("base-studies", set()))
                successful_ids.append(base_study_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "base-study metadata enrichment failed for %s: %s",
                base_study_id,
                exc,
            )
            retry_at = dt.datetime.now(dt.timezone.utc) + dt.timedelta(
                seconds=_retry_delay_seconds(settings)
            )
            db.session.execute(
                sa.update(BaseStudyMetadataOutbox)
                .where(BaseStudyMetadataOutbox.base_study_id == base_study_id)
                .values(updated_at=retry_at)
            )

    if successful_ids:
        db.session.execute(
            sa.delete(BaseStudyMetadataOutbox).where(
                BaseStudyMetadataOutbox.base_study_id.in_(successful_ids)
            )
        )
        if flag_update_ids:
            queued_flag_ids = normalize_ids(flag_update_ids)
        else:
            queued_flag_ids = []

    db.session.commit()
    if cache_ids.get("base-studies"):
        propagation_base_study_ids = normalize_ids(cache_ids["base-studies"])
    if propagation_base_study_ids:
        cache_ids.setdefault("studies", set()).update(
            _propagate_base_study_metadata_to_versions_post_commit(
                propagation_base_study_ids,
                logger=logger,
            )
        )
    if queued_flag_ids:
        _enqueue_base_study_flag_updates_post_commit(
            queued_flag_ids,
            reason="base-study-metadata-enrichment",
            logger=logger,
        )
    if cache_ids:
        bump_cache_versions(cache_ids)
    return len(successful_ids)
