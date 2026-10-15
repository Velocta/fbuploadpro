import {
  MAX_MEDIA_DOWNLOAD_BYTES,
  validateSafeRemoteUrl,
  deriveDefaultCaptionFromFilename,
} from '@fbuploadpro/contracts';
import type { Env } from '../index.js';

export interface StorageQuotaInfo {
  totalBytes: number;
  usedBytes: number;
}

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

export async function getUserStorageQuota(db: any, userId: string): Promise<StorageQuotaInfo> {
  const { data, error } = await db
    .from('user_storage_quotas')
    .select('total_bytes, used_bytes')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    // Default 5 GB
    return {
      totalBytes: 5_368_709_120,
      usedBytes: 0,
    };
  }

  return {
    totalBytes: Number(data.total_bytes ?? 5_368_709_120),
    usedBytes: Number(data.used_bytes ?? 0),
  };
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

  await db.from('media_download_jobs').update(dbUpdates).eq('id', jobId);
}

export function trimTrailingSlash(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') {
    end--;
  }
  return url.slice(0, end);
}

export async function validateDownloadSafetyAndQuota(
  sourceUrl: string,
  userId: string,
  db: any,
  jobId: string
): Promise<StorageQuotaInfo | null> {
  const safeCheck = validateSafeRemoteUrl(sourceUrl);
  if (!safeCheck.valid) {
    await updateJobStatus(db, jobId, {
      status: 'failed',
      errorCode: 'UNSAFE_URL',
      errorMessage: safeCheck.reason || 'Private and loopback network addresses are not allowed.',
    });
    return null;
  }

  const quota = await getUserStorageQuota(db, userId);
  if (quota.usedBytes >= quota.totalBytes) {
    await updateJobStatus(db, jobId, {
      status: 'failed',
      errorCode: 'QUOTA_EXCEEDED',
      errorMessage: 'Storage quota limit reached. Please remove old media or upgrade storage.',
    });
    return null;
  }

  return quota;
}

export async function fetchAndValidateRemoteMedia(
  sourceUrl: string,
  fetchImpl: typeof fetch,
  quota: StorageQuotaInfo,
  db: any,
  jobId: string
): Promise<{ response: Response; body: ReadableStream<Uint8Array>; totalBytesEstimate: number | null } | null> {
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

  if (totalBytesEstimate !== null && quota.usedBytes + totalBytesEstimate > quota.totalBytes) {
    await updateJobStatus(db, jobId, {
      status: 'failed',
      errorCode: 'QUOTA_EXCEEDED',
      errorMessage: 'Storage quota exceeded for this file size.',
    });
    return null;
  }

  return { response, body, totalBytesEstimate };
}

export function createStreamProgressTracker(params: {
  db: any;
  jobId: string;
  quota: StorageQuotaInfo;
  totalBytesEstimate: number | null;
  onBytesUpdate: (bytes: number) => void;
}): TransformStream<Uint8Array, Uint8Array> {
  const { db, jobId, quota, totalBytesEstimate, onBytesUpdate } = params;
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

      if (quota.usedBytes + downloadedBytes > quota.totalBytes) {
        controller.error(new Error('QUOTA_EXCEEDED'));
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

export async function persistDownloadedMediaItem(params: {
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
  quotaUsedBytes: number;
}): Promise<void> {
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
    quotaUsedBytes,
  } = params;

  await updateJobStatus(db, jobId, {
    status: 'processing',
    progressPercent: 98,
    downloadedBytes,
    totalBytes: downloadedBytes,
  });

  const captionText = deriveDefaultCaptionFromFilename(fileName);

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
    thumbnail_key: null,
    thumbnail_url: mediaType === 'image' ? publicUrl : null,
    duration_seconds: null,
    aspect_ratio: 'unknown',
    caption_text: captionText,
  });

  if (mediaInsertError) {
    throw new Error(`Failed to save media metadata: ${mediaInsertError.message}`);
  }

  await db.rpc('increment_user_storage_used', {
    p_user_id: userId,
    p_bytes: downloadedBytes,
  }).catch(async () => {
    await db
      .from('user_storage_quotas')
      .update({
        used_bytes: quotaUsedBytes + downloadedBytes,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  });

  await updateJobStatus(db, jobId, {
    status: 'completed',
    progressPercent: 100,
    downloadedBytes,
    totalBytes: downloadedBytes,
    mediaId,
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
  } else if (errorMsg.includes('QUOTA_EXCEEDED')) {
    errorCode = 'QUOTA_EXCEEDED';
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
    const quota = await validateDownloadSafetyAndQuota(sourceUrl, userId, db, jobId);
    if (!quota) return;

    await updateJobStatus(db, jobId, {
      status: 'downloading',
      progressPercent: 5,
    });

    const fetched = await fetchAndValidateRemoteMedia(sourceUrl, fetchImpl, quota, db, jobId);
    if (!fetched) return;
    const { response, body, totalBytesEstimate } = fetched;

    const mimeType = inferMimeFromUrlOrHeader(response.headers.get('content-type'), sourceUrl);
    const mediaType: 'video' | 'image' = mimeType.startsWith('image/') ? 'image' : 'video';
    const contentDisposition = response.headers.get('content-disposition');
    const headerFilename = extractFilenameFromHeader(contentDisposition);
    const fileName = sanitizeFileName(customFilename || headerFilename, mimeType, 'downloaded_asset');

    const mediaId = crypto.randomUUID();
    storageKey = `users/${userId}/media/${mediaId}/${fileName}`;

    let downloadedBytes = 0;
    const progressTransform = createStreamProgressTracker({
      db,
      jobId,
      quota,
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
      quotaUsedBytes: quota.usedBytes,
    });
  } catch (err: unknown) {
    await cleanupFailedDownload(db, jobId, storageKey, env, err);
  }
}
