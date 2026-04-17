FROM python:3.14-trixie

ARG DEBIAN_FRONTEND=noninteractive
WORKDIR /store/backend

COPY MANIFEST.in pyproject.toml /store/backend/

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -e .[dev]

COPY . /store/backend/

RUN pip install --no-cache-dir --no-deps -e .
