"""
Tests for admin role functionality
"""
from ...models import User, Role, Study, Studyset
from ...resources.utils import is_user_admin


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


def test_admin_can_modify_others_records(auth_clients, user_data, session):
    """Test that admin users can modify records they don't own"""
    from .request_utils import Client
    from jose.jwt import encode

    # Get a regular user's study
    regular_user = User.query.filter_by(name="user1").first()
    study = Study.query.filter_by(user=regular_user).first()
    assert study is not None

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
    admin_token = encode({"sub": "admin-user-id"}, "admin123", algorithm="HS256")
    admin_client = Client(token=admin_token, username="admin-user-id")

    # Try to modify the study as admin
    new_name = "Modified by admin"
    resp = admin_client.put(
        f"/api/studies/{study.id}",
        data={"name": new_name}
    )

    assert resp.status_code == 200
    assert resp.json()["name"] == new_name


def test_admin_can_delete_others_records(auth_clients, user_data, session):
    """Test that admin users can delete records they don't own"""
    from .request_utils import Client
    from jose.jwt import encode

    # Get a regular user's study
    regular_user = User.query.filter_by(name="user1").first()
    study = Study.query.filter_by(user=regular_user).first()
    assert study is not None
    study_id = study.id

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
    admin_token = encode({"sub": "admin-user-id"}, "admin123", algorithm="HS256")
    admin_client = Client(token=admin_token, username="admin-user-id")

    # Try to delete the study as admin
    resp = admin_client.delete(f"/api/studies/{study_id}")

    assert resp.status_code == 204
    # Verify study is deleted
    assert Study.query.filter_by(id=study_id).first() is None


def test_admin_can_see_private_records(auth_clients, user_data, session):
    """Test that admin users can see all records including private ones"""
    from .request_utils import Client
    from jose.jwt import encode

    # Create a private studyset owned by user1
    regular_user = User.query.filter_by(name="user1").first()
    private_studyset = Studyset(
        name="Private Studyset",
        user=regular_user,
        public=False
    )
    session.add(private_studyset)
    session.commit()
    studyset_id = private_studyset.id

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
    admin_token = encode({"sub": "admin-user-id"}, "admin123", algorithm="HS256")
    admin_client = Client(token=admin_token, username="admin-user-id")

    # Admin should be able to see the private studyset
    resp = admin_client.get("/api/studysets/")
    assert resp.status_code == 200

    studyset_ids = [s["id"] for s in resp.json()["results"]]
    assert studyset_id in studyset_ids


def test_non_admin_cannot_modify_others_records(auth_clients, user_data, session):
    """Test that non-admin users cannot modify records they don't own"""
    # Get user1's client and user2's study
    user1_client = auth_clients[0]
    user2 = User.query.filter_by(name="user2").first()
    study = Study.query.filter_by(user=user2).first()
    assert study is not None

    # Try to modify user2's study as user1 (should fail)
    resp = user1_client.put(
        f"/api/studies/{study.id}",
        data={"name": "Unauthorized modification"}
    )

    assert resp.status_code == 403


def test_non_admin_cannot_delete_others_records(auth_clients, user_data, session):
    """Test that non-admin users cannot delete records they don't own"""
    # Get user1's client and user2's study
    user1_client = auth_clients[0]
    user2 = User.query.filter_by(name="user2").first()
    study = Study.query.filter_by(user=user2).first()
    assert study is not None

    # Try to delete user2's study as user1 (should fail)
    resp = user1_client.delete(f"/api/studies/{study.id}")

    assert resp.status_code == 403
