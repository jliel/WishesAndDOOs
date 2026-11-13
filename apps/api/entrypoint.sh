#!/bin/sh
set -e

# Run database migrations if requested
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "Applying database migrations..."
    flask --app wsgi.py db upgrade
fi

echo "Starting Gunicorn WSGI server..."
exec gunicorn \
    --bind "${HOST:-0.0.0.0}:${PORT:-5000}" \
    --workers "${WEB_CONCURRENCY:-2}" \
    --threads "${GUNICORN_THREADS:-4}" \
    --timeout "${GUNICORN_TIMEOUT:-60}" \
    --access-logfile - \
    --error-logfile - \
    "app:create_app()"
