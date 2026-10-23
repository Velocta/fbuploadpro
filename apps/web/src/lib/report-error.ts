/**
 * reportError — the single reporting entry point (spec 137 §3.1).
 *
 * Route boundaries (§3.3), the API client's global session-expired
 * handler, and any other infrastructure report through this seam and
 * nowhere else. The transport behind the seam is replaceable: today it
 * logs to the console; when spec 118 (PostHog production wiring) lands,
 * it plugs in here via `setReportErrorTransport` and no caller changes.
 */

export interface ReportErrorContext {
  /** Where the error surfaced, e.g. `api-client`, `error-boundary`. */
  source?: string;
  [key: string]: unknown;
}

export type ReportErrorTransport = (
  error: unknown,
  context: ReportErrorContext | undefined
) => void;

function defaultTransport(error: unknown, context: ReportErrorContext | undefined): void {
  console.error('[reportError]', context?.source ?? 'unknown', error, context);
}

let transport: ReportErrorTransport = defaultTransport;

/** Install a custom transport (spec 118's PostHog wiring). Test seam too. */
export function setReportErrorTransport(next: ReportErrorTransport): void {
  transport = next;
}

/** Restore the default console transport. */
export function resetReportErrorTransport(): void {
  transport = defaultTransport;
}

/**
 * Report an error through the seam. Never throws: a broken transport
 * must not take down the boundary or handler that is reporting.
 */
export function reportError(error: unknown, context?: ReportErrorContext): void {
  try {
    transport(error, context);
  } catch (transportError) {
    console.error('[reportError] transport failed', transportError);
  }
}
