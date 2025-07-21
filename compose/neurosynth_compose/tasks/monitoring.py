"""Task monitoring and metrics configuration."""

import os
from celery import signals
from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, multiprocess

# Configure multiprocess metrics mode if using gunicorn/multiple workers
if os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
    registry = CollectorRegistry()
    multiprocess.MultiProcessCollector(registry)
else:
    registry = CollectorRegistry(auto_describe=True)

# Task execution metrics
TASK_LATENCY = Histogram(
    "celery_task_latency_seconds",
    "Task execution time in seconds",
    ["task_name", "queue"],
    registry=registry,
)

TASK_COUNT = Counter(
    "celery_tasks_total",
    "Number of tasks processed",
    ["task_name", "queue", "state"],
    registry=registry,
)

TASK_ERROR_COUNT = Counter(
    "celery_task_errors_total",
    "Number of task errors",
    ["task_name", "queue", "error_type"],
    registry=registry,
)

TASK_RETRY_COUNT = Counter(
    "celery_task_retries_total",
    "Number of task retries",
    ["task_name", "queue"],
    registry=registry,
)

# Queue metrics
QUEUE_LENGTH = Gauge(
    "celery_queue_length", "Number of tasks in queue", ["queue"], registry=registry
)

# Worker metrics
ACTIVE_WORKERS = Gauge(
    "celery_worker_count", "Number of active workers", registry=registry
)

WORKER_TASKS_ACTIVE = Gauge(
    "celery_worker_tasks_active",
    "Number of tasks being processed",
    ["hostname"],
    registry=registry,
)

# External service metrics
NEUROVAULT_REQUEST_LATENCY = Histogram(
    "neurovault_request_latency_seconds",
    "Neurovault API request latency",
    ["endpoint", "method"],
    registry=registry,
)

NEUROSTORE_REQUEST_LATENCY = Histogram(
    "neurostore_request_latency_seconds",
    "Neurostore API request latency",
    ["endpoint", "method"],
    registry=registry,
)


# Signal handlers
@signals.task_received.connect
def task_received(request, **kwargs):
    """Track queued tasks."""
    QUEUE_LENGTH.labels(request.delivery_info.get("routing_key", "default")).inc()


@signals.task_prerun.connect
def task_prerun(task_id, task, **kwargs):
    """Track task execution start."""
    QUEUE_LENGTH.labels(task.request.delivery_info.get("routing_key", "default")).dec()
    WORKER_TASKS_ACTIVE.labels(task.request.hostname).inc()


@signals.task_postrun.connect
def task_postrun(task_id, task, state, **kwargs):
    """Track task completion."""
    queue = task.request.delivery_info.get("routing_key", "default")
    WORKER_TASKS_ACTIVE.labels(task.request.hostname).dec()
    TASK_COUNT.labels(task.name, queue, state).inc()

    # Record task latency
    if task.request.runtime is not None:
        TASK_LATENCY.labels(task.name, queue).observe(task.request.runtime)


@signals.task_retry.connect
def task_retry(request, reason, **kwargs):
    """Track task retries."""
    queue = request.delivery_info.get("routing_key", "default")
    TASK_RETRY_COUNT.labels(request.task, queue).inc()


@signals.task_failure.connect
def task_failure(task_id, exception, task, **kwargs):
    """Track task failures."""
    queue = task.request.delivery_info.get("routing_key", "default")
    error_type = type(exception).__name__
    TASK_ERROR_COUNT.labels(task.name, queue, error_type).inc()


@signals.worker_ready.connect
def worker_ready(**kwargs):
    """Track worker availability."""
    ACTIVE_WORKERS.inc()


@signals.worker_shutdown.connect
def worker_shutdown(**kwargs):
    """Track worker shutdown."""
    ACTIVE_WORKERS.dec()


# API request timing decorators
def time_neurovault_request(endpoint):
    """Time Neurovault API requests."""

    def decorator(func):
        def wrapper(*args, **kwargs):
            with NEUROVAULT_REQUEST_LATENCY.labels(
                endpoint=endpoint, method=kwargs.get("method", "POST")
            ).time():
                return func(*args, **kwargs)

        return wrapper

    return decorator


def time_neurostore_request(endpoint):
    """Time Neurostore API requests."""

    def decorator(func):
        def wrapper(*args, **kwargs):
            with NEUROSTORE_REQUEST_LATENCY.labels(
                endpoint=endpoint, method=kwargs.get("method", "POST")
            ).time():
                return func(*args, **kwargs)

        return wrapper

    return decorator
