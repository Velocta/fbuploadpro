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

function toErrorInfo(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
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
  const apiKey = env.POSTHOG_KEY;
  if (!apiKey) return;

  const host = (env.POSTHOG_HOST || DEFAULT_HOST).replace(/\/$/, '');
  const info = toErrorInfo(error);

  const payload = {
    api_key: apiKey,
    event: '$exception',
    distinct_id: 'worker',
    properties: {
      $exception_message: info.message,
      $exception_stack: info.stack,
      ...context,
    },
  };

  const send = fetch(`${host}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
