"""Supabase client for storage operations."""
from supabase import create_client, Client
import os
from urllib.parse import urljoin
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def upload_raw_data(bucket: str, file_path: str, file_content: bytes) -> str:
    """Upload raw data to Supabase Storage and return URI."""
    if not supabase:
        # Fallback for development
        return f"file://local/{file_path}"
    
    try:
        supabase.storage.from_(bucket).upload(
            file_path, file_content, file_options={"content-type": "application/octet-stream"}
        )
        # Ensure trailing slash on base URL when building public object URL
        base = SUPABASE_URL if SUPABASE_URL.endswith("/") else f"{SUPABASE_URL}/"
        return urljoin(base, f"storage/v1/object/public/{bucket}/{file_path}")
    except Exception as e:
        print(f"Error uploading to Supabase: {e}")
        return f"file://local/{file_path}"

