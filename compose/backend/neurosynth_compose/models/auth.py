from flask_security import UserMixin, RoleMixin, SQLAlchemyUserDatastore

from .analysis import db, BaseMixin


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
    users = db.relationship(
        "User", secondary=roles_users, back_populates="roles", lazy="dynamic"
    )


class User(BaseMixin, db.Model, UserMixin):
    __tablename__ = "users"
    active = db.Column(db.Boolean())
    name = db.Column(db.Text)
    external_id = db.Column(db.Text, unique=True)
    roles = db.relationship("Role", secondary=roles_users, back_populates="users")


class Device(BaseMixin, db.Model):
    __tablename__ = "devices"
    device_name = db.Column(db.String)
    api_key = db.Column(db.String)
    user_id = db.Column("user_id", db.Text, db.ForeignKey("users.id"))
    user = db.relationship("User", backref=db.backref("devices"))


user_datastore = SQLAlchemyUserDatastore(db, User, Role)
