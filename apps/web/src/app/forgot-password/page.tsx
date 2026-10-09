'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input, Button, Alert } from '@/components/ui';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { PasswordInput } from '@/components/auth/password-input';
import { FormErrorCallout } from '@/components/auth/form-error-callout';
import { PALETTE, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { sanitizeAuthErrorMessage } from '@/lib/auth-errors';

export interface ForgotPasswordPageProps {
  initialSuccess?: boolean | undefined;
}

export default function ForgotPasswordPage({ initialSuccess = false }: ForgotPasswordPageProps = {}) {
  const router = useRouter();

  // Step state: 1 = email input, 2 = OTP + new password entry
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Loading & Submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(initialSuccess);
  const [cooldownSeconds, setCooldownSeconds] = useState(60);

  // Field-level error states
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [otpError, setOtpError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | undefined>(undefined);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [resendSuccessMessage, setResendSuccessMessage] = useState<string | null>(null);

  // Cooldown countdown effect
  useEffect(() => {
    if (step === 2 && cooldownSeconds > 0) {
      const timer = setInterval(() => {
        setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, cooldownSeconds]);

  // Step 1: Request OTP
  const handleRequestOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEmailError(undefined);
    setGeneralError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setEmailError('Please enter a valid Gmail address.');
      return;
    }
    const domain = cleanEmail.split('@')[1];
    if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
      setEmailError('Password recovery is available for @gmail.com (or @googlemail.com) accounts.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 400 && data.error) {
          setEmailError(sanitizeAuthErrorMessage(data.error));
          setIsSubmitting(false);
          return;
        }

        setGeneralError(
          sanitizeAuthErrorMessage(data.error, 'Failed to send verification code. Please try again.')
        );
        setIsSubmitting(false);
        return;
      }

      setStep(2);
      setCooldownSeconds(60);
      setGeneralError(null);
      setIsSubmitting(false);
    } catch {
      setGeneralError('Unable to process your request at this moment. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    if (cooldownSeconds > 0 || isResending) return;

    setIsResending(true);
    setGeneralError(null);
    setResendSuccessMessage(null);

    try {
      const res = await fetch('/api/auth/forgot-password/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.cooldownSecondsRemaining) {
          setCooldownSeconds(data.cooldownSecondsRemaining);
        }
        setGeneralError(sanitizeAuthErrorMessage(data.error, 'Unable to resend code right now.'));
        setIsResending(false);
        return;
      }

      setCooldownSeconds(60);
      setResendSuccessMessage('A fresh verification code has been dispatched. Any previous codes have been invalidated.');
      setIsResending(false);
    } catch {
      setGeneralError('Failed to resend code. Please check your connection.');
      setIsResending(false);
    }
  };

  // Step 2: Submit OTP & Reset Password
  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setOtpError(undefined);
    setPasswordError(undefined);
    setConfirmPasswordError(undefined);
    setGeneralError(null);
    setResendSuccessMessage(null);

    let hasError = false;
    const cleanOtp = otp.replace(/\D/g, '').trim();

    if (!cleanOtp) {
      setOtpError('Verification code is required.');
      hasError = true;
    } else if (cleanOtp.length !== 6) {
      setOtpError('Verification code must be exactly 6 digits.');
      hasError = true;
    }

    if (!password) {
      setPasswordError('New password is required.');
      hasError = true;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      hasError = true;
    } else if (password.length > 128) {
      setPasswordError('Password cannot exceed 128 characters.');
      hasError = true;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your new password.');
      hasError = true;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match. Please verify both password fields.');
      hasError = true;
    }

    if (hasError) return;

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: cleanOtp,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = sanitizeAuthErrorMessage(data.error, 'Failed to update password.');
        if (errorMsg.toLowerCase().includes('code') || errorMsg.toLowerCase().includes('attempt')) {
          setOtpError(errorMsg);
        } else if (errorMsg.toLowerCase().includes('password')) {
          setPasswordError(errorMsg);
        } else {
          setGeneralError(errorMsg);
        }
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      setIsSubmitting(false);

      const timer = setTimeout(() => {
        router.push('/login?reset=success');
      }, 2000);
      return () => clearTimeout(timer);
    } catch {
      setGeneralError('Unable to update your password at this moment. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout
      title={step === 1 ? 'Reset Password' : 'Set New Password'}
      description={
        step === 1
          ? 'Enter your registered Gmail address to receive a 6-digit verification code.'
          : `Enter the 6-digit verification code sent to ${email} and your new password.`
      }
      footer={
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-sub, #9ca3af)' }}>
          Remember your password?{' '}
          <Link
            href="/login"
            style={{
              color: PALETTE.primary,
              textDecoration: 'none',
              fontWeight: TYPOGRAPHY.weights.semibold,
            }}
          >
            Sign in
          </Link>
        </span>
      }
    >
      {isSuccess ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
          <Alert
            severity="success"
            title="Password Updated"
            message="Your password has been successfully reset. Redirecting you to sign in..."
          />
          <Link
            href="/login?reset=success"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              width: '100%',
            }}
          >
            <Button variant="primary" size="lg" style={{ width: '100%' }}>
              Proceed to Sign In
            </Button>
          </Link>
        </div>
      ) : step === 1 ? (
        <form onSubmit={handleRequestOtp} noValidate style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          <Input
            label="Email Address"
            type="email"
            placeholder="you@gmail.com"
            autoComplete="email"
            value={email}
            error={emailError}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(undefined);
              if (generalError) setGeneralError(null);
            }}
            disabled={isSubmitting}
            required
            helperText="We will send a 6-digit verification code to your registered Gmail address."
          />

          <FormErrorCallout message={generalError} style={{ marginTop: SPACING.xs }} />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            style={{ width: '100%', marginTop: SPACING.xs }}
          >
            Send Verification Code
          </Button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} noValidate style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          <Input
            label="Verification Code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            autoComplete="one-time-code"
            value={otp}
            error={otpError}
            onChange={(e) => {
              setOtp(e.target.value);
              if (otpError) setOtpError(undefined);
              if (generalError) setGeneralError(null);
            }}
            disabled={isSubmitting}
            required
            helperText="Enter the 6-digit numeric code sent to your email."
          />

          <PasswordInput
            label="New Password"
            placeholder="••••••••••••"
            autoComplete="new-password"
            value={password}
            error={passwordError}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError(undefined);
              if (generalError) setGeneralError(null);
            }}
            disabled={isSubmitting}
            required
            helperText="Minimum 8 characters"
          />

          <PasswordInput
            label="Confirm New Password"
            placeholder="••••••••••••"
            autoComplete="new-password"
            value={confirmPassword}
            error={confirmPasswordError}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (confirmPasswordError) setConfirmPasswordError(undefined);
              if (generalError) setGeneralError(null);
            }}
            disabled={isSubmitting}
            required
          />

          {resendSuccessMessage && (
            <div
              style={{
                fontSize: '0.8125rem',
                color: 'var(--success, #10b981)',
                marginTop: SPACING.xs,
              }}
            >
              {resendSuccessMessage}
            </div>
          )}

          <FormErrorCallout message={generalError} style={{ marginTop: SPACING.xs }} />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            style={{ width: '100%', marginTop: SPACING.xs }}
          >
            Update Password
          </Button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: SPACING.sm,
              fontSize: '0.8125rem',
            }}
          >
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={cooldownSeconds > 0 || isResending}
              style={{
                background: 'transparent',
                border: 'none',
                color: cooldownSeconds > 0 ? 'var(--text-dim, #6b7280)' : PALETTE.primary,
                cursor: cooldownSeconds > 0 ? 'not-allowed' : 'pointer',
                fontWeight: TYPOGRAPHY.weights.medium,
                padding: '4px 0',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {cooldownSeconds > 0 ? `Resend code (${cooldownSeconds}s)` : isResending ? 'Sending...' : 'Resend code'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setOtp('');
                setPassword('');
                setConfirmPassword('');
                setOtpError(undefined);
                setPasswordError(undefined);
                setConfirmPasswordError(undefined);
                setGeneralError(null);
                setResendSuccessMessage(null);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-sub, #9ca3af)',
                cursor: 'pointer',
                padding: '4px 0',
                textDecoration: 'underline',
              }}
            >
              Change email address
            </button>
          </div>
        </form>
      )}
    </AuthSplitLayout>
  );
}
