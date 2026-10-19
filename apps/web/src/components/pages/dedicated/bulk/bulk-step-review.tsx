'use client';

import React from 'react';
import { type PostFormat } from '@fbuploadpro/contracts';
import { type ComposerMediaItem } from '../composer/composer-media-area';
import {
  composerLabelStyle,
  composerHintStyle,
  composerErrorStyle,
  composerInputStyle,
} from '../composer/composer-styles';
import { COMPONENT_STYLES, SPACING, RADII, TYPOGRAPHY } from '@/lib/theme';
import { formatLabel, type BulkDestination } from './bulk-utils';

export interface BulkReviewRow {
  asset: ComposerMediaItem;
  caption: string;
  onCaptionChange: (caption: string) => void;
  onRemove: () => void;
  timeLabel: string;
  /** ISO timestamp sent to the API for this row. */
  scheduledISO: string;
}

export interface BulkReviewResult {
  assetId: string;
  assetName: string;
  thumbnailUrl?: string | null | undefined;
  ok: boolean;
  error?: string | undefined;
}

export interface BulkStepReviewProps {
  rows: BulkReviewRow[];
  format: PostFormat;
  destination: BulkDestination;
  isSubmitting: boolean;
  results: BulkReviewResult[] | null;
  onSubmit: () => void;
  onDone: () => void;
}

function rowThumbnail(asset: ComposerMediaItem): string | null {
  return asset.thumbnailUrl || asset.url || null;
}

export function BulkStepReview(props: Readonly<BulkStepReviewProps>) {
  const { rows, format, destination, isSubmitting, results, onSubmit, onDone } = props;

  // Summary state
  if (results) {
    const added = results.filter((r) => r.ok).length;
    const failed = results.length - added;
    const failures = results.filter((r) => !r.ok);
    const summaryNoun = results.length === 1 ? 'post' : 'posts';
    const summary =
      destination === 'queue'
        ? `${added} added to queue, ${failed} failed`
        : `${added} scheduled, ${failed} failed`;
    return (
      <div data-testid="bulk-summary" style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
        <p style={{ ...composerHintStyle, margin: 0, fontWeight: TYPOGRAPHY.weights.semibold }}>
          {summary} ({results.length} {summaryNoun}).
        </p>
        {failures.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            {failures.map((failure) => (
              <div
                key={failure.assetId}
                style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}
              >
                {failure.thumbnailUrl ? (
                  <img
                    src={failure.thumbnailUrl}
                    alt={failure.assetName}
                    style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: RADII.xs }}
                  />
                ) : (
                  <span style={{ ...composerHintStyle, margin: 0 }}>{failure.assetName}</span>
                )}
                <span data-testid={`bulk-result-error-${failure.assetId}`} style={composerErrorStyle}>
                  {failure.error || 'Could not add this post.'}
                </span>
              </div>
            ))}
          </div>
        )}
        <div>
          <button
            type="button"
            data-testid="bulk-summary-done-btn"
            onClick={onDone}
            style={{ ...COMPONENT_STYLES.primaryButton, padding: `${SPACING.xs} ${SPACING.lg}`, cursor: 'pointer' }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Review state
  const submitLabel =
    destination === 'queue'
      ? `Add ${rows.length} post${rows.length === 1 ? '' : 's'} to queue`
      : `Schedule ${rows.length} post${rows.length === 1 ? '' : 's'}`;

  return (
    <div data-testid="bulk-step-review" style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
      <span style={composerLabelStyle}>Review</span>
      <div
        data-testid="bulk-review-rows"
        style={{ display: 'flex', flexDirection: 'column', maxHeight: '320px', overflowY: 'auto' }}
      >
        {rows.map((row, index) => {
          const thumb = rowThumbnail(row.asset);
          return (
            <div
              key={row.asset.id}
              data-testid={`bulk-review-row-${row.asset.id}`}
              style={{
                display: 'flex',
                gap: SPACING.sm,
                alignItems: 'flex-start',
                padding: `${SPACING.sm} 0`,
                borderBottom: index === rows.length - 1 ? 'none' : '1px solid var(--border-subtle)',
              }}
            >
              {thumb ? (
                <img
                  src={thumb}
                  alt={row.asset.name}
                  style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: RADII.xs, flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: RADII.xs,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.6875rem',
                    color: 'var(--text-sub)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {formatLabel(format)}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: SPACING.xs, alignItems: 'baseline' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: TYPOGRAPHY.weights.semibold }}>
                    {formatLabel(format)}
                  </span>
                  <span style={composerHintStyle}>{row.timeLabel}</span>
                </div>
                <input
                  type="text"
                  aria-label={`Caption for ${row.asset.name}`}
                  data-testid={`bulk-row-caption-${row.asset.id}`}
                  value={row.caption}
                  maxLength={5000}
                  placeholder="Add a caption…"
                  onChange={(e) => row.onCaptionChange(e.target.value)}
                  style={{ ...composerInputStyle(), fontSize: '0.8125rem' }}
                />
              </div>
              <button
                type="button"
                data-testid={`bulk-row-remove-${row.asset.id}`}
                aria-label={`Remove ${row.asset.name}`}
                onClick={row.onRemove}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-sub)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  padding: '4px',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {rows.length === 0 && (
        <p style={{ ...composerHintStyle, margin: 0 }}>No posts left to add.</p>
      )}
      <div>
        <button
          type="button"
          data-testid="bulk-submit-btn"
          onClick={onSubmit}
          disabled={isSubmitting || rows.length === 0}
          style={{
            ...COMPONENT_STYLES.primaryButton,
            padding: `${SPACING.xs} ${SPACING.lg}`,
            cursor: isSubmitting || rows.length === 0 ? 'not-allowed' : 'pointer',
            opacity: isSubmitting || rows.length === 0 ? 0.7 : 1,
          }}
        >
          {isSubmitting ? `Adding ${rows.length} post${rows.length === 1 ? '' : 's'}…` : submitLabel}
        </button>
      </div>
    </div>
  );
}
