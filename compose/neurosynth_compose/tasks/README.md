# Celery Task Configuration

This document describes all available configuration options for the Celery task system.

## Environment Variables

### Worker Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CELERY_WORKER_NAME` | `default` | Name of the worker instance |
| `CELERY_WORKER_CONCURRENCY` | `2` | Number of worker processes |
| `CELERY_PREFETCH_MULTIPLIER` | `1` | Number of tasks prefetched per worker |
| `CELERY_MAX_TASKS_PER_CHILD` | `200` | Restart worker after N tasks (memory leak protection) |

### Broker Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `CELERY_BROKER_URL` | `amqp://localhost:5672//` | Message broker connection URL |
| `CELERY_BROKER_POOL_LIMIT` | `10` | Connection pool size |
| `CELERY_BROKER_TIMEOUT` | `4` | Connection timeout in seconds |
| `CELERY_BROKER_MAX_RETRIES` | `3` | Maximum connection retry attempts |
| `CELERY_BROKER_HEARTBEAT` | `10` | Heartbeat interval in seconds |
| `CELERY_BROKER_USE_SSL` | `false` | Enable SSL for broker connection |

### SSL Configuration

Required if `CELERY_BROKER_USE_SSL=true`:

| Variable | Required | Description |
|----------|----------|-------------|
| `SSL_CERT_FILE` | Yes | Path to SSL certificate file |
| `SSL_KEY_FILE` | No | Path to SSL key file (if separate from cert) |

### Result Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `CELERY_RESULT_BACKEND` | `redis://localhost:6379/0` | Result backend URL |
| `CELERY_RESULT_EXPIRES` | `86400` | Result TTL in seconds (24h) |

### Task-Specific Settings

#### Neurovault Tasks

| Variable | Default | Description |
|----------|---------|-------------|
| `NEUROVAULT_RATE_LIMIT` | `10/m` | Maximum tasks per minute |
| `NEUROVAULT_MAX_RETRIES` | `3` | Maximum retry attempts |
| `NEUROVAULT_HARD_TIMEOUT` | `300` | Hard timeout in seconds (5m) |
| `NEUROVAULT_SOFT_TIMEOUT` | `240` | Soft timeout in seconds (4m) |

#### Neurostore Tasks

| Variable | Default | Description |
|----------|---------|-------------|
| `NEUROSTORE_RATE_LIMIT` | `20/m` | Maximum tasks per minute |
| `NEUROSTORE_MAX_RETRIES` | `3` | Maximum retry attempts |
| `NEUROSTORE_HARD_TIMEOUT` | `180` | Hard timeout in seconds (3m) |
| `NEUROSTORE_SOFT_TIMEOUT` | `120` | Soft timeout in seconds (2m) |

## Queue Configuration

Three dedicated queues are configured:

1. **neurovault** - For file upload operations
   - High priority (10)
   - Direct routing with `neurovault.#` routing key
   - Rate limited to protect external API

2. **neurostore** - For analysis operations
   - High priority (10)
   - Direct routing with `neurostore.#` routing key
   - Higher rate limit for metadata operations

3. **celery** - For default tasks
   - Normal priority (5)
   - Direct routing with `task.#` routing key
   - Used for miscellaneous tasks

## Deployment Examples

### Development
```bash
export CELERY_WORKER_CONCURRENCY=2
export CELERY_MAX_TASKS_PER_CHILD=200
export NEUROVAULT_RATE_LIMIT=10/m
```

### Production
```bash
export CELERY_WORKER_CONCURRENCY=4
export CELERY_MAX_TASKS_PER_CHILD=1000
export CELERY_BROKER_URL=amqps://user:pass@cloudamqp.com/vhost
export CELERY_RESULT_BACKEND=redis://redis.host:6379/0
export CELERY_BROKER_USE_SSL=true
export SSL_CERT_FILE=/path/to/cert.pem
export NEUROVAULT_RATE_LIMIT=20/m
```

### Running Workers

Start worker for specific queue:
```bash
celery -A neurosynth_compose.tasks worker -Q neurovault -n neurovault@%h
```

Start worker for all queues:
```bash
celery -A neurosynth_compose.tasks worker -Q neurovault,neurostore,celery -n all@%h
```

## Monitoring

Task events and logging are enabled by default. All task lifecycle events are logged using structured logging with the following events:

- `task_started` - Task execution started
- `task_finished` - Task completed successfully
- `task_failed` - Task failed with error
- `task_retrying` - Task is being retried

Logs include task ID, name, runtime, and any error information for debugging.
