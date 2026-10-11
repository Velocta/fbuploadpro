'use client';

import React from 'react';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
} from '@/lib/theme';

export interface PagesEmptyStateProps {
  onAddPage: () => void;
}

export function PagesEmptyState({
  onAddPage,
}: Readonly<PagesEmptyStateProps>) {
  return (
    <div
      data-testid="pages-empty-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '64px 24px',
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderRadius: RADII.md,
        boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
        maxWidth: '560px',
        margin: '40px auto',
      }}
    >
      {/* Pages Icon Emblem */}
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: RADII.full,
          backgroundColor: PALETTE.primary,
          color: PALETTE.background,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: TYPOGRAPHY.weights.bold,
          fontSize: '1.25rem',
          marginBottom: SPACING.md,
          userSelect: 'none',
        }}
      >
        PG
      </div>

      <h2
        style={{
          margin: `0 0 ${SPACING.xs} 0`,
          fontSize: '1.25rem',
          fontWeight: TYPOGRAPHY.weights.bold,
          color: `var(--text-main, ${THEME.default.text.primary})`,
        }}
      >
        No Facebook Pages added yet
      </h2>

      <p
        style={{
          margin: `0 0 ${SPACING.xl} 0`,
          fontSize: '0.875rem',
          lineHeight: 1.5,
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          maxWidth: '420px',
        }}
      >
        Choose one of your connected Facebook accounts and select the pages you
        want to manage and publish reels to.
      </p>

      <button
        type="button"
        data-testid="empty-state-add-page-btn"
        onClick={onAddPage}
        style={{
          ...COMPONENT_STYLES.primaryButton,
          display: 'inline-flex',
          alignItems: 'center',
          gap: SPACING.xs,
          padding: `0 ${SPACING.lg}`,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>Add Page</span>
      </button>
    </div>
  );
}
