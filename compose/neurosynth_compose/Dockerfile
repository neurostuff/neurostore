FROM python:3.10-buster
ARG DEBIAN_FRONTEND=noninteractive

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

RUN apt-get -qq update

RUN wget -O- http://neuro.debian.net/lists/stretch.us-nh.full | tee /etc/apt/sources.list.d/neurodebian.sources.list && apt-key adv --recv-keys --keyserver hkps://keyserver.ubuntu.com 0xA5D32F012649A5A9
RUN curl -sSL https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add -
RUN echo "deb https://deb.nodesource.com/node_16.x buster main" | tee /etc/apt/sources.list.d/nodesource.list
RUN echo "deb-src https://deb.nodesource.com/node_16.x buster main" | tee -a /etc/apt/sources.list.d/nodesource.list
RUN apt-get update --allow-releaseinfo-change
RUN apt-get install -y nodejs
# below line is for cypress
RUN apt-get install -y libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb
RUN mkdir /root/.cache/Cypress
RUN npm install -g yarn

COPY requirements.txt /usr/src/app/
# in order to install nimare dependency indexed_gzip (no binaries for python 3.10)
RUN apt-get install -y build-essential
RUN pip install cython

RUN pip install --no-cache-dir -r requirements.txt

COPY . /usr/src/app

WORKDIR /neurosynth
