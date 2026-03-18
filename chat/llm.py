import os
import subprocess
import time

# Configuration for the external llama-server
# Qwen3.5 0.8B is lightweight and has reasoning capabilities
LLAMA_SERVER_PATH = "/home/ghn/ai/llama.cpp/build/bin/llama-server"
MODEL_PATH = "/home/ghn/Documents/protosem/django/llm/Qwen3.5-0.8B-BF16.gguf"
MMPROJ_PATH = "/home/ghn/Documents/protosem/django/llm/qwen3.5_0.8b_mmproj-F32.gguf"
PORT = 8081

def get_text_model():
    """Placeholder to indicate we are using the external server."""
    return True

def get_vision_model():
    """Placeholder to indicate we are using the external server."""
    return True
