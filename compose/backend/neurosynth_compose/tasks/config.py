"""Celery configuration for all environments."""

import os
import ssl
import logging
from kombu import Queue, Exchange
from celery import signals

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Exchange definitions
neurovault_exchange = Exchange("neurovault", type="direct")
neurostore_exchange = Exchange("neurostore", type="direct")
default_exchange = Exchange("celery", type="direct")

# Queue configuration
task_queues = [
    Queue(
        "neurovault",
        neurovault_exchange,
        routing_key="neurovault.#",
        queue_arguments={"x-max-priority": 10},
    ),
    Queue(
        "neurostore",
        neurostore_exchange,
        routing_key="neurostore.#",
        queue_arguments={"x-max-priority": 10},
    ),
    Queue(
        "celery",
        default_exchange,
        routing_key="task.#",
        queue_arguments={"x-max-priority": 5},
    ),
]

# Task routing
task_routes = {
    "neurovault.*": {"queue": "neurovault"},
    "neurostore.*": {"queue": "neurostore"},
    "default": {"queue": "celery"},
}

# Task-specific settings with rate limits and timeouts
task_annotations = {
    "neurovault.*": {
        "rate_limit": os.getenv("NEUROVAULT_RATE_LIMIT", "10/m"),
        "max_retries": int(os.getenv("NEUROVAULT_MAX_RETRIES", "3")),
        "hard_time_limit": int(os.getenv("NEUROVAULT_HARD_TIMEOUT", "300")),
        "soft_time_limit": int(os.getenv("NEUROVAULT_SOFT_TIMEOUT", "240")),
        "acks_late": True,
        "reject_on_worker_lost": True,
        "priority": 10,
    },
    "neurostore.*": {
        "rate_limit": os.getenv("NEUROSTORE_RATE_LIMIT", "20/m"),
        "max_retries": int(os.getenv("NEUROSTORE_MAX_RETRIES", "3")),
        "hard_time_limit": int(os.getenv("NEUROSTORE_HARD_TIMEOUT", "180")),
        "soft_time_limit": int(os.getenv("NEUROSTORE_SOFT_TIMEOUT", "120")),
        "acks_late": True,
        "priority": 8,
    },
}

# Worker settings
worker_name = os.getenv("CELERY_WORKER_NAME", "default")
worker_concurrency = int(os.getenv("CELERY_WORKER_CONCURRENCY", "2"))
worker_prefetch_multiplier = int(os.getenv("CELERY_PREFETCH_MULTIPLIER", "1"))
max_tasks_per_child = int(os.getenv("CELERY_MAX_TASKS_PER_CHILD", "200"))

# Broker configuration
broker_url = os.getenv("CELERY_BROKER_URL", "amqp://localhost:5672//")
broker_pool_limit = int(os.getenv("CELERY_BROKER_POOL_LIMIT", "10"))
broker_connection_timeout = int(os.getenv("CELERY_BROKER_TIMEOUT", "4"))
broker_connection_max_retries = int(os.getenv("CELERY_BROKER_MAX_RETRIES", "3"))
broker_heartbeat = int(os.getenv("CELERY_BROKER_HEARTBEAT", "10"))
broker_transport_options = {
    "visibility_timeout": 3600,
    "max_retries": 3,
    "interval_start": 0,
    "interval_step": 0.2,
    "interval_max": 0.5,
}

# SSL settings (if enabled)
if os.getenv("CELERY_BROKER_USE_SSL", "false").lower() == "true":
    broker_use_ssl = {
        "cert_reqs": ssl.CERT_REQUIRED,
        "ca_certs": os.environ["SSL_CERT_FILE"],
        "keyfile": os.environ.get("SSL_KEY_FILE"),
        "certfile": os.environ.get("SSL_CERT_FILE"),
    }

# Result backend
result_backend = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
result_expires = int(
    os.getenv("CELERY_RESULT_EXPIRES", str(60 * 60 * 24))
)  # 24h default
result_compression = "gzip"
result_extended = True

# Task settings
task_serializer = "json"
accept_content = ["json"]
result_serializer = "json"
task_compression = "gzip"
task_track_started = True
task_send_sent_event = True
worker_send_task_events = True

# Error handling
task_reject_on_worker_lost = True
task_acks_late = True


@signals.setup_logging.connect
def setup_celery_logging(*args, **kwargs):
    """Use Celery's default logging configuration."""
    pass


# Task lifecycle logging
@signals.task_prerun.connect
def log_task_start(task_id, task, *args, **kwargs):
    logger.info(f"task_started: task_id={task_id}, task_name={task.name}")


@signals.task_postrun.connect
def log_task_complete(task_id, task, retval, state, *args, **kwargs):
    logger.info(
        f"task_finished: task_id={task_id}, task_name={task.name}, state={state}, "
        f"runtime={getattr(task.request, 'runtime', None)}"
    )


@signals.task_failure.connect
def log_task_failure(task_id, exception, traceback, *args, **kwargs):
    logger.error(
        f"task_failed: task_id={task_id}, exc_type={type(exception).__name__}, "
        f"exc_message={exception}, traceback={traceback}"
    )
