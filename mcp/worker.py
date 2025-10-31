"""
File: mcp/worker.py
Purpose: Celery task that assembles prompts, calls LLM client, sanitizes output,
and publishes a {role: 'bot'} message to Redis chat channel.
Idempotency: Harmless to re-run; messages are append-only.
Telemetry: Includes task_id and timestamp in published payload.
"""
import os, json, datetime
from celery_app import celery_app
from utils.redis_client import get_redis, publish
from llm.openai_client import chat_completions
from skills.persona import build_system
from skills.summarizer import summarize_recent
from skills.safety import sanitize
import random

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
# IMPORTANT: Match Node's config.redis.channels.chat
REDIS_CHAT_CHANNEL = os.environ.get("REDIS_CHAT_CHANNEL", "chat")

r = get_redis(REDIS_URL)

@celery_app.task(bind=True, name="worker.generate_reply", autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def generate_reply(self, room: str, recent: list[str], bias: str = ""):
    """
    Celery task that:
      1) Builds a system prompt from bias
      2) Summarizes recent messages to a compact user prompt
      3) Calls LLM client
      4) Sanitizes output
      5) Publishes standardized payload to Redis pub/sub
    """
    task_id = getattr(self.request, "id", None)
    try:
        system = build_system(bias)
        user = summarize_recent(recent or [])
        text, err = chat_completions(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.8,
            max_tokens=80,
        )

        if not text:
            text = f"[imposter-bot] (fallback) {err or user or '...'}"

        text = sanitize(text).strip()
        if not text:
            text = "[imposter-bot] (empty reply)"

        # generate a friendly readable bot name similar to frontend usernames
        adjectives = ['Curious','Gentle','Swift','Witty','Brave','Sunny']
        animals = ['Otter','Fox','Koala','Panda','Cat','Turtle']
        def gen_bot_name():
            return f"{random.choice(adjectives)}{random.choice(animals)}{random.randrange(0,100)}"

        payload = {
            "user": gen_bot_name(),
            "text": text,
            "room": room or "lobby",
            "role": "bot",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "task_id": task_id,
        }

        # utils.redis_client.publish should JSON.stringify; if not, do it here:
        try:
            publish(r, REDIS_CHAT_CHANNEL, payload)
        except TypeError:
            publish(r, REDIS_CHAT_CHANNEL, json.dumps(payload))

        return text

    except Exception as e:
        # Publish a safe fallback so the chat doesn’t stall silently
        fallback = {
            "user": gen_bot_name() if 'gen_bot_name' in locals() else 'imposter-bot',
            "text": f"(error handling reply: {e})",
            "room": room or "lobby",
            "role": "bot",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "task_id": task_id,
        }
        try:
            publish(r, REDIS_CHAT_CHANNEL, fallback)
        except Exception:
            # last resort: swallow to avoid hard crashes after retries
            pass
        raise
