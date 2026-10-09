import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canonicalizeGmailAddress } from '@fbuploadpro/contracts';
import { findUserByEmail, resendSignupOtpViaSupabase, getSupabaseClient } from '@/lib/supabase-auth';
import { getPendingSignup } from '@/lib/otp-service';
import { formatAuthErrorResponse } from '@/lib/auth-errors';
import { checkRateLimit, extractClientIp } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const clientIp = extractClientIp(request.headers);

    // 1. IP rate limiting (max 5 resend requests per 60 seconds per IP)
    const ipLimit = checkRateLimit(`resend:ip:${clientIp}`, 5, 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many resend attempts. Please wait ${ipLimit.retryAfterSeconds} seconds before requesting a new code.`,
          retryAfterSeconds: ipLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) },
        }
      );
    }

    const body = await request.json();
    const { email } = body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid Gmail address is required.' },
        { status: 400 }
      );
    }

    let canonicalEmail: string;
    try {
      canonicalEmail = canonicalizeGmailAddress(email);
    } catch {
      return NextResponse.json(
        { error: 'Only @gmail.com (or @googlemail.com) addresses are supported.' },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(canonicalEmail);
    const pending = getPendingSignup(canonicalEmail);

    if (!user && !pending) {
      return NextResponse.json(
        { error: 'No pending registration found. Please submit the registration form again.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    if (supabase && user) {
      const { data: authUserData } = await supabase.auth.admin.getUserById(user.id);
      if (authUserData?.user?.email_confirmed_at) {
        return NextResponse.json(
          { error: 'Account is already verified. Please sign in.' },
          { status: 400 }
        );
      }
    } else if (!supabase && user && !pending) {
      return NextResponse.json(
        { error: 'Account is already verified. Please sign in.' },
        { status: 400 }
      );
    }

    const resendResult = await resendSignupOtpViaSupabase(canonicalEmail);

    if (!resendResult.success) {
      const status = resendResult.cooldownSecondsRemaining ? 429 : 400;
      return NextResponse.json(
        {
          error: resendResult.error || 'Unable to resend verification code.',
          cooldownSecondsRemaining: resendResult.cooldownSecondsRemaining,
        },
        { status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'A fresh 6-digit verification code has been dispatched to your email.',
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return formatAuthErrorResponse(error, {
      fallbackMessage: 'Unable to resend code at this moment. Please try again shortly.',
      defaultStatus: 500,
    });
  }
}
