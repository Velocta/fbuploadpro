import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SignupRequestSchema, isSignupEnabled } from '@fbuploadpro/contracts';
import { signUpTenantUser } from '@/lib/auth/signup';
import { formatAuthErrorResponse } from '@/lib/auth-errors';
import { checkRateLimit, extractClientIp, RATE_LIMIT_WINDOW_MS } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // 0. Server-side registration pause guard
    if (!isSignupEnabled()) {
      return NextResponse.json(
        {
          error: 'Account registration is temporarily paused. Please check back shortly or sign in to your existing account.',
        },
        { status: 403 }
      );
    }

    const clientIp = extractClientIp(request.headers);

    // 1. IP rate limiting (max 5 signup OTP requests per 60 seconds)
    const ipLimit = await checkRateLimit(`signup:ip:${clientIp}`, 5, RATE_LIMIT_WINDOW_MS);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many registration attempts. Please wait ${ipLimit.retryAfterSeconds} seconds before trying again.`,
          retryAfterSeconds: ipLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) },
        }
      );
    }

    const body = await request.json();
    const parseResult = SignupRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const canonicalEmail = parseResult.data.email;

    // 2. Email identifier rate limiting (max 3 requests per 60 seconds per email)
    const emailLimit = await checkRateLimit(`signup:email:${canonicalEmail}`, 3, RATE_LIMIT_WINDOW_MS);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many verification requests for this email address. Please wait ${emailLimit.retryAfterSeconds} seconds.`,
          retryAfterSeconds: emailLimit.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    // 3. Initiate or resume registration and dispatch OTP via Supabase Auth
    const signupResult = await signUpTenantUser(parseResult.data);

    return NextResponse.json(
      {
        success: true,
        requiresOtp: signupResult.requiresOtp,
        cooldownSecondsRemaining: signupResult.cooldownSecondsRemaining,
        email: canonicalEmail,
        message: 'A 6-digit verification code has been sent to your Gmail address.',
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return formatAuthErrorResponse(error, {
      fallbackMessage: 'Unable to initiate account registration. Please try again shortly.',
      defaultStatus: 500,
    });
  }
}
