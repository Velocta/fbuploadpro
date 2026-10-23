/**
 * Next.js instrumentation — runs once when a server instance boots
 * (spec 139). Two boot duties, Node.js runtime only:
 *
 * 1. Environment validation (lib/env.ts): in production a missing
 *    required variable fails the boot fast with a clear error naming
 *    the missing variables; elsewhere it warns and continues.
 *
 * 2. PostHog error-transport wiring (spec 137 §3.1 + spec 118): the
 *    `reportError` seam's transport was never installed server-side, so
 *    server errors reported through the seam only reached the console.
 *    Here the transport is installed to forward through
 *    lib/server-analytics.ts `captureServerException` (posthog-node;
 *    flushes immediately, safe no-op when POSTHOG_KEY is unset), while
 *    keeping the console log the default transport provided.
 *
 * Everything is loaded with dynamic imports inside the NEXT_RUNTIME
 * guard so the Edge runtime bundle never pulls in posthog-node or the
 * validator.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { validateEnv } = await import('./lib/env');
  validateEnv();

  const { setReportErrorTransport } = await import('./lib/report-error');
  const { captureServerException } = await import('./lib/server-analytics');
  setReportErrorTransport((error, context) => {
    console.error('[reportError]', context?.source ?? 'unknown', error, context);
    void captureServerException(error, { ...context });
  });
}
