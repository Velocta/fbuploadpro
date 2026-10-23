/**
 * PostHog analytics for the Cloudflare Worker.
 *
 * posthog-js and posthog-node do not run in the Workers runtime, so we use
 * the PostHog HTTP capture API directly via fetch. Reads POSTHOG_KEY /
 * POSTHOG_HOST from the worker Env. All helpers are safe no-ops when the
 * key is not configured.
 */

export interface PostHogEnv {
  POSTHOG_KEY?: string;
  POSTHOG_HOST?: string;
}

const DEFAULT_HOST = 'https://us.i.posthog.com';

/**
 * Capture is fire-and-forget telemetry: it must never hang the worker.
 * A short timeout bounds the fetch even when no waitUntil is available.
 */
export const POSTHOG_CAPTURE_TIMEOUT_MS = 5_000;

function toErrorInfo(error: unknown): { message: string; stack?: string | undefined } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

/**
 * Shared capture transport for exceptions and named events. Fire-and-
 * forget: safe no-op when the key is not configured, bounded by the
 * capture timeout, and telemetry failures are always swallowed.
 */
function sendCapture(
  env: PostHogEnv,
  event: string,
  properties: Record<string, unknown>,
  waitUntil?: (promise: Promise<unknown>) => void
): void {
  const apiKey = env.POSTHOG_KEY;
  if (!apiKey) return;

  const host = (env.POSTHOG_HOST || DEFAULT_HOST).replace(/\/$/, '');

  const payload = {
    api_key: apiKey,
    event,
    distinct_id: 'worker',
    properties,
  };

  const send = fetch(`${host}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(POSTHOG_CAPTURE_TIMEOUT_MS),
  }).catch(() => {
    // Never let telemetry break the worker.
  });

  if (waitUntil) {
    try {
      waitUntil(send);
    } catch {
      // ctx may be unavailable in some test harnesses.
    }
  }
}

/**
 * Capture an exception from the worker. Pass ctx.waitUntil (when available)
 * so the capture doesn't block the response and isn't cut off.
 */
export function captureWorkerError(
  env: PostHogEnv,
  error: unknown,
  context?: Record<string, unknown>,
  waitUntil?: (promise: Promise<unknown>) => void
): void {
  if (!env.POSTHOG_KEY) return;
  const info = toErrorInfo(error);
  sendCapture(
    env,
    '$exception',
    {
      $exception_message: info.message,
      $exception_stack: info.stack,
      ...context,
    },
    waitUntil
  );
}

/**
 * Capture a named operational event from the worker — a condition that
 * is not an exception but must be visible in the same place operators
 * already watch (e.g. the token-refresh backlog signal, spec 139
 * residue). Same transport, no-op, and timeout behaviour as
 * captureWorkerError.
 */
export function captureWorkerEvent(
  env: PostHogEnv,
  event: string,
  properties?: Record<string, unknown>,
  waitUntil?: (promise: Promise<unknown>) => void
): void {
  sendCapture(env, event, { ...properties }, waitUntil);
}
