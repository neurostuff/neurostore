from auth0.v3.management.users import Users
from neurosynth_compose.resources.users import User

TOKEN = "INSERT TOKEN"


user_endpoint = Users(domain="neurosynth-staging.us.auth0.com", token=TOKEN)

result = user_endpoint.list(per_page=100)["users"]

sql_users = []
for user in result:
    print(user["name"])
    sql_user = User.query.filter_by(external_id=user["user_id"]).one_or_none()
    if sql_user is None:
        sql_user = User(external_id=user["user_id"])
    sql_user.name = user["name"]
    sql_users.append(sql_user)
    print(user["user_id"])
