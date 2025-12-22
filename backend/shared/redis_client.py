"""Redis client for caching."""
import redis
import os
from dotenv import load_dotenv
from typing import Optional, Any
import json

load_dotenv()

redis_client = redis.Redis(
    host='redis-19865.c284.us-east1-2.gce.cloud.redislabs.com',
    port=19865,
    decode_responses=True,
    username="default",
    password=os.getenv("REDIS_PASSWORD"),
)


def get_cache(key: str) -> Optional[Any]:
    """Get value from cache."""
    value = redis_client.get(key)
    if value:
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return None


def set_cache(key: str, value: Any, ttl: int = 3600):
    """Set value in cache with TTL."""
    if isinstance(value, (dict, list)):
        value = json.dumps(value)
    redis_client.setex(key, ttl, value)


def delete_cache(key: str):
    """Delete key from cache."""
    redis_client.delete(key)

