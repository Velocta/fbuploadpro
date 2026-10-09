import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SignupRequestSchema } from '@fbuploadpro/contracts';
import { signUpTenantUser } from '@/lib/supabase-auth';
import { formatAuthErrorResponse } from '@/lib/auth-errors';
import { checkRateLimit, extractClientIp } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const clientIp = extractClientIp(request.headers);

    // 1. IP rate limiting (max 5 signup OTP requests per 60 seconds)
    const ipLimit = checkRateLimit(`signup:ip:${clientIp}`, 5, 60 * 1000);
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
    const emailLimit = checkRateLimit(`signup:email:${canonicalEmail}`, 3, 60 * 1000);
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
