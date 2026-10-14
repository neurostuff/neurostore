"""user_has_role, and is_user_admin as its admin case."""

from contextlib import contextmanager

import pytest
import sqlalchemy as sa
from connexion.context import _context

from neurostore.models import Role, User
from neurostore.resources.utils import is_user_admin, user_has_role


def make_user(session, external_id, *role_names):
    user = User(name=external_id, external_id=external_id)
    for name in role_names:
        role = session.get(Role, name) or Role(id=name, name=name)
        user.roles.append(role)
    session.add(user)
    session.commit()
    return user


@pytest.fixture
def request_context():
    token = _context.set({})
    yield
    _context.reset(token)


@contextmanager
def request_scope():
    token = _context.set({})
    try:
        yield
    finally:
        _context.reset(token)


def grant(session, user, name):
    user.roles.append(session.get(Role, name) or Role(id=name, name=name))
    session.commit()


def test_a_reviewer_is_not_an_admin(session):
    user = make_user(session, "reviewer-1", "admin-reviewer")
    assert user_has_role(user, "admin-reviewer") is True
    assert user_has_role(user, "admin") is False
    assert is_user_admin(user) is False


def test_an_admin_is_not_a_reviewer(session):
    user = make_user(session, "admin-1", "admin")
    assert is_user_admin(user) is True
    assert user_has_role(user, "admin-reviewer") is False


def test_a_user_can_hold_both_roles(session):
    user = make_user(session, "both-1", "admin", "admin-reviewer")
    assert user_has_role(user, "admin-reviewer") is True
    assert is_user_admin(user) is True


def test_two_roles_in_one_request_do_not_collide(session, request_context):
    user = make_user(session, "reviewer-2", "admin-reviewer")
    assert user_has_role(user, "admin-reviewer") is True
    assert is_user_admin(user) is False
    assert user_has_role(user, "admin-reviewer") is True


def test_the_request_memo_is_per_user(session, request_context):
    admin = make_user(session, "admin-2", "admin")
    reviewer = make_user(session, "reviewer-3", "admin-reviewer")
    assert is_user_admin(admin) is True
    assert is_user_admin(reviewer) is False


def test_no_user_holds_no_role(session):
    assert user_has_role(None, "admin-reviewer") is False
    assert is_user_admin(None) is False


def test_a_grant_is_seen_in_the_next_request(session):
    user = make_user(session, "grantee-1")
    with request_scope():
        assert is_user_admin(user) is False
    grant(session, user, "admin")
    with request_scope():
        assert is_user_admin(user) is True


def test_one_request_loads_a_users_roles_once(session):
    user = make_user(session, "counted-1", "admin")
    statements = []

    def record(conn, cursor, statement, *args):
        if "roles_users" in statement:
            statements.append(statement)

    with request_scope():
        sa.event.listen(session.bind, "before_cursor_execute", record)
        try:
            assert user_has_role(user, "admin") is True
            assert is_user_admin(user) is True
            assert user_has_role(user, "admin-reviewer") is False
        finally:
            sa.event.remove(session.bind, "before_cursor_execute", record)
    assert len(statements) == 1
