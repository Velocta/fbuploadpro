'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Input, Button, Alert } from '@/components/ui';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { PasswordInput } from '@/components/auth/password-input';
import { PALETTE, SPACING, TYPOGRAPHY } from '@/lib/theme';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [returnUrl, setReturnUrl] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ret = params.get('returnUrl');
      if (ret) {
        setReturnUrl(ret);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

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
        setErrorMessage(data.error || 'Invalid email or password. Please try again.');
        setIsSubmitting(false);
        return;
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch {
      setErrorMessage('An unexpected network error occurred. Please try again.');
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
            href="/signup"
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
      {errorMessage && (
        <div style={{ marginBottom: SPACING.lg }}>
          <Alert
            severity="error"
            title="Couldn't sign you in"
            message={errorMessage}
            onClose={() => setErrorMessage(null)}
          />
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
        <Input
          label="Email Address"
          type="email"
          placeholder="you@domain.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
          required
        />

        <PasswordInput
          label="Password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          style={{ width: '100%', marginTop: SPACING.sm }}
        >
          Sign In
        </Button>
      </form>
    </AuthSplitLayout>
  );
}
