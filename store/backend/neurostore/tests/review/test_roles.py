"""user_has_role, and is_user_admin as its admin case."""

from contextlib import contextmanager

import pytest
from connexion.context import _context

from neurostore.models import Role
from neurostore.resources.utils import is_user_admin, user_has_role


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


def test_a_reviewer_is_not_an_admin(make_user):
    user = make_user("reviewer-1", "admin-reviewer")
    assert user_has_role(user, "admin-reviewer") is True
    assert user_has_role(user, "admin") is False
    assert is_user_admin(user) is False


def test_an_admin_is_not_a_reviewer(make_user):
    user = make_user("admin-1", "admin")
    assert is_user_admin(user) is True
    assert user_has_role(user, "admin-reviewer") is False


def test_a_user_can_hold_both_roles(make_user):
    user = make_user("both-1", "admin", "admin-reviewer")
    assert user_has_role(user, "admin-reviewer") is True
    assert is_user_admin(user) is True


def test_two_roles_in_one_request_do_not_collide(make_user, request_context):
    user = make_user("reviewer-2", "admin-reviewer")
    assert user_has_role(user, "admin-reviewer") is True
    assert is_user_admin(user) is False
    assert user_has_role(user, "admin-reviewer") is True


def test_the_request_memo_is_per_user(make_user, request_context):
    admin = make_user("admin-2", "admin")
    reviewer = make_user("reviewer-3", "admin-reviewer")
    assert is_user_admin(admin) is True
    assert is_user_admin(reviewer) is False


def test_no_user_holds_no_role():
    assert user_has_role(None, "admin-reviewer") is False
    assert is_user_admin(None) is False


def test_a_grant_is_seen_in_the_next_request(session, make_user):
    user = make_user("grantee-1")
    with request_scope():
        assert is_user_admin(user) is False
    grant(session, user, "admin")
    with request_scope():
        assert is_user_admin(user) is True


def test_one_request_loads_a_users_roles_once(make_user, statements):
    user = make_user("counted-1", "admin")
    with request_scope(), statements() as seen:
        assert user_has_role(user, "admin") is True
        assert is_user_admin(user) is True
        assert user_has_role(user, "admin-reviewer") is False
    assert len([s for s in seen if "roles_users" in s]) == 1
