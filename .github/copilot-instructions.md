# Neurostore: Meta-Analysis Backend Services & Frontend

Neurostore is a containerized neuroimaging meta-analysis platform consisting of two Python Flask backend services (Neurostore and Neurosynth-Compose) and a React/TypeScript frontend. All services are deployed using Docker Compose.

**Always reference these instructions first and fallback to `.github/workflows/workflow.yml` for testing setup help, and then fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Initial Setup - CRITICAL: Git Submodules Required
Initialize Git submodules before any build or development work:
- `git submodule update --init --recursive` -- takes 1-2 seconds. **NEVER CANCEL**.
- This downloads OpenAPI specifications and TypeScript SDKs required for builds.

### Build Services - NEVER CANCEL These Commands
Build times vary significantly. Set appropriate timeouts and **DO NOT CANCEL** builds:

#### Store Service (Neurostore Backend)
- `cd store && cp .env.example .env`
- `docker network create nginx-proxy` -- creates shared network
- `docker compose build` -- takes 1-2 minutes. **NEVER CANCEL. Set timeout to 180+ seconds.**
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d` -- takes 10-15 seconds

#### Compose Service (Neurosynth-Compose Backend + Frontend)  
- `cd compose && cp .env.example .env`
- `docker compose build` -- takes 2-3 minutes. **NEVER CANCEL. Set timeout to 240+ seconds.**
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d` -- takes 5-10 seconds

### Database Setup
Create and migrate databases for both services:

#### Store Database
- `.env` selects the environment with `APP_ENV`; on a fresh volume, the matching default database is created automatically (`test_db` for development, `neurostore` for staging/production)
- `docker compose exec -T neurostore bash -c "flask db upgrade"` -- takes 5-10 seconds
- `docker compose exec -T neurostore bash -c "flask ingest-neurosynth --max-rows 100"` -- takes 5-10 seconds
- The tracked store migrations create `pgvector` automatically. If you are recovering a partially migrated database, `docker compose exec -T store-pgsql17 psql -U postgres -d test_db -c "CREATE EXTENSION IF NOT EXISTS vector;"` is still a safe fallback.

#### Compose Database
- `.env` selects the environment with `APP_ENV`; on a fresh volume, the matching default database is created automatically (`test_db` for development, `compose` for staging/production)
- `docker compose exec -T compose bash -c "flask db upgrade"` -- takes 5-10 seconds

### Frontend Development
Navigate to `compose/neurosynth-frontend/`:

#### Build & Development
- `cp .env.example .env.dev`
- `npm install` -- takes 25-30 seconds
- `npm run build:dev` -- takes 25-35 seconds
- `npm run start:dev` -- starts development server on http://localhost:3000

#### Configuration Files Needed
- `.env.dev` -- development environment configuration
- `.env.staging` -- staging environment configuration

## Testing - Set Long Timeouts

### Backend Tests - NEVER CANCEL
**CRITICAL**: Backend tests take significant time. Set appropriate timeouts.

#### Store Backend Tests
- `docker compose run -e "APP_ENV=docker_test" --rm neurostore bash -c "python -m pytest neurostore/tests"`
- Takes 2-3 minutes. **NEVER CANCEL. Set timeout to 300+ seconds.**
- Expected: ~229 passed, 12 skipped

#### Compose Backend Tests  
- `docker compose run -e "APP_ENV=docker_test" --rm compose bash -c "python -m pytest neurosynth_compose/tests"`
- Takes 2-4 minutes. **NEVER CANCEL. Set timeout to 360+ seconds.**

#### Frontend Tests
- `npm run test` -- takes 50-70 seconds
- Expected: ~345 tests passing
- `npm run cy:e2e-headless` -- Cypress E2E tests (requires both backend services running)

## Validation Scenarios

### Always Test These Workflows After Changes
1. **API Functionality**: `curl http://localhost/api/studies` -- Store API should return JSON
2. **Base Study Datatype Filtering**: `curl "http://localhost/api/base-studies?data_type=coordinate"` -- should return ingested coordinate studies after `flask ingest-neurosynth --max-rows 100`
3. **Frontend Build**: Ensure `npm run build:dev` completes without errors
4. **Backend Migration**: Test database migration commands work
5. **Docker Services**: All containers should start and stay healthy

### Service URLs
- **Store API**: http://localhost/api (port 80)
- **Compose API**: http://localhost:81/api (port 81)  
- **Frontend Dev**: http://localhost:3000 (when running `npm run start:dev`)
- **pgHero**: http://localhost/pghero (database monitoring)
- **Grafana**: Available via docker compose (database metrics)

## Linting & Code Quality

### Backend Linting
- `pip install flake8` (if not installed)
- `cd store/backend && flake8 ./neurostore` -- takes <1 second
- `cd compose/backend && flake8 ./neurosynth_compose` -- takes <1 second

### Frontend Linting  
- `npm run lint` -- takes 30-40 seconds
- **Expected**: ~899 linting issues exist (mostly formatting). This is normal.
- `npm run lint --fix` -- auto-fixes many issues

## Configuration Notes

### Environment Variables
Both services use similar `.env` configurations:
- `APP_ENV` -- Primary environment selector (`development`, `staging`, `production`). This drives the Flask config class and the default database name used by app/runtime services.
- `POSTGRES_HOST` -- Database host (store-pgsql17 or compose-pgsql17)
- `POSTGRES_PASSWORD` -- Database password (usually "example")
- `AUTH0_CLIENT_ID` -- Auth0 integration (can be placeholder for dev)
- `DEBUG=True` -- Enable debug mode

### Docker Configuration Issues
Use `APP_ENV` as the only environment selector. For Docker-based tests, use `APP_ENV=docker_test`.

## Directory Structure Reference
```
/
├── store/                    # Neurostore backend service
│   ├── backend/             # Python Flask application
│   │   ├── neurostore/      # Main package
│   │   ├── migrations/      # Database migrations
│   │   └── pyproject.toml   # Python dependencies
│   ├── docker-compose.yml   # Production config
│   └── docker-compose.dev.yml # Development overrides
├── compose/                 # Neurosynth-Compose service
│   ├── backend/             # Python Flask application  
│   │   ├── neurosynth_compose/ # Main package
│   │   └── pyproject.toml   # Python dependencies
│   ├── neurosynth-frontend/ # React/TypeScript app
│   │   ├── src/            # Source code
│   │   ├── package.json    # Node.js dependencies
│   │   └── vite.config.ts  # Build configuration
│   ├── docker-compose.yml  # Production config
│   └── docker-compose.dev.yml # Development overrides
```

## Common Issues & Solutions

### Missing OpenAPI Specs Error
- **Problem**: `FileNotFoundError: neurostore-openapi.yml` or `neurosynth-compose-openapi.yml`
- **Solution**: Run `git submodule update --init --recursive`

### Missing TypeScript SDK Error  
- **Problem**: `Could not resolve "../neurostore-typescript-sdk"`
- **Solution**: Initialize git submodules first

### Container Won't Start
- **Problem**: `Worker failed to boot` or similar gunicorn errors
- **Solution**: Check OpenAPI submodules are initialized and container logs with `docker compose logs [service]`

### Database Connection Errors
- **Problem**: `database "test_db" does not exist` 
- **Solution**: Create test databases as shown in setup steps

### Frontend Build Sentry Warnings
- **Problem**: Sentry API token errors during build
- **Solution**: Expected in development. Build still succeeds - ignore Sentry warnings.

## Performance Expectations

| Operation | Time | Timeout |
|-----------|------|---------|
| Git submodules | 1-2s | 30s |
| Store build | 1m36s | 180s |
| Compose build | 1m56s | 240s |
| Frontend npm install | 26s | 60s |
| Frontend build | 29s | 90s |
| Backend tests | 2m30s | 300s |
| Frontend tests | 59s | 120s |
| Database migrations | 5s | 30s |
| Backend linting | <1s | 10s |
| Frontend linting | 37s | 60s |

**Remember**: Always use `--timeout` parameters longer than these estimates. Builds may take longer on slower systems.
