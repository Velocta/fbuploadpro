#!/usr/bin/env python3
import json
import logging
import os
import shutil
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from config import (
    CLAIM_BATCH_SIZE,
    DOWNLOAD_MAX_BYTES,
    LOOP_INTERVAL_SECONDS,
    MAX_CONCURRENT,
    RESIDENTIAL_PROXY,
)
from db import claim_buffer_downloads, mark_download_failed, mark_downloaded
from media_download import download_reel_media
from r2_upload import object_key, upload_file
from sources import source_url

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("adu-downloader")


def process_one(row: dict) -> None:
    reel_id = row["reel_internal_id"]
    page_id = row["page_id"]
    platform = row["platform"]
    username = row["username"]
    reel_external_id = row["reel_id"]
    url = source_url(platform, username, reel_external_id)
    key = object_key(str(page_id), reel_id)
    local_path = None

    log.info(
        json.dumps(
            {
                "event": "download_begin",
                "reel_internal_id": reel_id,
                "page_id": str(page_id),
                "platform": platform,
            }
        )
    )

    try:
        if RESIDENTIAL_PROXY:
            os.environ["RESIDENTIAL_PROXY"] = RESIDENTIAL_PROXY

        local_path, caption = download_reel_media(platform, url)
        size = os.path.getsize(local_path)
        if size > DOWNLOAD_MAX_BYTES:
            raise RuntimeError("media_too_large")

        size_bytes, content_type, sha256 = upload_file(local_path, key)
        mark_downloaded(reel_id, key, size_bytes, content_type, sha256, caption)
        log.info(
            json.dumps(
                {
                    "event": "download_ok",
                    "reel_internal_id": reel_id,
                    "media_object_key": key,
                    "size_bytes": size_bytes,
                }
            )
        )
    except Exception as exc:
        log.exception(
            json.dumps(
                {
                    "event": "download_error",
                    "reel_internal_id": reel_id,
                    "message": str(exc)[:500],
                }
            )
        )
        mark_download_failed(reel_id)
    finally:
        if local_path and os.path.exists(local_path):
            parent = os.path.dirname(local_path)
            os.remove(local_path)
            if parent and parent.startswith("/tmp/adu-dl-"):
                shutil.rmtree(parent, ignore_errors=True)


def run_tick() -> int:
    result = claim_buffer_downloads(CLAIM_BATCH_SIZE)
    rows = result.data or []
    if not rows:
        log.info(json.dumps({"event": "claim_empty"}))
        return 0

    log.info(json.dumps({"event": "claim_ok", "count": len(rows)}))
    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as pool:
        futures = [pool.submit(process_one, row) for row in rows]
        for future in as_completed(futures):
            future.result()
    return len(rows)


def main() -> None:
    log.info(
        json.dumps(
            {
                "event": "loop_start",
                "interval_seconds": LOOP_INTERVAL_SECONDS,
                "concurrency": MAX_CONCURRENT,
            }
        )
    )
    while True:
        try:
            run_tick()
        except Exception:
            log.exception(json.dumps({"event": "tick_error"}))
        time.sleep(LOOP_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
