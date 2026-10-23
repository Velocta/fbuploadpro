import { randomUUID } from 'node:crypto';
import {
  MAX_MEDIA_DOWNLOAD_BYTES,
  deriveDefaultCaptionFromFilename,
  validateSafeRemoteUrl,
  type IStorageService,
  type RemoteMediaCandidate,
} from '@fbuploadpro/contracts';
import {
  extractFilenameFromContentDisposition,
  deriveFileNameFromUrl,
  resolveAllowedMimeType,
  sanitizeFileNameWithExtension,
} from './mime';
import {
  MediaDownloaderError,
  fetchCandidateResponse,
  validateAndNormalizeStreamUrl,
} from './resolvers';
import type { UploadedDownloadedMediaItem } from './index';

const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_CAPTION_LENGTH = 5000;

function assertContentLengthWithinLimit(response: Response, maxBytes: number): void {
  const contentLengthHeader = response.headers.get('content-length');
  if (!contentLengthHeader) {
    return;
  }
  const declaredSize = Number.parseInt(contentLengthHeader, 10);
  if (!Number.isNaN(declaredSize) && declaredSize > maxBytes) {
    throw new MediaDownloaderError(
      'FILE_TOO_LARGE',
      'This file exceeds the 500 MB maximum size limit.',
      400
    );
  }
}

function concatUint8Chunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

async function readResponseBytesWithLimit(
  response: Response,
  maxBytes: number
): Promise<Uint8Array> {
  assertContentLengthWithinLimit(response, maxBytes);

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new MediaDownloaderError(
        'FILE_TOO_LARGE',
        'This file exceeds the 500 MB maximum size limit.',
        400
      );
    }
    return new Uint8Array(buffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let exceededLimit = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          exceededLimit = true;
          break;
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (exceededLimit) {
    void reader.cancel();
    throw new MediaDownloaderError(
      'FILE_TOO_LARGE',
      'This file exceeds the 500 MB maximum size limit.',
      400
    );
  }

  return concatUint8Chunks(chunks, totalBytes);
}

function classifyThumbnailFormat(
  rawMime: string | undefined,
  pathname: string
): { mime: 'image/webp' | 'image/jpeg'; ext: 'webp' | 'jpeg' } | null {
  const lowerPath = pathname.toLowerCase();
  if (rawMime === 'image/webp' || lowerPath.endsWith('.webp')) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  if (
    rawMime === 'image/jpeg' ||
    rawMime === 'image/jpg' ||
    lowerPath.endsWith('.jpg') ||
    lowerPath.endsWith('.jpeg')
  ) {
    return { mime: 'image/jpeg', ext: 'jpeg' };
  }
  return null;
}

async function tryUploadVideoThumbnail(
  thumbnailUrl: string | null | undefined,
  userId: string,
  mediaId: string,
  storage: IStorageService,
  fetchFn: typeof fetch
): Promise<{ thumbnailKey: string | null; thumbnailUrl: string | null }> {
  if (!thumbnailUrl) {
    return { thumbnailKey: null, thumbnailUrl: null };
  }

  const safeCheck = validateSafeRemoteUrl(thumbnailUrl);
  if (!safeCheck.valid || !safeCheck.url) {
    return { thumbnailKey: null, thumbnailUrl: null };
  }

  try {
    const response = await fetchFn(safeCheck.url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FBUploadProMediaBot/1.0)',
        Accept: 'image/webp,image/jpeg,image/*,*/*;q=0.8',
      },
    });
    if (!response.ok) {
      return { thumbnailKey: null, thumbnailUrl: null };
    }
    if (response.url && !validateSafeRemoteUrl(response.url).valid) {
      return { thumbnailKey: null, thumbnailUrl: null };
    }

    const rawMime = (response.headers.get('content-type') ?? '')
      .split(';')[0]
      ?.trim()
      .toLowerCase();
    const format = classifyThumbnailFormat(rawMime, safeCheck.url.pathname);
    if (!format) {
      return { thumbnailKey: null, thumbnailUrl: null };
    }

    const bytes = await readResponseBytesWithLimit(response, MAX_THUMBNAIL_BYTES);
    if (bytes.byteLength === 0) {
      return { thumbnailKey: null, thumbnailUrl: null };
    }

    const thumbnailKey = `users/${userId}/thumbnails/${mediaId}.${format.ext}`;
    const uploaded = await storage.putObject({
      key: thumbnailKey,
      body: bytes,
      contentType: format.mime,
    });

    return {
      thumbnailKey: uploaded.key,
      thumbnailUrl: uploaded.publicUrl,
    };
  } catch {
    // Non-fatal: if optional video thumbnail download fails, proceed with the saved video
    return { thumbnailKey: null, thumbnailUrl: null };
  }
}

export async function downloadAndStoreSingleCandidate(
  candidate: RemoteMediaCandidate,
  index: number,
  userId: string,
  storage: IStorageService,
  fetchFn: typeof fetch,
  prefetchedResponse?: Response
): Promise<UploadedDownloadedMediaItem> {
  const normalizedStreamUrl = validateAndNormalizeStreamUrl(candidate.streamUrl);
  const response = await fetchCandidateResponse(
    normalizedStreamUrl,
    fetchFn,
    prefetchedResponse
  );

  const effectiveUrl = response.url || normalizedStreamUrl;
  const dispositionName = extractFilenameFromContentDisposition(
    response.headers.get('content-disposition')
  );
  const rawFileName =
    candidate.fileName ?? dispositionName ?? deriveFileNameFromUrl(effectiveUrl, index);

  const mimeType = resolveAllowedMimeType(
    response.headers.get('content-type'),
    effectiveUrl,
    rawFileName,
    candidate.mediaTypeHint
  );

  if (!mimeType) {
    throw new MediaDownloaderError(
      'UNSUPPORTED_MEDIA',
      'No supported video or image (MP4, MOV, WebM, JPEG, PNG, or WebP) was found at this link.',
      400
    );
  }

  const bytes = await readResponseBytesWithLimit(response, MAX_MEDIA_DOWNLOAD_BYTES);
  if (bytes.byteLength === 0) {
    throw new MediaDownloaderError(
      'UNSUPPORTED_MEDIA',
      'The remote media file was empty and could not be saved.',
      400
    );
  }

  const mediaId = randomUUID();
  const fallbackBase = index === 0 ? 'downloaded_media' : `downloaded_media_${index + 1}`;
  const sanitizedFileName = sanitizeFileNameWithExtension(rawFileName, mimeType, fallbackBase);
  const storageKey = `users/${userId}/media/${mediaId}/${sanitizedFileName}`;

  const uploadRes = await storage.putObject({
    key: storageKey,
    body: bytes,
    contentType: mimeType,
  });

  const mediaType: 'video' | 'image' = mimeType.startsWith('video/') ? 'video' : 'image';
  const thumbResult =
    mediaType === 'image'
      ? { thumbnailKey: null, thumbnailUrl: uploadRes.publicUrl }
      : await tryUploadVideoThumbnail(
          candidate.thumbnailUrl,
          userId,
          mediaId,
          storage,
          fetchFn
        );

  const trimmedCaption = candidate.caption?.trim() ?? '';
  const captionText =
    trimmedCaption.length > 0
      ? trimmedCaption.slice(0, MAX_CAPTION_LENGTH)
      : deriveDefaultCaptionFromFilename(sanitizedFileName);

  return {
    mediaId,
    name: sanitizedFileName,
    fileSize: uploadRes.byteLength,
    mimeType,
    mediaType,
    storageKey: uploadRes.key,
    url: uploadRes.publicUrl,
    thumbnailKey: thumbResult.thumbnailKey,
    thumbnailUrl: thumbResult.thumbnailUrl,
    durationSeconds: candidate.durationSeconds ?? null,
    aspectRatio: candidate.aspectRatio ?? 'unknown',
    captionText,
  };
}
