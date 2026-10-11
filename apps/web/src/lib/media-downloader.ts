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

function normalizeTagEqualsSpacing(tag: string): string {
  return tag.replaceAll(/\s+/g, ' ').replaceAll(' = ', '=').replaceAll(' =', '=').replaceAll('= ', '=');
}

function parseMetaTagAttributes(tag: string): Record<string, string> {
  const normalized = normalizeTagEqualsSpacing(tag);
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z0-9_:-]+)=(?:"([^"]*)"|'([^']*)')/g;
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrRegex.exec(normalized)) !== null) {
    const attrName = attrMatch[1]?.toLowerCase();
    const attrVal = attrMatch[2] ?? attrMatch[3] ?? '';
    if (attrName) {
      attrs[attrName] = attrVal;
    }
  }
  return attrs;
}

function extractMetaValues(html: string, keys: string[]): string[] {
  const results: string[] = [];
  const metaTagRegex = /<meta\b[^>]*>/gi;
  const keySet = new Set(keys.map((k) => k.toLowerCase()));

  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = metaTagRegex.exec(html)) !== null) {
    const attrs = parseMetaTagAttributes(tagMatch[0]);
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
  } catch {
    return null;
  }
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const val of values) {
    if (typeof val === 'string' && val.trim().length > 0) {
      return val;
    }
  }
  return null;
}

interface ParsedHtmlMedia {
  candidates: RemoteMediaCandidate[];
}

interface HtmlMediaAccumulator {
  videoUrls: string[];
  imageUrls: string[];
  thumbnailUrls: string[];
  captions: string[];
}

function appendResolvedUrl(target: string[], rawUrl: string | null, baseUrl: string): void {
  if (!rawUrl) {
    return;
  }
  const resolved = resolveRelativeUrl(rawUrl, baseUrl);
  if (resolved) {
    target.push(resolved);
  }
}

function extractJsonLdCaption(record: Record<string, unknown>, captions: string[]): void {
  const rawText = firstNonEmptyString(record.description, record.name, record.headline);
  if (rawText) {
    captions.push(decodeHtmlEntities(rawText));
  }
}

function extractJsonLdThumbnails(
  record: Record<string, unknown>,
  baseUrl: string,
  thumbnails: string[]
): void {
  if (typeof record.thumbnailUrl === 'string') {
    appendResolvedUrl(thumbnails, record.thumbnailUrl, baseUrl);
    return;
  }
  if (Array.isArray(record.thumbnailUrl)) {
    for (const item of record.thumbnailUrl) {
      if (typeof item === 'string') {
        appendResolvedUrl(thumbnails, item, baseUrl);
      }
    }
  }
}

function extractJsonLdMediaStream(
  record: Record<string, unknown>,
  baseUrl: string,
  acc: HtmlMediaAccumulator
): void {
  const typeVal = typeof record['@type'] === 'string' ? record['@type'].toLowerCase() : '';
  const streamCandidate = firstNonEmptyString(record.contentUrl, record.url);
  if (typeVal.includes('video')) {
    appendResolvedUrl(acc.videoUrls, streamCandidate, baseUrl);
  } else if (typeVal.includes('image')) {
    appendResolvedUrl(acc.imageUrls, streamCandidate, baseUrl);
  }
}

const JSON_LD_NESTED_KEYS = [
  '@graph',
  'video',
  'image',
  'hasPart',
  'sharedContent',
  'associatedMedia',
] as const;

function parseJsonLdNodes(node: unknown, baseUrl: string, acc: HtmlMediaAccumulator): void {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      parseJsonLdNodes(item, baseUrl, acc);
    }
    return;
  }

  const record = node as Record<string, unknown>;
  extractJsonLdCaption(record, acc.captions);
  extractJsonLdThumbnails(record, baseUrl, acc.thumbnailUrls);
  extractJsonLdMediaStream(record, baseUrl, acc);

  for (const nestedKey of JSON_LD_NESTED_KEYS) {
    if (record[nestedKey]) {
      parseJsonLdNodes(record[nestedKey], baseUrl, acc);
    }
  }
}

function extractJsonLdBlocksFromHtml(
  html: string,
  baseUrl: string,
  acc: HtmlMediaAccumulator
): void {
  const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = jsonLdRegex.exec(html)) !== null) {
    const rawJson = scriptMatch[1]?.trim();
    if (!rawJson) {
      continue;
    }
    try {
      const parsedJson: unknown = JSON.parse(rawJson);
      parseJsonLdNodes(parsedJson, baseUrl, acc);
    } catch {
      // Ignore malformed JSON-LD script blocks in third-party pages
    }
  }
}

function extractHtmlVideoTags(html: string, baseUrl: string, videoUrls: string[]): void {
  const videoSrcRegex = /<(?:video|source)\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let videoMatch: RegExpExecArray | null;
  while ((videoMatch = videoSrcRegex.exec(html)) !== null) {
    const src = videoMatch[1];
    if (src) {
      appendResolvedUrl(videoUrls, decodeHtmlEntities(src), baseUrl);
    }
  }
}

function deduplicateUrlsByHttpsKey(urls: string[]): string[] {
  const unique: string[] = [];
  const seenKeys = new Set<string>();
  for (const rawUrl of urls) {
    const canonicalKey = rawUrl.replace(/^http:\/\//i, 'https://');
    if (!seenKeys.has(canonicalKey)) {
      seenKeys.add(canonicalKey);
      unique.push(rawUrl);
    }
  }
  return unique;
}

function extractTitleTagFallback(html: string): string | null {
  const titleMatch = /<title\b[^>]*>([^<]+)<\/title>/i.exec(html);
  if (!titleMatch?.[1]) {
    return null;
  }
  const cleanedTitle = decodeHtmlEntities(titleMatch[1]);
  return cleanedTitle.length > 0 ? cleanedTitle : null;
}

function parseHtmlMediaCandidates(html: string, baseUrl: string): ParsedHtmlMedia {
  const acc: HtmlMediaAccumulator = {
    videoUrls: [],
    imageUrls: [],
    thumbnailUrls: [],
    captions: [],
  };

  const metaDescriptions = extractMetaValues(html, [
    'og:description',
    'twitter:description',
    'description',
  ]);
  const metaTitles = extractMetaValues(html, ['og:title', 'twitter:title']);
  acc.captions.push(...metaDescriptions, ...metaTitles);

  const ogVideos = extractMetaValues(html, [
    'og:video:secure_url',
    'og:video:url',
    'og:video',
    'twitter:player:stream',
  ]);
  for (const v of ogVideos) {
    appendResolvedUrl(acc.videoUrls, v, baseUrl);
  }

  const ogImages = extractMetaValues(html, [
    'og:image:secure_url',
    'og:image:url',
    'og:image',
    'twitter:image',
    'twitter:image:src',
  ]);
  for (const img of ogImages) {
    appendResolvedUrl(acc.imageUrls, img, baseUrl);
  }

  extractJsonLdBlocksFromHtml(html, baseUrl, acc);
  extractHtmlVideoTags(html, baseUrl, acc.videoUrls);

  if (acc.captions.length === 0) {
    const fallbackTitle = extractTitleTagFallback(html);
    if (fallbackTitle) {
      acc.captions.push(fallbackTitle);
    }
  }

  const primaryCaption = acc.captions.find((c) => c.trim().length > 0)?.trim() ?? null;
  const uniqueVideos = deduplicateUrlsByHttpsKey(acc.videoUrls);
  const uniqueImages = deduplicateUrlsByHttpsKey(acc.imageUrls);

  if (uniqueVideos.length > 0) {
    const defaultThumb = acc.thumbnailUrls[0] ?? uniqueImages[0] ?? null;
    return {
      candidates: uniqueVideos.map((streamUrl, idx) => ({
        streamUrl,
        thumbnailUrl: acc.thumbnailUrls[idx] ?? defaultThumb,
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

function classifyMediaTypeHint(rawType: unknown): 'video' | 'image' | undefined {
  if (typeof rawType !== 'string') {
    return undefined;
  }
  const lower = rawType.toLowerCase();
  if (lower === 'photo' || lower === 'image') {
    return 'image';
  }
  if (lower === 'video' || lower === 'gif') {
    return 'video';
  }
  return undefined;
}

function parsePickerArrayItem(
  rawItem: unknown,
  topThumb: string | null,
  topCaption: string | null
): RemoteMediaCandidate | null {
  if (!rawItem || typeof rawItem !== 'object') {
    return null;
  }
  const item = rawItem as Record<string, unknown>;
  const streamUrl = firstNonEmptyString(item.url, item.streamUrl);
  if (!streamUrl) {
    return null;
  }

  return {
    streamUrl,
    thumbnailUrl: firstNonEmptyString(item.thumb, item.thumbnailUrl, item.thumbnail) ?? topThumb,
    caption: firstNonEmptyString(item.caption, item.title) ?? topCaption,
    fileName: firstNonEmptyString(item.filename),
    mediaTypeHint: classifyMediaTypeHint(item.type),
  };
}

function extractTweetMediaList(mediaObj: Record<string, unknown> | null): unknown[] {
  if (!mediaObj) {
    return [];
  }
  if (Array.isArray(mediaObj.all)) {
    return mediaObj.all as unknown[];
  }
  const videos = Array.isArray(mediaObj.videos) ? (mediaObj.videos as unknown[]) : [];
  const photos = Array.isArray(mediaObj.photos) ? (mediaObj.photos as unknown[]) : [];
  return [...videos, ...photos];
}

function parseTweetCandidatesFromObject(
  tweet: Record<string, unknown>,
  topCaption: string | null
): RemoteMediaCandidate[] {
  const tweetText = firstNonEmptyString(tweet.text) ?? topCaption;
  const mediaObj =
    tweet.media && typeof tweet.media === 'object'
      ? (tweet.media as Record<string, unknown>)
      : null;
  const mediaList = extractTweetMediaList(mediaObj);

  const tweetCandidates: RemoteMediaCandidate[] = [];
  for (const entry of mediaList) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const m = entry as Record<string, unknown>;
    const streamUrl = firstNonEmptyString(m.url);
    if (!streamUrl) {
      continue;
    }
    const hint = classifyMediaTypeHint(m.type) ?? 'video';
    tweetCandidates.push({
      streamUrl,
      thumbnailUrl: firstNonEmptyString(m.thumbnail_url),
      caption: tweetText,
      mediaTypeHint: hint,
      durationSeconds: typeof m.duration === 'number' ? m.duration : null,
    });
  }
  return tweetCandidates;
}

function parseJsonPayloadCandidates(payload: unknown): RemoteMediaCandidate[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const data = payload as Record<string, unknown>;
  const topCaption = firstNonEmptyString(data.caption, data.title, data.description);
  const topThumb = firstNonEmptyString(data.thumbnail, data.thumbnailUrl, data.thumb);

  let arrayField: unknown[] | null = null;
  if (Array.isArray(data.picker)) {
    arrayField = data.picker;
  } else if (Array.isArray(data.items)) {
    arrayField = data.items;
  }

  if (arrayField && arrayField.length > 0) {
    const candidates = arrayField
      .map((rawItem) => parsePickerArrayItem(rawItem, topThumb, topCaption))
      .filter((item): item is RemoteMediaCandidate => item !== null);
    if (candidates.length > 0) {
      return candidates;
    }
  }

  if (data.tweet && typeof data.tweet === 'object') {
    const tweetCandidates = parseTweetCandidatesFromObject(
      data.tweet as Record<string, unknown>,
      topCaption
    );
    if (tweetCandidates.length > 0) {
      return tweetCandidates;
    }
  }

  const singleUrl = firstNonEmptyString(data.url, data.streamUrl);
  if (singleUrl) {
    return [
      {
        streamUrl: singleUrl,
        thumbnailUrl: topThumb,
        caption: topCaption,
        fileName: firstNonEmptyString(data.filename),
        durationSeconds: typeof data.duration === 'number' ? data.duration : null,
        aspectRatio: firstNonEmptyString(data.aspectRatio),
      },
    ];
  }

  return [];
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
      response = await fetchFn(normalizedStreamUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FBUploadProMediaBot/1.0)',
          Accept: '*/*',
        },
        redirect: 'follow',
      });
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
    const fxRes = await fetchFn(`https://api.fxtwitter.com/status/${statusMatch[1]}`, {
      headers: { Accept: 'application/json' },
    });
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
    const extRes = await fetchFn(configuredExtractorUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ url: canonicalSourceUrl }),
    });
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
    initialResponse = await fetchFn(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FBUploadProMediaBot/1.0)',
        Accept: '*/*',
      },
      redirect: 'follow',
    });
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

  const uploadedItems = await Promise.all(
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

  return {
    sourceUrl: canonicalSourceUrl,
    platform,
    items: uploadedItems,
  };
}

