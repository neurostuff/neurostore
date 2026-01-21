FROM python:3.11-bullseye
ARG DEBIAN_FRONTEND=noninteractive

RUN mkdir -p /store/backend
WORKDIR /store/backend

RUN apt-get -qq update

RUN wget -O- http://neuro.debian.net/lists/stretch.us-nh.full | tee /etc/apt/sources.list.d/neurodebian.sources.list && apt-key adv --recv-keys --keyserver hkps://keyserver.ubuntu.com 0xA5D32F012649A5A9
RUN curl -sSL https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add -
RUN echo "deb https://deb.nodesource.com/node_16.x buster main" | tee /etc/apt/sources.list.d/nodesource.list
RUN echo "deb-src https://deb.nodesource.com/node_16.x buster main" | tee -a /etc/apt/sources.list.d/nodesource.list
RUN apt-get update --allow-releaseinfo-change
RUN apt-get install -y nodejs
RUN npm install -g yarn
RUN pip install --upgrade pip

COPY pyproject.toml /store/backend/
RUN pip install --no-cache-dir -e .[dev]

COPY . /store/backend/

RUN pip install --no-cache-dir -e .
