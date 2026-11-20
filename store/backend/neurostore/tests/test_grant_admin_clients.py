from click.testing import CliRunner

from neurostore import cli
from neurostore.models import Role, User


def _admin_role(session):
    role = Role.query.filter_by(name="admin").one_or_none()
    if role is None:
        role = Role(id="admin", name="admin", description="Admin role")
        session.add(role)
        session.commit()
    return role


def _grant(monkeypatch, db, *args, env=None):
    monkeypatch.setattr(cli, "_run_with_runtime", lambda callback: callback(None, db))
    return CliRunner().invoke(cli.main, ["grant-admin-clients", *args], env=env or {})


def _roles(external_id):
    user = User.query.filter_by(external_id=external_id).one()
    return user, [role.name for role in user.roles]


def test_clients_from_the_environment_become_admin_users(session, db, monkeypatch):
    _admin_role(session)

    result = _grant(monkeypatch, db, env={"ADMIN_CLIENT_IDS": "uploader other"})

    assert result.exit_code == 0, result.output
    for client_id in ("uploader", "other"):
        user, roles = _roles(f"{client_id}@clients")
        assert user.active and roles == ["admin"]
    assert "uploader" not in result.output and "other" not in result.output


def test_an_existing_client_user_keeps_its_row_and_gains_the_role_once(
    session, db, monkeypatch
):
    _admin_role(session)
    existing = User(external_id="uploader@clients", name="ns-pond ingester")
    session.add(existing)
    session.commit()

    first = _grant(monkeypatch, db, "--client-id", "uploader")
    again = _grant(monkeypatch, db, "--client-id", "uploader")

    assert first.exit_code == 0 and again.exit_code == 0, first.output + again.output
    user, roles = _roles("uploader@clients")
    assert (user.id, user.name, roles) == (existing.id, "ns-pond ingester", ["admin"])
    assert "0 user(s) created, 1 granted admin" in first.output
    assert "0 user(s) created, 0 granted admin" in again.output


def test_without_the_admin_role_it_fails_and_creates_nothing(session, db, monkeypatch):
    assert Role.query.filter_by(name="admin").one_or_none() is None

    result = _grant(monkeypatch, db, "--client-id", "uploader")

    assert result.exit_code != 0
    assert "db upgrade" in result.output
    assert User.query.filter_by(external_id="uploader@clients").one_or_none() is None


def test_an_empty_client_list_is_a_no_op(session, db, monkeypatch):
    _admin_role(session)

    result = _grant(monkeypatch, db, env={"ADMIN_CLIENT_IDS": ""})

    assert result.exit_code == 0, result.output
    assert User.query.filter(User.external_id.like("%@clients")).count() == 0
