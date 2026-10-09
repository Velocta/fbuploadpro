'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Button, Alert, StatusDot } from '@/components/ui';
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
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.lg,
        backgroundColor: 'var(--bg-canvas, #000000)',
        color: 'var(--text-main, #ffffff)',
        fontFamily: TYPOGRAPHY.fontFamily,
      }}
    >
      <div style={{ maxWidth: '400px', width: '100%' }}>
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs }}>
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: TYPOGRAPHY.weights.bold,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-main)',
                }}
              >
                FBUploadPro <span style={{ color: PALETTE.primary }}>Gateway</span>
              </span>
              <StatusDot status="operational" label="Online" />
            </div>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your isolated workspace.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {errorMessage && (
              <div style={{ marginBottom: SPACING.lg }}>
                <Alert
                  severity="error"
                  title="Sign In Error"
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

              <Input
                label="Password"
                type="password"
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
          </CardContent>

          <CardFooter style={{ justifyContent: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim, #6b7280)' }}>
              Don&apos;t have an account?{' '}
              <Link
                href="/signup"
                style={{
                  color: PALETTE.primary,
                  textDecoration: 'none',
                  fontWeight: TYPOGRAPHY.weights.medium,
                }}
              >
                Create one
              </Link>
            </span>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
