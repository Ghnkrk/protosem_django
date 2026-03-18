#!/usr/bin/env bash
# render_build.sh (Lean/Web-only version)

# Install Python dependencies
pip install -r requirements.txt

# Create models folder (empty) to avoid file-not-found errors if still referenced
mkdir -p llm
