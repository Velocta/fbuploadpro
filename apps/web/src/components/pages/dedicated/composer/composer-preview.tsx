'use client';

import React from 'react';
import { type PostFormat } from '@fbuploadpro/contracts';
import {
  composerLabelStyle,
  composerHintStyle,
  composerFieldStyle,
} from './composer-styles';
import { SPACING, RADII, THEME, TYPOGRAPHY } from '@/lib/theme';
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
    <div data-testid="composer-preview" style={composerFieldStyle}>
      <span style={composerLabelStyle}>Preview</span>
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: SPACING.sm,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.sm,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            {pageName.charAt(0).toUpperCase() || 'P'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: TYPOGRAPHY.weights.semibold, color: `var(--text-main, ${THEME.default.text.primary})` }}>
              {pageName}
            </span>
            <span style={composerHintStyle}>{FORMAT_LABELS[format]}</span>
          </div>
        </div>

        {caption.trim() && (
          <p
            data-testid="composer-preview-caption"
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: `var(--text-main, ${THEME.default.text.primary})`,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {caption}
          </p>
        )}

        {thumb && (
          <img
            data-testid="composer-preview-thumbnail"
            src={thumb}
            alt=""
            style={{
              width: '100%',
              maxHeight: '220px',
              objectFit: 'cover',
              borderRadius: RADII.sm,
              border: '1px solid var(--border-subtle)',
            }}
          />
        )}

        {linkDomain && (
          <span data-testid="composer-preview-link" style={composerHintStyle}>
            {linkDomain}
          </span>
        )}

        {!caption.trim() && !thumb && (
          <p style={{ ...composerHintStyle, margin: 0 }}>Nothing to preview yet.</p>
        )}
      </div>
    </div>
  );
}
