import datetime as dt
import re
from xml.etree import ElementTree

import requests
import sqlalchemy as sa
from flask import current_app
from sqlalchemy.dialects.postgresql import insert as pg_insert
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from ..cache_versioning import bump_cache_versions
from ..database import db
from ..models import (
    BaseStudy,
    BaseStudyFlagOutbox,
    BaseStudyMetadataOutbox,
    PipelineEmbedding,
    PipelineStudyResult,
    Study,
    StudysetStudy,
)
from .has_media_flags import enqueue_base_study_flag_updates
from .utils import merge_unique_ids, normalize_ids

ID_FIELDS = ("pmid", "doi", "pmcid")
METADATA_FIELDS = ("name", "description", "publication", "authors", "year", "is_oa")
STUDY_METADATA_FIELDS = ("name", "description", "publication", "authors", "year")
CONTENT_FIELDS = METADATA_FIELDS + ("ace_fulltext", "pubget_fulltext")
TRANSIENT_HTTP_STATUS = {408, 409, 425, 429, 500, 502, 503, 504}


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
def _request_with_retry(method, url, **kwargs):
    response = requests.request(method, url, **kwargs)
    if response.status_code >= 400:
        error = requests.HTTPError(
            f"{response.status_code} error from {url}", response=response
        )
        raise error
    return response


def _request_timeout():
    timeout = current_app.config.get("BASE_STUDY_METADATA_REQUEST_TIMEOUT_SECONDS", 10)
    try:
        timeout = float(timeout)
    except (TypeError, ValueError):
        timeout = 10.0
    return max(1.0, timeout)


def _retry_delay_seconds():
    delay = current_app.config.get("BASE_STUDY_METADATA_RETRY_DELAY_SECONDS", 30)
    try:
        delay = float(delay)
    except (TypeError, ValueError):
        delay = 30.0
    return max(0.0, delay)


def _provider_error(provider_name, exc):
    current_app.logger.warning(
        "base-study metadata provider failed (%s): %s", provider_name, exc
    )


def lookup_ids_semantic_scholar(identifiers, api_key=None):
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
            "POST",
            "https://api.semanticscholar.org/graph/v1/paper/batch",
            params={"fields": "externalIds"},
            json={"ids": request_ids},
            headers=headers,
            timeout=_request_timeout(),
        )
        payload = response.json()
    except Exception as exc:  # noqa: BLE001
        _provider_error("semantic_scholar_id_lookup", exc)
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


def lookup_ids_pubmed(identifiers, email=None, api_key=None, tool="neurostore"):
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
            "GET",
            "https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/",
            params=params,
            timeout=_request_timeout(),
        )
        payload = response.json()
    except Exception as exc:  # noqa: BLE001
        _provider_error("pubmed_id_lookup", exc)
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


def lookup_ids_openalex(identifiers, email=None):
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
            "GET",
            "https://api.openalex.org/works",
            params=params,
            timeout=_request_timeout(),
        )
        payload = response.json()
    except Exception as exc:  # noqa: BLE001
        _provider_error("openalex_id_lookup", exc)
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


def fetch_metadata_semantic_scholar(identifiers, api_key=None):
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
            "POST",
            "https://api.semanticscholar.org/graph/v1/paper/batch",
            params={"fields": fields},
            json={"ids": request_ids},
            headers=headers,
            timeout=_request_timeout(),
        )
        payload = response.json()
    except Exception as exc:  # noqa: BLE001
        _provider_error("semantic_scholar_metadata", exc)
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


def fetch_metadata_pubmed(identifiers, email=None, api_key=None, tool="neurostore"):
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
            "GET",
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
            params=params,
            timeout=_request_timeout(),
        )
        root = ElementTree.fromstring(response.text)
    except Exception as exc:  # noqa: BLE001
        _provider_error("pubmed_metadata", exc)
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


def _find_active_duplicates(primary, identifiers):
    filters = []
    if identifiers.get("pmid"):
        filters.append(BaseStudy.pmid == identifiers["pmid"])
    if identifiers.get("doi"):
        filters.append(BaseStudy.doi == identifiers["doi"])
    if identifiers.get("pmcid"):
        filters.append(BaseStudy.pmcid == identifiers["pmcid"])
    if not filters:
        return []

    query = (
        sa.select(BaseStudy)
        .where(
            BaseStudy.is_active.is_(True),
            BaseStudy.id != primary.id,
            sa.or_(*filters),
        )
        .order_by(BaseStudy.created_at.asc(), BaseStudy.id.asc())
        .with_for_update(of=BaseStudy, skip_locked=True)
    )
    return list(db.session.scalars(query).all())


def _oldest_base_study(base_studies):
    def _sort_key(study):
        created = study.created_at or dt.datetime.max.replace(tzinfo=dt.timezone.utc)
        return (created, study.id)

    return sorted(base_studies, key=_sort_key)[0]


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
        for key, value in source_metadata.items():
            if key not in target_metadata and value is not None:
                target_metadata[key] = value
                changed = True
    return changed


def _merge_duplicate_into_primary(primary, duplicate):
    cache_ids = {"base-studies": {primary.id, duplicate.id}, "studies": set()}

    duplicate_identifiers = _extract_identifiers(duplicate)
    _copy_missing_attrs(primary, duplicate)
    # Mark duplicate inactive first so active-only doi+pmid uniqueness is preserved
    # while we copy any missing identifiers onto the canonical study.
    db.session.execute(
        sa.update(BaseStudy)
        .where(BaseStudy.id == duplicate.id)
        .values(is_active=False, superseded_by=primary.id)
    )
    duplicate.is_active = False
    duplicate.superseded_by = primary.id
    _apply_missing_ids(primary, duplicate_identifiers)

    moved_study_ids = list(
        db.session.scalars(
            sa.select(Study.id).where(Study.base_study_id == duplicate.id)
        ).all()
    )
    if moved_study_ids:
        db.session.execute(
            sa.update(Study)
            .where(Study.id.in_(moved_study_ids))
            .values(base_study_id=primary.id)
        )
        cache_ids["studies"].update(moved_study_ids)

        moved_studyset_ids = list(
            db.session.scalars(
                sa.select(StudysetStudy.studyset_id).where(
                    StudysetStudy.study_id.in_(moved_study_ids)
                )
            ).all()
        )
        if moved_studyset_ids:
            cache_ids["studysets"] = set(moved_studyset_ids)

    db.session.execute(
        sa.update(PipelineStudyResult)
        .where(PipelineStudyResult.base_study_id == duplicate.id)
        .values(base_study_id=primary.id)
    )
    db.session.execute(
        sa.update(PipelineEmbedding)
        .where(PipelineEmbedding.base_study_id == duplicate.id)
        .values(base_study_id=primary.id)
    )

    db.session.execute(
        sa.delete(BaseStudyFlagOutbox).where(
            BaseStudyFlagOutbox.base_study_id == duplicate.id
        )
    )
    db.session.execute(
        sa.delete(BaseStudyMetadataOutbox).where(
            BaseStudyMetadataOutbox.base_study_id == duplicate.id
        )
    )

    return cache_ids


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
    changed = False
    for field in ID_FIELDS:
        source_value = identifiers.get(field)
        target_value = getattr(primary, field, None)
        if _has_value(source_value) and not _has_value(target_value):
            setattr(primary, field, source_value)
            changed = True
    return changed


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
    changed_study_ids = set()
    versions = list(
        db.session.scalars(
            sa.select(Study)
            .where(Study.base_study_id == base_study.id)
            .with_for_update(of=Study)
        ).all()
    )
    for version in versions:
        changed = False
        for field, source_value in source_values.items():
            target_value = getattr(version, field, None)
            if field == "year":
                source_value = _normalize_year(source_value)
                target_value = _normalize_year(target_value)
            if _has_metadata_value(field, source_value) and not _has_metadata_value(
                field, target_value
            ):
                setattr(version, field, source_value)
                changed = True
        if changed:
            changed_study_ids.add(version.id)
    return changed_study_ids


def _merge_duplicates(primary):
    cache_ids = {"base-studies": {primary.id}, "studies": set()}

    while True:
        identifiers = _extract_identifiers(primary)
        duplicates = _find_active_duplicates(primary, identifiers)
        if not duplicates:
            break

        cluster = [primary] + duplicates
        canonical = _oldest_base_study(cluster)

        if canonical.id != primary.id:
            ids_from_primary_merge = _merge_duplicate_into_primary(canonical, primary)
            cache_ids = merge_unique_ids(cache_ids, ids_from_primary_merge)
            primary = canonical

        for duplicate in duplicates:
            if duplicate.id == primary.id:
                continue
            duplicate_cache_ids = _merge_duplicate_into_primary(primary, duplicate)
            cache_ids = merge_unique_ids(cache_ids, duplicate_cache_ids)

    return primary, cache_ids


def enrich_base_study_metadata(base_study_id):
    base_study_snapshot = db.session.scalar(
        sa.select(BaseStudy).where(BaseStudy.id == base_study_id)
    )
    if base_study_snapshot is None or base_study_snapshot.is_active is False:
        return {"base-studies": set(), "studies": set()}
    if not _needs_enrichment(base_study_snapshot):
        return {"base-studies": {base_study_snapshot.id}, "studies": set()}

    config = current_app.config
    semantic_scholar_api_key = config.get("SEMANTIC_SCHOLAR_API_KEY")
    contact_email = config.get("EMAIL")
    pubmed_api_key = config.get("PUBMED_TOOL_API_KEY")
    pubmed_tool = config.get("PUBMED_TOOL", "neurostore")

    external_identifiers = _extract_identifiers(base_study_snapshot)
    missing_ids = _missing_id_fields(external_identifiers)
    if missing_ids:
        _merge_ids_in_place(
            external_identifiers,
            lookup_ids_semantic_scholar(
                external_identifiers, api_key=semantic_scholar_api_key
            ),
        )
        missing_ids = _missing_id_fields(external_identifiers)
    if missing_ids:
        _merge_ids_in_place(
            external_identifiers,
            lookup_ids_pubmed(
                external_identifiers,
                email=contact_email,
                api_key=pubmed_api_key,
                tool=pubmed_tool,
            ),
        )
        missing_ids = _missing_id_fields(external_identifiers)
    if missing_ids:
        _merge_ids_in_place(
            external_identifiers,
            lookup_ids_openalex(external_identifiers, email=contact_email),
        )

    metadata_candidates = []
    missing_metadata = _missing_metadata_fields(base_study_snapshot)
    if missing_metadata:
        semantic_metadata = fetch_metadata_semantic_scholar(
            external_identifiers, api_key=semantic_scholar_api_key
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
            email=contact_email,
            api_key=pubmed_api_key,
            tool=pubmed_tool,
        )
        if pubmed_metadata:
            metadata_candidates.append(pubmed_metadata)
            _merge_ids_in_place(external_identifiers, pubmed_metadata)

    base_study = db.session.scalar(
        sa.select(BaseStudy)
        .where(BaseStudy.id == base_study_id)
        .with_for_update(of=BaseStudy)
    )
    if base_study is None or base_study.is_active is False:
        return {"base-studies": set(), "studies": set()}
    if not _needs_enrichment(base_study):
        changed_study_ids = _propagate_base_study_metadata_to_versions(base_study)
        return {
            "base-studies": {base_study.id},
            "studies": changed_study_ids,
        }

    cache_ids = {"base-studies": {base_study.id}, "studies": set()}
    identifiers = _extract_identifiers(base_study)
    _merge_ids_in_place(identifiers, external_identifiers)
    _apply_missing_ids(base_study, identifiers)
    base_study, merged_cache_ids = _merge_duplicates(base_study)
    cache_ids = merge_unique_ids(cache_ids, merged_cache_ids)

    _apply_missing_metadata(base_study, metadata_candidates)
    cache_ids.setdefault("studies", set()).update(
        _propagate_base_study_metadata_to_versions(base_study)
    )
    cache_ids.setdefault("base-studies", set()).add(base_study.id)
    return cache_ids


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


def process_base_study_metadata_outbox_batch(batch_size=50):
    batch_size = max(1, int(batch_size))

    successful_ids = []
    cache_ids = {"base-studies": set(), "studies": set()}
    flag_update_ids = set()

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

    for base_study_id in claimed_ids:
        try:
            with db.session.begin_nested():
                affected_ids = enrich_base_study_metadata(base_study_id)
                cache_ids = merge_unique_ids(cache_ids, affected_ids)
                flag_update_ids.update(affected_ids.get("base-studies", set()))
                successful_ids.append(base_study_id)
        except Exception as exc:  # noqa: BLE001
            current_app.logger.warning(
                "base-study metadata enrichment failed for %s: %s",
                base_study_id,
                exc,
            )
            retry_at = dt.datetime.now(dt.timezone.utc) + dt.timedelta(
                seconds=_retry_delay_seconds()
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
            enqueue_base_study_flag_updates(
                flag_update_ids, reason="base-study-metadata-enrichment"
            )

    db.session.commit()
    if cache_ids:
        bump_cache_versions(cache_ids)
    return len(successful_ids)
