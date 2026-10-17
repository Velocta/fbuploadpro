'use client';

import React from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface LeavePageGuardDialogProps {
  isOpen: boolean;
  activeUploadsCount: number;
  furthestAlongFile: { name: string; progressPercent: number } | null;
  onStay: () => void;
  onLeaveAnyway: () => void;
}

export function LeavePageGuardDialog({
  isOpen,
  activeUploadsCount,
  furthestAlongFile,
  onStay,
  onLeaveAnyway,
}: Readonly<LeavePageGuardDialogProps>) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-guard-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: SPACING.md,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid var(--border-strong, ${THEME.default.borders.strong})`,
          borderRadius: RADII.md,
          padding: SPACING.xl,
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.md,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
          <h2
            id="leave-guard-title"
            style={{
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Uploads still in progress
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              lineHeight: 1.45,
            }}
          >
            Leaving now will cancel {activeUploadsCount} upload{activeUploadsCount === 1 ? '' : 's'} — they'll be lost and you'll need to start over.
          </p>

          {furthestAlongFile && (
            <div
              style={{
                marginTop: SPACING.xs,
                padding: `${SPACING.xs} ${SPACING.sm}`,
                backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                borderRadius: RADII.xs,
                fontSize: '0.8125rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontVariantNumeric: TYPOGRAPHY.tabularNums,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {furthestAlongFile.name} · {Math.round(furthestAlongFile.progressPercent)}%
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: SPACING.sm,
            marginTop: SPACING.sm,
          }}
        >
          <button
            type="button"
            onClick={onLeaveAnyway}
            style={{
              padding: `${SPACING.xs} ${SPACING.md}`,
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: RADII.xs,
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor: 'pointer',
            }}
          >
            Leave anyway
          </button>
          <button
            type="button"
            onClick={onStay}
            style={{
              padding: `${SPACING.xs} ${SPACING.lg}`,
              backgroundColor: PALETTE.primary,
              border: 'none',
              borderRadius: RADII.xs,
              color: '#000000',
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: 'pointer',
            }}
          >
            Stay on this page
          </button>
        </div>
      </div>
    </div>
  );
}
