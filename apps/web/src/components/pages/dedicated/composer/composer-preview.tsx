'use client';

import React from 'react';
import Image from 'next/image';
import { type PostFormat } from '@fbuploadpro/contracts';
import type { ComposerMediaItem } from './composer-media-area';
import { FORMAT_LABELS } from './format-labels';

/**
 * Media shown in the preview, derived from the CURRENT format: text posts
 * publish no media, so retained media from a previous format never leaks
 * into a text preview.
 */
export function getPreviewMedia(
  format: PostFormat,
  mediaItems: ComposerMediaItem[]
): ComposerMediaItem | undefined {
  if (format === 'text') return undefined;
  return mediaItems.at(0);
}

export interface ComposerPreviewProps {
  pageName: string;
  format: PostFormat;
  caption: string;
  link: string;
  mediaItems: ComposerMediaItem[];
}

/** Small, plain preview pane — a sanity check, not a pixel-perfect replica. */
export function ComposerPreview({
  pageName,
  format,
  caption,
  link,
  mediaItems,
}: Readonly<ComposerPreviewProps>) {
  const firstMedia = getPreviewMedia(format, mediaItems);
  const thumb = firstMedia ? firstMedia.thumbnailUrl || firstMedia.url : undefined;
  const trimmedLink = link.trim();
  let linkDomain: string | null = null;
  if (trimmedLink) {
    try {
      linkDomain = new URL(trimmedLink).hostname;
    } catch {
      linkDomain = null;
    }
  }

  return (
    <div data-testid="composer-preview" className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">Preview</span>
      <div className="flex flex-col gap-3 border-t border-line pt-3">
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-metadata font-semibold text-ink"
          >
            {pageName.charAt(0).toUpperCase() || 'P'}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-body font-semibold text-ink">{pageName}</span>
            <span className="text-metadata text-ink-sub">{FORMAT_LABELS[format]}</span>
          </div>
        </div>

        {caption.trim() && (
          <p
            data-testid="composer-preview-caption"
            className="line-clamp-4 m-0 text-body break-words whitespace-pre-wrap text-ink"
          >
            {caption}
          </p>
        )}

        {thumb && (
          <Image
            data-testid="composer-preview-thumbnail"
            src={thumb}
            alt=""
            width={640}
            height={220}
            unoptimized
            className="max-h-56 w-full rounded-sm border border-line object-cover"
          />
        )}

        {linkDomain && (
          <span data-testid="composer-preview-link" className="text-metadata text-ink-sub">
            {linkDomain}
          </span>
        )}

        {!caption.trim() && !thumb && (
          <p className="m-0 text-metadata text-ink-sub">Nothing to preview yet.</p>
        )}
      </div>
    </div>
  );
}
