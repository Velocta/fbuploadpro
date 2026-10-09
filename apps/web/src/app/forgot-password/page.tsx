'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Input, Button, Alert } from '@/components/ui';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { FormErrorCallout } from '@/components/auth/form-error-callout';
import { PALETTE, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { sanitizeAuthErrorMessage } from '@/lib/auth-errors';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 400 && data.error) {
          setEmailError(sanitizeAuthErrorMessage(data.error));
          setIsSubmitting(false);
          return;
        }

        setGeneralError(
          sanitizeAuthErrorMessage(data.error, 'Failed to send recovery link. Please try again.')
        );
        setIsSubmitting(false);
        return;
      }

      setIsSubmitted(true);
      setIsSubmitting(false);
    } catch {
      setGeneralError('Unable to process your request at this moment. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout
      title="Reset Password"
      description="Enter your registered email address and we'll send you a secure recovery link."
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
      {isSubmitted ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
          <Alert
            severity="info"
            title="Check your inbox"
            message={`If an account is associated with ${email}, we have sent instructions to reset your password.`}
          />

          <Link
            href="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              width: '100%',
            }}
          >
            <Button variant="primary" size="lg" style={{ width: '100%' }}>
              Return to Sign In
            </Button>
          </Link>

          <button
            type="button"
            onClick={() => {
              setIsSubmitted(false);
              setEmail('');
              setEmailError(undefined);
              setGeneralError(null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim, #6b7280)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              textAlign: 'center',
              padding: '10px 12px',
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
            }}
          >
            Try a different email address
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
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
            helperText="We will send a password reset link to your registered Gmail address."
          />

          <FormErrorCallout message={generalError} style={{ marginTop: SPACING.xs }} />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            style={{ width: '100%', marginTop: SPACING.xs }}
          >
            Send Recovery Link
          </Button>
        </form>
      )}
    </AuthSplitLayout>
  );
}
