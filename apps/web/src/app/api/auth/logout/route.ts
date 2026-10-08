import { NextResponse } from 'next/server';
import { getSupabaseClient, getCookieDomain } from '@/lib/supabase-auth';

export async function POST() {
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
    const domain = getCookieDomain();

    response.cookies.set('fbup_session', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      domain,
      maxAge: 0,
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Logout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
