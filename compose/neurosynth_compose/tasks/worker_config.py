"""Celery worker configuration settings."""

import os
from celery import signals
from celery.signals import worker_ready
import logging

logger = logging.getLogger(__name__)

# Worker Settings
worker_name = os.getenv("CELERY_WORKER_NAME", "default")
worker_queue = os.getenv("CELERY_WORKER_QUEUE", "celery")
concurrency = int(os.getenv("CELERY_WORKER_CONCURRENCY", "2"))
max_tasks_per_child = int(os.getenv("CELERY_MAX_TASKS_PER_CHILD", "200"))
worker_prefetch_multiplier = int(os.getenv("CELERY_PREFETCH_MULTIPLIER", "1"))

# Queue Configuration
task_queues = {
    "neurovault": {
        "exchange": "neurovault",
        "exchange_type": "direct",
        "routing_key": "neurovault.#",
        "queue_arguments": {"x-max-priority": 10},
    },
    "neurostore": {
        "exchange": "neurostore",
        "exchange_type": "direct",
        "routing_key": "neurostore.#",
        "queue_arguments": {"x-max-priority": 10},
    },
    "celery": {
        "exchange": "celery",
        "exchange_type": "direct",
        "routing_key": "task.#",
        "queue_arguments": {"x-max-priority": 5},
    },
}

# Task Routing
task_routes = {
    "neurovault.*": {"queue": "neurovault"},
    "neurostore.*": {"queue": "neurostore"},
    "default": {"queue": "celery"},
}

# Task Settings
task_annotations = {
    "neurovault.*": {
        "rate_limit": "10/m",
        "max_retries": 3,
        "hard_time_limit": 300,
        "soft_time_limit": 240,
        "acks_late": True,
        "reject_on_worker_lost": True,
        "priority": 10,
    },
    "neurostore.*": {
        "rate_limit": "20/m",
        "max_retries": 3,
        "hard_time_limit": 180,
        "soft_time_limit": 120,
        "acks_late": True,
        "priority": 8,
    },
}

# Result Backend
result_backend = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
result_expires = 60 * 60 * 24  # 24 hours
result_compression = "gzip"
result_extended = True

# Message Settings
task_serializer = "json"
accept_content = ["json"]
result_serializer = "json"
task_compression = "gzip"
task_track_started = True
task_send_sent_event = True
worker_send_task_events = True

# Broker Settings
broker_connection_timeout = 4
broker_connection_max_retries = 3
broker_connection_retry = True
broker_heartbeat = 10
broker_pool_limit = None

# Error Handling
task_reject_on_worker_lost = True
task_acks_late = True


@signals.setup_logging.connect
def setup_logging_handler(*args, **kwargs):
    """Configure standard logging for workers."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


@worker_ready.connect
def worker_ready_handler(**kwargs):
    """Log when worker is ready."""
    logger.info(
        "worker_ready", worker=worker_name, queue=worker_queue, concurrency=concurrency
    )


@signals.task_prerun.connect
def task_prerun_handler(task_id, task, *args, **kwargs):
    """Log task start."""
    logger.info(
        "task_started", task_id=task_id, task_name=task.name, args=args, kwargs=kwargs
    )


@signals.task_postrun.connect
def task_postrun_handler(task_id, task, retval, state, *args, **kwargs):
    """Log task completion."""
    logger.info(
        "task_finished",
        task_id=task_id,
        task_name=task.name,
        state=state,
        runtime=task.request.runtime,
    )


@signals.task_retry.connect
def task_retry_handler(request, reason, einfo, *args, **kwargs):
    """Log task retry."""
    logger.warning(
        "task_retrying",
        task_id=request.id,
        task_name=request.task,
        reason=str(reason),
        exc_info=einfo,
    )


@signals.task_failure.connect
def task_failure_handler(task_id, exception, traceback, *args, **kwargs):
    """Log task failure."""
    logger.error(
        "task_failed",
        task_id=task_id,
        exc_type=type(exception).__name__,
        exc_message=str(exception),
        traceback=traceback,
    )
