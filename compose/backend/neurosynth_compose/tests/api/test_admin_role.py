"""
Tests for admin role functionality in compose
"""
import pytest
from neurosynth_compose.models import User, Role, MetaAnalysis, Project
from neurosynth_compose.resources.analysis import is_user_admin


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


def test_admin_can_modify_others_records(auth_client, user_data, session, db):
    """Test that admin users can modify records they don't own"""
    # Get a regular user's meta-analysis
    regular_user = User.query.filter_by(name="user1").first()
    meta_analysis = MetaAnalysis.query.filter_by(user=regular_user).first()
    assert meta_analysis is not None

    # Create admin user
    admin_role = Role.query.filter_by(name="admin").first()
    if not admin_role:
        admin_role = Role(id="admin", name="admin", description="Admin role")
        session.add(admin_role)
        session.commit()

    admin_user = User(name="admin_user", external_id="admin-user-id")
    admin_user.roles.append(admin_role)
    session.add(admin_user)
    session.commit()

    # Create admin client
    from neurosynth_compose.tests.utils import Client
    from jose.jwt import encode

    admin_token = encode({"sub": "admin-user-id"}, "admin123", algorithm="HS256")
    admin_client = Client(token=admin_token, username="admin-user-id")

    # Try to modify the meta-analysis as admin
    new_name = "Modified by admin"
    resp = admin_client.put(
        f"/api/meta-analyses/{meta_analysis.id}",
        data={"name": new_name}
    )

    assert resp.status_code == 200
    assert resp.json()["name"] == new_name


def test_admin_can_delete_others_records(auth_client, user_data, session, db):
    """Test that admin users can delete records they don't own"""
    # Get a regular user's meta-analysis
    regular_user = User.query.filter_by(name="user1").first()
    meta_analysis = MetaAnalysis.query.filter_by(user=regular_user).first()
    assert meta_analysis is not None
    meta_analysis_id = meta_analysis.id

    # Create admin user
    admin_role = Role.query.filter_by(name="admin").first()
    if not admin_role:
        admin_role = Role(id="admin", name="admin", description="Admin role")
        session.add(admin_role)
        session.commit()

    admin_user = User(name="admin_user", external_id="admin-user-id")
    admin_user.roles.append(admin_role)
    session.add(admin_user)
    session.commit()

    # Create admin client
    from neurosynth_compose.tests.utils import Client
    from jose.jwt import encode

    admin_token = encode({"sub": "admin-user-id"}, "admin123", algorithm="HS256")
    admin_client = Client(token=admin_token, username="admin-user-id")

    # Try to delete the meta-analysis as admin
    resp = admin_client.delete(f"/api/meta-analyses/{meta_analysis_id}")

    assert resp.status_code == 204
    # Verify meta-analysis is deleted
    assert MetaAnalysis.query.filter_by(id=meta_analysis_id).first() is None


def test_admin_can_see_private_records(auth_client, user_data, session, db):
    """Test that admin users can see all records including private ones"""
    # Create a private project owned by user1
    regular_user = User.query.filter_by(name="user1").first()
    private_project = Project(
        name="Private Project",
        user=regular_user,
        public=False
    )
    session.add(private_project)
    session.commit()
    project_id = private_project.id

    # Create admin user
    admin_role = Role.query.filter_by(name="admin").first()
    if not admin_role:
        admin_role = Role(id="admin", name="admin", description="Admin role")
        session.add(admin_role)
        session.commit()

    admin_user = User(name="admin_user", external_id="admin-user-id")
    admin_user.roles.append(admin_role)
    session.add(admin_user)
    session.commit()

    # Create admin client
    from neurosynth_compose.tests.utils import Client
    from jose.jwt import encode

    admin_token = encode({"sub": "admin-user-id"}, "admin123", algorithm="HS256")
    admin_client = Client(token=admin_token, username="admin-user-id")

    # Admin should be able to see the private project
    resp = admin_client.get("/api/projects/")
    assert resp.status_code == 200

    project_ids = [p["id"] for p in resp.json()["results"]]
    assert project_id in project_ids


def test_non_admin_cannot_modify_others_records(auth_client, user_data, session, db):
    """Test that non-admin users cannot modify records they don't own"""
    # Get user1's client and user2's meta-analysis
    user1_client = auth_client
    user2 = User.query.filter_by(name="user2").first()
    if not user2:
        pytest.skip("user2 not found in test data")

    meta_analysis = MetaAnalysis.query.filter_by(user=user2).first()
    if not meta_analysis:
        pytest.skip("No meta-analysis found for user2")

    # Try to modify user2's meta-analysis as user1 (should fail)
    resp = user1_client.put(
        f"/api/meta-analyses/{meta_analysis.id}",
        data={"name": "Unauthorized modification"}
    )

    assert resp.status_code == 403


def test_non_admin_cannot_delete_others_records(auth_client, user_data, session, db):
    """Test that non-admin users cannot delete records they don't own"""
    # Get user1's client and user2's meta-analysis
    user1_client = auth_client
    user2 = User.query.filter_by(name="user2").first()
    if not user2:
        pytest.skip("user2 not found in test data")

    meta_analysis = MetaAnalysis.query.filter_by(user=user2).first()
    if not meta_analysis:
        pytest.skip("No meta-analysis found for user2")

    # Try to delete user2's meta-analysis as user1 (should fail)
    resp = user1_client.delete(f"/api/meta-analyses/{meta_analysis.id}")

    assert resp.status_code == 403
