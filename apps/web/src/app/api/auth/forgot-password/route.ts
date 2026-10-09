import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requestPasswordReset } from '@/lib/supabase-auth';
import { formatAuthErrorResponse } from '@/lib/auth-errors';

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
    return formatAuthErrorResponse(error, {
      fallbackMessage: 'Unable to process your request at this moment. Please try again shortly.',
      defaultStatus: 500,
    });
  }
}
