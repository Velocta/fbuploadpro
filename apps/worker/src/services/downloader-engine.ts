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
    // 1. SSRF Safety Check
    const safeCheck = validateSafeRemoteUrl(sourceUrl);
    if (!safeCheck.valid) {
      await updateJobStatus(db, jobId, {
        status: 'failed',
        errorCode: 'UNSAFE_URL',
        errorMessage: safeCheck.reason || 'Private and loopback network addresses are not allowed.',
      });
      return;
    }

    // 2. Fetch User Storage Quota
    const quota = await getUserStorageQuota(db, userId);
    if (quota.usedBytes >= quota.totalBytes) {
      await updateJobStatus(db, jobId, {
        status: 'failed',
        errorCode: 'QUOTA_EXCEEDED',
        errorMessage: 'Storage quota limit reached. Please remove old media or upgrade storage.',
      });
      return;
    }

    // 3. Update status to 'downloading'
    await updateJobStatus(db, jobId, {
      status: 'downloading',
      progressPercent: 5,
    });

    // 4. Fetch the remote resource with redirect follow
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
      return;
    }

    const headerLength = Number(response.headers.get('content-length') || 0);
    const totalBytesEstimate = headerLength > 0 ? headerLength : null;

    if (totalBytesEstimate !== null && totalBytesEstimate > MAX_MEDIA_DOWNLOAD_BYTES) {
      await updateJobStatus(db, jobId, {
        status: 'failed',
        errorCode: 'FILE_TOO_LARGE',
        errorMessage: 'Media file exceeds the maximum allowed size of 500 MB.',
      });
      return;
    }

    if (totalBytesEstimate !== null && quota.usedBytes + totalBytesEstimate > quota.totalBytes) {
      await updateJobStatus(db, jobId, {
        status: 'failed',
        errorCode: 'QUOTA_EXCEEDED',
        errorMessage: 'Storage quota exceeded for this file size.',
      });
      return;
    }

    const mimeType = inferMimeFromUrlOrHeader(response.headers.get('content-type'), sourceUrl);
    const mediaType: 'video' | 'image' = mimeType.startsWith('image/') ? 'image' : 'video';
    const contentDisposition = response.headers.get('content-disposition');
    const headerFilename = extractFilenameFromHeader(contentDisposition);
    const rawName = customFilename || headerFilename || null;
    const fileName = sanitizeFileName(rawName, mimeType, 'downloaded_asset');

    const mediaId = crypto.randomUUID();
    storageKey = `users/${userId}/media/${mediaId}/${fileName}`;

    // 5. In-flight Streaming with Progress Tracking & Safety Limits
    let downloadedBytes = 0;
    let lastProgressPercent = 5;
    let lastDbUpdateMs = Date.now();

    const progressTransform = new TransformStream<Uint8Array, Uint8Array>({
      async transform(chunk, controller) {
        downloadedBytes += chunk.byteLength;

        if (downloadedBytes > MAX_MEDIA_DOWNLOAD_BYTES) {
          controller.error(new Error('FILE_TOO_LARGE'));
          return;
        }

        if (quota.usedBytes + downloadedBytes > quota.totalBytes) {
          controller.error(new Error('QUOTA_EXCEEDED'));
          return;
        }

        // Throttle progress updates (every 10% progress or 3 seconds)
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

    const transformedStream = response.body.pipeThrough(progressTransform);

    // 6. Pipe directly to Cloudflare R2
    let publicUrl: string;

    if (env.MEDIA_BUCKET && typeof env.MEDIA_BUCKET.put === 'function') {
      await env.MEDIA_BUCKET.put(storageKey, transformedStream, {
        httpMetadata: {
          contentType: mimeType,
        },
      });
      const r2Public = (env.R2_PUBLIC_URL || 'https://media.fbuploadpro.com').replace(/\/+$/, '');
      publicUrl = `${r2Public}/${storageKey}`;
    } else if (storageService && typeof storageService.putObject === 'function') {
      // Buffer fallback for test environments or custom storage services
      const reader = transformedStream.getReader();
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
      const putResult = await storageService.putObject({
        key: storageKey,
        body: combined,
        contentType: mimeType,
      });
      publicUrl = putResult.publicUrl || `https://media.fbuploadpro.com/${storageKey}`;
    } else {
      // Mock environment fallback for tests without storage
      const reader = transformedStream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
      publicUrl = `https://media.fbuploadpro.com/${storageKey}`;
    }

    // 7. Transition to 'processing' & Register media in Supabase
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

    // 8. Increment User Storage Quota
    await db.rpc('increment_user_storage_used', {
      p_user_id: userId,
      p_bytes: downloadedBytes,
    }).catch(async () => {
      // Fallback direct update if RPC is absent
      await db
        .from('user_storage_quotas')
        .update({
          used_bytes: quota.usedBytes + downloadedBytes,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    });

    // 9. Mark Job 'completed'
    await updateJobStatus(db, jobId, {
      status: 'completed',
      progressPercent: 100,
      downloadedBytes,
      totalBytes: downloadedBytes,
      mediaId,
    });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
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

    // Clean up partial R2 upload if any
    if (storageKey && env.MEDIA_BUCKET && typeof env.MEDIA_BUCKET.delete === 'function') {
      try {
        await env.MEDIA_BUCKET.delete(storageKey);
      } catch {
        // ignore cleanup error
      }
    }
  }
}
