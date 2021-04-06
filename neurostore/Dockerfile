FROM python:3.8-buster
ARG DEBIAN_FRONTEND=noninteractive

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

RUN apt-get -qq update

COPY requirements.txt /usr/src/app/
RUN pip install --no-cache-dir -r requirements.txt

COPY . /usr/src/app

WORKDIR /neurostore
