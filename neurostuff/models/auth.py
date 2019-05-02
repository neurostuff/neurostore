from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.orm.collections import attribute_mapped_collection
from sqlalchemy import (Column, Integer, String, Boolean, ForeignKey, JSON,
                        Table, Float, DateTime)
from sqlalchemy.orm import reconstructor, relationship, backref
from flask_security import UserMixin, RoleMixin, login_required
from flask_dance.consumer.storage.sqla import OAuthConsumerMixin


from ..database import db
from .data import BaseMixin


roles_users = Table('roles_users', db.Model.metadata,
        Column('user_id', Integer(), ForeignKey('users.id')),
        Column('role_id', Integer(), ForeignKey('roles.id')))


class Role(BaseMixin, db.Model, RoleMixin):
    __tablename__ = 'roles'

    name = Column(String(80), unique=True)
    description = Column(String(255))


class User(BaseMixin, db.Model, UserMixin):
    __tablename__ = 'users'

    email = Column(String(255), unique=True)
    password = Column(String(255))
    active = Column(Boolean())
    confirmed_at = Column(DateTime)
    roles = relationship('Role', secondary=roles_users,
                         backref=backref('users', lazy='dynamic'))


class OAuth(OAuthConsumerMixin, db.Model):
    user_id = Column(Integer, ForeignKey('users.id'))
    user = relationship(User)
    provider_user_id = Column(String(256), unique=True, nullable=False)
    provider = Column(String(30))
