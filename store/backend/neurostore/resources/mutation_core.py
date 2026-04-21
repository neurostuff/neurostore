from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import sqlalchemy as sa
from auth0.authentication.exceptions import Auth0Error
from auth0.authentication.users import Users
from connexion.context import context
from flask import current_app, request
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import raiseload, selectinload

from neurostore.database import db
from neurostore.exceptions.utils.error_helpers import (
    abort_not_found,
    abort_permission,
    abort_validation,
)
from neurostore.models import User
from neurostore.resources.utils import get_current_user, is_user_admin


def _machine_client_name(external_id: str | None) -> str:
    compose_client_id = current_app.config.get("COMPOSE_AUTH0_CLIENT_ID")
    compose_subject = (
        f"{compose_client_id}@clients" if compose_client_id else None
    )

    if compose_subject and external_id == compose_subject:
        return "compose_bot"

    if external_id and external_id.endswith("@clients"):
        return external_id.removesuffix("@clients")

    return "service-account"


def create_user():
    external_id = context.get("user")
    if external_id and external_id.endswith("@clients"):
        return User(external_id=external_id, name=_machine_client_name(external_id))

    auth = request.headers.get("Authorization", None)
    token = auth.split()[1]
    try:
        profile_info = Users(
            current_app.config["AUTH0_BASE_URL"].removeprefix("https://")
        ).userinfo(access_token=token)
    except Auth0Error:
        if external_id and external_id.endswith("@clients"):
            return User(
                external_id=external_id, name=_machine_client_name(external_id)
            )
        raise

    name = profile_info.get("name", "Unknown")
    if "@" in name:
        name = profile_info.get("nickname", "Unknown")

    return User(external_id=external_id, name=name)


def resolve_current_user(user=None):
    current_user = user or get_current_user()
    if current_user:
        return current_user

    current_user = create_user()
    try:
        db.session.add(current_user)
        db.session.commit()
    except (SQLAlchemyError, IntegrityError):
        db.session.rollback()
        current_user = User.query.filter_by(external_id=context["user"]).first()

    return current_user


@dataclass
class MutationContext:
    resource_cls: type
    data: Any
    id: str | None = None
    user: Any = None
    record: Any = None
    flush: bool = True
    current_user: Any = None
    is_admin: bool = False
    compose_bot: str = ""
    preloaded_studies: dict[str, Any] | None = None
    preloaded_nested_records: dict[str, Any] | None = None
    to_commit: list[Any] = field(default_factory=list)
    submitted_only_ids: bool = field(init=False, default=False)

    def __post_init__(self):
        self.submitted_only_ids = isinstance(self.data, dict) and set(
            self.data.keys()
        ) <= {"id"}

    @property
    def model(self):
        return self.resource_cls._model

    @property
    def only_ids(self):
        return self.submitted_only_ids


class DefaultMutationPolicy:
    def __init__(self, context: MutationContext):
        self.context = context

    @property
    def resource_cls(self):
        return self.context.resource_cls

    def prepare(self):
        data = self.context.data
        if not isinstance(data, dict):
            data = {"id": data}

        data = self.resource_cls.load_nested_records(data, self.context.record)
        self.context.preloaded_studies = data.pop("preloaded_studies", None)
        self.context.preloaded_nested_records = data.pop(
            "_preloaded_nested_records", None
        )
        self.context.data = data
        self.context.id = self.context.id or data.get("id")

    def get_lookup_query(self):
        query = self.context.model.query.options(raiseload("*", sql_only=True))
        if self.context.model is not User:
            query = query.options(selectinload(self.context.model.user))
        return query

    def init_new_record(self):
        record = self.context.model()
        record.user = self.context.current_user
        return record

    def load_existing_record(self):
        record = self.get_lookup_query().filter_by(id=self.context.id).first()
        if record is None:
            abort_not_found(self.context.model.__name__, self.context.id)
        return record

    def ensure_mutation_allowed(self):
        record = self.context.record
        if (
            not sa.inspect(record).pending
            and not self.context.only_ids
            and record.user != self.context.current_user
            and self.context.current_user.external_id != self.context.compose_bot
            and not self.context.is_admin
        ):
            abort_permission(
                "You do not have permission to modify this record."
                " You must be the owner, the compose bot, or an admin."
            )

    def handle_id_only_shortcut(self):
        self.context.to_commit.append(self.context.record)

    def apply_id_and_user(self):
        self.context.data["user_id"] = self.context.current_user.external_id
        if hasattr(self.context.record, "id"):
            self.context.data["id"] = self.context.record.id

    def check_duplicate(self):
        with db.session.no_autoflush:
            duplicate = self.resource_cls.check_duplicate(
                self.context.data, self.context.record
            )
        if duplicate and sa.inspect(self.context.record).transient:
            self.context.record.user = None
        return duplicate

    def resolve_parent_value(self, field, value):
        parent_id = value.get("id") if isinstance(value, dict) else value
        if parent_id is None:
            return None

        parent_resource_cls = self.resource_cls.resolve_related_resource(
            self.resource_cls._parent[field]
        )
        with db.session.no_autoflush:
            parent_record = parent_resource_cls._model.query.filter_by(
                id=parent_id
            ).first()
        if parent_record is None:
            abort_validation(f"Parent record not found with id={parent_id}")
        if not self.can_link_parent(field, parent_resource_cls, parent_record):
            abort_permission(
                "You do not have permission to link to this parent "
                "record. You must own the parent record, be the "
                "compose bot, or be an admin."
            )
        return parent_record

    def can_link_parent(self, field, parent_resource_cls, parent_record):
        return (
            self.context.current_user == parent_record.user
            or self.context.current_user.external_id == self.context.compose_bot
            or self.context.is_admin
        )

    def resolve_linked_value(self, field, value):
        linked_resource_cls = self.resource_cls.resolve_related_resource(
            self.resource_cls._linked[field]
        )

        if value.get("preloaded_data"):
            linked_record = value["preloaded_data"]
        else:
            if linked_resource_cls._composite_key:
                query_args = {
                    key: value[key.rstrip("_id")]["id"]
                    for key in linked_resource_cls._composite_key
                }
            else:
                linked_id = value.get("id") if isinstance(value, dict) else value
                if linked_id is None:
                    return None
                query_args = {"id": linked_id}
            with db.session.no_autoflush:
                linked_record = linked_resource_cls._model.query.filter_by(
                    **query_args
                ).first()
            if linked_record is None:
                abort_validation(f"Linked record not found with {query_args}")

        return linked_record

    def apply_scalar_fields(self):
        for key, value in self.context.data.items():
            if key in self.resource_cls._parent and value is not None:
                value = self.resolve_parent_value(key, value)
            if key in self.resource_cls._linked and value is not None:
                value = self.resolve_linked_value(key, value)

            if key not in self.resource_cls._nested and key not in {"id", "user"}:
                setattr(self.context.record, key, value)

    def pre_nested_record_update(self):
        self.context.record = self.resource_cls.pre_nested_record_update(
            self.context.record
        )

    def get_preloaded_records_for_field(self, field):
        field_preloaded_records = None
        if isinstance(self.context.preloaded_nested_records, dict):
            field_preloaded_records = self.context.preloaded_nested_records.get(field)
        if field_preloaded_records is None:
            field_preloaded_records = self.context.preloaded_studies
        return field_preloaded_records

    def resolve_nested_record(self, field_preloaded_records, nested_payload):
        nested_id = None
        if isinstance(nested_payload, dict) and nested_payload.get("id"):
            nested_id = nested_payload.get("id")
        elif isinstance(nested_payload, str):
            nested_id = nested_payload

        if isinstance(field_preloaded_records, dict) and nested_id:
            return field_preloaded_records.get(nested_id)
        return None

    def update_nested(self):
        for _field, resource_name in self.resource_cls._nested.items():
            if self.context.data.get(_field) is None:
                continue

            nested_resource_cls = self.resource_cls.resolve_related_resource(
                resource_name
            )
            field_preloaded_records = self.get_preloaded_records_for_field(_field)

            if isinstance(self.context.data[_field], list):
                nested_records = []
                for nested_payload in self.context.data[_field]:
                    nested_record = self.resolve_nested_record(
                        field_preloaded_records, nested_payload
                    )
                    nested_records.append(
                        nested_resource_cls.update_or_create(
                            nested_payload,
                            user=self.context.current_user,
                            record=nested_record,
                            flush=False,
                        )
                    )
                self.context.to_commit.extend(nested_records)
            else:
                nested_payload = self.context.data[_field]
                nested_record = self.resolve_nested_record(
                    field_preloaded_records, nested_payload
                )
                nested_records = nested_resource_cls.update_or_create(
                    nested_payload,
                    user=self.context.current_user,
                    record=nested_record,
                    flush=False,
                )
                self.context.to_commit.append(nested_records)

            setattr(self.context.record, _field, nested_records)

    def post_nested_record_update(self):
        return self.context.record

    def flush_records(self):
        if not self.context.flush:
            return

        db.session.add_all(self.context.to_commit)
        try:
            db.session.flush()
        except SQLAlchemyError as exc:
            db.session.rollback()
            abort_validation(
                "Database error occurred during nested record update: " + str(exc)
            )


class MutationExecutor:
    def __init__(self, context: MutationContext, policy: DefaultMutationPolicy):
        self.context = context
        self.policy = policy

    def execute(self):
        self.context.current_user = resolve_current_user(self.context.user)
        self.context.is_admin = is_user_admin(self.context.current_user)
        self.context.compose_bot = (
            current_app.config["COMPOSE_AUTH0_CLIENT_ID"] + "@clients"
        )

        self.policy.prepare()

        if self.context.id is None and self.context.record is None:
            self.context.record = self.policy.init_new_record()
        elif self.context.record is None:
            self.context.record = self.policy.load_existing_record()

        self.policy.ensure_mutation_allowed()

        if self.context.only_ids:
            self.policy.handle_id_only_shortcut()
            self.policy.flush_records()
            return self.context.record

        self.policy.apply_id_and_user()

        duplicate = self.policy.check_duplicate()
        if duplicate:
            return duplicate

        self.policy.apply_scalar_fields()
        self.policy.pre_nested_record_update()
        self.context.to_commit.append(self.context.record)
        self.policy.update_nested()
        record = self.policy.post_nested_record_update()
        self.policy.flush_records()
        return record
