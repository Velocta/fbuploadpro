import { z } from 'zod';
import { MediaItemResponseSchema } from './media.js';

export const MAX_MEDIA_DOWNLOAD_BYTES = 524_288_000; // 500 MB

export const DownloaderSourcePlatformValues = [
  'tiktok',
  'facebook',
  'instagram',
  'x',
  'youtube',
  'google_drive',
  'dropbox',
  'direct',
  'web',
] as const;

export const DownloaderSourcePlatformSchema = z.enum(DownloaderSourcePlatformValues);

export type DownloaderSourcePlatform = z.infer<typeof DownloaderSourcePlatformSchema>;

const DIRECT_MEDIA_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.webm',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function detectSourcePlatform(rawUrl: string): DownloaderSourcePlatform {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (_e) {
    return 'web';
  }

  const host = parsed.hostname.toLowerCase();

  if (matchesDomain(host, 'tiktok.com') || matchesDomain(host, 'tiktokv.com')) {
    return 'tiktok';
  }
  if (
    matchesDomain(host, 'facebook.com') ||
    matchesDomain(host, 'fb.watch') ||
    matchesDomain(host, 'fb.com') ||
    matchesDomain(host, 'fbcdn.net')
  ) {
    return 'facebook';
  }
  if (
    matchesDomain(host, 'instagram.com') ||
    matchesDomain(host, 'instagr.am') ||
    matchesDomain(host, 'cdninstagram.com')
  ) {
    return 'instagram';
  }
  if (
    matchesDomain(host, 'x.com') ||
    matchesDomain(host, 'twitter.com') ||
    matchesDomain(host, 't.co') ||
    matchesDomain(host, 'fxtwitter.com') ||
    matchesDomain(host, 'vxtwitter.com') ||
    matchesDomain(host, 'twimg.com')
  ) {
    return 'x';
  }
  if (matchesDomain(host, 'youtube.com') || matchesDomain(host, 'youtu.be')) {
    return 'youtube';
  }
  if (
    host === 'drive.google.com' ||
    host === 'docs.google.com' ||
    matchesDomain(host, 'googleusercontent.com') ||
    host === 'drive.usercontent.google.com'
  ) {
    return 'google_drive';
  }
  if (matchesDomain(host, 'dropbox.com') || matchesDomain(host, 'dropboxusercontent.com')) {
    return 'dropbox';
  }

  const pathname = parsed.pathname.toLowerCase();
  const lastDot = pathname.lastIndexOf('.');
  if (lastDot !== -1) {
    const ext = pathname.slice(lastDot);
    if (DIRECT_MEDIA_EXTENSIONS.has(ext)) {
      return 'direct';
    }
  }

  return 'web';
}

function isDocumentationOrBenchmarkIpv4(a: number, b: number, c: number): boolean {
  if (a === 192 && b === 0) {
    return c === 0 || c === 2;
  }
  if (a === 198) {
    return b === 18 || b === 19 || (b === 51 && c === 100);
  }
  return a === 203 && b === 0 && c === 113;
}

function isPrivateOrReservedIpv4(a: number, b: number, c: number, _d: number): boolean {
  if (a === 0 || a === 10 || a === 127 || a >= 224) {
    return true;
  }
  if (a === 100) {
    return b >= 64 && b <= 127;
  }
  if (a === 169) {
    return b === 254;
  }
  if (a === 172) {
    return b >= 16 && b <= 31;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  return isDocumentationOrBenchmarkIpv4(a, b, c);
}

function isUnsafeIpv6(rawIpv6: string): boolean {
  const normalized = rawIpv6.toLowerCase();
  if (
    normalized === '::1' ||
    normalized === '::' ||
    normalized === '0:0:0:0:0:0:0:1' ||
    normalized === '0:0:0:0:0:0:0:0'
  ) {
    return true;
  }

  // Unique local (fc00::/7 -> fc.. or fd..)
  if (/^f[cd][0-9a-f]{0,2}:/.test(normalized)) {
    return true;
  }

  // Link-local (fe80::/10 -> fe8., fe9., fea., feb.)
  if (/^fe[89ab][0-9a-f]?:/.test(normalized)) {
    return true;
  }

  // Multicast (ff00::/8)
  if (normalized.startsWith('ff')) {
    return true;
  }

  // IPv4-mapped or IPv4-compatible IPv6 addresses (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  const v4MappedPrefix = '::ffff:';
  if (normalized.startsWith(v4MappedPrefix)) {
    const tail = normalized.slice(v4MappedPrefix.length);
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(tail)) {
      const parts = tail.split('.').map((part) => Number.parseInt(part, 10));
      if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
        return true;
      }
      return isPrivateOrReservedIpv4(parts[0]!, parts[1]!, parts[2]!, parts[3]!);
    }

    const hexParts = tail.split(':');
    if (hexParts.length === 2) {
      const high = Number.parseInt(hexParts[0]!, 16);
      const low = Number.parseInt(hexParts[1]!, 16);
      if (Number.isNaN(high) || Number.isNaN(low)) {
        return true;
      }
      const a = (high >> 8) & 0xff;
      const b = high & 0xff;
      const c = (low >> 8) & 0xff;
      const d = low & 0xff;
      return isPrivateOrReservedIpv4(a, b, c, d);
    }
    return true;
  }

  return false;
}

export interface SafeUrlValidationResult {
  valid: boolean;
  url?: URL;
  reason?: string;
}

function stripTrailingDots(value: string): string {
  let end = value.length;
  while (end > 0 && value.codePointAt(end - 1) === 46) {
    end -= 1;
  }
  return value.slice(0, end);
}

function isLocalHostname(rawHost: string): boolean {
  return (
    rawHost === 'localhost' ||
    rawHost.endsWith('.localhost') ||
    rawHost.endsWith('.local') ||
    rawHost.endsWith('.internal')
  );
}

function validateIpv4Host(rawHost: string): string | null {
  const octets = rawHost.split('.').map((part) => Number.parseInt(part, 10));
  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return 'Invalid IPv4 address in link.';
  }
  if (isPrivateOrReservedIpv4(octets[0]!, octets[1]!, octets[2]!, octets[3]!)) {
    return 'Private and loopback network addresses are not allowed.';
  }
  return null;
}

function validateParsedHostSafety(rawHost: string): string | null {
  if (!rawHost || isLocalHostname(rawHost)) {
    return rawHost
      ? 'Local and internal network addresses are not allowed.'
      : 'Please enter a valid link with a public domain.';
  }

  if (rawHost.startsWith('[') && rawHost.endsWith(']')) {
    const ipv6Inner = rawHost.slice(1, -1);
    return isUnsafeIpv6(ipv6Inner)
      ? 'Private and loopback network addresses are not allowed.'
      : null;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(rawHost)) {
    return validateIpv4Host(rawHost);
  }

  if (!rawHost.includes('.')) {
    return 'Please enter a valid link with a public domain.';
  }

  return null;
}

export function validateSafeRemoteUrl(rawUrl: string): SafeUrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) {
    return {
      valid: false,
      reason: 'Please enter a valid link starting with http:// or https://.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      reason: 'Please enter a valid link starting with http:// or https://.',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      reason: 'Only http:// and https:// links are supported.',
    };
  }

  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return {
      valid: false,
      reason: 'Links containing embedded credentials are not allowed.',
    };
  }

  const rawHost = stripTrailingDots(parsed.hostname.toLowerCase());
  const hostError = validateParsedHostSafety(rawHost);
  if (hostError) {
    return {
      valid: false,
      reason: hostError,
    };
  }

  return { valid: true, url: parsed };
}

export interface BatchUrlDeduplicationResult {
  urls: string[];
  duplicateCount: number;
  invalidUrls: string[];
  invalidLines: string[];
}

export function deduplicateBatchUrls(rawInput: string): BatchUrlDeduplicationResult {
  const lines = rawInput.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  const seen = new Set<string>();
  const urls: string[] = [];
  const invalidUrls: string[] = [];
  let duplicateCount = 0;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }

    const validation = validateSafeRemoteUrl(trimmed);
    if (!validation.valid || !validation.url) {
      invalidUrls.push(trimmed);
      continue;
    }

    const normalized = validation.url.toString();
    if (seen.has(normalized)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(normalized);
    urls.push(normalized);
  }

  return {
    urls,
    duplicateCount,
    invalidUrls,
    invalidLines: invalidUrls,
  };
}

export const DownloaderIngestRequestSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Please enter a valid link starting with http:// or https://.')
    .max(2048, 'Link must be 2048 characters or fewer.'),
  folderId: z.string().uuid().nullable().optional(),
});

export type DownloaderIngestRequest = z.infer<typeof DownloaderIngestRequestSchema>;

export const DownloaderIngestResponseSchema = z.object({
  sourceUrl: z.string().url(),
  platform: DownloaderSourcePlatformSchema,
  items: z.array(MediaItemResponseSchema).min(1),
});

export type DownloaderIngestResponse = z.infer<typeof DownloaderIngestResponseSchema>;
