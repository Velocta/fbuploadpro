'use client';

import React from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY, COMPONENT_STYLES } from '@/lib/theme';

export interface BatchActionBarProps {
  selectedIds: string[];
  totalAvailableCount?: number;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onBatchMove?: () => void;
  onBatchCaption?: () => void;
  onBatchDelete?: () => void;
  isBusy?: boolean;
}

export function BatchActionBar({
  selectedIds,
  totalAvailableCount = 0,
  onSelectAll,
  onClearSelection,
  onBatchMove,
  onBatchCaption,
  onBatchDelete,
  isBusy = false,
}: Readonly<BatchActionBarProps>) {
  if (selectedIds.length === 0) {
    return null;
  }

  const allSelected =
    totalAvailableCount > 0 && selectedIds.length >= totalAvailableCount;

  return (
    <div
      data-testid="batch-action-bar"
      role="region"
      aria-label="Batch selection actions"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: SPACING.md,
        padding: `${SPACING.sm} ${SPACING.md}`,
        marginBottom: SPACING.lg,
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: `1px solid ${PALETTE.primary}`,
        borderRadius: RADII.md,
        boxShadow: `var(--shadow-elevated, ${THEME.default.shadows.elevated})`,
      }}
    >
      {/* Left: Selection Count & Select All / Clear Selection */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          flexWrap: 'wrap',
        }}
      >
        <span
          data-testid="batch-selected-count"
          style={{
            fontSize: '0.875rem',
            fontWeight: TYPOGRAPHY.weights.bold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
            fontVariantNumeric: TYPOGRAPHY.tabularNums,
          }}
        >
          {selectedIds.length} selected
        </span>

        {onSelectAll && !allSelected && (
          <button
            type="button"
            data-testid="batch-select-all-btn"
            disabled={isBusy}
            onClick={onSelectAll}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: 0,
              color: PALETTE.primary,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: isBusy ? 'not-allowed' : 'pointer',
            }}
          >
            Select all
          </button>
        )}

        {onClearSelection && (
          <button
            type="button"
            data-testid="batch-clear-btn"
            disabled={isBusy}
            onClick={onClearSelection}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: 0,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor: isBusy ? 'not-allowed' : 'pointer',
            }}
          >
            Clear selection
          </button>
        )}
      </div>

      {/* Right: Batch Actions (Move to Folder, Set Caption, Delete) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.sm,
          flexWrap: 'wrap',
        }}
      >
        {onBatchMove && (
          <button
            type="button"
            data-testid="batch-move-btn"
            disabled={isBusy}
            onClick={onBatchMove}
            style={{
              ...COMPONENT_STYLES.secondaryButton(THEME.default),
              height: '32px',
              padding: `0 ${SPACING.md}`,
              fontSize: '0.8125rem',
              color: `var(--text-main, ${THEME.default.text.primary})`,
              borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
            }}
          >
            Move to folder
          </button>
        )}

        {onBatchCaption && (
          <button
            type="button"
            data-testid="batch-caption-btn"
            disabled={isBusy}
            onClick={onBatchCaption}
            style={{
              ...COMPONENT_STYLES.secondaryButton(THEME.default),
              height: '32px',
              padding: `0 ${SPACING.md}`,
              fontSize: '0.8125rem',
              color: `var(--text-main, ${THEME.default.text.primary})`,
              borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
            }}
          >
            Set caption
          </button>
        )}

        {onBatchDelete && (
          <button
            type="button"
            data-testid="batch-delete-btn"
            disabled={isBusy}
            onClick={onBatchDelete}
            style={{
              height: '32px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: PALETTE.accent3,
              color: PALETTE.text,
              border: 'none',
              borderRadius: RADII.sm,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: isBusy ? 'not-allowed' : 'pointer',
            }}
          >
            Delete selected
          </button>
        )}
      </div>
    </div>
  );
}
