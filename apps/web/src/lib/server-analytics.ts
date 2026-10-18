/**
 * Server-side analytics (Next.js route handlers / server components).
 *
 * Uses posthog-node. Reads POSTHOG_KEY / POSTHOG_HOST from process.env
 * (server-only — never exposed to the browser). All helpers are safe no-ops
 * when the key is not configured, so the app runs fine without PostHog.
 */
import { PostHog } from 'posthog-node';

const POSTHOG_KEY = process.env.POSTHOG_KEY;
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!POSTHOG_KEY) return null;
  if (!client) {
    client = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      // Flush immediately: serverless functions may not survive to a timer.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

function toErrorInfo(error: unknown): { message: string; stack?: string | undefined } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

/**
 * Capture an exception server-side. Flushes immediately so serverless
 * invocations don't lose the event.
 */
export async function captureServerException(
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const ph = getClient();
  if (!ph) return;
  const info = toErrorInfo(error);
  try {
    ph.capture({
      distinctId: 'server',
      event: '$exception',
      properties: {
        $exception_message: info.message,
        $exception_stack: info.stack,
        ...context,
      },
    });
    await ph.flush();
  } catch {
    // Never let telemetry break the request.
  }
}

/**
 * Drop-in replacement for console.error at high-value error sites:
 * keeps the console log AND sends a structured event to PostHog.
 * Fire-and-forget — never throws, never blocks the caller on failure.
 */
export function logServerError(
  message: string,
  error?: unknown,
  context?: Record<string, unknown>
): void {
  console.error(message, error ?? '');
  const info = error !== undefined ? toErrorInfo(error) : { message };
  void captureServerException(info, { log_message: message, ...context });
}
