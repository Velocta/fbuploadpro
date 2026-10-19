'use client';

import React from 'react';
import type {
  DownloaderSourcePlatform,
  MediaFolder,
  MediaItemResponse,
} from '@fbuploadpro/contracts';
import {
  THEME,
  RADII,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
} from '@/lib/theme';
import { formatFolderAncestryPath } from '@/components/media/media-library-explorer';
import { deriveDefaultCaption, formatBytes } from '@/lib/upload-queue-helpers';
import type { DownloaderSavedEntry } from './media-downloader';

/**
 * Saved-item row for the downloader results list, extracted from
 * media-downloader.tsx. No behavior changes — moved verbatim.
 */

export function formatPlatformLabel(platform: DownloaderSourcePlatform): string {
  switch (platform) {
    case 'tiktok':
      return 'TikTok';
    case 'facebook':
      return 'Facebook';
    case 'instagram':
      return 'Instagram';
    case 'x':
      return 'X';
    case 'youtube':
      return 'YouTube';
    case 'google_drive':
      return 'Google Drive';
    case 'dropbox':
      return 'Dropbox';
    case 'direct':
      return 'Direct Media';
    default:
      return 'Web Link';
  }
}

function renderSavedItemPreview(item: MediaItemResponse, previewSrc: string | null) {
  if (!previewSrc) {
    return (
      <span
        style={{
          fontSize: '0.6875rem',
          fontWeight: TYPOGRAPHY.weights.semibold,
          color: `var(--text-dim, ${THEME.default.text.muted})`,
          textTransform: 'uppercase',
        }}
      >
        {item.mediaType}
      </span>
    );
  }

  if (item.mediaType === 'video' && !item.thumbnailUrl) {
    return (
      <video
        src={previewSrc}
        muted
        playsInline
        preload="metadata"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    );
  }

  return (
    <img
      src={previewSrc}
      alt={item.name}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  );
}


export function DownloaderSavedItemRow({
  entry,
  folders,
  onOpenInFolder,
}: Readonly<{
  entry: DownloaderSavedEntry;
  folders: MediaFolder[];
  onOpenInFolder: (folderId: string | null) => void;
}>) {
  const { item, platform } = entry;
  const resolvedCaption =
    item.captionText && item.captionText.trim().length > 0
      ? item.captionText
      : deriveDefaultCaption(item.name);
  const folderPathLabel = formatFolderAncestryPath(item.folderId, folders);
  const previewSrc = item.thumbnailUrl || item.url;

  return (
    <article
      data-testid={`downloader-saved-item-${item.id}`}
      style={{
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderRadius: RADII.md,
        padding: SPACING.md,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.md,
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          minWidth: 0,
          flex: 1,
        }}
      >
        {/* Thumbnail / Video Preview */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: RADII.sm,
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {renderSavedItemPreview(item, previewSrc)}
        </div>

        {/* Asset Details & Auto-Populated Caption */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.xs,
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.sm,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
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
              {formatBytes(item.fileSize)}
            </span>

            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.xs,
                padding: `2px ${SPACING.xs}`,
              }}
            >
              {formatPlatformLabel(platform)}
            </span>

            <span
              data-testid={`downloader-item-folder-${item.id}`}
              style={{
                fontSize: '0.6875rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.xs,
                padding: `2px ${SPACING.xs}`,
              }}
            >
              {folderPathLabel}
            </span>
          </div>

          <p
            data-testid={`downloader-item-caption-${item.id}`}
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {resolvedCaption}
          </p>
        </div>
      </div>

      {/* Open in Folder Action */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.xs }}>
        <button
          type="button"
          data-testid={`downloader-open-folder-${item.id}`}
          data-slot="downloader-open-folder-btn"
          onClick={() => onOpenInFolder(item.folderId)}
          style={{
            ...COMPONENT_STYLES.secondaryButton(THEME.default),
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            color: `var(--text-main, ${THEME.default.text.primary})`,
            height: '34px',
            fontSize: '0.8125rem',
            whiteSpace: 'nowrap',
          }}
        >
          Open in Folder
        </button>
      </div>
    </article>
  );
}

