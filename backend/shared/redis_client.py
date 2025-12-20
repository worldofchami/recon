"""Redis client for caching."""
import redis
import os
from dotenv import load_dotenv
from typing import Optional, Any
import json

load_dotenv()

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    db=0,
    decode_responses=True
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

