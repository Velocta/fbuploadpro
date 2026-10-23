import {
  normalizeCloudDriveUrl,
  parseHtmlMediaCandidates,
  parseJsonPayloadCandidates,
  resolveGoogleDriveDirectUrl,
  validateSafeRemoteUrl,
  type DownloaderSourcePlatform,
  type RemoteMediaCandidate,
} from '@fbuploadpro/contracts';
import {
  extractFilenameFromContentDisposition,
  resolveAllowedMimeType,
} from './mime';
import { tryResolveFromFxTwitter } from './extractors';
import {
  MEDIA_FETCH_TIMEOUT_MS,
  fetchWithTimeoutToHeaders,
} from '@/lib/http/fetch-with-timeout';

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

export function validateAndNormalizeStreamUrl(rawStreamUrl: string): string {
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

export async function fetchCandidateResponse(
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

export async function resolveCandidatesBuiltIn(
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
