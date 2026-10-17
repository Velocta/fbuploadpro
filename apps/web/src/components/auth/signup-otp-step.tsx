'use client';

import React, { useState, useEffect } from 'react';
import { Input, Button, Alert } from '@/components/ui';
import { FormErrorCallout } from '@/components/auth/form-error-callout';
import { PALETTE, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { sanitizeAuthErrorMessage } from '@/lib/auth-errors';
import { sanitizeAuthRedirectUrl } from '@/lib/auth-redirect';
import { completeAuthRedirect } from '@/lib/auth-broadcast';

export interface SignupOtpStepProps {
  readonly email: string;
  readonly returnUrl?: string | undefined;
  readonly initialCooldown?: number | undefined;
  readonly onBack: () => void;
}

export function getResendButtonText(resendCooldown: number, isResending: boolean): string {
  if (resendCooldown > 0) {
    return `Resend code in ${resendCooldown}s`;
  }
  if (isResending) {
    return 'Sending fresh code...';
  }
  return 'Did not receive code? Resend';
}

export function SignupOtpStep({
  email,
  returnUrl,
  initialCooldown = 60,
  onBack,
}: Readonly<SignupOtpStepProps>) {
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(initialCooldown);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleOtpSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError(null);
    setSuccessNotice(null);

    const cleanOtp = otp.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      setOtpError('Please enter the complete 6-digit verification code.');
      return;
    }

    setOtpError(null);
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
        setOtpError(
          sanitizeAuthErrorMessage(
            data.error,
            'Invalid or expired verification code. Please try again.'
          )
        );
        setIsSubmitting(false);
        return;
      }

      if (data.redirectUrl) {
        completeAuthRedirect(data.redirectUrl, data.user);
      }
    } catch {
      setGeneralError(
        'Unable to verify code at this moment. Please check your connection and try again.'
      );
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;

    setGeneralError(null);
    setSuccessNotice(null);
    setOtpError(null);
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
    <form
      onSubmit={handleOtpSubmit}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}
    >
      {successNotice && (
        <Alert
          severity="success"
          title="Code Sent"
          message={successNotice}
          onClose={() => setSuccessNotice(null)}
        />
      )}

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
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              color: 'var(--text-main, #f3f4f6)',
            }}
          >
            {email}
          </span>
        </div>
        <button
          type="button"
          onClick={onBack}
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
          error={otpError || undefined}
          onChange={(e) => {
            setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
            if (otpError) setOtpError(null);
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
        {otpError && otpError.toLowerCase().includes('expired') && (
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

      <div style={{ textAlign: 'center', marginTop: SPACING.xs }}>
        <button
          type="button"
          onClick={handleResendOtp}
          disabled={resendCooldown > 0 || isResending}
          style={{
            background: 'transparent',
            border: 'none',
            color: resendCooldown > 0 ? 'var(--text-dim, #6b7280)' : PALETTE.primary,
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            cursor: resendCooldown > 0 ? 'default' : 'pointer',
            padding: '4px 8px',
            textDecoration: resendCooldown > 0 ? 'none' : 'underline',
          }}
        >
          {getResendButtonText(resendCooldown, isResending)}
        </button>
      </div>
    </form>
  );
}
