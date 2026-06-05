import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { YTDLP_CONFIG } from '../config.js';
import { buildTiktokProfileUrl, supportsYtdlpDiscovery } from './profile-urls.js';
import { buildTiktokYtdlpArgs } from './ytdlp-args.js';

const execFileAsync = promisify(execFile);

const EXEC_OPTS_BASE = {
  maxBuffer: 50 * 1024 * 1024,
};

function parseTiktokYtdlpJson(stdout) {
  const info = JSON.parse(stdout);
  const ids = [];

  if (info.entries && Array.isArray(info.entries)) {
    for (const entry of info.entries) {
      if (entry?.id) {
        ids.push(entry.id);
      }
    }
  } else if (info.id) {
    ids.push(info.id);
  }

  return ids;
}

async function runYtDlp(args) {
  const execOpts = {
    ...EXEC_OPTS_BASE,
    timeout: YTDLP_CONFIG.TIMEOUT_MS,
  };

  try {
    const { stdout } = await execFileAsync(YTDLP_CONFIG.BIN, args, execOpts);
    return stdout;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }

    const { stdout } = await execFileAsync('python3', ['-m', 'yt_dlp', ...args], execOpts);
    return stdout;
  }
}

/**
 * Discover TikTok video IDs via yt-dlp (flat extract), matching main-scraper.
 * @param {string} platform
 * @param {string} sourceUsername
 * @param {number} maxCount
 * @returns {Promise<{ ok: true, ids: string[] } | { ok: false, reason: string }>}
 */
export async function discoverReelIdsWithYtdlp(platform, sourceUsername, maxCount) {
  const p = (platform || '').toLowerCase();

  if (!supportsYtdlpDiscovery(p)) {
    return { ok: false, reason: 'platform_not_supported' };
  }

  const profileUrl = buildTiktokProfileUrl(sourceUsername);
  if (!profileUrl) {
    return { ok: false, reason: 'invalid_profile_url' };
  }

  const args = buildTiktokYtdlpArgs(profileUrl, maxCount);

  let stdout;
  try {
    console.log(`📡 TikTok yt-dlp discovery: ${profileUrl}`);
    stdout = await runYtDlp(args);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stderr = err.stderr?.toString?.() || '';
    const detail = stderr.trim().slice(-500) || message;
    console.warn(`⚠️ TikTok yt-dlp failed for ${profileUrl}: ${detail}`);
    return { ok: false, reason: detail };
  }

  let ids;
  try {
    ids = parseTiktokYtdlpJson(stdout);
  } catch (parseErr) {
    const message = parseErr instanceof Error ? parseErr.message : String(parseErr);
    console.warn(`⚠️ TikTok yt-dlp returned invalid JSON for ${profileUrl}: ${message}`);
    return { ok: false, reason: 'unparseable_json' };
  }

  if (ids.length === 0) {
    console.warn(`⚠️ TikTok yt-dlp returned zero IDs for ${profileUrl}`);
    return { ok: false, reason: 'empty_result' };
  }

  console.log(`✅ TikTok yt-dlp discovered ${ids.length} ID(s) for ${sourceUsername}`);
  return { ok: true, ids };
}
