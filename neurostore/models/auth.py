from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.orm import relationship, backref
from flask_security import UserMixin, RoleMixin
from flask_dance.consumer.storage.sqla import OAuthConsumerMixin


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

    name = db.Column(db.Text)
    email = db.Column(db.Text, unique=True)
    password = db.Column(db.Text)
    active = db.Column(db.Boolean)
    confirmed_at = db.Column(db.DateTime)
    roles = relationship(
        "Role", secondary=roles_users, backref=backref("users", lazy="dynamic")
    )
    username = association_proxy("oauth", "provider_user_id")


class OAuth(OAuthConsumerMixin, db.Model):
    __tablename__ = "oauth"

    user_id = db.Column(db.Text, db.ForeignKey("users.id"))
    user = relationship(User, backref=backref("oauth"))
    provider_user_id = db.Column(db.Text, unique=True, nullable=False)
    provider = db.Column(db.Text)
