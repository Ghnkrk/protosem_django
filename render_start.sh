#!/usr/bin/env bash
# render_start.sh (Web-only version)

# Ensure the models directory exists
mkdir -p llm

# Run migrations (creates db.sqlite3 if it doesn't exist)
python manage.py migrate --noinput

# Set default PORT if not provided (Render sets this automatically)
PORT=${PORT:-8000}

# Start Gunicorn (Django server)
# Use gthread for better streaming performance
echo "Starting Gunicorn on port $PORT..."
gunicorn config.wsgi:application \
    --bind 0.0.0.0:$PORT \
    --worker-class gthread \
    --threads 4 \
    --timeout 120 \
    --log-level debug
