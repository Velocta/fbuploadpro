import re

DEFAULT_REEL_CAPTION = "❤️"

_PLACEHOLDER_CAPTIONS = frozenset({"...", "…", ".", "-", "n/a", "na", "none", ""})

_GENERIC_TITLE_PATTERNS = (
    re.compile(r"^instagram\s*reel\s*#?\d*$", re.I),
    re.compile(r"^tiktok\s*#?\d*$", re.I),
    re.compile(r"^youtube\s*shorts?$", re.I),
    re.compile(r"^reel\s*#?\d*$", re.I),
    re.compile(r"^video\s*#?\d*$", re.I),
)


def _looks_like_platform_id(text: str, reel_external_id: str | None) -> bool:
    if reel_external_id:
        reel_id = reel_external_id.strip()
        candidate = text.strip()
        if candidate.lower() == reel_id.lower():
            return True
        if " " not in candidate and (candidate in reel_id or reel_id in candidate):
            return True

    if re.fullmatch(r"\d{10,}", text):
        return True

    if " " not in text and re.fullmatch(r"[A-Za-z0-9_-]{11,32}", text):
        letter_runs = re.findall(r"[a-zA-Z]{4,}", text)
        if not letter_runs:
            return True
        if len(text) >= 15 and sum(ch.isdigit() for ch in text) >= 2:
            return True

    return False


def normalize_reel_caption(raw: str | None, *, reel_external_id: str | None = None) -> str:
    text = (raw or "").strip()
    if not text or text.lower() in _PLACEHOLDER_CAPTIONS:
        return DEFAULT_REEL_CAPTION

    if _looks_like_platform_id(text, reel_external_id):
        return DEFAULT_REEL_CAPTION

    lowered = text.lower().strip("# ")
    if lowered in {"video", "reel", "untitled", "tiktok", "instagram reel", "youtube shorts", "shorts"}:
        return DEFAULT_REEL_CAPTION

    for pattern in _GENERIC_TITLE_PATTERNS:
        if pattern.match(lowered):
            return DEFAULT_REEL_CAPTION

    return text


def caption_from_yt_dlp_info(info: dict, *, reel_external_id: str | None = None) -> str:
    description = (info.get("description") or "").strip()
    if description:
        return normalize_reel_caption(description, reel_external_id=reel_external_id)

    title = (info.get("title") or "").strip()
    video_id = str(info.get("id") or "").strip()
    if title and video_id and title == video_id:
        return DEFAULT_REEL_CAPTION

    return normalize_reel_caption(title, reel_external_id=reel_external_id)
