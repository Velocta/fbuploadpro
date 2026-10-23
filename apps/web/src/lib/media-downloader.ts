import { randomUUID } from 'node:crypto';
import {
  AllowedMediaMimeTypes,
  MAX_MEDIA_DOWNLOAD_BYTES,
  deriveDefaultCaptionFromFilename,
  detectSourcePlatform,
  validateSafeRemoteUrl,
  resolveGoogleDriveDirectUrl,
  normalizeCloudDriveUrl,
  parseHtmlMediaCandidates,
  parseJsonPayloadCandidates,
  type RemoteMediaCandidate,
  type DownloaderSourcePlatform,
  type IStorageService,
} from '@fbuploadpro/contracts';
import {
  MEDIA_FETCH_TIMEOUT_MS,
  fetchWithTimeout,
  fetchWithTimeoutToHeaders,
} from '@/lib/http/fetch-with-timeout';

export type { RemoteMediaCandidate };

export type AllowedMediaMime = (typeof AllowedMediaMimeTypes)[number];

export type DownloaderErrorCode =
  | 'UNSAFE_URL'
  | 'UNSUPPORTED_MEDIA'
  | 'FILE_TOO_LARGE'
  | 'DOWNLOAD_FAILED';

export class MediaDownloaderError extends Error {
  public readonly code: DownloaderErrorCode;
  public readonly statusCode: 400 | 502;

  constructor(code: DownloaderErrorCode, message: string, statusCode: 400 | 502 = 400) {
    super(message);
    this.name = 'MediaDownloaderError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface UploadedDownloadedMediaItem {
  mediaId: string;
  name: string;
  fileSize: number;
  mimeType: AllowedMediaMime;
  mediaType: 'video' | 'image';
  storageKey: string;
  url: string;
  thumbnailKey: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  aspectRatio: string;
  captionText: string;
}

export interface ResolveAndUploadMediaParams {
  sourceUrl: string;
  userId: string;
  storage: IStorageService;
  fetchImpl?: typeof fetch | undefined;
  extractorApiUrl?: string | null | undefined;
}

export interface ResolveAndUploadMediaResult {
  sourceUrl: string;
  platform: DownloaderSourcePlatform;
  items: UploadedDownloadedMediaItem[];
}

const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_CAPTION_LENGTH = 5000;

const EXTENSION_TO_MIME: Record<string, AllowedMediaMime> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const MIME_TO_EXTENSION: Record<AllowedMediaMime, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const ALLOWED_MIME_SET = new Set<string>(AllowedMediaMimeTypes);

export { normalizeCloudDriveUrl };

function inferMimeFromPathOrName(pathOrName: string): AllowedMediaMime | null {
  const lower = pathOrName.toLowerCase().split('?')[0]?.split('#')[0] ?? '';
  const dotIndex = lower.lastIndexOf('.');
  if (dotIndex === -1) {
    return null;
  }
  const ext = lower.slice(dotIndex);
  return EXTENSION_TO_MIME[ext] ?? null;
}

export function resolveAllowedMimeType(
  contentTypeHeader: string | null,
  targetUrl: string,
  fileNameHint?: string | null,
  mediaTypeHint?: 'video' | 'image'
): AllowedMediaMime | null {
  const rawMime = (contentTypeHeader ?? '').split(';')[0]?.trim().toLowerCase() ?? '';

  if (rawMime === 'image/jpg') {
    return 'image/jpeg';
  }
  if (rawMime === 'video/x-m4v') {
    return 'video/mp4';
  }
  if (ALLOWED_MIME_SET.has(rawMime)) {
    return rawMime as AllowedMediaMime;
  }

  if (
    rawMime.startsWith('text/html') ||
    rawMime.startsWith('application/xhtml+xml') ||
    rawMime.startsWith('application/json') ||
    rawMime.startsWith('text/plain')
  ) {
    return null;
  }

  if (fileNameHint) {
    const fromHint = inferMimeFromPathOrName(fileNameHint);
    if (fromHint) {
      return fromHint;
    }
  }

  try {
    const parsed = new URL(targetUrl);
    const fromUrl = inferMimeFromPathOrName(parsed.pathname);
    if (fromUrl) {
      return fromUrl;
    }
  } catch (_e) {
    // Ignore URL parse error and fall through to mediaTypeHint
  }

  if (
    (rawMime === '' ||
      rawMime === 'application/octet-stream' ||
      rawMime === 'binary/octet-stream') &&
    mediaTypeHint
  ) {
    return mediaTypeHint === 'video' ? 'video/mp4' : 'image/jpeg';
  }

  return null;
}

function extractFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const utf8Match = /filename\*=UTF-8''([^;\r\n]+)/i.exec(header);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch (_e) {
      return utf8Match[1].trim();
    }
  }
  const quotedMatch = /filename="([^"\r\n]+)"/i.exec(header);
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim();
  }
  const plainMatch = /filename=([^;\r\n]+)/i.exec(header);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }
  return null;
}

function sanitizeFileNameWithExtension(
  rawName: string | null | undefined,
  mimeType: AllowedMediaMime,
  fallbackBaseName: string
): string {
  const defaultExt = MIME_TO_EXTENSION[mimeType];
  const baseCandidate = (rawName ?? '').trim();

  let cleaned = baseCandidate
    .replaceAll(/[/\\?%*:|"<>]/g, '_')
    .replaceAll(/\s+/g, '_')
    .replaceAll(/[^a-zA-Z0-9._-]/g, '_')
    .replaceAll(/_+/g, '_')
    .replace(/^[_.-]+/, '');

  if (!cleaned) {
    cleaned = fallbackBaseName;
  }

  const lower = cleaned.toLowerCase();
  const hasValidExt = Object.keys(EXTENSION_TO_MIME).some((ext) => lower.endsWith(ext));
  if (!hasValidExt) {
    cleaned = `${cleaned.slice(0, 200)}${defaultExt}`;
  } else if (cleaned.length > 240) {
    const dotIdx = cleaned.lastIndexOf('.');
    const ext = cleaned.slice(dotIdx);
    cleaned = `${cleaned.slice(0, 200)}${ext}`;
  }

  return cleaned;
}

function deriveFileNameFromUrl(urlStr: string, index: number): string {
  try {
    const parsed = new URL(urlStr);
    const segments = parsed.pathname.split('/').filter((s) => s.length > 0);
    const lastSegment = segments.at(-1);
    if (lastSegment) {
      const decoded = decodeURIComponent(lastSegment);
      if (decoded.length > 1 && decoded.length <= 180) {
        return decoded;
      }
    }
  } catch (_e) {
    // Use fallback name below
  }
  return index === 0 ? 'cloud_media' : `cloud_media_${index + 1}`;
}

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
    // Headers-only timeout: the thumbnail body is read as a stream
    // below, so a whole-request signal would abort it mid-read.
    const response = await fetchWithTimeoutToHeaders(
      safeCheck.url.toString(),
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FBUploadProMediaBot/1.0)',
          Accept: 'image/webp,image/jpeg,image/*,*/*;q=0.8',
        },
      },
      MEDIA_FETCH_TIMEOUT_MS,
      fetchFn
    );
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

async function fetchCandidateResponse(
  normalizedStreamUrl: string,
  fetchFn: typeof fetch,
  prefetchedResponse?: Response
): Promise<Response> {
  let response: Response;
  if (prefetchedResponse) {
    response = prefetchedResponse;
  } else {
    try {
      // Streaming download: this response's body is consumed as a
      // stream by the caller (readResponseBytesWithLimit), so the
      // timeout must bound only the time to response headers — a
      // whole-request AbortSignal.timeout would abort large bodies
      // mid-stream. fetchWithTimeoutToHeaders clears its timer once
      // headers arrive, keeping the stream intact.
      response = await fetchWithTimeoutToHeaders(
        normalizedStreamUrl,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; FBUploadProMediaBot/1.0)',
            Accept: '*/*',
          },
          redirect: 'follow',
        },
        MEDIA_FETCH_TIMEOUT_MS,
        fetchFn
      );
    } catch {
      throw new MediaDownloaderError(
        'DOWNLOAD_FAILED',
        'Could not connect to the remote media server. Please try again.',
        502
      );
    }
  }

  if (response.url) {
    const redirectSafety = validateSafeRemoteUrl(response.url);
    if (!redirectSafety.valid) {
      throw new MediaDownloaderError(
        'UNSAFE_URL',
        redirectSafety.reason ?? 'Redirected to an unsafe network address.',
        400
      );
    }
  }

  if (!response.ok) {
    throw new MediaDownloaderError(
      'DOWNLOAD_FAILED',
      `Remote server returned status ${response.status} while downloading media.`,
      502
    );
  }

  return response;
}

function validateAndNormalizeStreamUrl(rawStreamUrl: string): string {
  const safeCheck = validateSafeRemoteUrl(rawStreamUrl);
  if (!safeCheck.valid || !safeCheck.url) {
    throw new MediaDownloaderError(
      'UNSAFE_URL',
      safeCheck.reason ?? 'The resolved media stream address is not allowed.',
      400
    );
  }

  const normalizedStreamUrl = normalizeCloudDriveUrl(safeCheck.url);
  const normalizedCheck = validateSafeRemoteUrl(normalizedStreamUrl);
  if (!normalizedCheck.valid) {
    throw new MediaDownloaderError(
      'UNSAFE_URL',
      normalizedCheck.reason ?? 'The resolved media stream address is not allowed.',
      400
    );
  }

  return normalizedStreamUrl;
}

async function downloadAndStoreSingleCandidate(
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

async function tryResolveFromFxTwitter(
  sourceUrl: URL,
  fetchFn: typeof fetch
): Promise<RemoteMediaCandidate[]> {
  const statusMatch = /\/status(?:es)?\/(\d+)/.exec(sourceUrl.pathname);
  if (!statusMatch?.[1]) {
    return [];
  }
  try {
    const fxRes = await fetchWithTimeout(
      `https://api.fxtwitter.com/status/${statusMatch[1]}`,
      { headers: { Accept: 'application/json' } },
      MEDIA_FETCH_TIMEOUT_MS,
      fetchFn
    );
    if (!fxRes.ok) {
      return [];
    }
    const fxJson: unknown = await fxRes.json();
    return parseJsonPayloadCandidates(fxJson);
  } catch {
    // Fallback quietly when FxTwitter API is unreachable
    return [];
  }
}

async function tryResolveViaExternalExtractor(
  configuredExtractorUrl: string | null,
  canonicalSourceUrl: string,
  fetchFn: typeof fetch
): Promise<RemoteMediaCandidate[]> {
  if (!configuredExtractorUrl || configuredExtractorUrl.trim().length === 0) {
    return [];
  }
  try {
    const extRes = await fetchWithTimeout(
      configuredExtractorUrl.trim(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ url: canonicalSourceUrl }),
      },
      MEDIA_FETCH_TIMEOUT_MS,
      fetchFn
    );
    if (!extRes.ok) {
      return [];
    }
    const extJson: unknown = await extRes.json();
    return parseJsonPayloadCandidates(extJson);
  } catch {
    // Fall back to built-in serverless resolver if external extractor is unreachable
    return [];
  }
}

async function parseOkInitialResponse(
  initialResponse: Response,
  normalizedUrl: string,
  sourceUrl: URL,
  platform: DownloaderSourcePlatform,
  fetchFn: typeof fetch
): Promise<{
  candidates: RemoteMediaCandidate[];
  prefetchedBinaryResponse?: Response;
}> {
  const contentType = initialResponse.headers.get('content-type') ?? '';
  const lowerContentType = contentType.toLowerCase();
  const effectiveUrl = initialResponse.url || normalizedUrl;
  const dispositionFileName = extractFilenameFromContentDisposition(
    initialResponse.headers.get('content-disposition')
  );
  const directMime = resolveAllowedMimeType(contentType, effectiveUrl, dispositionFileName);

  if (directMime) {
    return {
      prefetchedBinaryResponse: initialResponse,
      candidates: [
        {
          streamUrl: effectiveUrl,
          fileName: dispositionFileName,
        },
      ],
    };
  }

  if (lowerContentType.includes('application/json') || lowerContentType.includes('text/json')) {
    try {
      const jsonData: unknown = await initialResponse.json();
      return { candidates: parseJsonPayloadCandidates(jsonData) };
    } catch {
      // Return empty candidates when JSON response body cannot be parsed
      return { candidates: [] };
    }
  }

  const htmlText = await initialResponse.text();
  const parsedHtml = parseHtmlMediaCandidates(htmlText, effectiveUrl);
  if (parsedHtml.candidates.length === 0 && platform === 'x') {
    return { candidates: await tryResolveFromFxTwitter(sourceUrl, fetchFn) };
  }
  if (parsedHtml.candidates.length === 0 && platform === 'google_drive') {
    const directUrl = resolveGoogleDriveDirectUrl(sourceUrl.toString(), htmlText);
    if (directUrl) {
      return {
        candidates: [
          {
            streamUrl: directUrl,
            mediaTypeHint: 'video',
          },
        ],
      };
    }
  }
  return { candidates: parsedHtml.candidates };
}

async function resolveCandidatesBuiltIn(
  sourceUrl: URL,
  platform: DownloaderSourcePlatform,
  fetchFn: typeof fetch
): Promise<{
  candidates: RemoteMediaCandidate[];
  prefetchedBinaryResponse?: Response;
}> {
  const normalizedUrl = validateAndNormalizeStreamUrl(sourceUrl.toString());

  let initialResponse: Response;
  try {
    // Headers-only timeout: a direct-media response here is kept as
    // a prefetched stream and read later, so a whole-request signal
    // would abort its body mid-stream (see fetchCandidateResponse).
    initialResponse = await fetchWithTimeoutToHeaders(
      normalizedUrl,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FBUploadProMediaBot/1.0)',
          Accept: '*/*',
        },
        redirect: 'follow',
      },
      MEDIA_FETCH_TIMEOUT_MS,
      fetchFn
    );
  } catch {
    throw new MediaDownloaderError(
      'DOWNLOAD_FAILED',
      'Could not reach the provided link. Please verify the link and try again.',
      502
    );
  }

  if (initialResponse.url) {
    const redirectSafety = validateSafeRemoteUrl(initialResponse.url);
    if (!redirectSafety.valid) {
      throw new MediaDownloaderError(
        'UNSAFE_URL',
        redirectSafety.reason ?? 'Redirected to a restricted network address.',
        400
      );
    }
  }

  if (!initialResponse.ok) {
    const fallbackCandidates =
      platform === 'x' ? await tryResolveFromFxTwitter(sourceUrl, fetchFn) : [];
    if (fallbackCandidates.length === 0) {
      throw new MediaDownloaderError(
        'DOWNLOAD_FAILED',
        `Could not retrieve content from this link (status ${initialResponse.status}).`,
        502
      );
    }
    return { candidates: fallbackCandidates };
  }

  return parseOkInitialResponse(initialResponse, normalizedUrl, sourceUrl, platform, fetchFn);
}

export async function resolveAndUploadMediaFromUrl(
  params: ResolveAndUploadMediaParams
): Promise<ResolveAndUploadMediaResult> {
  const fetchFn = params.fetchImpl ?? globalThis.fetch;
  const sourceValidation = validateSafeRemoteUrl(params.sourceUrl);
  if (!sourceValidation.valid || !sourceValidation.url) {
    throw new MediaDownloaderError(
      'UNSAFE_URL',
      sourceValidation.reason ?? 'Please enter a valid public http:// or https:// link.',
      400
    );
  }

  const canonicalSourceUrl = sourceValidation.url.toString();
  const platform = detectSourcePlatform(canonicalSourceUrl);
  const configuredExtractorUrl =
    params.extractorApiUrl === undefined
      ? (process.env.DOWNLOADER_EXTRACTOR_API_URL ?? null)
      : params.extractorApiUrl;

  let candidates = await tryResolveViaExternalExtractor(
    configuredExtractorUrl,
    canonicalSourceUrl,
    fetchFn
  );
  let prefetchedBinaryResponse: Response | undefined;

  if (candidates.length === 0) {
    const builtIn = await resolveCandidatesBuiltIn(sourceValidation.url, platform, fetchFn);
    candidates = builtIn.candidates;
    prefetchedBinaryResponse = builtIn.prefetchedBinaryResponse;
  }

  if (candidates.length === 0) {
    throw new MediaDownloaderError(
      'UNSUPPORTED_MEDIA',
      'No downloadable video or image was found at this link.',
      400
    );
  }

  const results = await Promise.allSettled(
    candidates.map((candidate, idx) =>
      downloadAndStoreSingleCandidate(
        candidate,
        idx,
        params.userId,
        params.storage,
        fetchFn,
        idx === 0 ? prefetchedBinaryResponse : undefined
      )
    )
  );

  const successfulItems: UploadedDownloadedMediaItem[] = [];
  let firstError: unknown = null;

  for (const res of results) {
    if (res.status === 'fulfilled') {
      successfulItems.push(res.value);
    } else if (!firstError) {
      firstError = res.reason;
    }
  }

  if (firstError || successfulItems.length === 0) {
    await Promise.all(
      successfulItems.map(async (item) => {
        try {
          await params.storage.deleteObject(item.storageKey);
          if (item.thumbnailKey) {
            await params.storage.deleteObject(item.thumbnailKey);
          }
        } catch {
          // ignore cleanup errors
        }
      })
    );
    throw firstError ?? new MediaDownloaderError(
      'DOWNLOAD_FAILED',
      'Failed to download media assets from this link.',
      502
    );
  }

  return {
    sourceUrl: canonicalSourceUrl,
    platform,
    items: successfulItems,
  };
}

