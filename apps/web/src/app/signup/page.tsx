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
import { validateClientPhoneNumber } from '@fbuploadpro/contracts';

interface FieldErrors {
  name?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  password?: string | undefined;
  confirmPassword?: string | undefined;
  otp?: string | undefined;
}

export default function SignupPage() {
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [returnUrl, setReturnUrl] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Field-specific validation errors for inline red border and helper error display
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Form-level general error for compact callout above action button
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isEmailConflict, setIsEmailConflict] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ret = params.get('returnUrl');
      if (ret) {
        setReturnUrl(sanitizeAuthRedirectUrl(ret));
      }
      const initialStep = params.get('step');
      const emailParam = params.get('email');
      if (emailParam) {
        setEmail(emailParam);
      }
      if (initialStep === 'otp') {
        setStep('otp');
      }
      if (params.get('notice') === 'pending_verification') {
        setSuccessNotice('We sent a fresh 6-digit verification code. Please confirm your email to complete registration.');
      }
    }
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

  const handleDetailsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError(null);
    setSuccessNotice(null);
    setIsEmailConflict(false);

    const errors: FieldErrors = {};

    // 1. Full name validation
    if (!name.trim()) {
      errors.name = 'Full name is required.';
    } else if (name.trim().length > 100) {
      errors.name = 'Full name cannot exceed 100 characters.';
    }

    // 2. Comprehensive phone validation with libphonenumber-js
    const phoneValidation = validateClientPhoneNumber(phone);
    if (!phoneValidation.isValid) {
      errors.phone = phoneValidation.error || 'Please enter a valid international phone number.';
    }

    // 3. Gmail restriction & validation
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      errors.email = 'A valid email address is required.';
    } else {
      const domain = cleanEmail.split('@')[1];
      if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
        errors.email = 'Registration is limited to @gmail.com (or @googlemail.com) accounts.';
      }
    }

    // 4. Password validation
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    }

    // 5. Confirm password validation
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match. Please verify both password fields.';
    }

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
          const mappedErrors: FieldErrors = {};
          for (const [key, msgs] of Object.entries(data.details)) {
            if (Array.isArray(msgs) && msgs.length > 0 && typeof msgs[0] === 'string') {
              mappedErrors[key as keyof FieldErrors] = msgs[0];
            }
          }
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
        setOtp('');
        setFieldErrors({});
        setIsSubmitting(false);
        return;
      }

      if (data.redirectUrl) {
        window.location.href = sanitizeAuthRedirectUrl(data.redirectUrl);
      }
    } catch {
      setGeneralError('Unable to create your account at this moment. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError(null);
    setSuccessNotice(null);

    const cleanOtp = otp.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      setFieldErrors({ otp: 'Please enter the complete 6-digit verification code.' });
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/signup/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otp: cleanOtp,
          returnUrl: returnUrl ? sanitizeAuthRedirectUrl(returnUrl) : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFieldErrors({
          otp: sanitizeAuthErrorMessage(data.error, 'Invalid or expired verification code. Please try again.'),
        });
        setIsSubmitting(false);
        return;
      }

      if (data.redirectUrl) {
        window.location.href = sanitizeAuthRedirectUrl(data.redirectUrl);
      }
    } catch {
      setGeneralError('Unable to verify code at this moment. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;

    setGeneralError(null);
    setSuccessNotice(null);
    setFieldErrors({});
    setIsResending(true);

    try {
      const res = await fetch('/api/auth/signup/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGeneralError(sanitizeAuthErrorMessage(data.error, 'Unable to resend code right now.'));
        if (data.cooldownSecondsRemaining) {
          setResendCooldown(data.cooldownSecondsRemaining);
        }
        setIsResending(false);
        return;
      }

      setSuccessNotice('A fresh 6-digit verification code has been dispatched to your email.');
      setResendCooldown(60);
      setIsResending(false);
    } catch {
      setGeneralError('Failed to resend verification code. Please check your connection.');
      setIsResending(false);
    }
  };

  return (
    <AuthSplitLayout
      title={step === 'details' ? 'Create Account' : 'Verify Your Email'}
      description={
        step === 'details'
          ? 'Start scheduling and auto-publishing Facebook Reels in minutes.'
          : `We've sent a 6-digit confirmation code to ${email}. Enter the code below to activate your account.`
      }
      footer={
        step === 'details' ? (
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

      {step === 'details' ? (
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
            </a>
            .
          </p>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim, #6b7280)' }}>
                Verification code sent to
              </span>
              <span style={{ fontSize: '0.875rem', fontWeight: TYPOGRAPHY.weights.medium, color: 'var(--text-main, #f3f4f6)' }}>
                {email}
              </span>
            </div>
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
                color: PALETTE.primary,
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                cursor: 'pointer',
                padding: '4px 8px',
                textDecoration: 'underline',
              }}
            >
              Wrong email? Edit
            </button>
          </div>

          <div>
            <Input
              label="6-Digit Verification Code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="••••••"
              autoFocus
              value={otp}
              error={fieldErrors.otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                clearFieldError('otp');
              }}
              disabled={isSubmitting}
              required
              helperText="Check your spam folder if you do not see the email in your inbox."
              style={{
                textAlign: 'center',
                letterSpacing: '0.4em',
                fontSize: '1.25rem',
                fontWeight: TYPOGRAPHY.weights.bold,
              }}
            />
            {fieldErrors.otp && fieldErrors.otp.toLowerCase().includes('expired') && (
              <div style={{ marginTop: '8px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isResending || resendCooldown > 0}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: PALETTE.primary,
                    fontSize: '0.8125rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Send fresh code
                </button>
              </div>
            )}
          </div>

          <FormErrorCallout message={generalError} />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            style={{ width: '100%' }}
          >
            Verify & Activate Account
          </Button>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: SPACING.xs,
            }}
          >
            {resendCooldown > 0 ? (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim, #6b7280)' }}>
                Resend code in {resendCooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isResending}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: PALETTE.primary,
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {isResending ? 'Sending...' : 'Resend verification code'}
              </button>
            )}
          </div>
        </form>
      )}
    </AuthSplitLayout>
  );
}
