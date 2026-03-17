import json
import os
import base64
import re

from django.shortcuts import render
from django.http import StreamingHttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LLM_DIR = os.path.join(BASE_DIR, "llm")

from .llm import get_text_model, get_vision_model

def index(request):
    return render(request, "chat/index.html")


def _build_messages(query, image_data_uri=None):
    """Build the messages list for the chat completion API."""
    if image_data_uri:
        content = [
            {"type": "image_url", "image_url": {"url": image_data_uri}},
            {"type": "text", "text": query},
        ]
    else:
        content = query

    messages = [
        {
            "role": "system",
            "content": "You are a helpful assistant.",
        },
        {
            "role": "user",
            "content": content,
        },
    ]
    return messages


@csrf_exempt
@require_POST
def chat_api(request):
    """Streaming chat endpoint using Server-Sent Events."""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    query = body.get("query", "").strip()
    image_b64 = body.get("image")  # base64-encoded image data URI

    if not query:
        return JsonResponse({"error": "Query is required"}, status=400)

    messages = _build_messages(query, image_b64)

    def event_stream():
        try:
            if image_b64:
                llm = get_vision_model()
                if not llm:
                    raise Exception("Vision model failed to load")
            else:
                llm = get_text_model()
                if not llm:
                    raise Exception("Text model failed to load")

            response = llm.create_chat_completion(
                messages=messages,
                stream=True,
                max_tokens=2048,
                temperature=0.7,
            )

            for chunk in response:
                delta = chunk.get("choices", [{}])[0].get("delta", {})
                text = delta.get("content", "")
                if text:
                    data = json.dumps({"token": text})
                    yield f"data: {data}\n\n"

            yield "data: [DONE]\n\n"
        except Exception as e:
            error_data = json.dumps({"error": str(e)})
            yield f"data: {error_data}\n\n"
            yield "data: [DONE]\n\n"

    response = StreamingHttpResponse(
        event_stream(),
        content_type="text/event-stream",
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


@csrf_exempt
@require_POST
def tts_api(request):
    """TTS endpoint placeholder — to be implemented."""
    return JsonResponse({"error": "TTS not yet implemented"}, status=501)
