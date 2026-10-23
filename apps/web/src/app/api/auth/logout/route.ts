import { NextResponse, type NextRequest } from 'next/server';
import {
  getSupabaseAdminClient,
  getCookieDomain,
} from '@/lib/auth/clients';
import {
  purgeHostOnlySessionCookie,
} from '@/lib/auth/session';
import { buildCentralAppUrl } from '@fbuploadpro/contracts';
import { logServerError } from '@/lib/server-analytics';

export async function POST(request?: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }

    const host = request?.headers.get('host');
    const requestUrl = request?.url || (host ? `https://${host}` : undefined);
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';

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
    // Log the detail server-side; the client gets the generic message
    // (the raw error message used to leak here, spec 139 C1 pattern).
    logServerError('[auth/logout] Logout failed', error, { source: 'auth-logout' });
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
