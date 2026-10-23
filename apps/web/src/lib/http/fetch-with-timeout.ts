/**
 * Shared timeout helper for server-side external fetches (spec 139, A4).
 *
 * Every bare external `fetch` in `apps/web/src` must go through this module
 * so a hung upstream can never hang a route indefinitely. Callers keep
 * their existing behaviour otherwise: non-2xx responses are returned (not
 * thrown), exactly as with plain `fetch`, and a caller-supplied
 * `init.signal` is composed with the timeout — aborting the caller's
 * signal still aborts the request.
 */

/** Budget for Facebook Graph API calls, including OAuth token exchanges. */
export const GRAPH_API_TIMEOUT_MS = 30_000;

/** Budget for remote-media / download fetches (time-to-headers, see below). */
export const MEDIA_FETCH_TIMEOUT_MS = 15_000;

/** Default budget when a call site does not pass an explicit timeout. */
export const DEFAULT_FETCH_TIMEOUT_MS = GRAPH_API_TIMEOUT_MS;

type FetchFn = typeof fetch;

/**
 * Compose a caller signal (if any) with a timeout signal.
 * Uses `AbortSignal.any` where available; the timeout signal alone still
 * bounds the request on runtimes without it.
 */
export function composeTimeoutSignal(
  callerSignal: AbortSignal | null | undefined,
  timeoutMs: number
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!callerSignal) {
    return timeoutSignal;
  }
  return typeof AbortSignal.any === 'function'
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : timeoutSignal;
}

/**
 * `fetch` with an explicit timeout, via `AbortSignal.timeout` composed
 * with the caller's signal. The timeout covers the whole exchange
 * (connection, headers and body) — use it for small, bounded payloads
 * such as Graph API JSON responses.
 *
 * An optional `fetchFn` may be supplied by call sites that already accept
 * an injectable fetch (tests); it defaults to the global `fetch`.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
  fetchFn: FetchFn = globalThis.fetch
): Promise<Response> {
  return fetchFn(input, {
    ...init,
    signal: composeTimeoutSignal(init?.signal, timeoutMs),
  });
}

/**
 * Time-to-headers variant for streaming downloads.
 *
 * A plain `AbortSignal.timeout` signal stays attached to the response, so
 * it would abort the body mid-stream once the budget expires — breaking
 * large media downloads that legitimately take longer than the budget to
 * transfer. This variant therefore uses its own controller: the timer is
 * cleared as soon as `fetch` resolves (headers received), so the timeout
 * bounds only the time to first response, and the returned body may then
 * stream for as long as it needs. A caller-supplied signal is forwarded
 * to the controller at any time, so caller aborts still cancel the body.
 */
export async function fetchWithTimeoutToHeaders(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = MEDIA_FETCH_TIMEOUT_MS,
  fetchFn: FetchFn = globalThis.fetch
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort(callerSignal.reason);
    } else if (typeof callerSignal.addEventListener === 'function') {
      callerSignal.addEventListener(
        'abort',
        () => controller.abort(callerSignal.reason),
        { once: true }
      );
    }
  }
  const timer = setTimeout(() => {
    controller.abort(
      new Error(`Fetch timed out after ${timeoutMs}ms waiting for response headers`)
    );
  }, timeoutMs);
  try {
    return await fetchFn(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
