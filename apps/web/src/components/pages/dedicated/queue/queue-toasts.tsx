'use client';

import React from 'react';
import { THEME, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { Button } from '@/components/ui/button';

export interface QueueToastAction {
  label: string;
  onClick: () => void;
}

export interface QueueToast {
  id: number;
  message: string;
  tone: 'success' | 'error';
  action?: QueueToastAction;
}

export interface QueueToastsProps {
  toasts: QueueToast[];
  onDismiss: (id: number) => void;
}

/** Bottom-center toast stack with optional action (e.g. Undo). */
export function QueueToasts({ toasts, onDismiss }: Readonly<QueueToastsProps>) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: SPACING.xl,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.sm,
        zIndex: 1100,
        alignItems: 'center',
        maxWidth: 'min(92vw, 480px)',
      }}
    >
      {toasts.map((toast) => (
        <output
          key={toast.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.md,
            padding: `${SPACING.sm} ${SPACING.md}`,
            borderRadius: RADII.sm,
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            boxShadow: `var(--shadow-modal, ${THEME.default.shadows.modal})`,
          }}
        >
          <span
            style={{
              fontSize: '0.8125rem',
              color: `var(--text-main, ${THEME.default.text.primary})`,
              fontWeight: TYPOGRAPHY.weights.medium,
            }}
          >
            {toast.message}
          </span>
          {toast.action && (
            <Button variant="link" size="sm" onClick={toast.action.onClick}>
              {toast.action.label}
            </Button>
          )}
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '1rem',
              lineHeight: 1,
              padding: '2px',
            }}
          >
            ×
          </button>
        </output>
      ))}
    </div>
  );
}
