from auth0.management import ManagementClient

from neurosynth_compose.resources.users import User

TOKEN = "INSERT TOKEN"


def add_usernames(settings, token):
    """Synchronize Auth0 user names using explicitly supplied settings."""
    management_client = ManagementClient(
        domain=settings["AUTH0_BASE_URL"].removeprefix("https://"), token=token
    )
    sql_users = []
    for user in management_client.users.list(per_page=100):
        sql_user = User.query.filter_by(external_id=user.user_id).one_or_none()
        if sql_user is None:
            sql_user = User(external_id=user.user_id)
        sql_user.name = user.name
        sql_users.append(sql_user)
    return sql_users
