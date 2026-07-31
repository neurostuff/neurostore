"""
Tests for admin role functionality
"""

import warnings

import pytest

import sqlalchemy as sa
from sqlalchemy.exc import SAWarning

from neurostore.models import Role, Study, Studyset, User
from neurostore.models.data import BaseStudy
from neurostore.resources.utils import is_user_admin

pytestmark = pytest.mark.anyio


def test_is_user_admin_returns_false_for_non_admin(session):
    """Test that is_user_admin returns False for users without admin role"""
    user = User(name="regular_user", external_id="regular-user-id")
    session.add(user)
    session.commit()

    assert is_user_admin(user) is False


def test_is_user_admin_returns_true_for_admin(session):
    """Test that is_user_admin returns True for users with admin role"""
    # Create admin role
    admin_role = Role(id="admin", name="admin", description="Admin role")
    session.add(admin_role)

    # Create user with admin role
    user = User(name="admin_user", external_id="admin-user-id")
    user.roles.append(admin_role)
    session.add(user)
    session.commit()

    assert is_user_admin(user) is True


def test_is_user_admin_returns_false_for_none(session):
    """Test that is_user_admin returns False when user is None"""
    assert is_user_admin(None) is False


def test_is_user_admin_does_not_autoflush_transient_study_relationships(session):
    user = User(name="regular_user", external_id="regular-user-transient-id")
    base_study = BaseStudy(name="Transient Base Study", level="group", user=user)
    session.add_all([user, base_study])
    session.commit()

    transient_study = Study(
        name="Transient Study",
        user=user,
        base_study=base_study,
        level="group",
    )

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", SAWarning)
        assert is_user_admin(user) is False

    messages = [str(w.message) for w in caught]
    assert not any("Object of type <Study> not in session" in msg for msg in messages)
    assert sa.inspect(transient_study).transient is True


async def test_admin_can_modify_others_records(admin_client, user_data):
    """Test that admin users can modify records they don't own"""
    # Get a regular user's study
    regular_user = User.query.filter_by(name="user1").first()
    study = Study.query.filter_by(user=regular_user).first()
    assert study is not None

    # Try to modify the study as admin
    new_name = "Modified by admin"
    resp = await admin_client.put(f"/api/studies/{study.id}", data={"name": new_name})

    assert resp.status_code == 200
    assert resp.json()["name"] == new_name


async def test_admin_can_delete_others_records(admin_client, user_data):
    """Test that admin users can delete records they don't own"""
    # Get a regular user's study
    regular_user = User.query.filter_by(name="user1").first()
    study = Study.query.filter_by(user=regular_user).first()
    assert study is not None
    study_id = study.id

    # Try to delete the study as admin
    resp = await admin_client.delete(f"/api/studies/{study_id}")

    assert resp.status_code == 200
    # Verify study is deleted
    assert Study.query.filter_by(id=study_id).first() is None


async def test_admin_can_see_private_records(admin_client, user_data, session):
    """Test that admin users can see all records including private ones"""
    # Create a private studyset owned by user1
    regular_user = User.query.filter_by(name="user1").first()
    private_studyset = Studyset(
        name="Private Studyset", user=regular_user, public=False
    )
    session.add(private_studyset)
    session.commit()
    studyset_id = private_studyset.id

    # Admin should be able to see the private studyset
    resp = await admin_client.get("/api/studysets/")
    assert resp.status_code == 200

    studyset_ids = [s["id"] for s in resp.json()["results"]]
    assert studyset_id in studyset_ids


async def test_non_admin_cannot_modify_others_records(auth_client, user_data, session):
    """Test that non-admin users cannot modify records they don't own"""
    user2 = User.query.filter_by(name="user2").first()
    study = Study.query.filter_by(user=user2).first()
    assert study is not None

    # Try to modify user2's study as user1 (should fail)
    resp = await auth_client.put(
        f"/api/studies/{study.id}", data={"name": "Unauthorized modification"}
    )

    assert resp.status_code == 403


async def test_non_admin_cannot_delete_others_records(auth_client, user_data, session):
    """Test that non-admin users cannot delete records they don't own"""
    user2 = User.query.filter_by(name="user2").first()
    study = Study.query.filter_by(user=user2).first()
    assert study is not None

    # Try to delete user2's study as user1 (should fail)
    resp = await auth_client.delete(f"/api/studies/{study.id}")

    assert resp.status_code == 403
