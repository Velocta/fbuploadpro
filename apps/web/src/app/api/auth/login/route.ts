import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { LoginRequestSchema } from '@fbuploadpro/contracts';
import { loginTenantUser, getCookieDomain } from '@/lib/supabase-auth';
import { formatAuthErrorResponse } from '@/lib/auth-errors';
import { checkRateLimit, extractClientIp } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const clientIp = extractClientIp(request.headers);

    // IP rate limiting to prevent credential brute-force (max 10 login attempts per 60 seconds)
    const ipLimit = checkRateLimit(`login:ip:${clientIp}`, 10, 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many sign in attempts. Please wait ${ipLimit.retryAfterSeconds} seconds before trying again.`,
          retryAfterSeconds: ipLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) },
        }
      );
    }

    const body = await request.json();
    const parseResult = LoginRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Account identifier rate limiting to prevent brute-force attacks (max 5 attempts per 60s per email)
    const emailLimit = checkRateLimit(`login:email:${parseResult.data.email}`, 5, 60 * 1000);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many sign in attempts for this account. Please wait ${emailLimit.retryAfterSeconds} seconds before trying again.`,
          retryAfterSeconds: emailLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(emailLimit.retryAfterSeconds) },
        }
      );
    }

    const { user, token, redirectUrl } = await loginTenantUser(parseResult.data);

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
        redirectUrl,
      },
      { status: 200 }
    );

    const isProduction = process.env.NODE_ENV === 'production';
    const domain = getCookieDomain();

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
      fallbackMessage: 'Unable to sign in at this moment. Please try again shortly.',
      defaultStatus: 500,
    });
  }
}
