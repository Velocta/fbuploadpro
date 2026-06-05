import dotenv from 'dotenv';
dotenv.config();

const toBoolean = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());

const boundedInt = (value, fallback, { min = 0, max = null } = {}) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed < min) {
    return min;
  }
  if (max !== null && parsed > max) {
    return max;
  }
  return parsed;
};

export const INSTAGRAM_CONFIG = {
  USERNAME: process.env.INSTAGRAM_USERNAME,
  PASSWORD: process.env.INSTAGRAM_PASSWORD,
};

export const SUPABASE_CONFIG = {
  URL: process.env.SUPABASE_URL,
  SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

export const SCRAPER_CONFIG = {
  SCROLL_PAUSE: 2000,
  MAX_SAME_HEIGHT: 44,
  MAX_REELS_PER_PLATFORM: boundedInt(process.env.MAX_REELS_PER_PLATFORM, 1000, { min: 1, max: 10000 }),
};

export const BROWSER_CONFIG = {
  USER_DATA_DIR: process.env.BROWSER_USER_DATA_DIR || '.browser-profile',
  USER_AGENT: process.env.BROWSER_USER_AGENT || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
};

export const LOGIN_CONFIG = {
  SKIP_STARTUP_LOGINS: toBoolean(process.env.SKIP_STARTUP_LOGINS),
};

export const YTDLP_CONFIG = {
  BIN: process.env.YTDLP_BIN || 'yt-dlp',
  TIMEOUT_MS: boundedInt(process.env.YTDLP_TIMEOUT_MS, 120000, { min: 10000, max: 600000 }),
  RETRIES: boundedInt(process.env.YTDLP_RETRIES, 1, { min: 0, max: 10 }),
  EXTRACTOR_RETRIES: boundedInt(process.env.YTDLP_EXTRACTOR_RETRIES, 3, { min: 0, max: 20 }),
  SOCKET_TIMEOUT: boundedInt(process.env.YTDLP_SOCKET_TIMEOUT, 30, { min: 5, max: 300 }),
  SLEEP_REQUESTS: boundedInt(process.env.YTDLP_SLEEP_REQUESTS, 5, { min: 0, max: 60 }),
  DOWNLOAD_ARCHIVE_DIR: (process.env.YTDLP_DOWNLOAD_ARCHIVE_DIR || '').trim(),
  YOUTUBE_PLAYER_CLIENT: (process.env.YTDLP_YOUTUBE_PLAYER_CLIENT || 'mweb').trim(),
  YOUTUBE_PO_TOKEN: (process.env.YTDLP_YOUTUBE_PO_TOKEN || '').trim(),
};
