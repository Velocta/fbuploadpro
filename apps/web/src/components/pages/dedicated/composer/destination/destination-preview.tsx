'use client';

import React from 'react';
import Image from 'next/image';
import type { DestinationMediaItem } from './destination-media';

export interface DestinationPreviewProps {
  destinationName: string;
  formatLabel: string;
  text: string;
  mediaItems: DestinationMediaItem[];
  testIdPrefix: string;
}

/**
 * Small, plain preview pane for the destination composers — a sanity
 * check, not a pixel-perfect replica (the Facebook preview's pattern).
 * Multi-item posts show the first item plus the item count.
 */
export function DestinationPreview({
  destinationName,
  formatLabel,
  text,
  mediaItems,
  testIdPrefix,
}: Readonly<DestinationPreviewProps>) {
  const firstMedia = mediaItems.at(0);
  const thumb = firstMedia ? firstMedia.thumbnailUrl || firstMedia.url : undefined;
  return (
    <div data-testid={`${testIdPrefix}-preview`} className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">Preview</span>
      <div className="flex flex-col gap-3 border-t border-line pt-3">
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-metadata font-semibold text-ink"
          >
            {destinationName.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-body font-semibold text-ink">
              {destinationName}
            </span>
            <span className="text-metadata text-ink-sub">
              {formatLabel}
              {mediaItems.length > 1 ? ` · ${mediaItems.length} items` : ''}
            </span>
          </div>
        </div>

        {text.trim() && (
          <p
            data-testid={`${testIdPrefix}-preview-text`}
            className="line-clamp-4 m-0 text-body break-words whitespace-pre-wrap text-ink"
          >
            {text}
          </p>
        )}

        {thumb && (
          <Image
            data-testid={`${testIdPrefix}-preview-thumbnail`}
            src={thumb}
            alt=""
            width={640}
            height={220}
            unoptimized
            className="max-h-56 w-full rounded-sm border border-line object-cover"
          />
        )}

        {!text.trim() && !thumb && (
          <p className="m-0 text-metadata text-ink-sub">Nothing to preview yet.</p>
        )}
      </div>
    </div>
  );
}
