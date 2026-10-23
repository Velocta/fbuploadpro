import {
  parseJsonPayloadCandidates,
  type RemoteMediaCandidate,
} from '@fbuploadpro/contracts';
import {
  MEDIA_FETCH_TIMEOUT_MS,
  fetchWithTimeout,
} from '@/lib/http/fetch-with-timeout';

export async function tryResolveFromFxTwitter(
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

export async function tryResolveViaExternalExtractor(
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
