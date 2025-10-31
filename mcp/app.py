"""
File: mcp/app.py
Purpose: FastAPI app exposing /health and /mcp/event. Accepts recent chat context
and enqueues reply generation via Celery.
Inputs: POST /mcp/event {room, recent[], user?}
Outputs: JSON {ok, queued, room, bias}
Security: Validate payload shape; we use Pydantic model MCPEvent.
"""
import os, collections, re
from fastapi import FastAPI
from pydantic import BaseModel
from utils.redis_client import get_redis, publish
from celery_app import celery_app


app = FastAPI()
r = get_redis(os.environ.get('REDIS_URL', 'redis://redis:6379/0'))


class MCPEvent(BaseModel):
    room: str | None = 'lobby'
    recent: list[str]
    user: str | None = None

def build_bias(messages: list[str]) -> str:
    words = []
    for m in messages[-100:]:
        words += re.findall(r"[a-zA-Z']+", m.lower())
    counts = collections.Counter(zip(words, words[1:]))
    top = ", ".join([f"{a}->{b}" for (a,b),_ in counts.most_common(10)])
    return f"Recent bigrams: {top}" if top else ""

@app.get('/health')
def health():
    try:
        r.ping()
        return { 'ok': True }
    except Exception as e:
        return { 'ok': False, 'error': str(e) }
    
@app.post('/mcp/event')
def mcp_event(ev: MCPEvent):
    bias = build_bias(ev.recent or [])
    celery_app.send_task('worker.generate_reply', args=[ev.room or 'lobby', ev.recent or [], bias])
    return { 'ok': True, 'queued': True, 'room': ev.room, 'bias': bias }