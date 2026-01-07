"""Redis client for caching."""
import redis
import os
from dotenv import load_dotenv
from typing import Optional, Any
import json

load_dotenv()

# Get Redis connection details from environment variables provided by docker-compose
redis_host = os.getenv("REDIS_HOST", "localhost")
redis_port = int(os.getenv("REDIS_PORT", 6379))

# Initialize Redis client for local development
redis_client = redis.Redis(
    host=redis_host,
    port=redis_port,
    decode_responses=True
    # No username or password for the local Redis container by default
)


def get_cache(key: str) -> Optional[Any]:
    """Get value from cache."""
    try:
        value = redis_client.get(key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
    except redis.exceptions.RedisError as e:
        print(f"Redis Error: {e}")
        # Return None or handle as appropriate if Redis is down
        return None
    return None


def set_cache(key: str, value: Any, ttl: int = 3600):
    """Set value in cache with TTL."""
    try:
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        redis_client.setex(key, ttl, value)
    except redis.exceptions.RedisError as e:
        print(f"Redis Error: {e}")


def delete_cache(key: str):
    """Delete key from cache."""
    try:
        redis_client.delete(key)
    except redis.exceptions.RedisError as e:
        print(f"Redis Error: {e}")

