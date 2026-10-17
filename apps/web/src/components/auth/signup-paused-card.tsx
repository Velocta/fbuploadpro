'use client';

import React from 'react';
import Link from 'next/link';
import { PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { Button } from '@/components/ui';
import { buildWhatsAppSupportUrl } from '@/lib/whatsapp';

export interface SignupPausedCardProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Notice card displayed on /signup when registrations are temporarily paused.
 * Directs visitors to the workspace sign-in flow and provides support access.
 */
export const SignupPausedCard: React.FC<SignupPausedCardProps> = ({
  className,
  style,
}) => {
  const whatsAppUrl = buildWhatsAppSupportUrl({
    message: 'Hi! I am inquiring about account registration and early access for FBUploadPro.',
  });

  return (
    <div
      className={className}
      data-testid="signup-paused-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.xl,
        width: '100%',
        ...style,
      }}
    >
      {/* Notice Banner */}
      <div
        style={{
          backgroundColor: '#121722',
          border: '1px solid #1f2736',
          borderLeft: `3px solid ${PALETTE.primary}`,
          borderRadius: RADII.sm,
          padding: `${SPACING.lg} ${SPACING.xl}`,
        }}
      >
        <h3
          style={{
            margin: `0 0 ${SPACING.xs} 0`,
            fontSize: '0.9375rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: PALETTE.text,
            lineHeight: 1.4,
          }}
        >
          New registrations are currently closed
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: '#94a3b8',
            lineHeight: 1.55,
          }}
        >
          We are temporarily not accepting new account registrations while performing platform scaling. Existing operators can continue to access their workspaces normally.
        </p>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.md,
        }}
      >
        <Link href="/login" style={{ textDecoration: 'none', width: '100%' }}>
          <Button
            type="button"
            variant="primary"
            style={{
              width: '100%',
              paddingTop: '12px',
              paddingBottom: '12px',
              fontSize: '0.9375rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
            }}
          >
            Sign in to workspace
          </Button>
        </Link>

        {whatsAppUrl && (
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: `${SPACING.sm} ${SPACING.md}`,
              fontSize: '0.8125rem',
              color: '#94a3b8',
              textDecoration: 'none',
              transition: 'color 150ms ease',
              textAlign: 'center',
            }}
          >
            Need early access? Contact customer support on WhatsApp
          </a>
        )}
      </div>
    </div>
  );
};
