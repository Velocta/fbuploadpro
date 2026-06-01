import { spawn } from 'node:child_process';
import { YTDLP_CONFIG } from '../config.js';
import { buildYtdlpProfileUrl, supportsYtdlpDiscovery } from './profile-urls.js';
import { extractIdsFromYtdlpJson } from './extract-ids.js';

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

function runYtdlpFlatPlaylist(profileUrl) {
  const bin = YTDLP_CONFIG.BIN;
  const timeoutMs = YTDLP_CONFIG.TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const child = spawn(bin, ['--flat-playlist', '-J', profileUrl], {
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
 * @returns {Promise<{ ok: true, ids: string[] } | { ok: false, reason: string }>}
 */
export async function discoverReelIdsWithYtdlp(platform, sourceUsername, maxCount) {
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
    stdout = await runYtdlpFlatPlaylist(profileUrl);
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
