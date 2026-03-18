#!/usr/bin/env bash
# render_start.sh (Web-only version)

# Ensure the models directory exists (even if empty)
mkdir -p llm

# Start Gunicorn (Django server) in the foreground
# $PORT is provided by Render's environment
gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
