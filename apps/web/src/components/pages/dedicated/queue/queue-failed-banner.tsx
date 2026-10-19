'use client';

import React from 'react';
import { THEME, PALETTE, SPACING, TYPOGRAPHY, COMPONENT_STYLES } from '@/lib/theme';
import { Button } from '@/components/ui/button';

export interface QueueFailedBannerProps {
  count: number;
  onReview: () => void;
}

/** Full-width notice strip shown while failed posts need attention. */
export function QueueFailedBanner({ count, onReview }: Readonly<QueueFailedBannerProps>) {
  if (count <= 0) return null;
  return (
    <div
      role="alert"
      data-testid="queue-failed-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.md,
        padding: `${SPACING.sm} 0`,
        borderTop: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
        <span aria-hidden="true" style={COMPONENT_STYLES.statusDot('critical')} />
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          {count} {count === 1 ? 'post' : 'posts'} failed to publish.
        </span>
      </div>
      <Button
        variant="link"
        size="sm"
        onClick={onReview}
        style={{ color: PALETTE.accent3 }}
      >
        Review
      </Button>
    </div>
  );
}
