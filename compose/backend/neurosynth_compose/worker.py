from .__init__ import create_app
from .celery_app import make_celery

# Create Flask app and Celery app
flask_app = create_app()
celery = make_celery(flask_app)


# Import all task modules to ensure registration
import neurosynth_compose.tasks.neurostore  # noqa: F401,E402
import neurosynth_compose.tasks.neurovault  # noqa: F401,E402

# Expose celery instance for CLI
celery_app = celery
