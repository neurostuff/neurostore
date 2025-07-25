FROM python:3.11-bullseye
ARG DEBIAN_FRONTEND=noninteractive

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

RUN apt-get -qq update

RUN wget -O- http://neuro.debian.net/lists/stretch.us-nh.full | tee /etc/apt/sources.list.d/neurodebian.sources.list && apt-key adv --recv-keys --keyserver hkps://keyserver.ubuntu.com 0xA5D32F012649A5A9
RUN curl -sSL https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add -
RUN echo "deb https://deb.nodesource.com/node_18.x buster main" | tee /etc/apt/sources.list.d/nodesource.list
RUN echo "deb-src https://deb.nodesource.com/node_18.x buster main" | tee -a /etc/apt/sources.list.d/nodesource.list
RUN apt-get update --allow-releaseinfo-change
RUN apt-get install -y nodejs

# below line is for cypress
RUN apt-get install -y libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb
RUN mkdir -p /app/.cache/Cypress
RUN chmod 777 /app/.cache/Cypress
ENV CYPRESS_CACHE_FOLDER "/app/.cache/Cypress"

# in order to install nimare dependency indexed_gzip (no binaries for python 3.10)
RUN apt-get install -y build-essential
RUN pip install cython

RUN pip install --upgrade pip
# Copy only dependency files first for better layer caching
COPY MANIFEST.in /usr/src/app/
COPY pyproject.toml /usr/src/app/

RUN pip install .[dev]

# Now copy the rest of the app
COPY . /usr/src/app

RUN pip install .

WORKDIR /compose
