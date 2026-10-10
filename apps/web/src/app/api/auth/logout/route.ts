import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseClient, getCookieDomain } from '@/lib/supabase-auth';

export async function POST(request?: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }

    const response = NextResponse.json(
      {
        success: true,
        redirectUrl: '/login',
      },
      { status: 200 }
    );

    const isProduction = process.env.NODE_ENV === 'production';
    const domain = getCookieDomain(request?.headers.get('host'));

    response.cookies.set('fbup_session', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      domain,
      maxAge: 0,
    });

    if (domain) {
      // Also clear host-only cookie if domain-wide cookie is active
      response.headers.append(
        'Set-Cookie',
        `fbup_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`
      );
    }

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Logout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
