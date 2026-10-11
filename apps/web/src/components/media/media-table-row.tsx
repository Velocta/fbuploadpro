'use client';

import React, { useState } from 'react';
import type { MediaItemResponse } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { deriveDefaultCaption, formatBytes } from './upload-queue-banner';
import { formatDuration } from './media-asset-card';

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

  const isVideo = item.mediaType === 'video';
  const durationLabel = formatDuration(item.durationSeconds) ?? '—';
  const aspectRatioLabel =
    item.aspectRatio && item.aspectRatio !== 'unknown' ? item.aspectRatio : '—';
  const thumbnailSrc =
    item.thumbnailUrl || (!isVideo ? item.url : null);

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
      style={{
        backgroundColor: selected
          ? `var(--bg-active, ${THEME.default.surfaces.active})`
          : `var(--bg-panel, ${THEME.default.surfaces.panel})`,
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
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select ${item.name}`}
          data-testid={`select-media-${item.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(item.id, { shiftKey: e.shiftKey });
          }}
          style={{
            width: '20px',
            height: '20px',
            borderRadius: RADII.xs,
            border: `1.5px solid ${
              selected
                ? PALETTE.primary
                : `var(--border-focus, ${THEME.default.borders.focus})`
            }`,
            backgroundColor: selected
              ? PALETTE.primary
              : `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
            color: PALETTE.text,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {selected && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>
      </td>

      {/* 2. Mini Thumbnail Preview Trigger */}
      <td
        style={{
          padding: `${SPACING.xs} ${SPACING.sm}`,
          width: '56px',
          verticalAlign: 'middle',
        }}
      >
        <button
          type="button"
          data-testid={`preview-media-${item.id}`}
          onClick={() => onPreview?.(item)}
          aria-label={`Preview ${item.name}`}
          style={{
            width: '48px',
            height: '32px',
            borderRadius: RADII.xs,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            overflow: 'hidden',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={item.name}
              loading="lazy"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <span
              style={{
                fontSize: '0.625rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-dim, ${THEME.default.text.muted})`,
              }}
            >
              {isVideo ? 'VID' : 'IMG'}
            </span>
          )}
        </button>
      </td>

      {/* 3. File Name + Optional Folder Path Badge */}
      <td
        style={{
          padding: `${SPACING.sm} ${SPACING.md}`,
          verticalAlign: 'middle',
          maxWidth: '240px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            minWidth: 0,
          }}
        >
          <span
            title={item.name}
            style={{
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.name}
          </span>

          {folderPathLabel && (
            <div>
              <button
                type="button"
                data-testid={`media-folder-path-${item.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateFolder?.(item.folderId ?? null);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '1px 6px',
                  backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  borderRadius: RADII.xs,
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  fontSize: '0.6875rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  cursor: 'pointer',
                }}
              >
                {folderPathLabel}
              </button>
            </div>
          )}
        </div>
      </td>

      {/* 4. Click-to-Edit Inline Caption Cell */}
      <td
        style={{
          padding: `${SPACING.sm} ${SPACING.md}`,
          verticalAlign: 'middle',
          minWidth: '220px',
        }}
      >
        {isEditingCaption ? (
          <input
            type="text"
            data-testid={`table-caption-input-${item.id}`}
            aria-label={`Edit caption for ${item.name}`}
            value={captionDraft}
            autoFocus
            onChange={(e) => setCaptionDraft(e.target.value)}
            onBlur={() => void handleSaveCaption()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSaveCaption();
              } else if (e.key === 'Escape') {
                setCaptionDraft(resolvedCaption);
                setIsEditingCaption(false);
              }
            }}
            style={{
              width: '100%',
              padding: `4px ${SPACING.xs}`,
              backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              border: `1px solid ${PALETTE.primary}`,
              borderRadius: RADII.xs,
              fontSize: '0.8125rem',
              fontFamily: TYPOGRAPHY.fontFamily,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <button
            type="button"
            data-testid={`table-inline-caption-${item.id}`}
            disabled={isSavingCaption}
            onClick={() => {
              setCaptionDraft(resolvedCaption);
              setIsEditingCaption(true);
            }}
            title="Click to edit caption"
            style={{
              width: '100%',
              textAlign: 'left',
              padding: `4px ${SPACING.xs}`,
              backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.xs,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              fontSize: '0.8125rem',
              lineHeight: 1.35,
              cursor: 'text',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {resolvedCaption}
          </button>
        )}
      </td>

      {/* 5. Aspect Ratio */}
      <td
        style={{
          padding: `${SPACING.sm} ${SPACING.md}`,
          verticalAlign: 'middle',
          whiteSpace: 'nowrap',
          fontSize: '0.75rem',
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          fontVariantNumeric: TYPOGRAPHY.tabularNums,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: '2px 6px',
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.xs,
            fontWeight: TYPOGRAPHY.weights.semibold,
          }}
        >
          {aspectRatioLabel}
        </span>
      </td>

      {/* 6. Duration */}
      <td
        style={{
          padding: `${SPACING.sm} ${SPACING.md}`,
          verticalAlign: 'middle',
          whiteSpace: 'nowrap',
          fontSize: '0.75rem',
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          fontVariantNumeric: TYPOGRAPHY.tabularNums,
        }}
      >
        {durationLabel}
      </td>

      {/* 7. File Size */}
      <td
        style={{
          padding: `${SPACING.sm} ${SPACING.md}`,
          verticalAlign: 'middle',
          whiteSpace: 'nowrap',
          fontSize: '0.75rem',
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          fontVariantNumeric: TYPOGRAPHY.tabularNums,
        }}
      >
        {formatBytes(item.fileSize)}
      </td>

      {/* 8. Row Actions */}
      <td
        style={{
          padding: `${SPACING.sm} ${SPACING.md}`,
          verticalAlign: 'middle',
          whiteSpace: 'nowrap',
          textAlign: 'right',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: SPACING.xs,
          }}
        >
          <button
            type="button"
            onClick={() => onPreview?.(item)}
            style={{
              backgroundColor: 'transparent',
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.xs,
              padding: '2px 8px',
              fontSize: '0.75rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              cursor: 'pointer',
            }}
          >
            Preview
          </button>

          {onMoveRequest && (
            <button
              type="button"
              data-testid={`move-media-${item.id}`}
              onClick={() => onMoveRequest(item)}
              style={{
                backgroundColor: 'transparent',
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.xs,
                padding: '2px 8px',
                fontSize: '0.75rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                cursor: 'pointer',
              }}
            >
              Move
            </button>
          )}

          {onDeleteRequest && (
            <button
              type="button"
              data-testid={`delete-media-${item.id}`}
              onClick={() => onDeleteRequest(item)}
              style={{
                backgroundColor: 'transparent',
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.xs,
                padding: '2px 8px',
                fontSize: '0.75rem',
                color: PALETTE.accent3,
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
