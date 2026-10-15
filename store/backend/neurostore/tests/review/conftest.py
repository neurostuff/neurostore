"""Helpers the /review tests share: a user factory and a recorder of the SQL a block runs."""

from contextlib import contextmanager

import pytest
import sqlalchemy as sa

from neurostore.models import Role, User


@pytest.fixture
def make_user(session):
    def make(external_id, *role_names):
        user = session.scalar(sa.select(User).where(User.external_id == external_id))
        if user is None:
            user = User(name=f"name of {external_id}", external_id=external_id)
            session.add(user)
        user.roles = [session.get(Role, name) or Role(id=name, name=name) for name in role_names]
        session.commit()
        return user

    return make


@pytest.fixture
def statements(session):
    @contextmanager
    def recording():
        seen = []

        def record(conn, cursor, statement, *args):
            seen.append(statement)

        sa.event.listen(session.bind, "before_cursor_execute", record)
        try:
            yield seen
        finally:
            sa.event.remove(session.bind, "before_cursor_execute", record)

    return recording
