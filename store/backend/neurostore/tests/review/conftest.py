"""Helpers the /review tests share: API clients, a user factory and a recorder of the SQL a
block runs."""

from contextlib import contextmanager

import pytest
import sqlalchemy as sa

from neurostore.models import Role, User
from neurostore.tests.request_utils import AsyncClient
from neurostore.tests.review.layouts import LEAD, OTHER, REVIEWER, TOKENS


@pytest.fixture
async def clients(app, session, make_user, mock_auth):
    make_user(REVIEWER, "admin-reviewer")
    make_user(OTHER, "admin-reviewer")
    make_user(LEAD, "admin", "admin-reviewer")
    made = {
        user_id: AsyncClient(token=token, asgi_app=app.asgi_app, username=user_id)
        for user_id, token in TOKENS.items()
    }
    made[None] = AsyncClient(token=None, asgi_app=app.asgi_app)
    yield made
    for client in made.values():
        await client.aclose()


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
