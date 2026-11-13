# Multi-stage production build for WishesAndDOOs Flask API
FROM python:3.12-slim-bookworm AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Final runtime stage
FROM python:3.12-slim-bookworm

WORKDIR /app

# Install runtime dependencies (libpq for psycopg2, curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed python packages from builder
COPY --from=builder /install /usr/local

# Security: Run as unprivileged user
RUN groupadd -r wad && useradd -r -g wad -u 10001 wad_user \
    && mkdir -p /app/uploads/wishes \
    && chown -R wad_user:wad /app

# Copy application files
COPY --chown=wad_user:wad app/ ./app/
COPY --chown=wad_user:wad migrations/ ./migrations/
COPY --chown=wad_user:wad wsgi.py entrypoint.sh ./

RUN chmod +x entrypoint.sh

USER wad_user

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    FLASK_ENV=production \
    PORT=5000 \
    HOST=0.0.0.0

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:5000/api/v1/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
