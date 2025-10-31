"""
File: mcp/llm/openai_client.py
Purpose: Minimal HTTP client for OpenAI/Ollama-compatible /chat/completions API.
Config: OPENAI_API_BASE, OPENAI_API_KEY, OPENAI_MODEL
"""

import os, requests

API_BASE = os.environ.get("OPENAI_API_BASE", "").rstrip("/")
API_KEY = os.environ.get("OPENAI_API_KEY", "")
MODEL = os.environ.get("OPENAI_MODEL", "llama3")


def chat_completions(messages, temperature=0.8, max_tokens=80):
    """Call an OpenAI/Ollama-compatible chat completion API.
    Returns: (text, error) where only one is non-None.
    """
    if not API_BASE:
        return None, "API base URL not set"

    url = f"{API_BASE}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if API_KEY and API_KEY.lower() != "none":
        headers["Authorization"] = f"Bearer {API_KEY}"

    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)

        try:
            data = resp.json()
        except Exception:
            return None, f"Non-JSON response: {resp.text}"

        choices = data.get("choices")
        if not choices:
            return None, f"Bad response: {data}"

        content = choices[0].get("message", {}).get("content")
        if content:
            return content.strip(), None

        return None, f"Bad response: {data}"

    except Exception as e:
        return None, f"HTTP error: {e}"
