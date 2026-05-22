#!/usr/bin/env python3
import argparse
import base64
import csv
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def safe_name(value):
    cleaned = "".join(ch if ch.isalnum() or ch in ("-", "_", ".") else "_" for ch in value)
    return cleaned.strip("_") or "unknown"


def parse_bool(value):
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def request_json(method, url, body=None, timeout=300):
    payload = None
    headers = {}
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url=url, data=payload, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        response_body = resp.read().decode("utf-8")
        return resp.getcode(), resp.headers, json.loads(response_body)


def request_binary(method, url, timeout=300):
    req = urllib.request.Request(url=url, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.getcode(), resp.headers, resp.read()


def load_jobs(input_csv):
    jobs = []
    with open(input_csv, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            platform = (row.get("platform") or "").strip().lower()
            reel_id = (row.get("reel_id") or "").strip()
            username = (row.get("username") or "").strip()
            if not platform or not reel_id:
                continue
            jobs.append(
                {
                    "platform": platform,
                    "username": username,
                    "reel_id": reel_id,
                    "job_id": (row.get("job_id") or "").strip() or None,
                    "source_url": (row.get("source_url") or "").strip() or None,
                }
            )
    return jobs


def source_url_for(job):
    if job.get("source_url"):
        return job["source_url"]
    platform = job["platform"]
    username = job.get("username", "")
    reel_id = job["reel_id"]
    if platform == "instagram":
        return f"https://www.instagram.com/reels/{reel_id}/"
    if platform == "tiktok":
        return f"https://www.tiktok.com/@{username}/video/{reel_id}"
    if platform == "youtube":
        return f"https://www.youtube.com/shorts/{reel_id}"
    if platform == "facebook":
        if reel_id.startswith("http://") or reel_id.startswith("https://"):
            return reel_id
        return f"https://www.facebook.com/reel/{reel_id}"
    raise ValueError(f"Unsupported platform: {platform}")


def decode_caption(header_value):
    if not header_value:
        return ""
    try:
        return base64.b64decode(header_value).decode("utf-8", errors="replace")
    except Exception:
        return ""


def run_container_mode(base_url, job, timeout):
    query = urllib.parse.urlencode(
        {"url": source_url_for(job), "platform": job["platform"]},
        safe=":/?=&",
    )
    url = f"{base_url.rstrip('/')}/download?{query}"
    status, headers, data = request_binary("GET", url, timeout=timeout)
    return {
        "status": status,
        "binary": data,
        "content_type": headers.get("Content-Type", "application/octet-stream"),
        "caption": decode_caption(headers.get("X-Video-Description")),
        "error": "",
    }


def run_worker_mode(base_url, job, timeout):
    url = f"{base_url.rstrip('/')}/download-object"
    body = {
        "platform": job["platform"],
        "username": job.get("username") or "",
        "reel_id": job["reel_id"],
    }
    if job.get("job_id"):
        body["job_id"] = job["job_id"]
    status, _, payload = request_json("POST", url, body=body, timeout=timeout)
    return {
        "status": status,
        "binary": b"",
        "content_type": "",
        "caption": "",
        "payload": payload,
        "error": "",
    }


def ensure_dirs(output_dir):
    output = pathlib.Path(output_dir)
    videos = output / "videos"
    output.mkdir(parents=True, exist_ok=True)
    videos.mkdir(parents=True, exist_ok=True)
    return output, videos


def save_binary(videos_dir, job, data, content_type):
    ext = ".mp4"
    if "webm" in (content_type or "").lower():
        ext = ".webm"
    filename = f"{safe_name(job['platform'])}_{safe_name(job['reel_id'])}{ext}"
    path = videos_dir / filename
    path.write_bytes(data)
    return str(path)


def main():
    parser = argparse.ArgumentParser(
        description="Test V2 downloader and save reels + captions locally."
    )
    parser.add_argument(
        "--endpoint",
        required=True,
        help="Base URL of downloader endpoint (container or worker).",
    )
    parser.add_argument(
        "--mode",
        choices=["container", "worker"],
        default="container",
        help="container = /download (includes caption header), worker = /download-object",
    )
    parser.add_argument(
        "--input-csv",
        required=True,
        help="CSV with columns: platform,username,reel_id,job_id(optional),source_url(optional)",
    )
    parser.add_argument(
        "--output-dir",
        default="backend_v2/tests/downloader-output",
        help="Directory for downloaded files and reports.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=300,
        help="HTTP request timeout per job.",
    )
    parser.add_argument(
        "--stop-on-error",
        type=parse_bool,
        default=False,
        help="If true, stop at first failed job.",
    )

    args = parser.parse_args()

    jobs = load_jobs(args.input_csv)
    if not jobs:
        print("No valid jobs found in input CSV.", file=sys.stderr)
        return 1

    output_dir, videos_dir = ensure_dirs(args.output_dir)
    results = []

    for idx, job in enumerate(jobs, start=1):
        started_at = now_iso()
        result_row = {
            "index": idx,
            "platform": job["platform"],
            "username": job.get("username", ""),
            "reel_id": job["reel_id"],
            "job_id": job.get("job_id") or "",
            "mode": args.mode,
            "endpoint": args.endpoint,
            "status_code": "",
            "ok": False,
            "caption": "",
            "video_path": "",
            "content_type": "",
            "media_object_key": "",
            "sha256": "",
            "size_bytes": "",
            "error": "",
            "started_at": started_at,
            "finished_at": "",
        }
        try:
            if args.mode == "container":
                resp = run_container_mode(args.endpoint, job, args.timeout_seconds)
                result_row["status_code"] = resp["status"]
                result_row["content_type"] = resp["content_type"]
                result_row["caption"] = resp["caption"]
                if resp["status"] != 200:
                    raise RuntimeError(f"container_http_{resp['status']}")
                video_path = save_binary(videos_dir, job, resp["binary"], resp["content_type"])
                result_row["video_path"] = video_path
                result_row["size_bytes"] = str(len(resp["binary"]))
            else:
                resp = run_worker_mode(args.endpoint, job, args.timeout_seconds)
                result_row["status_code"] = resp["status"]
                payload = resp["payload"]
                if resp["status"] != 200:
                    raise RuntimeError(payload.get("error") or f"worker_http_{resp['status']}")
                result_row["media_object_key"] = str(payload.get("media_object_key") or "")
                result_row["sha256"] = str(payload.get("sha256") or "")
                result_row["size_bytes"] = str(payload.get("size_bytes") or "")

            result_row["ok"] = True
            print(f"[{idx}/{len(jobs)}] OK {job['platform']} {job['reel_id']}")
        except (urllib.error.HTTPError, urllib.error.URLError, RuntimeError, ValueError) as exc:
            result_row["error"] = str(exc)
            print(f"[{idx}/{len(jobs)}] FAIL {job['platform']} {job['reel_id']} -> {exc}", file=sys.stderr)
            if args.stop_on_error:
                result_row["finished_at"] = now_iso()
                results.append(result_row)
                break
        finally:
            if not result_row["finished_at"]:
                result_row["finished_at"] = now_iso()
            results.append(result_row)

    json_path = output_dir / "results.json"
    csv_path = output_dir / "results.csv"

    json_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        fieldnames = list(results[0].keys())
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    ok_count = sum(1 for r in results if r["ok"])
    fail_count = len(results) - ok_count
    print(f"Done. ok={ok_count} fail={fail_count}")
    print(f"Saved: {json_path}")
    print(f"Saved: {csv_path}")
    return 0 if fail_count == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
