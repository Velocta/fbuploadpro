'use client';

/**
 * Signup (spec 136 §5.2) — page-level orchestration only: the two-step
 * flow (details → email OTP), the entry parameters (`?step=otp&email=…`,
 * `?notice=pending_verification`, `?returnUrl=`), and the paused-state
 * gate. The forms themselves live in `components/auth/`
 * (`SignupDetailsForm`, `SignupOtpStep`) on the §3.8 form standard; the
 * hand-rolled field-error machinery that used to live here is deleted.
 *
 * Preserved behaviours (§4.2): direct entry at the OTP step (login's
 * OTP-pending redirect depends on it), the OTP step staying completable
 * while signups are paused, and the layout titles/descriptions per state.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { SignupDetailsForm } from '@/components/auth/signup-details-form';
import { SignupOtpStep } from '@/components/auth/signup-otp-step';
import { SignupPausedCard } from '@/components/auth/signup-paused-card';
import { sanitizeAuthRedirectUrl } from '@/lib/auth-redirect';
import { isSignupEnabled } from '@fbuploadpro/contracts';
import {
  signupFormSchema,
  type SignupFormValues,
} from './signup-form-schema';

export interface FieldErrors {
  name?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  password?: string | undefined;
  confirmPassword?: string | undefined;
  otp?: string | undefined;
}

/**
 * Kept for parity with the previous hand-rolled validator: runs the zod
 * form schema and returns the first message per field. The details form
 * itself validates through the RHF resolver.
 */
export function validateSignupDetails(input: SignupFormValues): FieldErrors {
  const result = signupFormSchema.safeParse(input);
  if (result.success) return {};
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in errors)) {
      errors[key as keyof FieldErrors] = issue.message;
    }
  }
  return errors;
}

export function getSignupLayoutMeta(
  isPaused: boolean,
  step: 'details' | 'otp',
  email: string
): { title: string; description: string } {
  if (isPaused) {
    return {
      title: 'Registration Paused',
      description: 'We are currently not accepting new account registrations.',
    };
  }
  if (step === 'details') {
    return {
      title: 'Create Account',
      description: 'Start scheduling and auto-publishing Facebook Reels in minutes.',
    };
  }
  return {
    title: 'Verify Your Email',
    description: `We've sent a 6-digit confirmation code to ${email}. Enter the code below to activate your account.`,
  };
}

export function mapApiFieldErrors(details: unknown): FieldErrors {
  const mappedErrors: FieldErrors = {};
  if (!details || typeof details !== 'object') return mappedErrors;
  for (const [key, msgs] of Object.entries(details as Record<string, unknown>)) {
    if (Array.isArray(msgs) && msgs.length > 0 && typeof msgs[0] === 'string') {
      mappedErrors[key as keyof FieldErrors] = msgs[0];
    }
  }
  return mappedErrors;
}

export function parseInitialQueryParams(search: string) {
  const params = new URLSearchParams(search);
  const ret = params.get('returnUrl');
  const initialStep = params.get('step');
  const emailParam = params.get('email');
  const noticeParam = params.get('notice');
  return {
    returnUrl: ret ? sanitizeAuthRedirectUrl(ret) : undefined,
    step: initialStep === 'otp' ? ('otp' as const) : undefined,
    email: emailParam || undefined,
    successNotice:
      noticeParam === 'pending_verification'
        ? 'We sent a fresh 6-digit verification code. Please confirm your email to complete registration.'
        : undefined,
  };
}

export default function SignupPage() {
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [email, setEmail] = useState('');
  const [returnUrl, setReturnUrl] = useState<string | undefined>(undefined);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const initial = parseInitialQueryParams(window.location.search);
    if (initial.returnUrl) setReturnUrl(initial.returnUrl);
    if (initial.email) setEmail(initial.email);
    if (initial.step) setStep(initial.step);
    if (initial.successNotice) setSuccessNotice(initial.successNotice);
  }, []);

  const signupsAllowed = isSignupEnabled();
  const isPaused = !signupsAllowed && step !== 'otp';
  const layoutMeta = getSignupLayoutMeta(isPaused, step, email);

  const signInFooter = (
    <span className="text-metadata text-ink-sub">
      Already have an account?{' '}
      <Link
        href={returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login'}
        className="font-semibold text-link no-underline hover:underline"
      >
        Sign in
      </Link>
    </span>
  );

  if (isPaused) {
    return (
      <AuthSplitLayout
        title={layoutMeta.title}
        description={layoutMeta.description}
        footer={signInFooter}
      >
        <SignupPausedCard />
      </AuthSplitLayout>
    );
  }

  if (step === 'otp') {
    return (
      <AuthSplitLayout
        title={layoutMeta.title}
        description={layoutMeta.description}
        footer={
          <button
            type="button"
            onClick={() => setStep('details')}
            className="inline-flex min-h-11 items-center px-3 py-2.5 text-metadata text-ink-sub underline"
          >
            Need to change your details? Return to form
          </button>
        }
      >
        <SignupOtpStep
          email={email}
          returnUrl={returnUrl}
          initialCooldown={otpCooldown}
          onBack={() => setStep('details')}
        />
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout
      title={layoutMeta.title}
      description={layoutMeta.description}
      footer={signInFooter}
    >
      <SignupDetailsForm
        initialEmail={email || undefined}
        successNotice={successNotice}
        onDismissSuccessNotice={() => setSuccessNotice(null)}
        onRequiresOtp={(submittedEmail, cooldownSecondsRemaining) => {
          setEmail(submittedEmail);
          setOtpCooldown(cooldownSecondsRemaining);
          setStep('otp');
        }}
      />
    </AuthSplitLayout>
  );
}
