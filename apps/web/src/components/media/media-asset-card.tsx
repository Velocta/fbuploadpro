'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { MediaItemResponse } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { deriveDefaultCaption, formatBytes } from './upload-queue-banner';

export const HOVER_VIDEO_PREVIEW_DELAY_MS = 300;

export interface MediaAssetCardProps {
  item: MediaItemResponse;
  selected?: boolean | undefined;
  initialEditingCaption?: boolean | undefined;
  initialHoverPlaying?: boolean | undefined;
  folderPathLabel?: string | null | undefined;
  onNavigateFolder?: ((folderId: string | null) => void) | undefined;
  onToggleSelect?:
    | ((mediaId: string, options?: { shiftKey?: boolean }) => void)
    | undefined;
  onPreview?: ((item: MediaItemResponse) => void) | undefined;
  onUpdateCaption?:
    | ((mediaId: string, captionText: string) => Promise<void> | void)
    | undefined;
  onMoveRequest?: ((item: MediaItemResponse) => void) | undefined;
  onDeleteRequest?: ((item: MediaItemResponse) => void) | undefined;
  onDragStartMedia?:
    | ((e: React.DragEvent<HTMLElement>, item: MediaItemResponse) => void)
    | undefined;
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const totalSec = Math.round(seconds);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function MediaAssetCard({
  item,
  selected = false,
  initialEditingCaption = false,
  initialHoverPlaying = false,
  folderPathLabel = null,
  onNavigateFolder,
  onToggleSelect,
  onPreview,
  onUpdateCaption,
  onMoveRequest,
  onDeleteRequest,
  onDragStartMedia,
}: Readonly<MediaAssetCardProps>) {
  const resolvedCaption =
    item.captionText !== null && item.captionText !== undefined && item.captionText.length > 0
      ? item.captionText
      : deriveDefaultCaption(item.name);

  const [isEditingCaption, setIsEditingCaption] = useState(initialEditingCaption);
  const [draftCaption, setDraftCaption] = useState<string | null>(
    initialEditingCaption ? resolvedCaption : null
  );
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const [isHoverPlaying, setIsHoverPlaying] = useState(initialHoverPlaying);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastShiftKeyRef = useRef(false);

  const currentDraft = draftCaption ?? resolvedCaption;
  const formattedDuration = formatDuration(item.durationSeconds);
  const isVideo = item.mediaType === 'video';
  const previewSrc = item.thumbnailUrl || (!isVideo ? item.url : null);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, []);

  const handleMouseEnterSurface = () => {
    if (!isVideo || !item.url) return;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = setTimeout(() => {
      setIsHoverPlaying(true);
    }, HOVER_VIDEO_PREVIEW_DELAY_MS);
  };

  const handleMouseLeaveSurface = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHoverPlaying(false);
  };

  const handleStartEditCaption = () => {
    setDraftCaption(resolvedCaption);
    setIsEditingCaption(true);
  };

  const handleCommitCaption = async () => {
    const trimmed = currentDraft.trim();
    setIsEditingCaption(false);
    setDraftCaption(null);
    if (trimmed !== (item.captionText ?? '')) {
      setIsSavingCaption(true);
      try {
        await onUpdateCaption?.(item.id, trimmed);
      } finally {
        setIsSavingCaption(false);
      }
    }
  };

  const handleCancelCaption = () => {
    setIsEditingCaption(false);
    setDraftCaption(null);
  };

  return (
    <article
      data-testid={`media-card-${item.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer?.setData(
          'application/x-fbuploadpro-media',
          JSON.stringify({ mediaId: item.id })
        );
        onDragStartMedia?.(e, item);
      }}
      style={{
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: `1px solid ${
          selected
            ? PALETTE.primary
            : `var(--border-subtle, ${THEME.default.borders.hairline})`
        }`,
        borderRadius: RADII.md,
        boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Thumbnail & Preview Surface */}
      <div
        data-testid={`media-thumbnail-surface-${item.id}`}
        onMouseEnter={handleMouseEnterSurface}
        onMouseLeave={handleMouseLeaveSurface}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 10',
          backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
          borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          data-testid={`preview-media-${item.id}`}
          onClick={() => onPreview?.(item)}
          aria-label={`Preview ${item.name}`}
          style={{
            width: '100%',
            height: '100%',
            padding: 0,
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          {isHoverPlaying && isVideo && item.url ? (
            <video
              data-testid={`hover-video-preview-${item.id}`}
              src={item.url}
              muted
              loop
              playsInline
              autoPlay
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                pointerEvents: 'none',
              }}
            />
          ) : previewSrc ? (
            <img
              src={previewSrc}
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
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: SPACING.xs,
                color: `var(--text-dim, ${THEME.default.text.muted})`,
              }}
            >
              {isVideo ? (
                <svg
                  width="32"
                  height="32"
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
                  width="32"
                  height="32"
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
              <span style={{ fontSize: '0.75rem', fontWeight: TYPOGRAPHY.weights.medium }}>
                {isVideo ? 'Video clip' : 'Image asset'}
              </span>
            </div>
          )}
        </button>

        {/* Top-Left Multi-Select Checkbox */}
        <label
          style={{
            position: 'absolute',
            top: SPACING.sm,
            left: SPACING.sm,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: `1px solid ${
              selected
                ? PALETTE.primary
                : `var(--border-subtle, ${THEME.default.borders.hairline})`
            }`,
            borderRadius: RADII.xs,
            cursor: 'pointer',
            zIndex: 2,
          }}
        >
          <input
            type="checkbox"
            data-testid={`select-media-${item.id}`}
            checked={selected}
            onMouseDown={(e) => {
              lastShiftKeyRef.current = Boolean(e.shiftKey);
            }}
            onClick={(e) => {
              lastShiftKeyRef.current = Boolean(e.shiftKey);
            }}
            onChange={(e) => {
              const nativeShift = Boolean(
                (e.nativeEvent as MouseEvent | undefined)?.shiftKey
              );
              const shiftKey = nativeShift || lastShiftKeyRef.current;
              lastShiftKeyRef.current = false;
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

        {/* Bottom Metadata Overlay (Rectangular RADII.xs technical readout, never capsule pills) */}
        <div
          style={{
            position: 'absolute',
            bottom: SPACING.xs,
            right: SPACING.xs,
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.xs,
            pointerEvents: 'none',
          }}
        >
          {item.aspectRatio && item.aspectRatio !== 'unknown' && (
            <span
              style={{
                padding: '2px 6px',
                backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.xs,
                fontSize: '0.6875rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontVariantNumeric: TYPOGRAPHY.tabularNums,
              }}
            >
              {item.aspectRatio}
            </span>
          )}
          {formattedDuration && (
            <span
              style={{
                padding: '2px 6px',
                backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.xs,
                fontSize: '0.6875rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontVariantNumeric: TYPOGRAPHY.tabularNums,
              }}
            >
              {formattedDuration}
            </span>
          )}
        </div>
      </div>

      {/* Card Body: File Name + Optional Global Search Folder Path + Inline Direct Caption Editor + Actions */}
      <div
        style={{
          padding: SPACING.md,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.sm,
          flex: 1,
        }}
      >
        {/* File Name & Size Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: SPACING.xs,
          }}
        >
          <span
            title={item.name}
            style={{
              fontSize: '0.75rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {item.name}
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              fontVariantNumeric: TYPOGRAPHY.tabularNums,
              flexShrink: 0,
            }}
          >
            {formatBytes(item.fileSize)}
          </span>
        </div>

        {/* Clickable Folder Path Badge (Shown in Global Search Results) */}
        {folderPathLabel && (
          <button
            type="button"
            data-testid={`media-folder-path-${item.id}`}
            onClick={() => onNavigateFolder?.(item.folderId ?? null)}
            title={`Open folder: ${folderPathLabel}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
              alignSelf: 'flex-start',
              maxWidth: '100%',
              padding: '2px 6px',
              backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.xs,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '0.6875rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor: 'pointer',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke={PALETTE.primary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {folderPathLabel}
            </span>
          </button>
        )}

        {/* Inline Direct Caption Editor */}
        <div>
          <div
            style={{
              fontSize: '0.6875rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              marginBottom: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Caption</span>
            {isSavingCaption && <span>Saving...</span>}
          </div>

          {isEditingCaption ? (
            <input
              type="text"
              data-testid={`inline-caption-input-${item.id}`}
              value={currentDraft}
              autoFocus
              aria-label={`Edit caption for ${item.name}`}
              onChange={(e) => setDraftCaption(e.target.value)}
              onBlur={() => void handleCommitCaption()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCommitCaption();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancelCaption();
                }
              }}
              style={{
                width: '100%',
                height: '32px',
                padding: `0 ${SPACING.sm}`,
                backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                border: `1px solid ${PALETTE.primary}`,
                borderRadius: RADII.xs,
                fontSize: '0.8125rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <button
              type="button"
              data-testid={`inline-caption-${item.id}`}
              onClick={handleStartEditCaption}
              title="Click to edit caption"
              style={{
                width: '100%',
                textAlign: 'left',
                padding: `${SPACING.xs} ${SPACING.sm}`,
                backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.xs,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                lineHeight: 1.35,
                cursor: 'text',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
              }}
            >
              {resolvedCaption}
            </button>
          )}
        </div>

        {/* Bottom Quick Action Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: SPACING.xs,
            marginTop: 'auto',
            paddingTop: SPACING.xs,
            borderTop: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          }}
        >
          <button
            type="button"
            onClick={() => onPreview?.(item)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: `${SPACING.xs} 0`,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '0.75rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor: 'pointer',
            }}
          >
            Preview & edit
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.xs }}>
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
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  fontSize: '0.75rem',
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
                  color: PALETTE.accent3,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
