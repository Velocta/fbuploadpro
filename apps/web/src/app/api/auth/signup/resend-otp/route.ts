import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resendSignupOtp, getPendingSignup } from '@/lib/otp-service';
import { sendOtpEmail } from '@/lib/email-service';
import { formatAuthErrorResponse } from '@/lib/auth-errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address is required.' },
        { status: 400 }
      );
    }

    const emailLower = email.trim().toLowerCase();
    const pending = getPendingSignup(emailLower);

    if (!pending) {
      return NextResponse.json(
        { error: 'No pending registration found. Please submit the registration form again.' },
        { status: 400 }
      );
    }

    const resendResult = resendSignupOtp(emailLower);

    if (!resendResult.success || !resendResult.otp) {
      const status = resendResult.cooldownSecondsRemaining ? 429 : 400;
      return NextResponse.json(
        {
          error: resendResult.error || 'Unable to resend verification code.',
          cooldownSecondsRemaining: resendResult.cooldownSecondsRemaining,
        },
        { status }
      );
    }

    await sendOtpEmail({
      email: emailLower,
      name: pending.data.name,
      otp: resendResult.otp,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'A fresh 6-digit verification code has been dispatched to your email.',
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return formatAuthErrorResponse(error, {
      fallbackMessage: 'Unable to resend code at this moment. Please try again shortly.',
      defaultStatus: 500,
    });
  }
}
