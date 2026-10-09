import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resetUserPassword } from '@/lib/supabase-auth';
import { formatAuthErrorResponse } from '@/lib/auth-errors';
import { checkRateLimit, extractClientIp } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const clientIp = extractClientIp(request.headers);

    // 1. IP rate limiting (max 5 password reset attempts per 60 seconds)
    const ipLimit = checkRateLimit(`reset_pwd:ip:${clientIp}`, 5, 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many password reset attempts. Please wait ${ipLimit.retryAfterSeconds} seconds before trying again.`,
          retryAfterSeconds: ipLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) },
        }
      );
    }

    const body = await request.json();
    const { password, email, otp, token, code } = body || {};

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    if (password.length > 128) {
      return NextResponse.json(
        { error: 'Password cannot exceed 128 characters.' },
        { status: 400 }
      );
    }

    const cleanOtp = typeof otp === 'string' ? otp.replace(/\D/g, '').trim() : undefined;
    const recoveryToken = typeof token === 'string' && token.trim() ? token.trim() : typeof code === 'string' && code.trim() ? code.trim() : undefined;

    if (!cleanOtp && !recoveryToken) {
      return NextResponse.json(
        { error: 'A valid 6-digit verification code or recovery token is required.' },
        { status: 400 }
      );
    }

    if (cleanOtp) {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return NextResponse.json(
          { error: 'Email address is required for verification.' },
          { status: 400 }
        );
      }

      if (cleanOtp.length !== 6) {
        return NextResponse.json(
          { error: 'Verification code must be exactly 6 digits.' },
          { status: 400 }
        );
      }

      const { resetUserPasswordWithOtp } = await import('@/lib/supabase-auth');
      const result = await resetUserPasswordWithOtp({
        email,
        otp: cleanOtp,
        password,
      });

      return NextResponse.json({
        success: true,
        message: result.message,
      });
    }

    const result = await resetUserPassword({
      password,
      email: typeof email === 'string' ? email.trim() : undefined,
      token: recoveryToken,
      code: typeof code === 'string' ? code.trim() : undefined,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: unknown) {
    return formatAuthErrorResponse(error, {
      fallbackMessage: 'Unable to reset your password. Your link may have expired or is invalid.',
      defaultStatus: 500,
    });
  }
}
