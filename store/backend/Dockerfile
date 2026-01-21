FROM python:3.11-bullseye
ARG DEBIAN_FRONTEND=noninteractive

RUN mkdir -p /store/backend
WORKDIR /store/backend

RUN apt-get -qq update

RUN wget -O- http://neuro.debian.net/lists/stretch.us-nh.full | tee /etc/apt/sources.list.d/neurodebian.sources.list && apt-key adv --recv-keys --keyserver hkps://keyserver.ubuntu.com 0xA5D32F012649A5A9 || true
RUN apt-get update --allow-releaseinfo-change || apt-get update
RUN apt-get install -y nodejs npm
RUN npm install -g yarn || true
RUN pip install --upgrade pip

COPY pyproject.toml /store/backend/
RUN pip install --no-cache-dir -e .[dev]

COPY . /store/backend/

RUN pip install --no-cache-dir -e .
