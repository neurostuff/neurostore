from flask_security import UserMixin, RoleMixin, SQLAlchemyUserDatastore


from ..database import db
from .data import BaseMixin


roles_users = db.Table(
    "roles_users",
    db.Model.metadata,
    db.Column("user_id", db.Text, db.ForeignKey("users.id")),
    db.Column("role_id", db.Text, db.ForeignKey("roles.id")),
)


class Role(BaseMixin, db.Model, RoleMixin):
    __tablename__ = "roles"

    name = db.Column(db.Text, unique=True)
    description = db.Column(db.Text)


class User(BaseMixin, db.Model, UserMixin):
    __tablename__ = "users"
    active = db.Column(db.Boolean())
    name = db.Column(db.Text, index=True)
    external_id = db.Column(db.Text, unique=True)
    roles = db.relationship(
        "Role", secondary=roles_users, backref=db.backref("users", lazy="dynamic")
    )


user_datastore = SQLAlchemyUserDatastore(db, User, Role)
