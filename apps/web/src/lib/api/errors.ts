/**
 * ApiError taxonomy (spec 137 §3.1).
 *
 * Every call through the typed API client either returns typed data or
 * throws one of these errors. There is no third outcome: no silent
 * returns, no raw `Response` objects, no unvalidated casts.
 */

export type ApiErrorKind =
  | 'http'
  | 'network'
  | 'parse'
  | 'session-expired'
  | 'aborted';

export interface ApiErrorOptions {
  /** HTTP status code, when the error came from a response. */
  status?: number;
  /** Machine-readable server error code (e.g. `INVALID_REQUEST`), when sent. */
  code?: string;
  /** Original error/value that caused this one, preserved for reporting. */
  cause?: unknown;
  /** Zod issues (or a serialized equivalent) for `parse` failures. */
  issues?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly issues: unknown;

  constructor(kind: ApiErrorKind, message: string, options: ApiErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options.status;
    this.code = options.code;
    this.issues = options.issues;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** A non-2xx response that is not a 401. Carries status + server code/message. */
export function httpError(
  status: number,
  message: string,
  options: ApiErrorOptions = {}
): ApiError {
  return new ApiError('http', message, { ...options, status });
}

/** The request never produced a response (offline, DNS, CORS, …). */
export function networkError(cause: unknown): ApiError {
  return new ApiError(
    'network',
    'The request could not be completed. Check your connection and try again.',
    { cause }
  );
}

/** The response body was not valid JSON, or it failed schema validation. */
export function parseError(message: string, options: ApiErrorOptions = {}): ApiError {
  return new ApiError('parse', message, options);
}

/** Any 401 response. The global session-expired handler reacts to this kind. */
export function sessionExpiredError(options: ApiErrorOptions = {}): ApiError {
  return new ApiError(
    'session-expired',
    'Your session expired. Sign in again to pick up where you left off.',
    { ...options, status: 401 }
  );
}

/** The caller (or React Query) aborted the request via its AbortSignal. */
export function abortedError(cause?: unknown): ApiError {
  return new ApiError('aborted', 'The request was cancelled.', { cause });
}

/**
 * Narrow an `unknown` caught value to a displayable message.
 *
 * This is the replacement for `catch (err: any)` + `err.message` at the
 * data boundary (spec 137 §3.7): call sites type catches as `unknown`
 * and narrow through here.
 */
export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (typeof error === 'string' && error.trim().length > 0) return error;
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  if (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string' &&
    ((error as { message: string }).message as string).trim().length > 0
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}
