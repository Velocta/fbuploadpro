import os
import tempfile
import uuid
import json
import subprocess
from urllib.parse import urlsplit, urlunsplit

from config import (
    DATACENTER_PROXY,
    RESIDENTIAL_PROXY,
    aria2_cli_args,
    yt_dlp_aria2_downloader_args,
)

# Flexible target: yt-dlp/curl_cffi pick a compatible Chrome version automatically.
YT_DLP_IMPERSONATE = "chrome"

PLATFORM_PROFILES = {
    "instagram": {
        "headers": {
            "Referer": "https://www.instagram.com/",
        },
        "retries": 1,
        "extractor_retries": 2,
        "fragment_retries": 2,
        "socket_timeout": 30,
    },
    "tiktok": {
        "format_candidates": ["bv*+ba/b", "b[ext=mp4]/b"],
        "headers": {
            "Referer": "https://www.tiktok.com/",
        },
        "retries": 1,
        "extractor_retries": 1,
        "fragment_retries": 3,
        "socket_timeout": 30,
    },
    "youtube": {
        "format_candidates": ["bv*+ba/b", "bestvideo*+bestaudio/best"],
        "headers": {
            "Referer": "https://www.youtube.com/",
        },
        "retries": 1,
        "extractor_retries": 3,
        "fragment_retries": 3,
        "socket_timeout": 30,
    },
    "facebook": {
        "format_candidates": ["bv*+ba/b", "b[ext=mp4]/b"],
        "headers": {
            "Referer": "https://www.facebook.com/",
        },
        "retries": 1,
        "extractor_retries": 3,
        "fragment_retries": 3,
        "socket_timeout": 30,
        "generic_extractor_fallback": True
    },
}

def run_command(args):
    try:
        return subprocess.run(
            args,
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        sanitized_cmd = " ".join(_sanitize_arg(arg) for arg in exc.cmd)
        stderr_tail = _truncate_for_error(exc.stderr)
        stdout_tail = _truncate_for_error(exc.stdout)
        raise RuntimeError(
            "Command failed "
            f"(exit_code={exc.returncode}). "
            f"cmd={sanitized_cmd}. "
            f"stderr={stderr_tail or '(empty)'}. "
            f"stdout={stdout_tail or '(empty)'}"
        ) from exc


def _truncate_for_error(text, limit=1200):
    if not text:
        return ""
    collapsed = " ".join(text.strip().split())
    if len(collapsed) <= limit:
        return collapsed
    return f"{collapsed[:limit]}... [truncated]"


def _sanitize_arg(arg):
    if "://" not in arg or "@" not in arg:
        return arg
    try:
        parsed = urlsplit(arg)
    except Exception:
        return arg

    if not parsed.username or parsed.password is None:
        return arg

    redacted_netloc = parsed.netloc.replace(f"{parsed.username}:{parsed.password}@", "***:***@")
    return urlunsplit((parsed.scheme, redacted_netloc, parsed.path, parsed.query, parsed.fragment))


def parse_json_from_stdout(stdout):
    for line in reversed(stdout.splitlines()):
        stripped = line.strip()
        if not stripped:
            continue
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            continue
    raise RuntimeError("yt-dlp did not return parsable JSON output")


def build_common_yt_dlp_args(profile, proxy):
    args = [
        "--no-warnings",
        "--quiet",
        "--impersonate",
        YT_DLP_IMPERSONATE,
        "--retries",
        str(profile.get("retries", 1)),
        "--extractor-retries",
        str(profile.get("extractor_retries", 3)),
        "--fragment-retries",
        str(profile.get("fragment_retries", 3)),
        "--socket-timeout",
        str(profile.get("socket_timeout", 30)),
    ]
    if proxy:
        args.extend(["--proxy", proxy])
    for header_name, header_value in profile.get("headers", {}).items():
        args.extend(["--add-header", f"{header_name}: {header_value}"])
    return args


def fetch_metadata(url, proxy, profile):
    args = [
        "yt-dlp",
        url,
        "--dump-single-json",
        "--skip-download",
    ]
    args.extend(build_common_yt_dlp_args(profile, proxy))
    result = run_command(args)
    return parse_json_from_stdout(result.stdout)


def download_with_yt_dlp(url, proxy, output_template, profile, format_selector, use_generic_extractor=False):
    args = [
        "yt-dlp",
        url,
        "--format",
        format_selector,
        "--output",
        output_template,
        "--no-progress",
        "--downloader",
        "aria2c",
        "--downloader-args",
        yt_dlp_aria2_downloader_args(),
        "--merge-output-format",
        "mp4",
        "--print-json",
    ]
    args.extend(build_common_yt_dlp_args(profile, proxy))
    if use_generic_extractor:
        args.append("--force-generic-extractor")
    result = run_command(args)
    return parse_json_from_stdout(result.stdout)


def resolve_downloaded_filename(tmp_dir, unique_id, info):
    requested_downloads = info.get("requested_downloads") or []
    preferred_paths = [
        info.get("_filename"),
        requested_downloads[0].get("filepath") if requested_downloads else None,
    ]
    for candidate in preferred_paths:
        if candidate and os.path.exists(candidate):
            return candidate

    base_filename = os.path.join(tmp_dir, unique_id)
    for ext in ("mp4", "mkv", "webm", "m4a"):
        candidate = f"{base_filename}.{ext}"
        if os.path.exists(candidate):
            return candidate

    for name in os.listdir(tmp_dir):
        if name.startswith(unique_id) and not name.endswith(".part"):
            candidate = os.path.join(tmp_dir, name)
            if os.path.isfile(candidate):
                return candidate

    return None

def download_from_metadata_info(info: dict, tmp_dir: str, unique_id: str) -> tuple[str, str]:
    """Resolve CDN URLs from yt-dlp metadata and download via aria2 (no proxy on file fetch)."""
    description = info.get("description") or info.get("title") or "..."
    user_agent = info.get("http_headers", {}).get("User-Agent", "Mozilla/5.0")
    requested_formats = info.get("requested_formats")
    if requested_formats and len(requested_formats) > 1:
        v_url = requested_formats[0]["url"]
        a_url = requested_formats[1]["url"]
        v_path = os.path.join(tmp_dir, f"{unique_id}_v.mp4")
        a_path = os.path.join(tmp_dir, f"{unique_id}_a.m4a")
        subprocess.run(
            ["aria2c", "-q", *aria2_cli_args(), "--user-agent", user_agent, v_url, "-o", f"{unique_id}_v.mp4", "-d", tmp_dir],
            check=True,
        )
        subprocess.run(
            ["aria2c", "-q", *aria2_cli_args(), "--user-agent", user_agent, a_url, "-o", f"{unique_id}_a.m4a", "-d", tmp_dir],
            check=True,
        )
        filename = os.path.join(tmp_dir, f"{unique_id}.mp4")
        subprocess.run(["ffmpeg", "-y", "-i", v_path, "-i", a_path, "-c", "copy", "-f", "mp4", filename], check=True)
    else:
        url_to_dl = info.get("url")
        if not url_to_dl:
            raise RuntimeError("Unable to extract direct video URL from metadata")
        filename = os.path.join(tmp_dir, f"{unique_id}.mp4")
        subprocess.run(
            ["aria2c", "-q", *aria2_cli_args(), "--user-agent", user_agent, url_to_dl, "-o", f"{unique_id}.mp4", "-d", tmp_dir],
            check=True,
        )
    return filename, description


def download_via_metadata_then_aria2(
    url: str,
    profile: dict,
    metadata_proxy: str | None,
    tmp_dir: str,
    unique_id: str,
) -> tuple[str, str]:
    info = fetch_metadata(url, metadata_proxy, profile)
    return download_from_metadata_info(info, tmp_dir, unique_id)


def download_with_ytdlp_formats(
    url: str,
    profile: dict,
    proxy: str | None,
    tmp_dir: str,
    unique_id: str,
    *,
    include_generic_fallback: bool = False,
) -> tuple[str, str]:
    output_template = os.path.join(tmp_dir, f"{unique_id}.%(ext)s")
    attempts = [(fmt, False) for fmt in profile.get("format_candidates", ["bv*+ba/b"])]
    if include_generic_fallback:
        attempts.append((profile["format_candidates"][-1], True))

    filename = None
    description = "..."
    attempt_errors = []
    for format_selector, use_generic_extractor in attempts:
        try:
            info = download_with_yt_dlp(
                url,
                proxy,
                output_template,
                profile,
                format_selector,
                use_generic_extractor=use_generic_extractor,
            )
            description = info.get("description") or info.get("title") or "..."
            filename = resolve_downloaded_filename(tmp_dir, unique_id, info)
            if filename:
                return filename, description
            attempt_errors.append(f"format={format_selector}: output file not found")
        except RuntimeError as exc:
            attempt_errors.append(f"format={format_selector}: {exc}")

    raise RuntimeError("All yt-dlp profile attempts failed. " + " | ".join(attempt_errors[-3:]))


def download_reel_media(platform: str, url: str) -> tuple[str, str]:
    """Download reel to a temp file; returns (absolute_path, caption). Caller must delete the file."""
    platform = (platform or "instagram").lower()
    if platform not in PLATFORM_PROFILES:
        raise ValueError(f"unsupported platform: {platform}")

    unique_id = uuid.uuid4().hex
    tmp_dir = tempfile.mkdtemp(prefix="adu-dl-")
    try:
        profile = PLATFORM_PROFILES[platform]

        if platform == "instagram":
            # Metadata via yt-dlp (optional datacenter proxy), then direct CDN fetch via aria2.
            filename, description = download_via_metadata_then_aria2(
                url,
                profile,
                DATACENTER_PROXY,
                tmp_dir,
                unique_id,
            )
        elif platform == "youtube":
            filename, description = download_with_ytdlp_formats(
                url,
                profile,
                RESIDENTIAL_PROXY,
                tmp_dir,
                unique_id,
            )
        else:
            # TikTok and Facebook: full yt-dlp download (optional datacenter proxy on yt-dlp).
            filename, description = download_with_ytdlp_formats(
                url,
                profile,
                DATACENTER_PROXY,
                tmp_dir,
                unique_id,
                include_generic_fallback=platform == "facebook",
            )

        if not os.path.exists(filename):
            raise RuntimeError("Failed to download video")
        return filename, description
    except Exception:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise
