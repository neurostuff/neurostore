FROM postgres:17.6
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

COPY pg_dump-to-s3 /home
RUN chmod +x /home/pg_dump-to-s3.sh /home/s3-autodelete.sh
RUN crontab /home/backup.txt
RUN service cron start
RUN dos2unix /home/pg_dump-to-s3.sh
RUN dos2unix /home/s3-autodelete.sh

COPY postgresql.conf /etc/postgresql/postgresql.conf
COPY pg_stat_statements.sql /docker-entrypoint-initdb.d/
COPY init-pgvector.sql /docker-entrypoint-initdb.d/
COPY init-test-db.sql /docker-entrypoint-initdb.d/
