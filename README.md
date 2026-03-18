# Local Django Chatbot

A real-time, multimodal chatbot built with Django and the `llama.cpp` server. This setup supports the latest model architectures (like Qwen 3.5) by using the native C++ inference server as a backend.

## Features
- **Native Inference**: Uses `llama.cpp` server for high-performance inference.
- **Qwen 3.5 Support**: Full support for the `qwen35` architecture (including reasoning and multimodal vision).
- **Real-time Streaming**: Responses stream token-by-token using Server-Sent Events (SSE).
- **Collapsible Thinking**: Dedicated UI for reasoning models with collapsible "Thought Process" blocks.
- **Premium Dark UI**: Glassmorphism, modern typography, and responsive design.

---

## Setup Instructions

### 1. Build llama.cpp from Source
To support the latest architectures like **Qwen 3.5**, you must build the latest version of `llama.cpp` from source.

```bash
# Clone the repository
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp

# Build (using CMake for best results)
cmake -B build
cmake --build build --config Release -j
```
*Note the path to binary: `llama.cpp/build/bin/llama-server`*

### 2. Setup Django Application
Clone this project and setup the Python environment.

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Model Installation
Create a folder named `llm/` in the Django project root and place your GGUF models there.

**Recommended Models (Qwen 3.5 0.8B):**
- Place `Qwen3.5-0.8B-BF16.gguf` in `llm/`
- Place `qwen3.5_0.8b_mmproj-F32.gguf` in `llm/`

### 4. Run the Inference Server (Backend)
Start the `llama-server` on port 8081. This server handles the actual LLM logic.

```bash
# From the Django project root
/path/to/your/llama.cpp/build/bin/llama-server \
  -m llm/Qwen3.5-0.8B-BF16.gguf \
  --mmproj llm/qwen3.5_0.8b_mmproj-F32.gguf \
  --port 8081 \
  --host 0.0.0.0 \
  --threads 6 \
  -c 8192
```

### 5. Run the Django Web Interface
In a separate terminal, start the Django development server.

```bash
# Ensure venv is activated
python manage.py runserver 0.0.0.0:8000
```
Visit **`http://localhost:8000`** to start chatting.

Visit **`http://localhost:8000`** to start chatting.

---

## Render Deployment Guide (Web Only)

This project is currently configured for a **Lean Web Deployment** (GGUF model files are excluded to keep the deployment under 100MB). It is intended for UI/Frontend demonstration.

### 1. Configuration (Render Dashboard)
- **Runtime**: Python 3.10+
- **Build Command**: `bash render_build.sh`
- **Start Command**: `bash render_start.sh`

### 2. Deployment Script Details
- **`render_build.sh`**: Installs requirements, creates the `llm/` folder, and handles static file preparations.
- **`render_start.sh`**: Runs migrations, collects static files via WhiteNoise, and launches **Gunicorn** on the correct `$PORT`.

---

## Alternative: Using a Procfile
If you prefer, you can add a `Procfile` to the root directory:
```
web: bash render_start.sh
```
If this is present, Render will automatically detect it and use it for the web process.

---

## Technical Details
- **Architecture**: Django acts as a streaming proxy. It handles frontend requests, calls the local C++ `llama-server` API on port 8081, and streams tokens to the UI.
- **Reasoning**: The backend detects `reasoning_content` from the server and wraps it in `<think>` tags for the UI's collapsible thoughts.
- **Multimodal Support**: Base64 images are processed through the Llava-compatible `--mmproj` handler.
