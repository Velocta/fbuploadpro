import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { LoginRequestSchema } from '@fbuploadpro/contracts';
import { loginTenantUser, getCookieDomain } from '@/lib/supabase-auth';

export async function POST(request: NextRequest) {
  try {
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
    const err = error as { code?: string; message?: string };
    if (err.code === 'ACCOUNT_SUSPENDED' || err.message?.includes('suspended')) {
      return NextResponse.json(
        {
          error: 'Account is suspended',
          redirectUrl: '/account-suspended',
        },
        { status: 403 }
      );
    }

    const message = err.message || 'Authentication failed';
    const status = message.includes('Invalid email or password') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
