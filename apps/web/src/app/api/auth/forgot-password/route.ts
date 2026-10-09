import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requestPasswordReset } from '@/lib/supabase-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body?.email;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    const origin = request.nextUrl.origin;
    const redirectTo = `${origin}/reset-password`;

    const result = await requestPasswordReset({
      email: email.trim(),
      redirectTo,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: unknown) {
    const message = (error as Error).message || 'Failed to process password recovery request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
