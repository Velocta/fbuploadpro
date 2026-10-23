/**
 * Client-side PostHog singleton (error tracking only).
 *
 * The API key is passed in from the server layout as a prop — never read
 * from process.env here, since only NEXT_PUBLIC_ vars are exposed to the
 * browser and we intentionally use plain POSTHOG_KEY/POSTHOG_HOST.
 *
 * Pageviews and session recording are OFF; this is exception tracking only.
 *
 * Loading (spec 137 §3.6.1 / PR-A4): `posthog-js` is loaded with a
 * dynamic import inside initPostHog, so it is NOT in the root critical
 * path — the chunk loads after first paint, when the provider's effect
 * runs. Loading mechanics only: the key/host wiring is spec 118's, and
 * the `reportError` seam (lib/report-error.ts) is untouched — this
 * module never was its transport (the seam's transport is installed
 * via setReportErrorTransport, independently of this loader).
 */

let initialized = false;
let loadStarted = false;

export const POSTHOG_DEFAULT_HOST = 'https://us.i.posthog.com';

/**
 * Initialize PostHog in the browser. Safe to call multiple times;
 * subsequent calls are no-ops. No-op entirely when no API key is provided.
 * The dynamic import is fire-and-forget: a failed chunk load leaves
 * error tracking off for the session rather than breaking the page —
 * the failure is logged, never silently swallowed.
 */
export function initPostHog(apiKey: string | undefined | null, host?: string | undefined | null): void {
  if (initialized || loadStarted) return;
  if (!apiKey) return;
  if (typeof window === 'undefined') return;
  loadStarted = true;

  void import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(apiKey, {
        api_host: host || POSTHOG_DEFAULT_HOST,
        // Error tracking only — no analytics noise.
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
      });
      initialized = true;
    })
    .catch((error: unknown) => {
      loadStarted = false;
      console.error('[posthog] failed to load posthog-js', error);
    });
}
