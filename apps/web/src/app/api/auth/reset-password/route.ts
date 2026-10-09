import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resetUserPassword } from '@/lib/supabase-auth';
import { formatAuthErrorResponse } from '@/lib/auth-errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, email, token } = body || {};

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const result = await resetUserPassword({
      password,
      email: typeof email === 'string' ? email.trim() : undefined,
      token: typeof token === 'string' ? token.trim() : undefined,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: unknown) {
    return formatAuthErrorResponse(error, {
      fallbackMessage: 'Unable to reset your password. Your link may have expired or is invalid.',
      defaultStatus: 500,
    });
  }
}
