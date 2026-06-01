/** Platforms that attempt yt-dlp flat-playlist discovery before Puppeteer. */
export const YTDLP_DISCOVERY_PLATFORMS = new Set(['tiktok', 'youtube']);

export function supportsYtdlpDiscovery(platform) {
  return YTDLP_DISCOVERY_PLATFORMS.has((platform || '').toLowerCase());
}

export function buildYtdlpProfileUrl(platform, sourceUsername) {
  const p = (platform || '').toLowerCase();
  const cleaned = (sourceUsername || '').trim().replace(/\s/g, '');

  if (p === 'tiktok') {
    const handle = cleaned.startsWith('@') ? cleaned : `@${cleaned}`;
    return `https://www.tiktok.com/${handle}`;
  }

  if (p === 'youtube') {
    const handle = cleaned.startsWith('@') ? cleaned : `@${cleaned}`;
    return `https://www.youtube.com/${handle}/shorts`;
  }

  return null;
}
