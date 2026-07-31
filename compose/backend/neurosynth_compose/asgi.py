"""ASGI server entry point, kept separate from the Celery application."""

from neurosynth_compose import create_asgi_app

asgi_app = create_asgi_app()

__all__ = ["asgi_app"]
