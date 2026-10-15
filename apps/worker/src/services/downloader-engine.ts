import {
  MAX_MEDIA_DOWNLOAD_BYTES,
  validateSafeRemoteUrl,
  deriveDefaultCaptionFromFilename,
  detectSourcePlatform,
  normalizeCloudDriveUrl,
  resolveGoogleDriveDirectUrl,
  parseHtmlMediaCandidates,
  parseJsonPayloadCandidates,
  type RemoteMediaCandidate,
} from '@fbuploadpro/contracts';
import type { Env } from '../index.js';

export interface IngestJobParams {
  jobId: string;
  userId: string;
  sourceUrl: string;
  targetFolderId?: string | null;
  customFilename?: string | null;
  db: any;
  env: Env;
  fetchImpl?: typeof fetch;
  storageService?: any;
}

const MIME_EXTENSIONS: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const EXTENSION_MIMES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export function inferMimeFromUrlOrHeader(contentTypeHeader: string | null, targetUrl: string): string {
  const rawMime = (contentTypeHeader ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (rawMime === 'image/jpg') return 'image/jpeg';
  if (rawMime === 'video/x-m4v') return 'video/mp4';
  if (MIME_EXTENSIONS[rawMime]) return rawMime;

  try {
    const parsed = new URL(targetUrl);
    const pathname = parsed.pathname.toLowerCase();
    const dot = pathname.lastIndexOf('.');
    if (dot !== -1) {
      const ext = pathname.slice(dot);
      if (EXTENSION_MIMES[ext]) {
        return EXTENSION_MIMES[ext]!;
      }
    }
  } catch {
    // ignore parse error
  }

  // Default fallback for social/web media streams
  return 'video/mp4';
}

export function sanitizeFileName(
  rawName: string | null | undefined,
  mimeType: string,
  fallbackBase: string
): string {
  const ext = MIME_EXTENSIONS[mimeType] || '.mp4';
  const candidate = (rawName ?? '').trim();

  let cleaned = candidate
    .replaceAll(/[/\\?%*:|"<>]/g, '_')
    .replaceAll(/\s+/g, '_')
    .replaceAll(/[^a-zA-Z0-9._-]/g, '_')
    .replaceAll(/_+/g, '_')
    .replace(/^[_.-]+/, '');

  if (!cleaned) {
    cleaned = fallbackBase;
  }

  const lower = cleaned.toLowerCase();
  const hasExt = Object.keys(EXTENSION_MIMES).some((e) => lower.endsWith(e));
  if (!hasExt) {
    cleaned = `${cleaned.slice(0, 200)}${ext}`;
  } else if (cleaned.length > 240) {
    const dotIdx = cleaned.lastIndexOf('.');
    cleaned = `${cleaned.slice(0, 200)}${cleaned.slice(dotIdx)}`;
  }

  return cleaned;
}

export function extractFilenameFromHeader(header: string | null): string | null {
  if (!header) return null;
  const utf8Match = /filename\*=UTF-8''([^;\r\n]+)/i.exec(header);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }
  const quoted = /filename="([^"\r\n]+)"/i.exec(header);
  if (quoted?.[1]) return quoted[1].trim();
  const plain = /filename=([^;\r\n]+)/i.exec(header);
  if (plain?.[1]) return plain[1].trim();
  return null;
}

export async function updateJobStatus(
  db: any,
  jobId: string,
  updates: {
    status?: string;
    progressPercent?: number;
    downloadedBytes?: number;
    totalBytes?: number | null;
    mediaId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.progressPercent !== undefined) dbUpdates.progress_percent = updates.progressPercent;
  if (updates.downloadedBytes !== undefined) dbUpdates.downloaded_bytes = updates.downloadedBytes;
  if (updates.totalBytes !== undefined) dbUpdates.total_bytes = updates.totalBytes;
  if (updates.mediaId !== undefined) dbUpdates.media_id = updates.mediaId;
  if (updates.errorCode !== undefined) dbUpdates.error_code = updates.errorCode;
  if (updates.errorMessage !== undefined) dbUpdates.error_message = updates.errorMessage;
  if (updates.metadata !== undefined) dbUpdates.metadata = updates.metadata;

  await db.from('media_download_jobs').update(dbUpdates).eq('id', jobId);
}

export function trimTrailingSlash(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') {
    end--;
  }
  return url.slice(0, end);
}

/**
 * Validates remote download safety. Per Spec 028, user storage quotas are abolished.
 */
export async function validateDownloadSafety(
  sourceUrl: string,
  db: any,
  jobId: string
): Promise<boolean> {
  const safeCheck = validateSafeRemoteUrl(sourceUrl);
  if (!safeCheck.valid) {
    await updateJobStatus(db, jobId, {
      status: 'failed',
      errorCode: 'UNSAFE_URL',
      errorMessage: safeCheck.reason || 'Private and loopback network addresses are not allowed.',
    });
    return false;
  }
  return true;
}

// Backward-compatible alias for existing test imports
export async function validateDownloadSafetyAndQuota(
  sourceUrl: string,
  _userId: string,
  db: any,
  jobId: string
): Promise<{ totalBytes: number; usedBytes: number } | null> {
  const safe = await validateDownloadSafety(sourceUrl, db, jobId);
  if (!safe) return null;
  return { totalBytes: Number.MAX_SAFE_INTEGER, usedBytes: 0 };
}

async function tryExtractorApi(
  sourceUrl: string,
  env: Env,
  fetchImpl: typeof fetch
): Promise<RemoteMediaCandidate[] | null> {
  const extractorUrl = (env as Record<string, unknown>).DOWNLOADER_EXTRACTOR_API_URL;
  if (!extractorUrl || typeof extractorUrl !== 'string' || extractorUrl.trim().length === 0) {
    return null;
  }
  try {
    const extRes = await fetchImpl(extractorUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ url: sourceUrl }),
    });
    if (!extRes.ok) return null;
    const extJson: unknown = await extRes.json();
    const extCandidates = parseJsonPayloadCandidates(extJson);
    return extCandidates.length > 0 ? extCandidates : null;
  } catch {
    return null;
  }
}

async function tryPlatformHtmlResolution(
  sourceUrl: string,
  platform: string,
  parsed: URL,
  html: string,
  fetchImpl: typeof fetch
): Promise<RemoteMediaCandidate[] | null> {
  if (platform === 'google_drive') {
    const direct = resolveGoogleDriveDirectUrl(sourceUrl, html);
    if (direct) {
      return [{ streamUrl: direct, mediaTypeHint: 'video' }];
    }
  }

  if (platform === 'x') {
    const statusMatch = /\/status(?:es)?\/(\d+)/.exec(parsed.pathname);
    if (statusMatch?.[1]) {
      try {
        const fxRes = await fetchImpl(`https://api.fxtwitter.com/status/${statusMatch[1]}`, {
          headers: { Accept: 'application/json' },
        });
        if (fxRes.ok) {
          const fxCandidates = parseJsonPayloadCandidates(await fxRes.json());
          if (fxCandidates.length > 0) return fxCandidates;
        }
      } catch {
        // ignore
      }
    }
  }
  return null;
}

async function tryProbeResolution(
  normalizedUrl: string,
  sourceUrl: string,
  platform: string,
  parsed: URL,
  fetchImpl: typeof fetch
): Promise<RemoteMediaCandidate[] | null> {
  try {
    const probeRes = await fetchImpl(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FBUploadProMediaBot/1.0)',
        Accept: '*/*',
      },
      redirect: 'follow',
    });
    if (!probeRes.ok) return null;

    const contentType = (probeRes.headers.get('content-type') ?? '').toLowerCase();
    const effectiveUrl = probeRes.url || normalizedUrl;

    if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
      const html = await probeRes.text();
      const parsedHtml = parseHtmlMediaCandidates(html, effectiveUrl);
      if (parsedHtml.candidates.length > 0) {
        return parsedHtml.candidates;
      }
      return await tryPlatformHtmlResolution(sourceUrl, platform, parsed, html, fetchImpl);
    }

    if (contentType.includes('application/json')) {
      try {
        const jsonCandidates = parseJsonPayloadCandidates(await probeRes.json());
        if (jsonCandidates.length > 0) return jsonCandidates;
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore probe errors, fallback to normalizedUrl
  }
  return null;
}

/**
 * Edge-compatible link resolution: handles social platforms, cloud drives, and virus-scan bypass.
 */
export async function resolveRemoteCandidates(
  sourceUrl: string,
  env: Env,
  fetchImpl: typeof fetch
): Promise<RemoteMediaCandidate[]> {
  const parsed = new URL(sourceUrl);
  const normalizedUrl = normalizeCloudDriveUrl(parsed);
  const platform = detectSourcePlatform(sourceUrl);

  const extractorCandidates = await tryExtractorApi(sourceUrl, env, fetchImpl);
  if (extractorCandidates) {
    return extractorCandidates;
  }

  const probeCandidates = await tryProbeResolution(normalizedUrl, sourceUrl, platform, parsed, fetchImpl);
  if (probeCandidates) {
    return probeCandidates;
  }

  return [{ streamUrl: normalizedUrl }];
}

export async function fetchAndValidateRemoteMedia(
  sourceUrl: string,
  fetchImpl: typeof fetch,
  db: any,
  jobId: string
): Promise<{ response: Response; body: ReadableStream<Uint8Array>; totalBytesEstimate: number | null } | null> {
  // Pre-stream HEAD validation
  try {
    const headRes = await fetchImpl(sourceUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FBUploadPro/1.0; +https://fbuploadpro.com)',
      },
    });
    if (headRes.ok) {
      const headLength = Number(headRes.headers.get('content-length') || 0);
      if (headLength > MAX_MEDIA_DOWNLOAD_BYTES) {
        await updateJobStatus(db, jobId, {
          status: 'failed',
          errorCode: 'FILE_TOO_LARGE',
          errorMessage: 'Media file exceeds the maximum allowed size of 500 MB.',
        });
        return null;
      }
    }
  } catch {
    // HEAD failure is non-fatal
  }

  const response = await fetchImpl(sourceUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FBUploadPro/1.0; +https://fbuploadpro.com)',
    },
  });

  if (!response.ok || !response.body) {
    await updateJobStatus(db, jobId, {
      status: 'failed',
      errorCode: 'DOWNLOAD_FAILED',
      errorMessage: `Failed to fetch remote media (HTTP ${response.status} ${response.statusText}).`,
    });
    return null;
  }

  if (response.url) {
    const redirectSafety = validateSafeRemoteUrl(response.url);
    if (!redirectSafety.valid) {
      await updateJobStatus(db, jobId, {
        status: 'failed',
        errorCode: 'UNSAFE_URL',
        errorMessage: redirectSafety.reason || 'Redirected to an unsafe network address.',
      });
      return null;
    }
  }

  const body = response.body;
  const headerLength = Number(response.headers.get('content-length') || 0);
  const totalBytesEstimate = headerLength > 0 ? headerLength : null;

  if (totalBytesEstimate !== null && totalBytesEstimate > MAX_MEDIA_DOWNLOAD_BYTES) {
    await updateJobStatus(db, jobId, {
      status: 'failed',
      errorCode: 'FILE_TOO_LARGE',
      errorMessage: 'Media file exceeds the maximum allowed size of 500 MB.',
    });
    return null;
  }

  return { response, body, totalBytesEstimate };
}

export function createStreamProgressTracker(params: {
  db: any;
  jobId: string;
  totalBytesEstimate: number | null;
  onBytesUpdate: (bytes: number) => void;
}): TransformStream<Uint8Array, Uint8Array> {
  const { db, jobId, totalBytesEstimate, onBytesUpdate } = params;
  let downloadedBytes = 0;
  let lastProgressPercent = 5;
  let lastDbUpdateMs = Date.now();

  return new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      downloadedBytes += chunk.byteLength;
      onBytesUpdate(downloadedBytes);

      if (downloadedBytes > MAX_MEDIA_DOWNLOAD_BYTES) {
        controller.error(new Error('FILE_TOO_LARGE'));
        return;
      }

      if (totalBytesEstimate && totalBytesEstimate > 0) {
        const currentPercent = Math.min(95, Math.floor((downloadedBytes / totalBytesEstimate) * 100));
        const now = Date.now();
        if (currentPercent >= lastProgressPercent + 10 || now - lastDbUpdateMs >= 3000) {
          lastProgressPercent = currentPercent;
          lastDbUpdateMs = now;
          await updateJobStatus(db, jobId, {
            progressPercent: currentPercent,
            downloadedBytes,
            totalBytes: totalBytesEstimate,
          }).catch(() => {});
        }
      }

      controller.enqueue(chunk);
    },
  });
}

export async function collectStreamBuffer(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    combined.set(c, offset);
    offset += c.length;
  }
  return combined;
}

export async function drainAndDiscardStream(stream: ReadableStream<Uint8Array>): Promise<void> {
  const reader = stream.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
}

export async function writeStreamToDestination(params: {
  stream: ReadableStream<Uint8Array>;
  storageKey: string;
  mimeType: string;
  env: Env;
  storageService?: any;
}): Promise<string> {
  const { stream, storageKey, mimeType, env, storageService } = params;

  if (env.MEDIA_BUCKET && typeof env.MEDIA_BUCKET.put === 'function') {
    await env.MEDIA_BUCKET.put(storageKey, stream, {
      httpMetadata: { contentType: mimeType },
    });
    const r2Public = trimTrailingSlash(env.R2_PUBLIC_URL || 'https://media.fbuploadpro.com');
    return `${r2Public}/${storageKey}`;
  }

  if (storageService && typeof storageService.putObject === 'function') {
    const combined = await collectStreamBuffer(stream);
    const putResult = await storageService.putObject({
      key: storageKey,
      body: combined,
      contentType: mimeType,
    });
    return putResult.publicUrl || `https://media.fbuploadpro.com/${storageKey}`;
  }

  // Mock environment fallback for tests without storage
  await drainAndDiscardStream(stream);
  return `https://media.fbuploadpro.com/${storageKey}`;
}

export async function tryUploadVideoThumbnailToR2(params: {
  thumbnailUrl?: string | null;
  userId: string;
  mediaId: string;
  env: Env;
  fetchImpl: typeof fetch;
  storageService?: any;
}): Promise<{ thumbnailKey: string | null; thumbnailUrl: string | null }> {
  const { thumbnailUrl, userId, mediaId, env, fetchImpl, storageService } = params;
  if (!thumbnailUrl) return { thumbnailKey: null, thumbnailUrl: null };

  const safeCheck = validateSafeRemoteUrl(thumbnailUrl);
  if (!safeCheck.valid || !safeCheck.url) return { thumbnailKey: null, thumbnailUrl: null };

  try {
    const res = await fetchImpl(safeCheck.url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FBUploadProMediaBot/1.0)',
      },
    });
    if (!res.ok || !res.body) return { thumbnailKey: null, thumbnailUrl: null };

    const rawMime = (res.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase();
    const ext = rawMime === 'image/jpeg' || rawMime === 'image/jpg' ? '.jpg' : '.webp';
    const mime = ext === '.jpg' ? 'image/jpeg' : 'image/webp';
    const thumbnailKey = `users/${userId}/thumbnails/${mediaId}${ext}`;

    const r2Url = await writeStreamToDestination({
      stream: res.body,
      storageKey: thumbnailKey,
      mimeType: mime,
      env,
      storageService,
    });

    return { thumbnailKey, thumbnailUrl: r2Url };
  } catch {
    return { thumbnailKey: null, thumbnailUrl: null };
  }
}

export interface PersistDownloadedMediaItemParams {
  db: any;
  jobId: string;
  userId: string;
  targetFolderId: string | null;
  mediaId: string;
  fileName: string;
  mimeType: string;
  mediaType: 'video' | 'image';
  storageKey: string;
  publicUrl: string;
  downloadedBytes: number;
  thumbnailKey?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  aspectRatio?: string | null;
  captionText?: string | null;
  allMediaIds?: string[];
}

export async function persistDownloadedMediaItem(
  params: PersistDownloadedMediaItemParams
): Promise<void> {
  const {
    db,
    jobId,
    userId,
    targetFolderId,
    mediaId,
    fileName,
    mimeType,
    mediaType,
    storageKey,
    publicUrl,
    downloadedBytes,
    thumbnailKey = null,
    thumbnailUrl = null,
    durationSeconds = null,
    aspectRatio = 'unknown',
    captionText = null,
    allMediaIds,
  } = params;

  await updateJobStatus(db, jobId, {
    status: 'processing',
    progressPercent: 98,
    downloadedBytes,
    totalBytes: downloadedBytes,
  });

  const finalCaption =
    captionText && captionText.trim().length > 0
      ? captionText.trim().slice(0, 5000)
      : deriveDefaultCaptionFromFilename(fileName);

  const { error: mediaInsertError } = await db.from('media_items').insert({
    id: mediaId,
    user_id: userId,
    folder_id: targetFolderId,
    name: fileName,
    file_size: downloadedBytes,
    mime_type: mimeType,
    media_type: mediaType,
    storage_key: storageKey,
    url: publicUrl,
    thumbnail_key: thumbnailKey,
    thumbnail_url: mediaType === 'image' ? publicUrl : (thumbnailUrl ?? null),
    duration_seconds: durationSeconds,
    aspect_ratio: aspectRatio ?? 'unknown',
    caption_text: finalCaption,
  });

  if (mediaInsertError) {
    throw new Error(`Failed to save media metadata: ${mediaInsertError.message}`);
  }

  const mediaIds = allMediaIds && allMediaIds.length > 0 ? allMediaIds : [mediaId];

  await updateJobStatus(db, jobId, {
    status: 'completed',
    progressPercent: 100,
    downloadedBytes,
    totalBytes: downloadedBytes,
    mediaId,
    metadata: {
      media_ids: mediaIds,
      total_items: mediaIds.length,
    },
  });
}

export async function cleanupFailedDownload(
  db: any,
  jobId: string,
  storageKey: string | null,
  env: Env,
  err: unknown
): Promise<void> {
  const errorMsg = err instanceof Error ? err.message : String(err);
  let errorCode = 'DOWNLOAD_FAILED';
  if (errorMsg.includes('FILE_TOO_LARGE')) {
    errorCode = 'FILE_TOO_LARGE';
  }

  await updateJobStatus(db, jobId, {
    status: 'failed',
    errorCode,
    errorMessage: errorMsg,
  });

  if (storageKey && env.MEDIA_BUCKET && typeof env.MEDIA_BUCKET.delete === 'function') {
    try {
      await env.MEDIA_BUCKET.delete(storageKey);
    } catch {
      // ignore cleanup error
    }
  }
}

interface ProcessCandidateContext {
  db: any;
  jobId: string;
  userId: string;
  targetFolderId: string | null;
  customFilename: string | null;
  fetchImpl: typeof fetch;
  env: Env;
  storageService?: any;
  createdMediaIds: string[];
}

async function streamAndPersistCandidate(
  candidate: RemoteMediaCandidate,
  index: number,
  ctx: ProcessCandidateContext
): Promise<{ mediaId: string; storageKey: string } | null> {
  const { db, jobId, userId, targetFolderId, customFilename, fetchImpl, env, storageService, createdMediaIds } = ctx;
  const fetched = await fetchAndValidateRemoteMedia(candidate.streamUrl, fetchImpl, db, jobId);
  if (!fetched) return null;
  const { response, body, totalBytesEstimate } = fetched;

  const mimeType = inferMimeFromUrlOrHeader(response.headers.get('content-type'), candidate.streamUrl);
  const mediaType: 'video' | 'image' =
    candidate.mediaTypeHint ?? (mimeType.startsWith('image/') ? 'image' : 'video');
  const contentDisposition = response.headers.get('content-disposition');
  const headerFilename = extractFilenameFromHeader(contentDisposition);
  const defaultStem = index === 0 ? 'downloaded_asset' : `downloaded_asset_${index + 1}`;
  const fileName = sanitizeFileName(
    candidate.fileName || (index === 0 ? customFilename : null) || headerFilename,
    mimeType,
    defaultStem
  );

  const mediaId = crypto.randomUUID();
  createdMediaIds.push(mediaId);
  const storageKey = `users/${userId}/media/${mediaId}/${fileName}`;

  let downloadedBytes = 0;
  const progressTransform = createStreamProgressTracker({
    db,
    jobId,
    totalBytesEstimate,
    onBytesUpdate: (bytes) => {
      downloadedBytes = bytes;
    },
  });

  const transformedStream = body.pipeThrough(progressTransform);

  const publicUrl = await writeStreamToDestination({
    stream: transformedStream,
    storageKey,
    mimeType,
    env,
    storageService,
  });

  let thumbResult: { thumbnailKey: string | null; thumbnailUrl: string | null } = {
    thumbnailKey: null,
    thumbnailUrl: null,
  };

  if (mediaType === 'video' && candidate.thumbnailUrl) {
    thumbResult = await tryUploadVideoThumbnailToR2({
      thumbnailUrl: candidate.thumbnailUrl,
      userId,
      mediaId,
      env,
      fetchImpl,
      storageService,
    });
  }

  await persistDownloadedMediaItem({
    db,
    jobId,
    userId,
    targetFolderId,
    mediaId,
    fileName,
    mimeType,
    mediaType,
    storageKey,
    publicUrl,
    downloadedBytes,
    thumbnailKey: thumbResult.thumbnailKey,
    thumbnailUrl: thumbResult.thumbnailUrl,
    durationSeconds: candidate.durationSeconds ?? null,
    aspectRatio: candidate.aspectRatio ?? 'unknown',
    captionText: candidate.caption ?? null,
    allMediaIds: createdMediaIds,
  });

  return { mediaId, storageKey };
}

export async function executeDownloadJob(params: IngestJobParams): Promise<void> {
  const {
    jobId,
    userId,
    sourceUrl,
    targetFolderId = null,
    customFilename = null,
    db,
    env,
    fetchImpl = fetch,
    storageService,
  } = params;

  let storageKey: string | null = null;

  try {
    const isSafe = await validateDownloadSafety(sourceUrl, db, jobId);
    if (!isSafe) return;

    await updateJobStatus(db, jobId, {
      status: 'downloading',
      progressPercent: 5,
    });

    const candidates = await resolveRemoteCandidates(sourceUrl, env, fetchImpl);
    if (candidates.length === 0) {
      await updateJobStatus(db, jobId, {
        status: 'failed',
        errorCode: 'DOWNLOAD_FAILED',
        errorMessage: 'No downloadable video or image was found at this link.',
      });
      return;
    }

    const createdMediaIds: string[] = [];
    const candidateCtx: ProcessCandidateContext = {
      db,
      jobId,
      userId,
      targetFolderId,
      customFilename,
      fetchImpl,
      env,
      storageService,
      createdMediaIds,
    };

    let pipelineAborted = false;
    await candidates.reduce(async (prevPromise, candidate, i) => {
      await prevPromise;
      if (pipelineAborted) return;
      const res = await streamAndPersistCandidate(candidate, i, candidateCtx);
      if (!res) {
        pipelineAborted = true;
        return;
      }
      storageKey = res.storageKey;
    }, Promise.resolve());
  } catch (err: unknown) {
    await cleanupFailedDownload(db, jobId, storageKey, env, err);
  }
}
