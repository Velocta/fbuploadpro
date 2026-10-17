'use client';

import React, { useState } from 'react';
import type { MediaItemResponse } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import {
  deriveDefaultCaption,
  formatBytes,
  formatUploadDate,
  formatMediaDetails,
} from './media-types';

export interface MediaTableRowProps {
  item: MediaItemResponse;
  selected?: boolean | undefined;
  initialEditingCaption?: boolean | undefined;
  folderPathLabel?: string | null | undefined;
  onNavigateFolder?: ((folderId: string | null) => void) | undefined;
  onToggleSelect?:
    | ((mediaId: string, options?: { shiftKey?: boolean | undefined }) => void)
    | undefined;
  onPreview?: ((item: MediaItemResponse) => void) | undefined;
  onUpdateCaption?:
    | ((mediaId: string, captionText: string) => Promise<void> | void)
    | undefined;
  onMoveRequest?: ((item: MediaItemResponse) => void) | undefined;
  onDeleteRequest?: ((item: MediaItemResponse) => void) | undefined;
}

export function MediaTableRow({
  item,
  selected = false,
  initialEditingCaption = false,
  folderPathLabel = null,
  onNavigateFolder,
  onToggleSelect,
  onPreview,
  onUpdateCaption,
  onMoveRequest,
  onDeleteRequest,
}: Readonly<MediaTableRowProps>) {
  const resolvedCaption =
    item.captionText !== null &&
    item.captionText !== undefined &&
    item.captionText.trim().length > 0
      ? item.captionText
      : deriveDefaultCaption(item.name);

  const [isEditingCaption, setIsEditingCaption] = useState(initialEditingCaption);
  const [captionDraft, setCaptionDraft] = useState(resolvedCaption);
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  const isVideo = item.mediaType === 'video';
  const detailsLabel = formatMediaDetails(item.aspectRatio, item.durationSeconds);
  const thumbnailSrc = item.thumbnailUrl || (!isVideo ? item.url : null);

  const handleSaveCaption = async () => {
    const trimmed = captionDraft.trim() || deriveDefaultCaption(item.name);
    setIsEditingCaption(false);
    if (trimmed === resolvedCaption) return;

    setIsSavingCaption(true);
    try {
      await onUpdateCaption?.(item.id, trimmed);
    } finally {
      setIsSavingCaption(false);
    }
  };

  return (
    <tr
      data-testid={`media-row-${item.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer?.setData(
          'application/x-fbuploadpro-media',
          JSON.stringify({ mediaId: item.id })
        );
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: selected
          ? `var(--bg-active, ${THEME.default.surfaces.active})`
          : isHovered
            ? `var(--bg-hover, ${THEME.default.surfaces.hover})`
            : 'transparent',
        borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        transition: 'background-color 0.12s ease',
      }}
    >
      {/* 1. Selection Checkbox */}
      <td
        style={{
          padding: `${SPACING.sm} ${SPACING.md}`,
          width: '40px',
          verticalAlign: 'middle',
        }}
      >
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            data-testid={`select-row-${item.id}`}
            checked={selected}
            onChange={(e) => {
              const shiftKey = Boolean(
                (e.nativeEvent as MouseEvent | undefined)?.shiftKey
              );
              onToggleSelect?.(item.id, { shiftKey });
            }}
            aria-label={`Select ${item.name}`}
            style={{
              margin: 0,
              cursor: 'pointer',
              accentColor: PALETTE.primary,
            }}
          />
        </label>
      </td>

      {/* 2. Preview Thumbnail */}
      <td
        style={{
          padding: `${SPACING.sm} 0`,
          width: '48px',
          verticalAlign: 'middle',
        }}
      >
        <button
          type="button"
          onClick={() => onPreview?.(item)}
          aria-label={`Preview ${item.name}`}
          style={{
            width: '44px',
            height: '32px',
            borderRadius: RADII.xs,
            overflow: 'hidden',
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            color: `var(--text-dim, ${THEME.default.text.muted})`,
          }}
        >
          {thumbnailSrc && !imgError ? (
            <img
              src={thumbnailSrc}
              alt={item.name}
              onError={() => setImgError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : isVideo ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <polygon points="10 8 16 12 10 16 10 8" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          )}
        </button>
      </td>

      {/* 3. File (Name + Folder Ancestry Link) */}
      <td
        style={{
          padding: `${SPACING.sm} ${SPACING.md}`,
          verticalAlign: 'middle',
          maxWidth: '220px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span
            title={item.name}
            data-testid={`row-name-${item.id}`}
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
          {folderPathLabel && (
            <button
              type="button"
              onClick={() => onNavigateFolder?.(item.folderId ?? null)}
              title={`Open folder: ${folderPathLabel}`}
              style={{
                alignSelf: 'flex-start',
                backgroundColor: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: '0.6875rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{folderPathLabel}</span>
            </button>
          )}
        </div>
      </td>

      {/* 4. Caption (Click-to-Edit) */}
      <td
        style={{
          padding: `${SPACING.sm} ${SPACING.md}`,
          verticalAlign: 'middle',
          maxWidth: '240px',
        }}
      >
        {isEditingCaption ? (
          <input
            type="text"
            data-testid={`row-caption-input-${item.id}`}
            value={captionDraft}
            onChange={(e) => setCaptionDraft(e.target.value)}
            onBlur={() => void handleSaveCaption()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSaveCaption();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setIsEditingCaption(false);
                setCaptionDraft(resolvedCaption);
              }
            }}
            style={{
              width: '100%',
              padding: '2px 6px',
              backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
              border: `1px solid ${PALETTE.primary}`,
              borderRadius: RADII.xs,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              fontSize: '0.75rem',
              outline: 'none',
            }}
          />
        ) : (
          <button
            type="button"
            data-testid={`row-caption-${item.id}`}
            onClick={() => setIsEditingCaption(true)}
            title="Click to edit caption"
            style={{
              width: '100%',
              textAlign: 'left',
              backgroundColor: 'transparent',
              border: 'none',
              padding: '2px 0',
              fontSize: '0.75rem',
              color: item.captionText
                ? `var(--text-main, ${THEME.default.text.primary})`
                : `var(--text-dim, ${THEME.default.text.muted})`,
              cursor: 'text',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
            }}
          >
            {isSavingCaption ? 'Saving...' : resolvedCaption}
          </button>
        )}
      </td>

      {/* 5. Details (Merged Ratio & Duration, e.g. "1:1 · 0:45") */}
      <td
        data-testid={`row-details-${item.id}`}
        style={{
          padding: `${SPACING.sm} ${SPACING.md}`,
          verticalAlign: 'middle',
          fontSize: '0.75rem',
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          fontVariantNumeric: TYPOGRAPHY.tabularNums,
          whiteSpace: 'nowrap',
        }}
      >
        {detailsLabel}
      </td>

      {/* 6. Size */}
      <td
        data-testid={`row-size-${item.id}`}
        style={{
          padding: `${SPACING.sm} ${SPACING.md}`,
          verticalAlign: 'middle',
          fontSize: '0.75rem',
          color: `var(--text-dim, ${THEME.default.text.muted})`,
          fontVariantNumeric: TYPOGRAPHY.tabularNums,
          whiteSpace: 'nowrap',
        }}
      >
        {formatBytes(item.fileSize)}
      </td>

      {/* 7. Upload Date (e.g. "Oct 18, 2026") */}
      <td
        data-testid={`row-date-${item.id}`}
        style={{
          padding: `${SPACING.sm} ${SPACING.md}`,
          verticalAlign: 'middle',
          fontSize: '0.75rem',
          color: `var(--text-dim, ${THEME.default.text.muted})`,
          fontVariantNumeric: TYPOGRAPHY.tabularNums,
          whiteSpace: 'nowrap',
        }}
      >
        {formatUploadDate(item.createdAt)}
      </td>

      {/* 8. Actions (Preview, Move, Delete) — NO Schedule button! */}
      <td
        style={{
          padding: `${SPACING.sm} ${SPACING.md}`,
          verticalAlign: 'middle',
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            opacity: isHovered ? 1 : 0.7,
            transition: 'opacity 0.12s ease',
          }}
        >
          {onPreview && (
            <button
              type="button"
              data-testid={`row-action-preview-${item.id}`}
              onClick={() => onPreview(item)}
              aria-label="Preview asset"
              style={{
                padding: '3px 8px',
                backgroundColor: 'transparent',
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.xs,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontSize: '0.6875rem',
                cursor: 'pointer',
              }}
            >
              Preview
            </button>
          )}

          {onMoveRequest && (
            <button
              type="button"
              data-testid={`row-action-move-${item.id}`}
              onClick={() => onMoveRequest(item)}
              aria-label="Move asset"
              style={{
                padding: '3px 8px',
                backgroundColor: 'transparent',
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.xs,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontSize: '0.6875rem',
                cursor: 'pointer',
              }}
            >
              Move
            </button>
          )}

          {onDeleteRequest && (
            <button
              type="button"
              data-testid={`row-action-delete-${item.id}`}
              onClick={() => onDeleteRequest(item)}
              aria-label="Delete asset"
              style={{
                padding: '3px 8px',
                backgroundColor: 'transparent',
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.xs,
                color: PALETTE.accent3,
                fontSize: '0.6875rem',
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
