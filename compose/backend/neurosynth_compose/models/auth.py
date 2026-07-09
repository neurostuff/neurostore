from flask_security import RoleMixin, SQLAlchemyUserDatastore, UserMixin
from sqlalchemy import Boolean, Column, ForeignKey, String, Table, Text
from sqlalchemy.orm import backref, relationship

from neurosynth_compose.database import db
from neurosynth_compose.models.analysis import BaseMixin

roles_users = Table(
    "roles_users",
    db.metadata,
    Column("user_id", Text, ForeignKey("users.id")),
    Column("role_id", Text, ForeignKey("roles.id")),
)


class Role(BaseMixin, db.Model, RoleMixin):
    __tablename__ = "roles"

    name = Column(Text, unique=True)
    description = Column(Text)
    users = relationship(
        "User", secondary=roles_users, back_populates="roles", lazy="dynamic"
    )


class User(BaseMixin, db.Model, UserMixin):
    __tablename__ = "users"
    active = Column(Boolean())
    name = Column(Text)
    external_id = Column(Text, unique=True)
    roles = relationship("Role", secondary=roles_users, back_populates="users")


class Device(BaseMixin, db.Model):
    __tablename__ = "devices"
    device_name = Column(String)
    api_key = Column(String)
    user_id = Column("user_id", Text, ForeignKey("users.id"))
    user = relationship("User", backref=backref("devices"))


user_datastore = SQLAlchemyUserDatastore(db, User, Role)
