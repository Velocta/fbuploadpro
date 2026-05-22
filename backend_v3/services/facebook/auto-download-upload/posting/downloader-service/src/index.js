import { Container, getContainer } from '@cloudflare/containers';
import { env as workerEnv } from 'cloudflare:workers';

function normalizeFacebookReelSource(reelId) {
  const value = String(reelId || '').trim();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `https://www.facebook.com/reel/${value}`;
}

function getSourceUrl(platform, username, reelId) {
  const sourcePlatform = String(platform || '').toLowerCase();
  if (sourcePlatform === 'instagram') return `https://www.instagram.com/reels/${reelId}/`;
  if (sourcePlatform === 'tiktok') return `https://www.tiktok.com/@${username}/video/${reelId}`;
  if (sourcePlatform === 'youtube') return `https://www.youtube.com/shorts/${reelId}`;
  if (sourcePlatform === 'facebook') return normalizeFacebookReelSource(reelId);
  throw new Error(`UNSUPPORTED_FORMAT platform=${sourcePlatform || 'unknown'}`);
}

async function sha256Hex(blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function decodeBase64Utf8(input) {
  try {
    return decodeURIComponent(
      Array.from(atob(String(input || '')))
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
  } catch {
    return '';
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithContainerReadiness(container, targetUrl) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await container.fetch(targetUrl);
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await sleep(100 + Math.floor(Math.random() * 200));
      }
    }
  }
  throw lastError ?? new Error('container_fetch_failed');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (request.method !== 'POST' || url.pathname !== '/download-object') {
      return new Response('Not Found', { status: 404 });
    }

    try {
      const body = await request.json();
      const platform = String(body.platform || '').toLowerCase();
      const username = String(body.username || '');
      const reelId = String(body.reel_id || '');
      const jobId = String(body.job_id || crypto.randomUUID());
      if (!platform || !reelId) {
        return Response.json(
          { error_code: 'CONTRACT_INVALID', error: 'missing platform/reel_id' },
          { status: 400 }
        );
      }

      const sourceUrl = getSourceUrl(platform, username, reelId);
      const container = getContainer(env.DOWNLOADER_CONTAINER, jobId);
      const downloadUrl = `https://downloader.internal/download?url=${encodeURIComponent(sourceUrl)}&platform=${encodeURIComponent(platform)}`;
      const res = await fetchWithContainerReadiness(
        container,
        downloadUrl
      );
      if (!res.ok) {
        const msg = await res.text();
        return Response.json(
          {
            error_code: 'TRANSIENT_NETWORK',
            error: msg || `downloader_http_${res.status}`,
          },
          { status: 502 }
        );
      }

      const blob = await res.blob();
      const size = blob.size;
      const sha = await sha256Hex(blob);
      const captionHeader = res.headers.get('X-Video-Description');
      const reelCaption = decodeBase64Utf8(captionHeader).trim();
      const key = `v2-posting/${jobId}/${sha}.mp4`;
      await env.POSTING_MEDIA_BUCKET.put(key, blob, {
        httpMetadata: { contentType: blob.type || 'video/mp4' },
        customMetadata: {
          source_platform: platform,
          source_username: username,
          source_reel_id: reelId,
        },
      });

      return Response.json({
        contract_version: 'v1',
        media_object_key: key,
        signed_url: null,
        expires_at: null,
        content_type: blob.type || 'video/mp4',
        size_bytes: size,
        sha256: sha,
        reel_caption: reelCaption || null,
        source_fingerprint: `${platform}:${username}:${reelId}`,
        downloaded_at: new Date().toISOString(),
      });
    } catch (error) {
      const msg = String(error?.message || 'download_failed');
      const errorCode = msg.startsWith('UNSUPPORTED_FORMAT')
        ? 'UNSUPPORTED_FORMAT'
        : msg.includes('not available')
          ? 'SOURCE_NOT_FOUND'
          : 'TRANSIENT_NETWORK';
      return Response.json(
        {
          error_code: errorCode,
          error: msg,
        },
        { status: 500 }
      );
    }
  },
};

export class DownloaderContainer extends Container {
  defaultPort = 8080;
  sleepAfter = '30s';
  envVars = {
    RESIDENTIAL_PROXY: workerEnv.RESIDENTIAL_PROXY,
  };
}
