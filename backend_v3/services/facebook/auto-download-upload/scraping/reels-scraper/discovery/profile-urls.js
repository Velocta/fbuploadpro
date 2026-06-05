/** Platforms that attempt yt-dlp flat-playlist discovery before Puppeteer. */
export const YTDLP_DISCOVERY_PLATFORMS = new Set(['tiktok']);

export function supportsYtdlpDiscovery(platform) {
  return YTDLP_DISCOVERY_PLATFORMS.has((platform || '').toLowerCase());
}

export function buildTiktokProfileUrl(sourceUsername) {
  const handle = String(sourceUsername || '').trim().replace(/^@+/, '');
  if (!handle) {
    return null;
  }
  return `https://www.tiktok.com/@${handle}`;
}

/** @deprecated Use buildTiktokProfileUrl — kept for callers passing platform. */
export function buildYtdlpProfileUrl(platform, sourceUsername) {
  if ((platform || '').toLowerCase() !== 'tiktok') {
    return null;
  }
  return buildTiktokProfileUrl(sourceUsername);
}
