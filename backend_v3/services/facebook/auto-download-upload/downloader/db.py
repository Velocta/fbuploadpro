from supabase import create_client

from config import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

_client = None


def get_client():
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _client


def reset_stale_reel_downloads(stale_minutes: int):
    return get_client().rpc(
        "reset_stale_adu_reel_downloads",
        {"p_stale_minutes": stale_minutes},
    ).execute()


def claim_buffer_downloads(limit: int):
    return get_client().rpc("claim_adu_buffer_downloads", {"p_limit": limit}).execute()


def mark_downloaded(reel_id: int, object_key: str, size_bytes: int, content_type: str, sha256: str, caption: str):
    return get_client().rpc(
        "mark_adu_reel_downloaded",
        {
            "p_reel_id": reel_id,
            "p_media_object_key": object_key,
            "p_media_size_bytes": size_bytes,
            "p_media_content_type": content_type,
            "p_media_sha256": sha256,
            "p_reel_caption": caption,
        },
    ).execute()


def mark_download_failed(reel_id: int):
    return get_client().rpc("mark_adu_reel_download_failed", {"p_reel_id": reel_id}).execute()
