from auth0.management import ManagementClient
from neurosynth_compose.resources.users import User
from flask import current_app

TOKEN = "INSERT TOKEN"


management_client = ManagementClient(
    domain=current_app.config["AUTH0_BASE_URL"].removeprefix("https://"),
    token=TOKEN
)

result_pager = management_client.users.list(per_page=100)

sql_users = []
for user in result_pager:
    print(user.name)
    sql_user = User.query.filter_by(external_id=user.user_id).one_or_none()
    if sql_user is None:
        sql_user = User(external_id=user.user_id)
    sql_user.name = user.name
    sql_users.append(sql_user)
    print(user.user_id)
