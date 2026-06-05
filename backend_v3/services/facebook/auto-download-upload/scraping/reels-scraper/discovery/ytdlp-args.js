const PLATFORM_REFERERS = {
  tiktok: 'https://www.tiktok.com/',
  youtube: 'https://www.youtube.com/',
};

function buildYoutubeExtractorArgs(platform, config) {
  if (platform !== 'youtube') {
    return null;
  }

  const parts = [];
  if (config.YOUTUBE_PLAYER_CLIENT) {
    parts.push(`player_client=${config.YOUTUBE_PLAYER_CLIENT}`);
  }
  if (config.YOUTUBE_PO_TOKEN) {
    parts.push(`po_token=${config.YOUTUBE_PO_TOKEN}`);
  }

  return parts.length > 0 ? `youtube:${parts.join(';')}` : null;
}

/**
 * Build argv for `yt-dlp --flat-playlist -J <profileUrl>`.
 * Cookies and User-Agent always come from the Puppeteer automation browser profile.
 * @param {string} platform
 * @param {string} profileUrl
 * @param {object} config - resolved YTDLP runtime config
 */
export function buildYtdlpFlatPlaylistArgs(platform, profileUrl, config) {
  const p = (platform || '').toLowerCase();

  const args = [
    '--no-warnings',
    '--flat-playlist',
    '-J',
    '--retries',
    String(config.RETRIES),
    '--extractor-retries',
    String(config.EXTRACTOR_RETRIES),
    '--socket-timeout',
    String(config.SOCKET_TIMEOUT),
  ];

  if (config.USER_AGENT) {
    args.push('--user-agent', config.USER_AGENT);
  }

  const referer = PLATFORM_REFERERS[p];
  if (referer) {
    args.push('--add-header', `Referer:${referer}`);
  }

  if (config.COOKIES_FROM_BROWSER) {
    args.push('--cookies-from-browser', config.COOKIES_FROM_BROWSER);
  }

  if (config.SLEEP_REQUESTS > 0) {
    args.push('--sleep-requests', String(config.SLEEP_REQUESTS));
  }

  if (config.DOWNLOAD_ARCHIVE) {
    args.push('--download-archive', config.DOWNLOAD_ARCHIVE);
  }

  const extractorArgs = buildYoutubeExtractorArgs(p, config);
  if (extractorArgs) {
    args.push('--extractor-args', extractorArgs);
  }

  args.push(profileUrl);
  return args;
}
