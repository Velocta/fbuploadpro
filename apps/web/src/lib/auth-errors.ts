import { NextResponse } from 'next/server';

/**
 * Regex identifying internal infrastructure, database, socket, or technical plumbing terms
 * that MUST NEVER be exposed in client-facing user interfaces or API response bodies.
 */
const TECHNICAL_LEAK_KEYWORDS = [
  'econnrefused',
  '127.0.0.1',
  'localhost',
  '5432',
  'postgres',
  'pg_pool',
  'database',
  'socket',
  'stack',
  'syntaxerror',
  'uncaught',
  'typeerror',
  'internal server',
  'connection refused',
];

const SQL_ACTION_REGEX = /\b(select|insert|update|delete)\s/i;
const TIMEOUT_REGEX = /timed?\s*out/i;

function hasTechnicalLeak(message: string): boolean {
  const lower = message.toLowerCase();
  if (TECHNICAL_LEAK_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return true;
  }
  return SQL_ACTION_REGEX.test(message) || TIMEOUT_REGEX.test(message);
}

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

  if (hasTechnicalLeak(trimmed)) {
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

  let rawMessage = '';
  if (error instanceof Error) {
    rawMessage = error.message;
  } else if (typeof error === 'string') {
    rawMessage = error;
  }
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
    rawMessage.includes('Passwords do not match') ||
    rawMessage.includes('Invalid or expired') ||
    rawMessage.includes('Invalid verification code') ||
    rawMessage.includes('Too many incorrect attempts') ||
    rawMessage.includes('Verification code has expired') ||
    rawMessage.includes('No pending registration found') ||
    rawMessage.includes('reset link has expired') ||
    rawMessage.includes('token is required')
  ) {
    return NextResponse.json({ error: rawMessage }, { status: 400 });
  }

  // 5. Rate Limit / Cooldown Check (429)
  const isRateLimited =
    code === 'RATE_LIMITED' ||
    rawMessage.toLowerCase().includes('for security purposes') ||
    rawMessage.toLowerCase().includes('too many') ||
    /after\s+(\d+)\s+seconds/i.test(rawMessage);

  if (isRateLimited) {
    const match = /after\s+(\d+)\s+seconds/i.exec(rawMessage);
    const retryAfter = match
      ? Number.parseInt(match[1], 10)
      : (error as { retryAfterSeconds?: number })?.retryAfterSeconds || 60;
    const sanitizedMsg = `For security purposes, please wait ${retryAfter} second${
      retryAfter === 1 ? '' : 's'
    } before requesting another verification code.`;

    return NextResponse.json(
      {
        error: sanitizedMsg,
        retryAfterSeconds: retryAfter,
        cooldownSecondsRemaining: retryAfter,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    );
  }

  // 6. Default/Unexpected Failure (Never leak technical details!)
  return NextResponse.json(
    { error: sanitizeAuthErrorMessage(rawMessage, fallbackMessage) },
    { status: defaultStatus }
  );
}
