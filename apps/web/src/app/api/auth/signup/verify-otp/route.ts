import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { registerTenantUser, getCookieDomain } from '@/lib/supabase-auth';
import { verifySignupOtp } from '@/lib/otp-service';
import { formatAuthErrorResponse } from '@/lib/auth-errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp, returnUrl } = body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address is required.' },
        { status: 400 }
      );
    }

    if (!otp || typeof otp !== 'string' || otp.trim().length < 6) {
      return NextResponse.json(
        { error: 'A valid 6-digit verification code is required.' },
        { status: 400 }
      );
    }

    const emailLower = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    // Verify OTP against pending registrations
    const verification = verifySignupOtp(emailLower, cleanOtp);

    if (!verification.success || !verification.signupData) {
      return NextResponse.json(
        { error: verification.error || 'Invalid or expired verification code.' },
        { status: 400 }
      );
    }

    // Provision user in database / Supabase
    const { user, token, redirectUrl: defaultRedirectUrl } = await registerTenantUser(
      verification.signupData
    );

    // Deep-link preservation
    let finalRedirectUrl = defaultRedirectUrl;
    if (returnUrl && typeof returnUrl === 'string') {
      const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
      const isLocal = rootDomain.includes('localhost') || rootDomain.includes('127.0.0.1');
      const protocol = isLocal ? 'http' : 'https';

      if (returnUrl.startsWith('/')) {
        finalRedirectUrl = `${protocol}://${user.subdomain}.${rootDomain}${returnUrl}`;
      } else if (returnUrl.includes(user.subdomain)) {
        finalRedirectUrl = returnUrl;
      }
    }

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
      fallbackMessage: 'Unable to verify code and activate account. Please try again shortly.',
      defaultStatus: 500,
    });
  }
}
