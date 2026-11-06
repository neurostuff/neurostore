from sqlalchemy.dialects.postgresql import ARRAY

from neurostore.database import db
from neurostore.models.data import BaseMixin

roles_users = db.Table(
    "roles_users",
    db.Model.metadata,
    db.Column("user_id", db.Text, db.ForeignKey("users.id")),
    db.Column("role_id", db.Text, db.ForeignKey("roles.id")),
)


class Role(BaseMixin, db.Model):
    __tablename__ = "roles"

    name = db.Column(db.Text, unique=True)
    description = db.Column(db.Text)

    def __str__(self):
        """The label the admin's forms and lists show for a role."""
        return self.name or self.id


class User(BaseMixin, db.Model):
    __tablename__ = "users"
    active = db.Column(db.Boolean())
    name = db.Column(db.Text, index=True)
    external_id = db.Column(db.Text, unique=True)
    roles = db.relationship(
        "Role", secondary=roles_users, backref=db.backref("users", lazy="dynamic")
    )


class ApiKey(BaseMixin, db.Model):
    """A user's long-lived key for both Store and Compose; only its hash is kept."""

    __tablename__ = "api_keys"
    user_id = db.Column(
        db.Text, db.ForeignKey("users.external_id"), nullable=False, index=True
    )
    name = db.Column(db.Text, nullable=False)
    prefix = db.Column(db.Text, nullable=False)
    key_hash = db.Column(db.Text, nullable=False, unique=True)
    scopes = db.Column(ARRAY(db.Text), nullable=False)
    last_used_at = db.Column(db.DateTime(timezone=True))
    revoked_at = db.Column(db.DateTime(timezone=True))
    user = db.relationship("User", backref=db.backref("api_keys", lazy="dynamic"))


# user_datastore = SQLAlchemyUserDatastore(db, User, Role)
