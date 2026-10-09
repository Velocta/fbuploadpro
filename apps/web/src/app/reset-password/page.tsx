'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Alert } from '@/components/ui';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { PALETTE, SPACING, TYPOGRAPHY } from '@/lib/theme';

export default function ResetPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    // Gracefully route visitors to the unified OTP recovery interface
    const timer = setTimeout(() => {
      router.replace('/forgot-password');
    }, 1500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <AuthSplitLayout
      title="Password Recovery"
      description="Password recovery is now managed securely with a 6-digit verification code."
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
        <Alert
          severity="info"
          title="Redirecting to Password Recovery"
          message="Password recovery is now handled directly using a 6-digit code. Redirecting you to the recovery page..."
        />
        <Link
          href="/forgot-password"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            width: '100%',
          }}
        >
          <Button variant="primary" size="lg" style={{ width: '100%' }}>
            Go to Password Recovery
          </Button>
        </Link>
      </div>
    </AuthSplitLayout>
  );
}
