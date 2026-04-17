ARG NODE_MAJOR=22

FROM node:${NODE_MAJOR}-trixie-slim AS node

FROM python:3.14-trixie

ARG DEBIAN_FRONTEND=noninteractive
WORKDIR /compose/backend

COPY --from=node /usr/local/ /usr/local/

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libasound2t64 \
        libgbm-dev \
        libgtk-3-0t64 \
        libnotify-dev \
        libnss3 \
        libxtst6 \
        libxss1 \
        xauth \
        xvfb \
    && rm -rf /var/lib/apt/lists/*

ENV CYPRESS_CACHE_FOLDER=/app/.cache/Cypress

RUN mkdir -p "${CYPRESS_CACHE_FOLDER}" \
    && chmod 777 "${CYPRESS_CACHE_FOLDER}"

COPY MANIFEST.in pyproject.toml /compose/backend/

RUN pip install --no-cache-dir --upgrade pip cython \
    && pip install --no-cache-dir -e .[dev]

COPY . /compose/backend/

RUN pip install --no-cache-dir --no-deps -e .
