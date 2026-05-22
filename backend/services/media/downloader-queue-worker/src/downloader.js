import { getContainer } from '@cloudflare/containers';

export async function downloadOnce(env, platform, username, reelId, jobId) {
  const sourceUrl = getSourceUrl(platform, username, reelId);
  const res = await fetchDownloader(env, sourceUrl, platform, jobId || reelId);
  if (!res.ok) {
    throw new Error(`Status ${res.status}: ${await res.text()}`);
  }

  const blob = await res.blob();
  const b64Description = res.headers.get('X-Video-Description');
  let description = '';
  if (b64Description) {
    description = decodeURIComponent(escape(atob(b64Description)));
  }
  return { blob, description };
}

function normalizeFacebookReelSource(reelId) {
  const value = String(reelId || '').trim();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `https://www.facebook.com/reel/${value}`;
}

async function fetchDownloader(env, sourceUrl, platform, sessionId) {
  const query = `?url=${encodeURIComponent(sourceUrl)}&platform=${platform}`;
  if (!env.POSTING_DOWNLOAD_CONTAINER) {
    throw new Error('downloader_container_not_configured');
  }
  const container = getContainer(env.POSTING_DOWNLOAD_CONTAINER, String(sessionId));
  // Fail fast: do a single readiness check and let queue retries handle recovery.
  try {
    const health = await container.fetch('https://downloader.internal/health');
    if (!health.ok) {
      throw new Error(`status=${health.status}`);
    }
  } catch (error) {
    const lastHealthError = String(error?.message || 'container_health_probe_failed');
    throw new Error(`container_startup_not_ready ${lastHealthError}`.trim());
  }
  return container.fetch(`https://downloader.internal/download${query}`);
}

export function getSourceUrl(platform, username, reelId) {
  const sourcePlatform = String(platform || '').toLowerCase();
  if (sourcePlatform === 'instagram') return `https://www.instagram.com/reels/${reelId}/`;
  if (sourcePlatform === 'tiktok') return `https://www.tiktok.com/@${username}/video/${reelId}`;
  if (sourcePlatform === 'youtube') return `https://www.youtube.com/shorts/${reelId}`;
  if (sourcePlatform === 'facebook') return normalizeFacebookReelSource(reelId);
  throw new Error(`unsupported_platform ${sourcePlatform || 'unknown'}`);
}
