import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { LoginRequestSchema } from '@fbuploadpro/contracts';
import { loginTenantUser, resendSignupOtpViaSupabase, getCookieDomain } from '@/lib/supabase-auth';
import { formatAuthErrorResponse } from '@/lib/auth-errors';
import { checkRateLimit, extractClientIp } from '@/lib/rate-limiter';
import {
  findPendingSignup,
  verifyPendingSignupPassword,
} from '@/lib/otp-service';

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
          error: `Too many sign in attempts. Please wait ${emailLimit.retryAfterSeconds} seconds before trying again.`,
          retryAfterSeconds: emailLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(emailLimit.retryAfterSeconds) },
        }
      );
    }

    let loginResult;
    try {
      loginResult = await loginTenantUser(parseResult.data);
    } catch (loginErr: unknown) {
      const errObj = loginErr as { code?: string; requiresOtp?: boolean; email?: string };
      if (errObj?.code === 'REQUIRES_OTP' || errObj?.requiresOtp) {
        const targetEmail = errObj.email || parseResult.data.email;
        await resendSignupOtpViaSupabase(targetEmail);
        return NextResponse.json(
          {
            error: 'Please verify your email address to complete registration.',
            requiresOtp: true,
            email: targetEmail,
          },
          { status: 403 }
        );
      }

      // Check if user has an unverified pending registration in fallback store
      const pendingSignup = findPendingSignup(parseResult.data.email);
      if (pendingSignup) {
        const passwordMatches = verifyPendingSignupPassword(parseResult.data.email, parseResult.data.password);
        if (passwordMatches) {
          await resendSignupOtpViaSupabase(pendingSignup.data.email);
          return NextResponse.json(
            {
              error: 'Please verify your email address to complete registration.',
              requiresOtp: true,
              email: pendingSignup.data.email,
            },
            { status: 403 }
          );
        }
      }
      throw loginErr;
    }

    const { user, token, redirectUrl } = loginResult;

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
