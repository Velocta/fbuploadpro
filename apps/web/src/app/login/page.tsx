'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Input, Button } from '@/components/ui';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { PasswordInput } from '@/components/auth/password-input';
import { FormErrorCallout } from '@/components/auth/form-error-callout';
import { PALETTE, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { sanitizeAuthErrorMessage } from '@/lib/auth-errors';

interface FieldErrors {
  email?: string | undefined;
  password?: string | undefined;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [returnUrl, setReturnUrl] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ret = params.get('returnUrl');
      if (ret) {
        setReturnUrl(ret);
      }
    }
  }, []);

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

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      errors.email = 'Please enter a valid Gmail address.';
    } else {
      const domain = cleanEmail.split('@')[1];
      if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
        errors.email = 'Only @gmail.com (or @googlemail.com) accounts are supported.';
      }
    }

    if (!password) {
      errors.password = 'Please enter your password.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          returnUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403 && data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }

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

        setGeneralError(
          sanitizeAuthErrorMessage(data.error, 'Invalid email or password. Please try again.')
        );
        setIsSubmitting(false);
        return;
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch {
      setGeneralError('Unable to sign in at this moment. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout
      title="Sign In"
      description="Welcome back! Sign in to manage and publish your content across Facebook and Instagram."
      footer={
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-sub, #9ca3af)' }}>
          Don&apos;t have an account?{' '}
          <Link
            href={returnUrl ? `/signup?returnUrl=${encodeURIComponent(returnUrl)}` : '/signup'}
            style={{
              color: PALETTE.primary,
              textDecoration: 'none',
              fontWeight: TYPOGRAPHY.weights.semibold,
            }}
          >
            Create one
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
        <Input
          label="Email Address"
          type="email"
          placeholder="you@gmail.com"
          autoComplete="username"
          value={email}
          error={fieldErrors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearFieldError('email');
          }}
          disabled={isSubmitting}
          required
        />

        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: SPACING.xs,
            }}
          >
            <label
              style={{
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: 'var(--text-sub)',
                lineHeight: 1.25,
              }}
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              style={{
                fontSize: '0.8125rem',
                color: PALETTE.primary,
                textDecoration: 'none',
                fontWeight: TYPOGRAPHY.weights.medium,
              }}
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            placeholder="••••••••••••"
            autoComplete="current-password"
            value={password}
            error={fieldErrors.password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearFieldError('password');
            }}
            disabled={isSubmitting}
            required
            aria-label="Password"
          />
        </div>

        <FormErrorCallout message={generalError} style={{ marginTop: SPACING.xs }} />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          style={{ width: '100%', marginTop: SPACING.xs }}
        >
          Sign In
        </Button>
      </form>
    </AuthSplitLayout>
  );
}
