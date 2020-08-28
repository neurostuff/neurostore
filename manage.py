"""
    Command line management tools.
"""
import os

from flask_script import Manager, Shell
from flask_migrate import Migrate, MigrateCommand
from flask_security.utils import encrypt_password

from neurostuff.core import app, db, user_datastore

app.config.from_object(os.environ['APP_SETTINGS'])
migrate = Migrate(app, db, directory=app.config['MIGRATIONS_DIR'])
manager = Manager(app)


def _make_context():
    from neurostuff import models

    return dict(app=app, db=db, ms=models)


manager.add_command('db', MigrateCommand)
manager.add_command("shell", Shell(make_context=_make_context))


@manager.command
def add_user(email, password):
    """ Add a user to the database.
    email - A valid email address (primary login key)
    password - Any string
    """
    user_datastore.create_user(
        email=email, password=encrypt_password(password))

    db.session.commit()


if __name__ == '__main__':
    manager.run()
