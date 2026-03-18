import json
import os
import base64
import re

from django.shortcuts import render
from django.http import StreamingHttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

import requests

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

    server_url = "http://localhost:8081/v1/chat/completions"
    
    payload = {
        "messages": messages,
        "stream": True,
        "max_tokens": 2048,
        "temperature": 0.7,
    }

    def event_stream():
        in_thinking_state = False
        try:
            with requests.post(server_url, json=payload, stream=True, timeout=120) as r:
                r.raise_for_status()
                for line in r.iter_lines():
                    if line:
                        decoded_line = line.decode('utf-8')
                        if decoded_line.startswith('data: '):
                            data_str = decoded_line[6:].strip()
                            if data_str == "[DONE]":
                                if in_thinking_state:
                                    yield f"data: {json.dumps({'token': '</think>'})}\n\n"
                                yield "data: [DONE]\n\n"
                                break
                            
                            try:
                                chunk = json.loads(data_str)
                                delta = chunk.get("choices", [{}])[0].get("delta", {})
                                
                                reasoning = delta.get("reasoning_content", "")
                                content = delta.get("content", "")
                                
                                response_tokens = []
                                
                                # If we get reasoning content, make sure we are inside <think> tags
                                if reasoning:
                                    if not in_thinking_state:
                                        response_tokens.append("<think>")
                                        in_thinking_state = True
                                    response_tokens.append(reasoning)
                                
                                # If we get normal content but were in thinking mode, close it
                                if content:
                                    if in_thinking_state:
                                        response_tokens.append("</think>")
                                        in_thinking_state = False
                                    response_tokens.append(content)
                                
                                for token in response_tokens:
                                    yield f"data: {json.dumps({'token': token})}\n\n"
                                    
                            except json.JSONDecodeError:
                                continue

        except Exception as e:
            error_data = json.dumps({"error": f"Llama-server error: {str(e)}"})
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
