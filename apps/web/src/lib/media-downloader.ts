import { randomUUID } from 'node:crypto';
import {
  AllowedMediaMimeTypes,
  MAX_MEDIA_DOWNLOAD_BYTES,
   deriveDefaultCaptionFromFilename,
  detectSourcePlatform,
  validateSafeRemoteUrl,
  type DownloaderSourcePlatform,
  type IStorageService,
} from '@fbuploadpro/contracts';

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

export interface RemoteMediaCandidate {
  streamUrl: string;
  thumbnailUrl?: string | null | undefined;
  caption?: string | null | undefined;
  fileName?: string | null | undefined;
  mediaTypeHint?: 'video' | 'image' | undefined;
  durationSeconds?: number | null | undefined;
  aspectRatio?: string | null | undefined;
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

export function normalizeCloudDriveUrl(url: URL): string {
  const host = url.hostname.toLowerCase();

  if (host === 'drive.google.com') {
    const fileMatch = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url.pathname);
    if (fileMatch?.[1]) {
      return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
    }
    const queryId = url.searchParams.get('id');
    if (url.pathname === '/open' && queryId) {
      return `https://drive.google.com/uc?export=download&id=${queryId}`;
    }
  }

  if (host === 'www.dropbox.com' || host === 'dropbox.com') {
    const cloned = new URL(url.toString());
    cloned.searchParams.set('dl', '1');
    return cloned.toString();
  }

  return url.toString();
}

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

function decodeHtmlEntities(input: string): string {
  return input
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .trim();
}

function extractMetaValues(html: string, keys: string[]): string[] {
  const results: string[] = [];
  const metaTagRegex = /<meta\b[^>]*>/gi;
  const attrRegex = /([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  const keySet = new Set(keys.map((k) => k.toLowerCase()));

  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = metaTagRegex.exec(html)) !== null) {
    const tag = tagMatch[0];
    const attrs: Record<string, string> = {};
    let attrMatch: RegExpExecArray | null;
    attrRegex.lastIndex = 0;
    while ((attrMatch = attrRegex.exec(tag)) !== null) {
      const attrName = attrMatch[1]?.toLowerCase();
      const attrVal = attrMatch[2] ?? attrMatch[3] ?? '';
      if (attrName) {
        attrs[attrName] = attrVal;
      }
    }

    const prop = (attrs.property ?? attrs.name ?? attrs.itemprop ?? '').toLowerCase();
    const content = attrs.content ? decodeHtmlEntities(attrs.content) : '';
    if (prop && content && keySet.has(prop)) {
      results.push(content);
    }
  }

  return results;
}

function resolveRelativeUrl(candidate: string, baseUrl: string): string | null {
  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch (_e) {
    return null;
  }
}

interface ParsedHtmlMedia {
  candidates: RemoteMediaCandidate[];
}

function parseJsonLdNodes(
  node: unknown,
  baseUrl: string,
  videos: string[],
  images: string[],
  thumbnails: string[],
  captions: string[]
): void {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      parseJsonLdNodes(item, baseUrl, videos, images, thumbnails, captions);
    }
    return;
  }

  const record = node as Record<string, unknown>;
  const typeVal = typeof record['@type'] === 'string' ? record['@type'].toLowerCase() : '';

  if (typeof record.description === 'string' && record.description.trim()) {
    captions.push(decodeHtmlEntities(record.description));
  } else if (typeof record.name === 'string' && record.name.trim()) {
    captions.push(decodeHtmlEntities(record.name));
  } else if (typeof record.headline === 'string' && record.headline.trim()) {
    captions.push(decodeHtmlEntities(record.headline));
  }

  if (typeof record.thumbnailUrl === 'string') {
    const resolved = resolveRelativeUrl(record.thumbnailUrl, baseUrl);
    if (resolved) thumbnails.push(resolved);
  } else if (Array.isArray(record.thumbnailUrl)) {
    for (const t of record.thumbnailUrl) {
      if (typeof t === 'string') {
        const resolved = resolveRelativeUrl(t, baseUrl);
        if (resolved) thumbnails.push(resolved);
      }
    }
  }

  if (typeVal.includes('video')) {
    const rawVideoUrl =
      typeof record.contentUrl === 'string'
        ? record.contentUrl
        : typeof record.url === 'string'
          ? record.url
          : null;
    if (rawVideoUrl) {
      const resolved = resolveRelativeUrl(rawVideoUrl, baseUrl);
      if (resolved) videos.push(resolved);
    }
  } else if (typeVal.includes('image')) {
    const rawImageUrl =
      typeof record.contentUrl === 'string'
        ? record.contentUrl
        : typeof record.url === 'string'
          ? record.url
          : null;
    if (rawImageUrl) {
      const resolved = resolveRelativeUrl(rawImageUrl, baseUrl);
      if (resolved) images.push(resolved);
    }
  }

  for (const nestedKey of ['@graph', 'video', 'image', 'hasPart', 'sharedContent', 'associatedMedia']) {
    if (record[nestedKey]) {
      parseJsonLdNodes(record[nestedKey], baseUrl, videos, images, thumbnails, captions);
    }
  }
}

function parseHtmlMediaCandidates(html: string, baseUrl: string): ParsedHtmlMedia {
  const videoUrls: string[] = [];
  const imageUrls: string[] = [];
  const thumbnailUrls: string[] = [];
  const captions: string[] = [];

  // 1. Extract OpenGraph / Twitter Card captions (descriptions prioritized over titles)
  const metaDescriptions = extractMetaValues(html, [
    'og:description',
    'twitter:description',
    'description',
  ]);
  const metaTitles = extractMetaValues(html, ['og:title', 'twitter:title']);
  captions.push(...metaDescriptions, ...metaTitles);

  // 2. Extract OpenGraph / Twitter Card video & image URLs
  const ogVideos = extractMetaValues(html, [
    'og:video:secure_url',
    'og:video:url',
    'og:video',
    'twitter:player:stream',
  ]);
  for (const v of ogVideos) {
    const resolved = resolveRelativeUrl(v, baseUrl);
    if (resolved) {
      videoUrls.push(resolved);
    }
  }

  const ogImages = extractMetaValues(html, [
    'og:image:secure_url',
    'og:image:url',
    'og:image',
    'twitter:image',
    'twitter:image:src',
  ]);
  for (const img of ogImages) {
    const resolved = resolveRelativeUrl(img, baseUrl);
    if (resolved) {
      imageUrls.push(resolved);
    }
  }

  // 3. Extract JSON-LD structured data
  const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = jsonLdRegex.exec(html)) !== null) {
    const rawJson = scriptMatch[1]?.trim();
    if (!rawJson) continue;
    try {
      const parsedJson: unknown = JSON.parse(rawJson);
      parseJsonLdNodes(parsedJson, baseUrl, videoUrls, imageUrls, thumbnailUrls, captions);
    } catch (_e) {
      // Ignore malformed JSON-LD blocks
    }
  }

  // 4. Extract <video src="..."> and <source src="..."> tags
  const videoSrcRegex = /<(?:video|source)\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let videoMatch: RegExpExecArray | null;
  while ((videoMatch = videoSrcRegex.exec(html)) !== null) {
    const src = videoMatch[1];
    if (src) {
      const resolved = resolveRelativeUrl(decodeHtmlEntities(src), baseUrl);
      if (resolved) {
        videoUrls.push(resolved);
      }
    }
  }

  // 5. Extract <title> fallback if no caption found yet
  if (captions.length === 0) {
    const titleMatch = /<title\b[^>]*>([^<]+)<\/title>/i.exec(html);
    if (titleMatch?.[1]) {
      const cleanedTitle = decodeHtmlEntities(titleMatch[1]);
      if (cleanedTitle) {
        captions.push(cleanedTitle);
      }
    }
  }

  const primaryCaption = captions.find((c) => c.trim().length > 0)?.trim() ?? null;

  // Deduplicate video URLs (accounting for http vs https pairs of identical host+path)
  const uniqueVideos: string[] = [];
  const seenVideoKeys = new Set<string>();
  for (const vUrl of videoUrls) {
    const canonicalKey = vUrl.replace(/^http:\/\//i, 'https://');
    if (!seenVideoKeys.has(canonicalKey)) {
      seenVideoKeys.add(canonicalKey);
      uniqueVideos.push(vUrl);
    }
  }

  const uniqueImages: string[] = [];
  const seenImageKeys = new Set<string>();
  for (const imgUrl of imageUrls) {
    const canonicalKey = imgUrl.replace(/^http:\/\//i, 'https://');
    if (!seenImageKeys.has(canonicalKey)) {
      seenImageKeys.add(canonicalKey);
      uniqueImages.push(imgUrl);
    }
  }

  if (uniqueVideos.length > 0) {
    const defaultThumb = thumbnailUrls[0] ?? uniqueImages[0] ?? null;
    return {
      candidates: uniqueVideos.map((streamUrl, idx) => ({
        streamUrl,
        thumbnailUrl: idx === 0 ? defaultThumb : (thumbnailUrls[idx] ?? defaultThumb),
        caption: primaryCaption,
        mediaTypeHint: 'video',
      })),
    };
  }

  if (uniqueImages.length > 0) {
    return {
      candidates: uniqueImages.map((streamUrl) => ({
        streamUrl,
        thumbnailUrl: null,
        caption: primaryCaption,
        mediaTypeHint: 'image',
      })),
    };
  }

  return { candidates: [] };
}

function parseJsonPayloadCandidates(payload: unknown): RemoteMediaCandidate[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const data = payload as Record<string, unknown>;
  const topCaption =
    typeof data.caption === 'string'
      ? data.caption
      : typeof data.title === 'string'
        ? data.title
        : typeof data.description === 'string'
          ? data.description
          : null;
  const topThumb =
    typeof data.thumbnail === 'string'
      ? data.thumbnail
      : typeof data.thumbnailUrl === 'string'
        ? data.thumbnailUrl
        : typeof data.thumb === 'string'
          ? data.thumb
          : null;

  // Multi-item picker / carousel format (Cobalt / custom extractor)
  const arrayField = Array.isArray(data.picker)
    ? data.picker
    : Array.isArray(data.items)
      ? data.items
      : null;

  if (arrayField && arrayField.length > 0) {
    const candidates: RemoteMediaCandidate[] = [];
    for (const rawItem of arrayField) {
      if (!rawItem || typeof rawItem !== 'object') continue;
      const item = rawItem as Record<string, unknown>;
      const streamUrl =
        typeof item.url === 'string'
          ? item.url
          : typeof item.streamUrl === 'string'
            ? item.streamUrl
            : null;
      if (!streamUrl) continue;

      const itemType = typeof item.type === 'string' ? item.type.toLowerCase() : '';
      const mediaTypeHint: 'video' | 'image' | undefined =
        itemType === 'photo' || itemType === 'image'
          ? 'image'
          : itemType === 'video' || itemType === 'gif'
            ? 'video'
            : undefined;

      candidates.push({
        streamUrl,
        thumbnailUrl:
          typeof item.thumb === 'string'
            ? item.thumb
            : typeof item.thumbnailUrl === 'string'
              ? item.thumbnailUrl
              : typeof item.thumbnail === 'string'
                ? item.thumbnail
                : topThumb,
        caption:
          typeof item.caption === 'string'
            ? item.caption
            : typeof item.title === 'string'
              ? item.title
              : topCaption,
        fileName: typeof item.filename === 'string' ? item.filename : null,
        mediaTypeHint,
      });
    }
    if (candidates.length > 0) {
      return candidates;
    }
  }

  // FxTwitter / VxTwitter tweet object format
  if (data.tweet && typeof data.tweet === 'object') {
    const tweet = data.tweet as Record<string, unknown>;
    const tweetText = typeof tweet.text === 'string' ? tweet.text : topCaption;
    const mediaObj =
      tweet.media && typeof tweet.media === 'object'
        ? (tweet.media as Record<string, unknown>)
        : null;
    const mediaList = Array.isArray(mediaObj?.all)
      ? (mediaObj.all as unknown[])
      : [
          ...(Array.isArray(mediaObj?.videos) ? (mediaObj.videos as unknown[]) : []),
          ...(Array.isArray(mediaObj?.photos) ? (mediaObj.photos as unknown[]) : []),
        ];

    const tweetCandidates: RemoteMediaCandidate[] = [];
    for (const entry of mediaList) {
      if (!entry || typeof entry !== 'object') continue;
      const m = entry as Record<string, unknown>;
      if (typeof m.url !== 'string') continue;
      const mType = typeof m.type === 'string' ? m.type.toLowerCase() : '';
      tweetCandidates.push({
        streamUrl: m.url,
        thumbnailUrl: typeof m.thumbnail_url === 'string' ? m.thumbnail_url : null,
        caption: tweetText,
        mediaTypeHint: mType === 'photo' || mType === 'image' ? 'image' : 'video',
        durationSeconds: typeof m.duration === 'number' ? m.duration : null,
      });
    }
    if (tweetCandidates.length > 0) {
      return tweetCandidates;
    }
  }

  // Single stream object format
  const singleUrl =
    typeof data.url === 'string'
      ? data.url
      : typeof data.streamUrl === 'string'
        ? data.streamUrl
        : null;
  if (singleUrl) {
    return [
      {
        streamUrl: singleUrl,
        thumbnailUrl: topThumb,
        caption: topCaption,
        fileName: typeof data.filename === 'string' ? data.filename : null,
        durationSeconds: typeof data.duration === 'number' ? data.duration : null,
        aspectRatio: typeof data.aspectRatio === 'string' ? data.aspectRatio : null,
      },
    ];
  }

  return [];
}

async function readResponseBytesWithLimit(
  response: Response,
  maxBytes: number
): Promise<Uint8Array> {
  const contentLengthHeader = response.headers.get('content-length');
  if (contentLengthHeader) {
    const declaredSize = Number.parseInt(contentLengthHeader, 10);
    if (!Number.isNaN(declaredSize) && declaredSize > maxBytes) {
      throw new MediaDownloaderError(
        'FILE_TOO_LARGE',
        'This file exceeds the 500 MB maximum size limit.',
        400
      );
    }
  }

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

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new MediaDownloaderError(
          'FILE_TOO_LARGE',
          'This file exceeds the 500 MB maximum size limit.',
          400
        );
      }
      chunks.push(value);
    }
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
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
    if (response.url) {
      const redirectCheck = validateSafeRemoteUrl(response.url);
      if (!redirectCheck.valid) {
        return { thumbnailKey: null, thumbnailUrl: null };
      }
    }

    const rawMime = (response.headers.get('content-type') ?? '')
      .split(';')[0]
      ?.trim()
      .toLowerCase();
    const isWebp = rawMime === 'image/webp' || safeCheck.url.pathname.toLowerCase().endsWith('.webp');
    const isJpeg =
      rawMime === 'image/jpeg' ||
      rawMime === 'image/jpg' ||
      safeCheck.url.pathname.toLowerCase().endsWith('.jpg') ||
      safeCheck.url.pathname.toLowerCase().endsWith('.jpeg');

    if (!isWebp && !isJpeg) {
      return { thumbnailKey: null, thumbnailUrl: null };
    }

    const bytes = await readResponseBytesWithLimit(response, MAX_THUMBNAIL_BYTES);
    if (bytes.byteLength === 0) {
      return { thumbnailKey: null, thumbnailUrl: null };
    }

    const thumbMime = isWebp ? 'image/webp' : 'image/jpeg';
    const thumbExt = isWebp ? 'webp' : 'jpeg';
    const thumbnailKey = `users/${userId}/thumbnails/${mediaId}.${thumbExt}`;
    const uploaded = await storage.putObject({
      key: thumbnailKey,
      body: bytes,
      contentType: thumbMime,
    });

    return {
      thumbnailKey: uploaded.key,
      thumbnailUrl: uploaded.publicUrl,
    };
  } catch (_e) {
    return { thumbnailKey: null, thumbnailUrl: null };
  }
}

async function downloadAndStoreSingleCandidate(
  candidate: RemoteMediaCandidate,
  index: number,
  userId: string,
  storage: IStorageService,
  fetchFn: typeof fetch,
  prefetchedResponse?: Response
): Promise<UploadedDownloadedMediaItem> {
  const safeCheck = validateSafeRemoteUrl(candidate.streamUrl);
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

  let response: Response;
  if (prefetchedResponse) {
    response = prefetchedResponse;
  } else {
    try {
      response = await fetchFn(normalizedStreamUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FBUploadProMediaBot/1.0)',
          Accept: '*/*',
        },
        redirect: 'follow',
      });
    } catch (_e) {
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

  const dispositionName = extractFilenameFromContentDisposition(
    response.headers.get('content-disposition')
  );
  const rawFileName =
    candidate.fileName ??
    dispositionName ??
    deriveFileNameFromUrl(response.url || normalizedStreamUrl, index);

  const mimeType = resolveAllowedMimeType(
    response.headers.get('content-type'),
    response.url || normalizedStreamUrl,
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

  let thumbnailKey: string | null = null;
  let thumbnailUrl: string | null = null;

  if (mediaType === 'image') {
    thumbnailUrl = uploadRes.publicUrl;
  } else {
    const thumbResult = await tryUploadVideoThumbnail(
      candidate.thumbnailUrl,
      userId,
      mediaId,
      storage,
      fetchFn
    );
    thumbnailKey = thumbResult.thumbnailKey;
    thumbnailUrl = thumbResult.thumbnailUrl;
  }

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
    thumbnailKey,
    thumbnailUrl,
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
    const fxRes = await fetchFn(`https://api.fxtwitter.com/status/${statusMatch[1]}`, {
      headers: { Accept: 'application/json' },
    });
    if (!fxRes.ok) {
      return [];
    }
    const fxJson: unknown = await fxRes.json();
    return parseJsonPayloadCandidates(fxJson);
  } catch (_e) {
    return [];
  }
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
    params.extractorApiUrl !== undefined
      ? params.extractorApiUrl
      : (process.env.DOWNLOADER_EXTRACTOR_API_URL ?? null);

  let candidates: RemoteMediaCandidate[] = [];
  let prefetchedBinaryResponse: Response | undefined;

  // 1. Try pluggable external extractor API if configured
  if (configuredExtractorUrl && configuredExtractorUrl.trim().length > 0) {
    try {
      const extRes = await fetchFn(configuredExtractorUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ url: canonicalSourceUrl }),
      });
      if (extRes.ok) {
        const extJson: unknown = await extRes.json();
        candidates = parseJsonPayloadCandidates(extJson);
      }
    } catch (_e) {
      // Fall back to built-in serverless resolver if external extractor is unreachable
    }
  }

  // 2. Built-in serverless resolution when extractor did not yield candidates
  if (candidates.length === 0) {
    const normalizedUrl = normalizeCloudDriveUrl(sourceValidation.url);
    const normalizedSafe = validateSafeRemoteUrl(normalizedUrl);
    if (!normalizedSafe.valid) {
      throw new MediaDownloaderError(
        'UNSAFE_URL',
        normalizedSafe.reason ?? 'Unsafe destination URL.',
        400
      );
    }

    let initialResponse: Response;
    try {
      initialResponse = await fetchFn(normalizedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FBUploadProMediaBot/1.0)',
          Accept: '*/*',
        },
        redirect: 'follow',
      });
    } catch (_e) {
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
      if (platform === 'x') {
        candidates = await tryResolveFromFxTwitter(sourceValidation.url, fetchFn);
      }
      if (candidates.length === 0) {
        throw new MediaDownloaderError(
          'DOWNLOAD_FAILED',
          `Could not retrieve content from this link (status ${initialResponse.status}).`,
          502
        );
      }
    } else {
      const contentType = initialResponse.headers.get('content-type') ?? '';
      const lowerContentType = contentType.toLowerCase();
      const dispositionFileName = extractFilenameFromContentDisposition(
        initialResponse.headers.get('content-disposition')
      );
      const directMime = resolveAllowedMimeType(
        contentType,
        initialResponse.url || normalizedUrl,
        dispositionFileName
      );

      if (directMime) {
        prefetchedBinaryResponse = initialResponse;
        candidates = [
          {
            streamUrl: initialResponse.url || normalizedUrl,
            fileName: dispositionFileName,
          },
        ];
      } else if (
        lowerContentType.includes('application/json') ||
        lowerContentType.includes('text/json')
      ) {
        try {
          const jsonData: unknown = await initialResponse.json();
          candidates = parseJsonPayloadCandidates(jsonData);
        } catch (_e) {
          candidates = [];
        }
      } else {
        const htmlText = await initialResponse.text();
        const parsedHtml = parseHtmlMediaCandidates(htmlText, initialResponse.url || normalizedUrl);
        candidates = parsedHtml.candidates;

        if (candidates.length === 0 && platform === 'x') {
          candidates = await tryResolveFromFxTwitter(sourceValidation.url, fetchFn);
        }
      }
    }
  }

  if (candidates.length === 0) {
    throw new MediaDownloaderError(
      'UNSUPPORTED_MEDIA',
      'No downloadable video or image was found at this link.',
      400
    );
  }

  const uploadedItems: UploadedDownloadedMediaItem[] = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i]!;
    const item = await downloadAndStoreSingleCandidate(
      candidate,
      i,
      params.userId,
      params.storage,
      fetchFn,
      i === 0 ? prefetchedBinaryResponse : undefined
    );
    uploadedItems.push(item);
  }

  return {
    sourceUrl: canonicalSourceUrl,
    platform,
    items: uploadedItems,
  };
}
