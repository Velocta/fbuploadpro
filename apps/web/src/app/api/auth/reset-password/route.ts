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
    const { password, email, token, code } = body || {};

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

    const recoveryToken = typeof token === 'string' && token.trim() ? token.trim() : typeof code === 'string' && code.trim() ? code.trim() : undefined;
    if (!recoveryToken && !email) {
      return NextResponse.json(
        { error: 'A valid password recovery link or token is required.' },
        { status: 400 }
      );
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
