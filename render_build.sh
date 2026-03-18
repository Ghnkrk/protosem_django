#!/usr/bin/env bash
# render_build.sh (Lean/Web-only version)

# Install Python dependencies
pip install -r requirements.txt

# Create models folder
mkdir -p llm

# Collect static files during build
python manage.py collectstatic --noinput
