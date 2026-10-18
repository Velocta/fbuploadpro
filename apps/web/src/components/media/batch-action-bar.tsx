'use client';

import React from 'react';
import { THEME, PALETTE, RADII, TYPOGRAPHY } from '@/lib/theme';

export interface BatchActionBarProps {
  selectedIds: string[];
  totalAvailableCount?: number | undefined;
  onSelectAll?: (() => void) | undefined;
  onClearSelection?: () => void;
  onBatchMove?: () => void;
  onBatchCaption?: () => void;
  onBatchDelete?: () => void;
  isBusy?: boolean;
}

export function BatchActionBar({
  selectedIds,
  totalAvailableCount: _totalAvailableCount,
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

  return (
    <div
      data-testid="batch-action-bar"
      role="region"
      aria-label="Batch actions"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 16px',
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.18))',
        borderRadius: RADII.md,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(12px)',
        whiteSpace: 'nowrap',
      }}
    >
      {/* "n selected" */}
      <span
        data-testid="batch-selected-count"
        style={{
          fontSize: '0.8125rem',
          fontWeight: TYPOGRAPHY.weights.semibold,
          color: `var(--text-main, ${THEME.default.text.primary})`,
          fontVariantNumeric: TYPOGRAPHY.tabularNums,
        }}
      >
        {selectedIds.length} selected
      </span>

      {onSelectAll && (
        <button
          type="button"
          data-testid="batch-select-all-btn"
          tabIndex={-1}
          onClick={onSelectAll}
          style={{ display: 'none' }}
        >
          Select all
        </button>
      )}

      <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>·</span>

      {/* Move Action */}
      {onBatchMove && (
        <>
          <button
            type="button"
            data-testid="batch-move-btn"
            disabled={isBusy}
            onClick={onBatchMove}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: 0,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor: isBusy ? 'not-allowed' : 'pointer',
            }}
          >
            Move
          </button>
          <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>·</span>
        </>
      )}

      {/* Set Caption Action */}
      {onBatchCaption && (
        <>
          <button
            type="button"
            data-testid="batch-caption-btn"
            disabled={isBusy}
            onClick={onBatchCaption}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: 0,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor: isBusy ? 'not-allowed' : 'pointer',
            }}
          >
            Set caption
          </button>
          <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>·</span>
        </>
      )}

      {/* Delete Action */}
      {onBatchDelete && (
        <>
          <button
            type="button"
            data-testid="batch-delete-btn"
            disabled={isBusy}
            onClick={onBatchDelete}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: 0,
              color: PALETTE.accent3,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor: isBusy ? 'not-allowed' : 'pointer',
            }}
          >
            Delete
          </button>
          <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>·</span>
        </>
      )}

      {/* Clear Action */}
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
            color: `var(--text-dim, ${THEME.default.text.muted})`,
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            cursor: isBusy ? 'not-allowed' : 'pointer',
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
