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
  'pg_',
  'syntax error at or near',
  'relation "',
  'syntaxerror',
  'uncaught',
  'typeerror',
  'internal server',
  'connection refused',
];

const SQL_ACTION_REGEX = /\b(select\s+\*|insert\s+into|update\s+\w+\s+set|delete\s+from)\b/i;
const TIMEOUT_REGEX = /(socket\s+timed?\s*out|timed?\s*out\s+after\s+\d+ms)/i;

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
  rawMessage: unknown,
  fallbackMessage: string = 'Unable to complete your request at this moment. Please try again shortly.'
): string {
  const message =
    typeof rawMessage === 'string'
      ? rawMessage
      : rawMessage instanceof Error
        ? rawMessage.message
        : rawMessage && typeof rawMessage === 'object' && 'message' in rawMessage
          ? String((rawMessage as { message: unknown }).message)
          : null;

  if (!message || !message.trim()) {
    return fallbackMessage;
  }

  const trimmed = message.trim();

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
): NextResponse<{ error: string; redirectUrl?: string | undefined; requiresOtp?: boolean | undefined; email?: string | undefined }> {
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
  const errorObj = error as { code?: string; requiresOtp?: boolean; email?: string; retryAfterSeconds?: number };
  const code = errorObj?.code || '';

  // 1. Requires OTP Handler (403)
  if (code === 'REQUIRES_OTP' || errorObj?.requiresOtp) {
    return NextResponse.json(
      {
        error: rawMessage || 'Please verify your email address to complete registration.',
        requiresOtp: true,
        ...(errorObj?.email ? { email: errorObj.email } : {}),
      },
      { status: 403 }
    );
  }


  // 2. Account Suspended Check (403)
  if (code === 'ACCOUNT_SUSPENDED' || rawMessage.toLowerCase().includes('suspended')) {
    return NextResponse.json(
      {
        error: 'Account is suspended',
        redirectUrl: '/account-suspended',
      },
      { status: 403 }
    );
  }

  // 3. Email Already Registered Check (409)
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

  // 4. Rate Limit / Cooldown / Lockout Check (429 - evaluated before general 400 validation)
  const isRateLimited =
    code === 'RATE_LIMITED' ||
    rawMessage.toLowerCase().includes('for security purposes') ||
    rawMessage.toLowerCase().includes('too many') ||
    rawMessage.toLowerCase().includes('temporarily locked') ||
    /after\s+(\d+)\s+seconds/i.test(rawMessage);

  if (isRateLimited) {
    const match = /after\s+(\d+)\s+seconds/i.exec(rawMessage);
    const retryAfter = match
      ? Number.parseInt(match[1], 10)
      : errorObj?.retryAfterSeconds || 60;
    const sanitizedMsg = rawMessage.toLowerCase().includes('temporarily locked')
      ? rawMessage
      : `For security purposes, please wait ${retryAfter} second${
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

  // 5. Invalid Credentials Check (401)
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

  // 6. Safe Client Validation Messages (400)
  if (
    rawMessage.includes('Password must be at least') ||
    rawMessage.includes('Password cannot exceed') ||
    rawMessage.includes('valid email address is required') ||
    rawMessage.includes('Only @gmail.com') ||
    rawMessage.includes('Passwords do not match') ||
    rawMessage.includes('Invalid or expired') ||
    rawMessage.includes('Invalid verification code') ||
    rawMessage.includes('Verification code has expired') ||
    rawMessage.includes('No pending registration found') ||
    rawMessage.includes('reset link has expired') ||
    rawMessage.includes('token is required')
  ) {
    return NextResponse.json({ error: rawMessage }, { status: 400 });
  }

  // 7. Default/Unexpected Failure (Never leak technical details!)
  return NextResponse.json(
    { error: sanitizeAuthErrorMessage(rawMessage, fallbackMessage) },
    { status: defaultStatus }
  );
}

