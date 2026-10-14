import { NextResponse, type NextRequest } from 'next/server';
import {
  getSupabaseClient,
  getCookieDomain,
  purgeHostOnlySessionCookie,
} from '@/lib/supabase-auth';
import { buildCentralAppUrl } from '@fbuploadpro/contracts';

export async function POST(request?: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }

    const host = request?.headers.get('host');
    const requestUrl = request?.url || (host ? `https://${host}` : undefined);
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'fbuploadpro.com';

    const redirectUrl = buildCentralAppUrl(
      '/login?logout=success',
      requestUrl,
      rootDomain
    ).toString();

    const response = NextResponse.json(
      {
        success: true,
        redirectUrl,
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
      purgeHostOnlySessionCookie(response);
    }

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Logout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
