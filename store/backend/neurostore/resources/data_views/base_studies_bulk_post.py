from __future__ import annotations

from neurostore.base_studies import (
    ARTICLE_ID_FIELDS,
    ARTICLE_ID_LISTS,
    article_identifiers,
    attach_identifiers,
    held_by,
    lock_identifiers,
    resolve,
    settle_publication_status,
)
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
        selectinload(BaseStudy.identifier_rows),
        selectinload(BaseStudy.versions)
        .load_only(
            Study.id,
            Study.user_id,
            Study.created_at,
            Study.updated_at,
            Study.source,
            Study.has_coordinates,
            Study.has_images,
            Study.has_z_maps,
            Study.has_t_maps,
            Study.has_beta_and_variance_maps,
        )
        .options(
            raiseload("*", sql_only=True),
            selectinload(Study.user)
            .load_only(user_model.external_id, user_model.name)
            .options(raiseload("*", sql_only=True)),
        ),
    )


def load_base_study_records(base_study_ids, user_model):
    if not base_study_ids:
        return []
    return (
        BaseStudy.query.filter(BaseStudy.id.in_(list(base_study_ids)))
        .options(*_base_study_response_load_options(user_model))
        .all()
    )


def load_response_records(base_study_ids, user_model):
    if not base_study_ids:
        return []

    records = load_base_study_records(base_study_ids, user_model)
    records_by_id = {record.id: record for record in records}
    return [records_by_id[base_study_id] for base_study_id in base_study_ids]


class BaseStudyBulkPostService:
    def __init__(self, resource_cls, user_model, *, settings):
        self.resource_cls = resource_cls
        self.user_model = user_model
        self.settings = settings

    @staticmethod
    def ensure_user():
        current_user = get_current_user()
        if current_user is not None:
            return current_user

        current_user = create_user()
        db.session.add(current_user)
        return current_user

    def create_initial_version(
        self, record, study_data, current_user, studies_view_cls
    ):
        version = studies_view_cls._model()
        version.base_study = record
        version.user = current_user
        version = studies_view_cls.update_or_create(
            study_data,
            record=version,
            user=current_user,
            flush=False,
            settings=self.settings,
        )
        record.versions.append(version)
        return version

    def create_or_reuse(self, data, studies_view_cls):
        """Each posted study's base study: the one its identifiers name, with the
        identifiers it lacked added, or a new one when none of them is held. Returns the
        base studies in posted order, the records to add, and the records that changed."""
        base_studies = []
        to_commit = []
        changed_base_study_records = []
        current_user = None

        posted = [article_identifiers(study_data) for study_data in data]
        every_identifier = [identifier for identifiers in posted for identifier in identifiers]
        lock_identifiers(db.session, every_identifier)
        held = held_by(db.session, every_identifier)
        records = {
            record.id: record
            for record in load_base_study_records(
                sorted({holder.base_study_id for holder in held.values()}), self.user_model
            )
        }

        for study_data, identifiers in zip(data, posted):
            base_study_id = resolve(identifiers, held)
            if base_study_id is None:
                if current_user is None:
                    current_user = self.ensure_user()
                with db.session.no_autoflush:
                    record = self.resource_cls.update_or_create(
                        {k: v for k, v in study_data.items() if k not in ARTICLE_ID_FIELDS},
                        user=current_user,
                        flush=False,
                        settings=self.settings,
                    )
                # Added now: a merge candidate recorded for a later study may name it.
                db.session.add(record)
                to_commit.append(record)
                changed_base_study_records.append(record)
                created = True
            else:
                record = records[base_study_id]
                created = False

            with db.session.no_autoflush:
                attached = attach_identifiers(
                    db.session, record, identifiers, held, source="post"
                )
            settle_publication_status(record, study_data.get("publication_status"))
            records[record.id] = record
            if attached.wrote and not created:
                changed_base_study_records.append(record)

            base_studies.append(record)
            if record.versions:
                continue

            if current_user is None:
                current_user = self.ensure_user()
            to_commit.append(
                self.create_initial_version(
                    record,
                    {
                        k: v
                        for k, v in study_data.items()
                        if k not in ARTICLE_ID_LISTS and k != "publication_status"
                    },
                    current_user,
                    studies_view_cls,
                )
            )
            changed_base_study_records.append(record)

        return base_studies, to_commit, changed_base_study_records
