from __future__ import annotations

import sqlalchemy as sa
from neurostore.database import db
from neurostore.models import BaseStudy, Study
from neurostore.resources.mutation_core import create_user
from neurostore.resources.utils import get_current_user


def _base_study_response_load_options(user_model):
    from sqlalchemy.orm import raiseload, selectinload

    return (
        raiseload("*", sql_only=True),
        selectinload(BaseStudy.user)
        .load_only(user_model.external_id, user_model.name)
        .options(raiseload("*", sql_only=True)),
        selectinload(BaseStudy.versions)
        .load_only(
            Study.id,
            Study.user_id,
            Study.created_at,
            Study.updated_at,
            Study.source,
        )
        .options(
            raiseload("*", sql_only=True),
            selectinload(Study.user)
            .load_only(user_model.external_id, user_model.name)
            .options(raiseload("*", sql_only=True)),
        ),
    )


def _normalize_identifier(value) -> str:
    if value is None:
        return ""
    return str(value)


def _lookup_key(doi: str, pmid: str) -> str:
    return f"{doi}{pmid}"


def collect_lookup_identifiers(payload):
    dois = set()
    pmids = set()

    for study_data in payload:
        doi = _normalize_identifier(study_data.get("doi"))
        pmid = _normalize_identifier(study_data.get("pmid"))
        if doi:
            dois.add(doi)
        if pmid:
            pmids.add(pmid)

    return dois, pmids


def build_lookup(records):
    lookup = {"combined": {}, "doi": {}, "pmid": {}}

    for record in records:
        doi = _normalize_identifier(record.doi)
        pmid = _normalize_identifier(record.pmid)

        if doi:
            lookup["doi"][doi] = record
        if pmid:
            lookup["pmid"][pmid] = record
        if doi or pmid:
            lookup["combined"][_lookup_key(doi, pmid)] = record

    return lookup


def match_lookup_record(lookup, study_data):
    doi = _normalize_identifier(study_data.get("doi"))
    pmid = _normalize_identifier(study_data.get("pmid"))
    key = _lookup_key(doi, pmid)

    if not key or key.isspace():
        return None
    if doi and pmid:
        return lookup["combined"].get(key)
    if doi:
        return lookup["doi"].get(doi)
    return lookup["pmid"].get(pmid)


def register_lookup_record(lookup, record):
    doi = _normalize_identifier(record.doi)
    pmid = _normalize_identifier(record.pmid)

    if doi:
        lookup["doi"][doi] = record
    if pmid:
        lookup["pmid"][pmid] = record
    if doi or pmid:
        lookup["combined"][_lookup_key(doi, pmid)] = record


def prefetch_lookup_records(dois, pmids, user_model):
    filters = []
    if dois:
        filters.append(BaseStudy.doi.in_(sorted(dois)))
    if pmids:
        filters.append(BaseStudy.pmid.in_(sorted(pmids)))
    if not filters:
        return []

    return (
        BaseStudy.query.filter(sa.or_(*filters))
        .options(*_base_study_response_load_options(user_model))
        .all()
    )


def load_response_records(base_study_ids, user_model):
    if not base_study_ids:
        return []

    records = (
        BaseStudy.query.filter(BaseStudy.id.in_(list(base_study_ids)))
        .options(*_base_study_response_load_options(user_model))
        .all()
    )
    records_by_id = {record.id: record for record in records}
    return [records_by_id[base_study_id] for base_study_id in base_study_ids]


class BaseStudyBulkPostService:
    def __init__(self, resource_cls, user_model):
        self.resource_cls = resource_cls
        self.user_model = user_model

    @staticmethod
    def ensure_user():
        current_user = get_current_user()
        if current_user is not None:
            return current_user

        current_user = create_user()
        db.session.add(current_user)
        return current_user

    @staticmethod
    def create_initial_version(record, study_data, current_user, studies_view_cls):
        version = studies_view_cls._model()
        version.base_study = record
        version.user = current_user
        version = studies_view_cls.update_or_create(
            study_data, record=version, user=current_user, flush=False
        )
        record.versions.append(version)
        return version

    def create_or_reuse(self, data, studies_view_cls):
        base_studies = []
        to_commit = []
        changed_base_study_records = []
        current_user = None

        dois, pmids = collect_lookup_identifiers(data)
        lookup = build_lookup(prefetch_lookup_records(dois, pmids, self.user_model))

        for study_data in data:
            record = match_lookup_record(lookup, study_data)
            if record is None:
                if current_user is None:
                    current_user = self.ensure_user()
                with db.session.no_autoflush:
                    record = self.resource_cls.update_or_create(
                        study_data, user=current_user, flush=False
                    )
                to_commit.append(record)
                register_lookup_record(lookup, record)
                changed_base_study_records.append(record)

            base_studies.append(record)
            if record.versions:
                continue

            if current_user is None:
                current_user = self.ensure_user()
            to_commit.append(
                self.create_initial_version(
                    record, study_data, current_user, studies_view_cls
                )
            )
            changed_base_study_records.append(record)

        return base_studies, to_commit, changed_base_study_records
