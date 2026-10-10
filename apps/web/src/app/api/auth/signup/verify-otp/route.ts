import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canonicalizeGmailAddress } from '@fbuploadpro/contracts';
import { verifySignupOtpViaSupabase, getCookieDomain } from '@/lib/supabase-auth';
import { formatAuthErrorResponse } from '@/lib/auth-errors';
import { checkRateLimit, extractClientIp } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const clientIp = extractClientIp(request.headers);

    // IP rate limiting on OTP verification attempts (10 requests per 60s)
    const ipLimit = checkRateLimit(`verify_otp:ip:${clientIp}`, 10, 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many verification attempts from this IP. Please wait ${ipLimit.retryAfterSeconds} seconds before trying again.`,
          retryAfterSeconds: ipLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) },
        }
      );
    }

    const body = await request.json();
    const { email, otp, returnUrl } = body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address is required.' },
        { status: 400 }
      );
    }

    let canonicalEmail: string;
    try {
      canonicalEmail = canonicalizeGmailAddress(email);
    } catch {
      return NextResponse.json(
        { error: 'Only @gmail.com (or @googlemail.com) addresses are permitted.' },
        { status: 400 }
      );
    }

    if (!otp || typeof otp !== 'string' || otp.trim().length < 6) {
      return NextResponse.json(
        { error: 'A valid 6-digit verification code is required.' },
        { status: 400 }
      );
    }

    const cleanOtp = otp.trim();
    const requestHost = request.headers.get('host');

    // Verify OTP via Supabase Auth (or test fallback) and activate user profile
    const { user, token, redirectUrl: finalRedirectUrl } = await verifySignupOtpViaSupabase({
      email: canonicalEmail,
      otp: cleanOtp,
      returnUrl,
      requestHost,
    });

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          subdomain: user.subdomain,
          role: user.role,
          status: user.status,
        },
        redirectUrl: finalRedirectUrl,
      },
      { status: 201 }
    );

    const isProduction = process.env.NODE_ENV === 'production';
    const domain = getCookieDomain(requestHost);

    response.cookies.set('fbup_session', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      domain,
      maxAge: 86400 * 30, // 30 days
    });

    return response;
  } catch (error: unknown) {
    return formatAuthErrorResponse(error, {
      fallbackMessage: 'Unable to verify code and activate account. Please try again shortly.',
      defaultStatus: 500,
    });
  }
}
