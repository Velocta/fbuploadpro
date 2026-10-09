'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Button, Alert, StatusDot } from '@/components/ui';
import { deriveSubdomainFromEmail } from '@fbuploadpro/contracts';
import { PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const derivedSubdomain = useMemo(() => {
    return deriveSubdomainFromEmail(email);
  }, [email]);

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('Phone number is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('A valid email address is required.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

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
        setErrorMessage(data.error || 'Registration failed. Please check your details and try again.');
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
      <div style={{ maxWidth: '440px', width: '100%' }}>
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
                FBUploadPro <span style={{ color: PALETTE.primary }}>Workspace</span>
              </span>
              <StatusDot status="operational" label="Ready" />
            </div>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>
              Deploy your automated Facebook Reels & media publishing workspace.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {errorMessage && (
              <div style={{ marginBottom: SPACING.lg }}>
                <Alert
                  severity="error"
                  title="Registration Error"
                  message={errorMessage}
                  onClose={() => setErrorMessage(null)}
                />
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
              <Input
                label="Full Name"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                required
              />

              <Input
                label="Phone Number"
                type="tel"
                placeholder="+1 555 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isSubmitting}
                required
              />

              <Input
                label="Email Address"
                type="email"
                placeholder="jane.doe+reels@agency.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
                helperText="Dots and plus tags will be automatically stripped for your subdomain"
              />

              {/* Real-time Subdomain Derivation Preview */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACING.sm,
                  padding: '8px 12px',
                  borderRadius: RADII.sm,
                  backgroundColor: 'var(--bg-subtle, #121419)',
                  border: '1px solid var(--border-subtle, #1f242d)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-sub, #9ca3af)',
                }}
              >
                <StatusDot status="operational" />
                <span>
                  Workspace URL: <strong style={{ color: PALETTE.primary }}>{derivedSubdomain}</strong>.{rootDomain}
                </span>
              </div>

              <Input
                label="Password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
                helperText="Minimum 8 characters"
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                style={{ width: '100%', marginTop: SPACING.sm }}
              >
                Create Workspace
              </Button>
            </form>
          </CardContent>

          <CardFooter style={{ justifyContent: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim, #6b7280)' }}>
              Already have an account?{' '}
              <Link
                href="/login"
                style={{
                  color: PALETTE.primary,
                  textDecoration: 'none',
                  fontWeight: TYPOGRAPHY.weights.medium,
                }}
              >
                Sign in
              </Link>
            </span>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
