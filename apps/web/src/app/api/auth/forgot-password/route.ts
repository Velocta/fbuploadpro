import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canonicalizeGmailAddress } from '@fbuploadpro/contracts';
import { formatAuthErrorResponse } from '@/lib/auth-errors';
import { checkRateLimit, extractClientIp, RATE_LIMIT_WINDOW_MS } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const clientIp = extractClientIp(request.headers);

    // 1. IP rate limiting (max 5 reset requests per 60 seconds)
    const ipLimit = await checkRateLimit(`forgot:ip:${clientIp}`, 5, RATE_LIMIT_WINDOW_MS);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many password reset requests. Please wait ${ipLimit.retryAfterSeconds} seconds before trying again.`,
          retryAfterSeconds: ipLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) },
        }
      );
    }

    const body = await request.json();
    const email = body?.email;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    let canonicalEmail: string;
    try {
      canonicalEmail = canonicalizeGmailAddress(email);
    } catch {
      return NextResponse.json(
        { error: 'Only @gmail.com (or @googlemail.com) email addresses are permitted.' },
        { status: 400 }
      );
    }

    // 2. Identifier rate limiting (max 3 reset requests per 60 seconds per email)
    const emailLimit = await checkRateLimit(`forgot:email:${canonicalEmail}`, 3, RATE_LIMIT_WINDOW_MS);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many requests for this email address. Please wait ${emailLimit.retryAfterSeconds} seconds.`,
          retryAfterSeconds: emailLimit.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    // Dispatch recovery OTP via Supabase Auth (or test fallback)
    const { sendPasswordResetOtpViaSupabase } = await import('@/lib/auth/password-reset');
    await sendPasswordResetOtpViaSupabase(canonicalEmail);

    return NextResponse.json({
      success: true,
      requiresOtp: true,
      email: canonicalEmail,
      message: `A 6-digit verification code has been sent to ${canonicalEmail}.`,
    });
  } catch (error: unknown) {
    return formatAuthErrorResponse(error, {
      fallbackMessage: 'Unable to initiate password reset at this moment. Please try again shortly.',
      defaultStatus: 500,
    });
  }
}
