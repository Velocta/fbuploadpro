import dotenv from 'dotenv';
dotenv.config();

const toBoolean = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());

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
  MAX_REELS_PER_PLATFORM: Number(process.env.MAX_REELS_PER_PLATFORM || 1000),
};

export const BROWSER_CONFIG = {
  USER_DATA_DIR: process.env.BROWSER_USER_DATA_DIR || '.browser-profile',
  USER_AGENT: process.env.BROWSER_USER_AGENT || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
};

export const LOGIN_CONFIG = {
  SKIP_STARTUP_LOGINS: toBoolean(process.env.SKIP_STARTUP_LOGINS),
};