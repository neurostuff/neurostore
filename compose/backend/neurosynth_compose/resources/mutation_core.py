from __future__ import annotations

from collections import ChainMap
from dataclasses import dataclass
from operator import itemgetter
from typing import Any

from flask import abort
from sqlalchemy import select

from neurosynth_compose.database import db
from neurosynth_compose.models.analysis import (
    AnnotationReference,
    Condition,
    StudysetReference,
)
from neurosynth_compose.resources.common import (
    create_user,
    get_current_user,
    is_user_admin,
)


@dataclass
class MutationContext:
    resource_cls: type
    data: Any
    id: str | None = None
    commit: bool = True
    user: Any = None
    record: Any = None
    flush: bool = True
    current_user: Any = None
    committed_externally: bool = False

    @property
    def model(self):
        return self.resource_cls._model

    @property
    def only_ids(self):
        return isinstance(self.data, dict) and set(self.data.keys()) <= {"id"}


def resolve_current_user(user=None):
    current_user = user or get_current_user()
    if current_user:
        return current_user

    current_user = create_user()
    if current_user is None:
        return None

    db.session.add(current_user)
    db.session.commit()
    return current_user


class ComposeMutationPolicy:
    def __init__(self, context: MutationContext):
        self.context = context

    @property
    def resource_cls(self):
        return self.context.resource_cls

    def prepare(self):
        if not isinstance(self.context.data, dict):
            self.context.data = {"id": self.context.data}
        self.context.id = self.context.id or self.context.data.get("id")

    def init_new_record(self):
        if self.context.model is Condition:
            record = (
                db.session.execute(
                    select(self.context.model)
                    .where(self.context.model.name == self.context.data.get("name"))
                    .limit(1)
                )
                .scalars()
                .first()
            )
            if record is not None:
                return record

        record = self.context.model()
        if hasattr(record, "user"):
            record.user = self.context.current_user
        return record

    def load_existing_record(self):
        record = db.session.execute(
            select(self.context.model).where(self.context.model.id == self.context.id)
        ).scalar_one_or_none()
        if record is None and self.context.model in (
            StudysetReference,
            AnnotationReference,
        ):
            return self.context.model(id=self.context.id)
        if record is None:
            abort(422)
        return record

    def ensure_mutation_allowed(self):
        record = self.context.record
        if getattr(record, "user_id", None) is None:
            return
        if self.context.only_ids:
            return
        if record.user_id == self.context.current_user.external_id:
            return
        if is_user_admin(self.context.current_user):
            return
        abort(
            403,
            description=(
                "You do not have permission to modify this record. "
                "You must be the owner or an admin."
            ),
        )

    def apply_external_request(self):
        self.context.committed_externally = bool(
            self.resource_cls._external_request(
                self.context.data,
                self.context.record,
                self.context.id,
            )
        )

    def apply_scalar_fields(self):
        nested_keys = [
            item
            for key in self.resource_cls._nested.keys()
            for item in (key if isinstance(key, tuple) else (key,))
        ]
        if self.context.committed_externally:
            return
        for key, value in self.context.data.items():
            if key not in nested_keys and key not in {"id", "user"}:
                setattr(self.context.record, key, value)

    def _resolve_nested_payload(self, field):
        field = (field,) if not isinstance(field, tuple) else field
        relevant_keys = {key for key in self.context.data.keys() if key in field}
        if relevant_keys and relevant_keys < set(field):
            field = (list(relevant_keys)[0],)

        try:
            nested_data = itemgetter(*field)(self.context.data)
        except KeyError:
            nested_data = None

        if isinstance(nested_data, tuple):
            nested_data = [dict(ChainMap(*rows)) for rows in zip(*nested_data)]
        return field, nested_data

    def _resolve_existing_nested(self):
        if not self.resource_cls._attribute_name:
            return None
        return getattr(self.context.record, self.resource_cls._attribute_name, None)

    def apply_nested_fields(self):
        for field, resource_name in self.resource_cls._nested.items():
            field_names, nested_data = self._resolve_nested_payload(field)
            if nested_data is None:
                continue

            resource_cls = self.resource_cls.resolve_related_resource(resource_name)
            existing_nested = self._resolve_existing_nested()
            if existing_nested:
                for nested_payload, existing in zip(nested_data, existing_nested):
                    if isinstance(nested_payload, dict):
                        nested_payload.setdefault("id", existing.id)

            if isinstance(nested_data, list):
                nested_records = [
                    resource_cls.update_or_create(
                        payload,
                        commit=False,
                        user=self.context.current_user,
                        flush=False,
                    )
                    for payload in nested_data
                ]
            else:
                nested_records = resource_cls.update_or_create(
                    nested_data,
                    commit=False,
                    user=self.context.current_user,
                    flush=False,
                )

            update_field = (
                field_names
                if not self.resource_cls._attribute_name
                else (self.resource_cls._attribute_name,)
            )
            for field_name in update_field:
                setattr(self.context.record, field_name, nested_records)

    def finalize(self):
        if self.context.current_user is None:
            abort(401, description="user authentication required")

        if (
            hasattr(self.context.record, "user_id")
            and getattr(self.context.record, "user_id", None) is None
            and hasattr(self.context.record, "user")
        ):
            self.context.record.user = self.context.current_user

        db.session.add(self.context.record)
        if self.context.flush:
            db.session.flush()


class MutationExecutor:
    def __init__(self, context: MutationContext):
        self.context = context
        self.policy = ComposeMutationPolicy(context)

    def execute(self):
        self.context.current_user = resolve_current_user(self.context.user)
        self.policy.prepare()

        if self.context.record is not None:
            pass
        elif self.context.id is None:
            self.context.record = self.policy.init_new_record()
        else:
            self.context.record = self.policy.load_existing_record()

        self.policy.ensure_mutation_allowed()
        if self.context.only_ids:
            return self.context.record

        self.policy.apply_external_request()
        self.policy.apply_scalar_fields()
        self.policy.apply_nested_fields()
        self.policy.finalize()
        return self.context.record


def execute_mutation(
    resource_cls,
    data,
    *,
    id=None,
    commit=True,
    user=None,
    record=None,
    flush=True,
):
    context = MutationContext(
        resource_cls=resource_cls,
        data=data,
        id=id,
        commit=commit,
        user=user,
        record=record,
        flush=flush,
    )
    record = MutationExecutor(context).execute()
    if commit:
        from neurosynth_compose.database import commit_session

        commit_session()
    return record
