'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Input, Button, Alert } from '@/components/ui';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { PasswordInput } from '@/components/auth/password-input';
import { FormErrorCallout } from '@/components/auth/form-error-callout';
import { PALETTE, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { sanitizeAuthErrorMessage } from '@/lib/auth-errors';
import { sanitizeAuthRedirectUrl } from '@/lib/auth-redirect';
import { completeAuthRedirect } from '@/lib/auth-broadcast';
import { validateClientPhoneNumber, isSignupEnabled } from '@fbuploadpro/contracts';
import { SignupPausedCard } from '@/components/auth/signup-paused-card';
import { SignupOtpStep } from '@/components/auth/signup-otp-step';

interface FieldErrors {
  name?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  password?: string | undefined;
  confirmPassword?: string | undefined;
  otp?: string | undefined;
}

interface SignupDetailsInput {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export function validateSignupDetails(input: SignupDetailsInput): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.name.trim()) {
    errors.name = 'Full name is required.';
  } else if (input.name.trim().length > 100) {
    errors.name = 'Full name cannot exceed 100 characters.';
  }

  const phoneValidation = validateClientPhoneNumber(input.phone);
  if (!phoneValidation.isValid) {
    errors.phone = phoneValidation.error || 'Please enter a valid international phone number.';
  }

  const cleanEmail = input.email.trim().toLowerCase();
  if (!cleanEmail.includes('@')) {
    errors.email = 'A valid email address is required.';
  } else {
    const domain = cleanEmail.split('@')[1];
    if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
      errors.email = 'Registration is limited to @gmail.com (or @googlemail.com) accounts.';
    }
  }

  if (!input.password) {
    errors.password = 'Password is required.';
  } else if (input.password.length < 8) {
    errors.password = 'Password must be at least 8 characters long.';
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (input.password !== input.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match. Please verify both password fields.';
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
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [returnUrl, setReturnUrl] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Field-specific validation errors for inline red border and helper error display
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Form-level general error for compact callout above action button
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isEmailConflict, setIsEmailConflict] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const initial = parseInitialQueryParams(window.location.search);
    if (initial.returnUrl) setReturnUrl(initial.returnUrl);
    if (initial.email) setEmail(initial.email);
    if (initial.step) setStep(initial.step);
    if (initial.successNotice) setSuccessNotice(initial.successNotice);
  }, []);

  // Cooldown countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const clearFieldError = (field: keyof FieldErrors) => {
    if (field === 'email') {
      setIsEmailConflict(false);
    }
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (generalError) {
      setGeneralError(null);
    }
  };

  const handleDetailsSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError(null);
    setSuccessNotice(null);
    setIsEmailConflict(false);

    const errors = validateSignupDetails({
      name,
      phone,
      email,
      password,
      confirmPassword,
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 400 && data.details) {
          const mappedErrors = mapApiFieldErrors(data.details);
          if (Object.keys(mappedErrors).length > 0) {
            setFieldErrors(mappedErrors);
            setIsSubmitting(false);
            return;
          }
        }

        if (res.status === 429) {
          const cooldown = data.retryAfterSeconds || data.cooldownSecondsRemaining || 60;
          setResendCooldown(cooldown);
          setGeneralError(
            sanitizeAuthErrorMessage(
              data.error,
              `For security purposes, please wait ${cooldown} seconds before trying again.`
            )
          );
          setIsSubmitting(false);
          return;
        }

        if (res.status === 409 || data.error?.toLowerCase().includes('already registered')) {
          setIsEmailConflict(true);
          setFieldErrors((prev) => ({
            ...prev,
            email: 'This email is already registered.',
          }));
          setIsSubmitting(false);
          return;
        }

        setGeneralError(
          sanitizeAuthErrorMessage(
            data.error,
            'Unable to create your account at this moment. Please try again shortly.'
          )
        );
        setIsSubmitting(false);
        return;
      }

      if (data.requiresOtp) {
        setStep('otp');
        setResendCooldown(data.cooldownSecondsRemaining ?? 60);
        setFieldErrors({});
        setIsSubmitting(false);
        return;
      }

      if (data.redirectUrl) {
        completeAuthRedirect(data.redirectUrl, data.user);
      }
    } catch {
      setGeneralError('Unable to create your account at this moment. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  const signupsAllowed = isSignupEnabled();
  const isPaused = !signupsAllowed && step !== 'otp';
  const layoutMeta = getSignupLayoutMeta(isPaused, step, email);

  return (
    <AuthSplitLayout
      title={layoutMeta.title}
      description={layoutMeta.description}
      footer={
        isPaused || step === 'details' ? (
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-sub, #9ca3af)' }}>
            Already have an account?{' '}
            <Link
              href={returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login'}
              style={{
                color: PALETTE.primary,
                textDecoration: 'none',
                fontWeight: TYPOGRAPHY.weights.semibold,
              }}
            >
              Sign in
            </Link>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setStep('details');
              setGeneralError(null);
              setSuccessNotice(null);
              setFieldErrors({});
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-sub, #9ca3af)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '10px 12px',
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Need to change your details? Return to form
          </button>
        )
      }
    >
      {isPaused ? (
        <SignupPausedCard />
      ) : step === 'otp' ? (
        <SignupOtpStep
          email={email}
          returnUrl={returnUrl}
          initialCooldown={resendCooldown}
          onBack={() => {
            setStep('details');
            setGeneralError(null);
            setSuccessNotice(null);
            setFieldErrors({});
          }}
        />
      ) : (
        <>
          {successNotice && (
            <div style={{ marginBottom: SPACING.lg }}>
              <Alert
                severity="success"
                title="Code Sent"
                message={successNotice}
                onClose={() => setSuccessNotice(null)}
              />
            </div>
          )}

          <form onSubmit={handleDetailsSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          <Input
            label="Full Name"
            placeholder="Jane Doe"
            autoComplete="name"
            value={name}
            error={fieldErrors.name}
            onChange={(e) => {
              setName(e.target.value);
              clearFieldError('name');
            }}
            disabled={isSubmitting}
            required
          />

          <Input
            label="Phone Number"
            type="tel"
            placeholder="+1 555 123 4567"
            autoComplete="tel"
            value={phone}
            error={fieldErrors.phone}
            onChange={(e) => {
              setPhone(e.target.value);
              clearFieldError('phone');
            }}
            disabled={isSubmitting}
            required
            helperText="Include country code starting with + (e.g. +1... or +92...)"
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="you@gmail.com"
            autoComplete="email"
            value={email}
            error={fieldErrors.email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearFieldError('email');
            }}
            disabled={isSubmitting}
            required
            helperText="Only @gmail.com accounts are supported"
          />

          {isEmailConflict && (
            <div
              style={{
                marginTop: '-8px',
                marginBottom: SPACING.xs,
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Link
                href={`/login?email=${encodeURIComponent(email.trim())}`}
                style={{
                  color: PALETTE.primary,
                  textDecoration: 'underline',
                  fontWeight: TYPOGRAPHY.weights.medium,
                }}
              >
                Sign in instead
              </Link>
              <span style={{ color: 'var(--text-dim, #6b7280)' }}>•</span>
              <Link
                href={`/forgot-password?email=${encodeURIComponent(email.trim())}`}
                style={{
                  color: PALETTE.primary,
                  textDecoration: 'underline',
                  fontWeight: TYPOGRAPHY.weights.medium,
                }}
              >
                Reset password
              </Link>
            </div>
          )}

          <PasswordInput
            label="Password"
            placeholder="••••••••••••"
            autoComplete="new-password"
            value={password}
            error={fieldErrors.password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearFieldError('password');
            }}
            disabled={isSubmitting}
            required
            helperText="Minimum 8 characters"
          />

          <PasswordInput
            label="Confirm Password"
            placeholder="••••••••••••"
            autoComplete="new-password"
            value={confirmPassword}
            error={fieldErrors.confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              clearFieldError('confirmPassword');
            }}
            disabled={isSubmitting}
            required
          />

          <FormErrorCallout message={generalError} style={{ marginTop: SPACING.xs }} />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            disabled={isSubmitting || resendCooldown > 0}
            style={{ width: '100%', marginTop: SPACING.xs }}
          >
            {resendCooldown > 0 ? `Please wait (${resendCooldown}s)` : 'Create Account'}
          </Button>

          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-dim, #6b7280)',
              lineHeight: 1.5,
              textAlign: 'center',
              marginTop: SPACING.xs,
              marginBottom: 0,
            }}
          >
            By creating an account, you agree to our{' '}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Terms of Service (opens in a new tab)"
              style={{
                color: PALETTE.primary,
                textDecoration: 'none',
                fontWeight: TYPOGRAPHY.weights.medium,
              }}
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Privacy Policy (opens in a new tab)"
              style={{
                color: PALETTE.primary,
                textDecoration: 'none',
                fontWeight: TYPOGRAPHY.weights.medium,
              }}
            >
              Privacy Policy
            </a>.
          </p>
        </form>
        </>
      )}
    </AuthSplitLayout>
  );
}
