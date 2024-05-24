FROM postgres:12.12

# Install necessary dependencies
RUN apt-get update && apt-get install -y dos2unix
RUN apt-get install -yq python3-pip python-dev build-essential
RUN apt-get install -yq cron
RUN pip3 install awscli

# Install pgvector dependencies
RUN apt-get install -y postgresql-server-dev-12 gcc make curl clang

# Download and install pgvector
RUN curl -L https://github.com/pgvector/pgvector/archive/refs/tags/v0.7.0.tar.gz -o pgvector.tar.gz \
    && tar -xzf pgvector.tar.gz \
    && cd pgvector-0.7.0 \
    && make \
    && make install \
    && rm -rf pgvector.tar.gz pgvector-0.7.0

# Copy initialization script
COPY init-vector-extension.sql /docker-entrypoint-initdb.d/

# Copy scripts and set permissions
COPY pg_dump-to-s3 /home
RUN chmod +x /home/pg_dump-to-s3.sh /home/s3-autodelete.sh

# Set up cron jobs
RUN crontab /home/backup.txt
RUN service cron start

# Convert scripts to Unix format
RUN dos2unix /home/pg_dump-to-s3.sh
RUN dos2unix /home/s3-autodelete.sh
