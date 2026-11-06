# pg_search 0.26.3 links against symbols that 17.6 lacks.
FROM postgres:17.11
RUN apt-get update && \
    apt-get install -y dos2unix \
    python3-pip python-dev-is-python3 build-essential \
    cron \
    curl \
    postgresql-server-dev-17

RUN pip3 install --break-system-packages awscli

# Download and install pgvector
# Force baseline compiler flags so the extension runs on GitHub runners without illegal-instruction crashes
RUN curl -L https://github.com/pgvector/pgvector/archive/refs/tags/v0.8.0.tar.gz -o pgvector.tar.gz \
    && tar -xzf pgvector.tar.gz \
    && cd pgvector-0.8.0 \
    && make OPTFLAGS='-O2 -fPIC' \
    && make install \
    && rm -rf pgvector.tar.gz pgvector-0.8.0

# ParadeDB's pg_search (AGPL-3.0) provides the BM25 index base-study search runs on.
ARG PG_SEARCH_VERSION=0.26.3
ARG PG_SEARCH_SHA256=6ac9ce81070c4663d3a338bdf24347e87a44d2db9ddc8b5b4823f4d5071cdc52
RUN curl -fsSL -o /tmp/pg_search.deb \
        "https://github.com/paradedb/paradedb/releases/download/v${PG_SEARCH_VERSION}/postgresql-17-pg-search_${PG_SEARCH_VERSION}-1PARADEDB-trixie_amd64.deb" \
    && echo "${PG_SEARCH_SHA256}  /tmp/pg_search.deb" | sha256sum -c - \
    && apt-get install -y /tmp/pg_search.deb \
    && rm /tmp/pg_search.deb

COPY pg_dump-to-s3 /home
RUN chmod +x /home/pg_dump-to-s3.sh /home/s3-autodelete.sh /home/build-reduced-dev-backup.sh
RUN crontab /home/backup.txt
RUN dos2unix /home/pg_dump-to-s3.sh
RUN dos2unix /home/s3-autodelete.sh
RUN dos2unix /home/build-reduced-dev-backup.sh
COPY resolve-app-db.sh /usr/local/bin/resolve-app-db.sh
RUN chmod +x /usr/local/bin/resolve-app-db.sh
COPY docker-entrypoint-cron.sh /usr/local/bin/docker-entrypoint-cron.sh
RUN chmod +x /usr/local/bin/docker-entrypoint-cron.sh

COPY postgresql.conf /etc/postgresql/postgresql.conf
COPY pg_stat_statements.sql /docker-entrypoint-initdb.d/
COPY init-pgvector.sql /docker-entrypoint-initdb.d/

ENTRYPOINT ["/usr/local/bin/docker-entrypoint-cron.sh"]
CMD ["postgres"]
