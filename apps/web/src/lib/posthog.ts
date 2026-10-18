/**
 * Client-side PostHog singleton (error tracking only).
 *
 * The API key is passed in from the server layout as a prop — never read
 * from process.env here, since only NEXT_PUBLIC_ vars are exposed to the
 * browser and we intentionally use plain POSTHOG_KEY/POSTHOG_HOST.
 *
 * Pageviews and session recording are OFF; this is exception tracking only.
 */
import posthog from 'posthog-js';

let initialized = false;

export const POSTHOG_DEFAULT_HOST = 'https://us.i.posthog.com';

/**
 * Initialize PostHog in the browser. Safe to call multiple times;
 * subsequent calls are no-ops. No-op entirely when no API key is provided.
 */
export function initPostHog(apiKey: string | undefined | null, host?: string | undefined | null): void {
  if (initialized) return;
  if (!apiKey) return;
  if (typeof window === 'undefined') return;

  posthog.init(apiKey, {
    api_host: host || POSTHOG_DEFAULT_HOST,
    // Error tracking only — no analytics noise.
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
  });
  initialized = true;
}

/** Capture an exception client-side. No-op if PostHog isn't initialized. */
export function captureClientException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!initialized) return;
  try {
    posthog.capture('$exception', {
      $exception_message: error instanceof Error ? error.message : String(error),
      $exception_stack: error instanceof Error ? error.stack : undefined,
      ...context,
    });
  } catch {
    // Never let telemetry break the app.
  }
}

/** Associate subsequent events with a user. No-op if PostHog isn't initialized. */
export function identifyPostHogUser(
  userId: string,
  traits?: Record<string, unknown>
): void {
  if (!initialized) return;
  try {
    posthog.identify(userId, traits);
  } catch {
    // Never let telemetry break the app.
  }
}
