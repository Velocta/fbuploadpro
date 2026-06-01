/**
 * Parse yt-dlp --flat-playlist -J output into platform-native reel/video/short IDs.
 */

function normalizeEntries(payload) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  if (Array.isArray(payload.entries)) {
    return payload.entries.filter(Boolean);
  }

  if (payload.id || payload.url || payload.webpage_url) {
    return [payload];
  }

  return [];
}

function idFromUrl(url, platform) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const withoutQuery = url.split('?')[0];

  if (platform === 'tiktok') {
    const match = withoutQuery.match(/\/video\/([^/?#]+)/);
    return match?.[1] || null;
  }

  if (platform === 'youtube') {
    const match = withoutQuery.match(/\/shorts\/([^/?#]+)/);
    return match?.[1] || null;
  }

  return null;
}

function extractEntryId(entry, platform) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const rawId = entry.id;
  if (typeof rawId === 'string' && rawId.trim()) {
    return rawId.trim();
  }

  const url = entry.url || entry.webpage_url || entry.original_url;
  return idFromUrl(url, platform);
}

export function extractIdsFromYtdlpJson(payload, platform, maxCount) {
  const p = (platform || '').toLowerCase();
  const limit = Math.max(1, maxCount || 1000);
  const entries = normalizeEntries(payload);
  const ids = [];
  const seen = new Set();

  for (const entry of entries) {
    const id = extractEntryId(entry, p);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
    if (ids.length >= limit) {
      break;
    }
  }

  return ids;
}
