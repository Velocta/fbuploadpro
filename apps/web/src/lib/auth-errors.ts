import { NextResponse } from 'next/server';

/**
 * Regex identifying internal infrastructure, database, socket, or technical plumbing terms
 * that MUST NEVER be exposed in client-facing user interfaces or API response bodies.
 */
const TECHNICAL_LEAK_REGEX =
  /ECONNREFUSED|127\.0\.0\.1|localhost|5432|postgres|pg_pool|select\s|insert\s|update\s|delete\s|database|socket|timed?\s*out|stack|syntaxerror|uncaught|typeerror|internal\s+server|connection\s+refused/i;

/**
 * Sanitizes any raw error string before rendering to user-visible frontend components.
 * If any internal infrastructure or diagnostic plumbing keywords are detected,
 * replaces them with a clean, reassuring commercial SaaS message.
 */
export function sanitizeAuthErrorMessage(
  rawMessage: string | null | undefined,
  fallbackMessage: string = 'Unable to complete your request at this moment. Please try again shortly.'
): string {
  if (!rawMessage || typeof rawMessage !== 'string' || !rawMessage.trim()) {
    return fallbackMessage;
  }

  const trimmed = rawMessage.trim();

  if (TECHNICAL_LEAK_REGEX.test(trimmed)) {
    return fallbackMessage;
  }

  return trimmed;
}

export interface AuthErrorResponseOptions {
  fallbackMessage?: string;
  defaultStatus?: number;
}

/**
 * Server-side error handler for authentication endpoints.
 * Logs full diagnostic traces internally for server logs while ensuring that
 * client response bodies NEVER contain infrastructure or database details.
 */
export function formatAuthErrorResponse(
  error: unknown,
  options: AuthErrorResponseOptions = {}
): NextResponse<{ error: string; redirectUrl?: string }> {
  const fallbackMessage =
    options.fallbackMessage || 'Unable to complete your request at this moment. Please try again shortly.';
  const defaultStatus = options.defaultStatus || 500;

  // Log internal diagnostic error to server logs for operator visibility
  console.error('[Auth Error]', error);

  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : '';
  const code = (error as { code?: string })?.code || '';

  // 1. Account Suspended Check (403)
  if (code === 'ACCOUNT_SUSPENDED' || rawMessage.toLowerCase().includes('suspended')) {
    return NextResponse.json(
      {
        error: 'Account is suspended',
        redirectUrl: '/account-suspended',
      },
      { status: 403 }
    );
  }

  // 2. Email Already Registered Check (409)
  if (
    rawMessage.toLowerCase().includes('already registered') ||
    rawMessage.toLowerCase().includes('already exists') ||
    rawMessage.toLowerCase().includes('user already registered')
  ) {
    return NextResponse.json(
      { error: 'Email is already registered' },
      { status: 409 }
    );
  }

  // 3. Invalid Credentials Check (401)
  if (
    rawMessage.toLowerCase().includes('invalid email or password') ||
    rawMessage.toLowerCase().includes('invalid login credentials') ||
    rawMessage.toLowerCase().includes('invalid_grant')
  ) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  // 4. Safe Client Validation Messages (400)
  if (
    rawMessage.includes('Password must be at least') ||
    rawMessage.includes('valid email address is required') ||
    rawMessage.includes('Passwords do not match')
  ) {
    return NextResponse.json({ error: rawMessage }, { status: 400 });
  }

  // 5. Default/Unexpected Failure (Never leak technical details!)
  return NextResponse.json(
    { error: sanitizeAuthErrorMessage(rawMessage, fallbackMessage) },
    { status: defaultStatus }
  );
}
