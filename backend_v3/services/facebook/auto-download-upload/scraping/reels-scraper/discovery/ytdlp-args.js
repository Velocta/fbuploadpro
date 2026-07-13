/** Matches main-scraper/scrapers/tiktok-ytdlp.js */
export const TIKTOK_YTDLP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

/**
 * Build argv for TikTok profile discovery via yt-dlp flat extract.
 * @param {string} profileUrl
 * @param {number} maxItems
 * @param {string} [userAgent]
 */
export function buildTiktokYtdlpArgs(profileUrl, maxItems, userAgent = TIKTOK_YTDLP_USER_AGENT) {
  const limit = Math.max(1, maxItems || 1000);

  return [
    '--flat-playlist',
    '-J',
    '--no-warnings',
    '--quiet',
    '--playlist-items',
    `1:${limit}`,
    '--impersonate',
    'chrome',
    '--add-header',
    'Referer: https://www.tiktok.com/',
    '--retries',
    '3',
    '--extractor-retries',
    '3',
    '--socket-timeout',
    '30',
    '--no-check-certificates',
    profileUrl,
  ];
}
