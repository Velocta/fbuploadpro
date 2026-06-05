import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BROWSER_CONFIG, YTDLP_CONFIG } from '../config.js';
import { buildYtdlpProfileUrl, supportsYtdlpDiscovery } from './profile-urls.js';
import { extractIdsFromYtdlpJson } from './extract-ids.js';
import { buildYtdlpFlatPlaylistArgs } from './ytdlp-args.js';

function parseYtdlpStdout(stdout) {
  const trimmed = (stdout || '').trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(lines[i]);
      } catch {
        // continue
      }
    }
  }

  return null;
}

/** Puppeteer launches Chromium; yt-dlp reads cookies from the same profile. */
function resolveAutomationBrowserCookies() {
  const profileDir = path.resolve(BROWSER_CONFIG.USER_DATA_DIR);
  return `chromium:${profileDir}`;
}

function resolveDownloadArchive(platform, pageId, config) {
  if (!config.DOWNLOAD_ARCHIVE_DIR || !pageId) {
    return '';
  }

  const archivePath = path.join(config.DOWNLOAD_ARCHIVE_DIR, `${platform}-${pageId}.txt`);
  fs.mkdirSync(config.DOWNLOAD_ARCHIVE_DIR, { recursive: true });
  return archivePath;
}

function buildRuntimeConfig(platform, pageId) {
  return {
    RETRIES: YTDLP_CONFIG.RETRIES,
    EXTRACTOR_RETRIES: YTDLP_CONFIG.EXTRACTOR_RETRIES,
    SOCKET_TIMEOUT: YTDLP_CONFIG.SOCKET_TIMEOUT,
    USER_AGENT: BROWSER_CONFIG.USER_AGENT,
    COOKIES_FROM_BROWSER: resolveAutomationBrowserCookies(),
    SLEEP_REQUESTS: YTDLP_CONFIG.SLEEP_REQUESTS,
    DOWNLOAD_ARCHIVE: resolveDownloadArchive(platform, pageId, YTDLP_CONFIG),
    YOUTUBE_PLAYER_CLIENT: YTDLP_CONFIG.YOUTUBE_PLAYER_CLIENT,
    YOUTUBE_PO_TOKEN: YTDLP_CONFIG.YOUTUBE_PO_TOKEN,
  };
}

function runYtdlpFlatPlaylist(platform, profileUrl, pageId) {
  const bin = YTDLP_CONFIG.BIN;
  const timeoutMs = YTDLP_CONFIG.TIMEOUT_MS;
  const runtimeConfig = buildRuntimeConfig(platform, pageId);
  const args = buildYtdlpFlatPlaylistArgs(platform, profileUrl, runtimeConfig);

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`yt-dlp timed out after ${timeoutMs}ms`));
        return;
      }
      if (code !== 0) {
        const tail = stderr.trim().slice(-500) || stdout.trim().slice(-500);
        reject(new Error(`yt-dlp exited with code ${code}${tail ? `: ${tail}` : ''}`));
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Discover reel IDs via yt-dlp (TikTok / YouTube only).
 * @param {string} platform
 * @param {string} sourceUsername
 * @param {number} maxCount
 * @param {{ pageId?: string }} [options]
 * @returns {Promise<{ ok: true, ids: string[] } | { ok: false, reason: string }>}
 */
export async function discoverReelIdsWithYtdlp(platform, sourceUsername, maxCount, options = {}) {
  const p = (platform || '').toLowerCase();

  if (!supportsYtdlpDiscovery(p)) {
    return { ok: false, reason: 'platform_not_supported' };
  }

  const profileUrl = buildYtdlpProfileUrl(p, sourceUsername);
  if (!profileUrl) {
    return { ok: false, reason: 'invalid_profile_url' };
  }

  let stdout;
  try {
    console.log(`📡 yt-dlp discovery: ${profileUrl}`);
    stdout = await runYtdlpFlatPlaylist(p, profileUrl, options.pageId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ yt-dlp failed for ${profileUrl}: ${message}`);
    return { ok: false, reason: message };
  }

  const payload = parseYtdlpStdout(stdout);
  if (!payload) {
    console.warn(`⚠️ yt-dlp returned unparseable JSON for ${profileUrl}`);
    return { ok: false, reason: 'unparseable_json' };
  }

  const ids = extractIdsFromYtdlpJson(payload, p, maxCount);
  if (ids.length === 0) {
    console.warn(`⚠️ yt-dlp returned zero IDs for ${profileUrl}`);
    return { ok: false, reason: 'empty_result' };
  }

  console.log(`✅ yt-dlp discovered ${ids.length} ID(s) for ${p}/${sourceUsername}`);
  return { ok: true, ids };
}
