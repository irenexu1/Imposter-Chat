"""
File: mcp/utils/redis_client.py
Purpose: Tiny helpers for Redis publish and client creation.
"""
import redis, json


def get_redis(url: str):
    return redis.Redis.from_url(url, decode_responses=True)


def publish(r, channel: str, obj):
    r.publish(channel, json.dumps(obj))