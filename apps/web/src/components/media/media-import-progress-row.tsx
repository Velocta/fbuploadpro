'use client';

import React from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import {
  type ImportQueueItem,
  formatBytes,
} from './media-types';

export interface ImportProgressRowProps {
  item: ImportQueueItem;
  destinationFolderName: string;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}

export function ImportProgressRow({
  item,
  destinationFolderName,
  onPause,
  onResume,
  onCancel,
  onRetry,
}: Readonly<ImportProgressRowProps>) {
  const isQueued = item.status === 'queued';
  const isUploading = item.status === 'uploading';
  const isCompleted = item.status === 'completed';
  const isFailed = item.status === 'failed';
  const isPaused = item.status === 'paused';
  const isCancelled = item.status === 'cancelled';

  return (
    <div
      data-testid={`import-row-${item.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${SPACING.xs} ${SPACING.sm}`,
        backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
        border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
        borderRadius: RADII.xs,
        gap: SPACING.sm,
        opacity: isCancelled ? 0.45 : 1,
      }}
    >
      {/* 46px Thumbnail & File Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.sm,
          overflow: 'hidden',
          flex: 1,
        }}
      >
        <div
          style={{
            width: '46px',
            height: '46px',
            minWidth: '46px',
            borderRadius: RADII.xs,
            overflow: 'hidden',
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {item.mediaType === 'image' && item.previewUrl ? (
            <img
              src={item.previewUrl}
              alt={item.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={PALETTE.primary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {item.mediaType === 'video' ? (
                <>
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </>
              ) : (
                <>
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </>
              )}
            </svg>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <span
            title={item.name}
            style={{
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.name}
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              fontVariantNumeric: TYPOGRAPHY.tabularNums,
            }}
          >
            {formatBytes(item.size)}
          </span>
        </div>
      </div>

      {/* Row Status & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
        {isQueued && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: `var(--text-dim, ${THEME.default.text.muted})` }}>
              queued
            </span>
            <button
              type="button"
              data-testid={`cancel-queued-${item.id}`}
              onClick={() => onCancel(item.id)}
              aria-label={`Cancel ${item.name}`}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                cursor: 'pointer',
                padding: '2px',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {isUploading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '130px' }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  width: '100%',
                  height: '4px',
                  backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${item.progressPercent}%`,
                    height: '100%',
                    backgroundColor: PALETTE.primary,
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  fontVariantNumeric: TYPOGRAPHY.tabularNums,
                }}
              >
                {item.progressPercent}%
              </span>
            </div>
            <button
              type="button"
              data-testid={`pause-upload-${item.id}`}
              onClick={() => onPause(item.id)}
              aria-label={`Pause ${item.name}`}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                cursor: 'pointer',
                fontSize: '0.6875rem',
              }}
            >
              Pause
            </button>
            <button
              type="button"
              data-testid={`cancel-upload-${item.id}`}
              onClick={() => onCancel(item.id)}
              aria-label={`Cancel ${item.name}`}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                cursor: 'pointer',
                fontSize: '0.6875rem',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {isPaused && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '130px' }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  width: '100%',
                  height: '4px',
                  backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${item.progressPercent}%`,
                    height: '100%',
                    backgroundColor: `var(--text-dim, ${THEME.default.text.muted})`,
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  fontVariantNumeric: TYPOGRAPHY.tabularNums,
                }}
              >
                {item.progressPercent}%
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: `var(--text-dim, ${THEME.default.text.muted})` }}>
              paused
            </span>
            <button
              type="button"
              data-testid={`resume-upload-${item.id}`}
              onClick={() => onResume(item.id)}
              style={{
                padding: '2px 6px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                borderRadius: RADII.xs,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.6875rem',
                cursor: 'pointer',
              }}
            >
              Resume
            </button>
            <button
              type="button"
              data-testid={`cancel-paused-${item.id}`}
              onClick={() => onCancel(item.id)}
              aria-label={`Cancel ${item.name}`}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                cursor: 'pointer',
                fontSize: '0.6875rem',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {isCompleted && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                color: PALETTE.accent2,
                fontWeight: TYPOGRAPHY.weights.medium,
              }}
            >
              uploaded to {destinationFolderName}
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={PALETTE.accent2}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}

        {isFailed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: PALETTE.accent3 }}>
              {item.validationError || 'failed — retry'}
            </span>
            <button
              type="button"
              data-testid={`retry-upload-${item.id}`}
              onClick={() => onRetry(item.id)}
              style={{
                padding: '2px 6px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                borderRadius: RADII.xs,
                color: PALETTE.primary,
                fontSize: '0.6875rem',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {isCancelled && (
          <span style={{ fontSize: '0.75rem', color: `var(--text-dim, ${THEME.default.text.muted})` }}>
            cancelled
          </span>
        )}
      </div>
    </div>
  );
}