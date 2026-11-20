FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-cache-dir .
USER nobody
EXPOSE 8000
CMD ["neurostore-mcp", "--transport", "http", "--host", "0.0.0.0", "--port", "8000", "--path", "/mcp"]
