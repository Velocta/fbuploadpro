import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SignupRequestSchema } from '@fbuploadpro/contracts';
import { findUserByEmail } from '@/lib/supabase-auth';
import { createPendingSignup } from '@/lib/otp-service';
import { sendOtpEmail } from '@/lib/email-service';
import { formatAuthErrorResponse } from '@/lib/auth-errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = SignupRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const emailLower = parseResult.data.email.trim().toLowerCase();

    // Check email uniqueness before sending OTP
    const existingUser = await findUserByEmail(emailLower);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email is already registered' },
        { status: 409 }
      );
    }

    // Generate 6-digit OTP and store pending registration
    const { otp, expiresAt } = createPendingSignup(parseResult.data);

    // Dispatch OTP email via Resend (or simulated logger in test/dev)
    await sendOtpEmail({
      email: emailLower,
      name: parseResult.data.name,
      otp,
    });

    return NextResponse.json(
      {
        success: true,
        requiresOtp: true,
        email: emailLower,
        expiresAt: expiresAt.toISOString(),
        message: 'A 6-digit verification code has been sent to your email.',
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return formatAuthErrorResponse(error, {
      fallbackMessage: 'Unable to initiate account registration. Please try again shortly.',
      defaultStatus: 500,
    });
  }
}
