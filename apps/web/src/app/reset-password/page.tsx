'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Alert } from '@/components/ui';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { PasswordInput } from '@/components/auth/password-input';
import { FormErrorCallout } from '@/components/auth/form-error-callout';
import { PALETTE, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { sanitizeAuthErrorMessage } from '@/lib/auth-errors';

interface FieldErrors {
  password?: string | undefined;
  confirmPassword?: string | undefined;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const clearFieldError = (field: keyof FieldErrors) => {
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError(null);

    const errors: FieldErrors = {};

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    }

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
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 400 && data.error?.includes('at least 8 characters')) {
          setFieldErrors({ password: 'Password must be at least 8 characters long.' });
          setIsSubmitting(false);
          return;
        }

        setGeneralError(
          sanitizeAuthErrorMessage(data.error, 'Failed to update password. Your reset link may be expired.')
        );
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      setIsSubmitting(false);

      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch {
      setGeneralError('Unable to reset your password. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout
      title="Set New Password"
      description="Create a new, strong password to secure your account."
      footer={
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-sub, #9ca3af)' }}>
          Back to{' '}
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
            message="Your password has been reset successfully. Redirecting you to the sign in page..."
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
              Proceed to Sign In
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          <PasswordInput
            label="New Password"
            placeholder="••••••••••••"
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
            label="Confirm New Password"
            placeholder="••••••••••••"
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
            style={{ width: '100%', marginTop: SPACING.sm }}
          >
            Update Password
          </Button>
        </form>
      )}
    </AuthSplitLayout>
  );
}
