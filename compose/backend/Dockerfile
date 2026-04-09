FROM python:3.11-bullseye
ARG DEBIAN_FRONTEND=noninteractive
ARG NODE_MAJOR=18

RUN mkdir -p /compose/backend
WORKDIR /compose/backend

RUN apt-get -qq update
RUN apt-get install -y --no-install-recommends ca-certificates curl gnupg dirmngr

RUN wget -O- http://neuro.debian.net/lists/stretch.us-nh.full | tee /etc/apt/sources.list.d/neurodebian.sources.list && apt-key adv --recv-keys --keyserver hkps://keyserver.ubuntu.com 0xA5D32F012649A5A9
RUN mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | \
    gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
RUN apt-get update --allow-releaseinfo-change
RUN apt-get install -y nodejs

# below line is for cypress
RUN apt-get install -y libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb
RUN mkdir -p /app/.cache/Cypress
RUN chmod 777 /app/.cache/Cypress
ENV CYPRESS_CACHE_FOLDER=/app/.cache/Cypress

# in order to install nimare dependency indexed_gzip (no binaries for python 3.10)
RUN apt-get install -y build-essential
RUN pip install cython

RUN pip install --upgrade pip
# Copy only dependency files first for better layer caching
COPY MANIFEST.in /compose/backend/
COPY pyproject.toml /compose/backend/

RUN pip install --no-cache-dir -e .[dev]

# Now copy the rest of the app
COPY . /compose/backend/

RUN pip install --no-cache-dir -e .
