'use client';

import React from 'react';
import Image from 'next/image';
import { type PostFormat } from '@fbuploadpro/contracts';
import { type ComposerMediaItem } from '../composer/composer-media-area';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import { formatLabel, pluralize, type BulkDestination } from './bulk-utils';

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

  // Summary state (UI Rule 26: the bulk flow ends on an engineered summary,
  // with per-row errors and failed rows named — never all-or-nothing silence).
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
      <div data-testid="bulk-summary" className="flex flex-col gap-4">
        <p className="m-0 text-body font-semibold text-ink">
          {summary} ({results.length} {summaryNoun}).
        </p>
        {failures.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {failures.map((failure) => (
              <div key={failure.assetId} className="flex items-center gap-3">
                {failure.thumbnailUrl ? (
                  <Image
                    src={failure.thumbnailUrl}
                    alt={failure.assetName}
                    width={80}
                    height={80}
                    unoptimized
                    className="size-10 shrink-0 rounded-sm object-cover"
                  />
                ) : (
                  <span className="text-metadata text-ink-sub">{failure.assetName}</span>
                )}
                <span
                  data-testid={`bulk-result-error-${failure.assetId}`}
                  className="text-metadata font-medium text-brand-rose"
                >
                  {failure.error || 'Could not add this post.'}
                </span>
              </div>
            ))}
          </div>
        )}
        <div>
          <Button data-testid="bulk-summary-done-btn" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  // Review state
  const postNoun = pluralize(rows.length, 'post', 'posts');
  const submitLabel =
    destination === 'queue'
      ? `Add ${rows.length} ${postNoun} to queue`
      : `Schedule ${rows.length} ${postNoun}`;

  return (
    <div data-testid="bulk-step-review" className="flex flex-col gap-4">
      <span className="text-body font-medium text-ink">Review</span>
      <div data-testid="bulk-review-rows" className="flex max-h-80 flex-col overflow-y-auto">
        {rows.map((row, index) => {
          const thumb = rowThumbnail(row.asset);
          return (
            <div
              key={row.asset.id}
              data-testid={`bulk-review-row-${row.asset.id}`}
              className={
                index === rows.length - 1
                  ? 'flex items-start gap-3 py-3'
                  : 'flex items-start gap-3 border-b border-line py-3'
              }
            >
              {thumb ? (
                <Image
                  src={thumb}
                  alt={row.asset.name}
                  width={96}
                  height={96}
                  unoptimized
                  className="size-12 shrink-0 rounded-sm object-cover"
                />
              ) : (
                <div className="flex size-12 shrink-0 items-center justify-center rounded-sm border border-line text-metadata text-ink-sub">
                  {formatLabel(format)}
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="text-body font-semibold text-ink">{formatLabel(format)}</span>
                  <span className="text-metadata text-ink-sub">{row.timeLabel}</span>
                </div>
                <Input
                  type="text"
                  aria-label={`Caption for ${row.asset.name}`}
                  data-testid={`bulk-row-caption-${row.asset.id}`}
                  value={row.caption}
                  maxLength={5000}
                  placeholder="Add a caption…"
                  onChange={(e) => row.onCaptionChange(e.target.value)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                data-testid={`bulk-row-remove-${row.asset.id}`}
                aria-label={`Remove ${row.asset.name}`}
                onClick={row.onRemove}
              >
                ×
              </Button>
            </div>
          );
        })}
      </div>
      {rows.length === 0 && <p className="m-0 text-metadata text-ink-sub">No posts left to add.</p>}
      {isSubmitting && (
        <p role="status" className="m-0 text-metadata text-ink-sub">
          Adding {rows.length} {postNoun}…
        </p>
      )}
      <div>
        <Button
          data-testid="bulk-submit-btn"
          onClick={onSubmit}
          disabled={isSubmitting || rows.length === 0}
          loading={isSubmitting}
        >
          {isSubmitting ? `Adding ${rows.length} ${postNoun}…` : submitLabel}
        </Button>
      </div>
    </div>
  );
}
