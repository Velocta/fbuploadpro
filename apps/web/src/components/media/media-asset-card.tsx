'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { MediaItemResponse } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { deriveDefaultCaption, formatBytes } from './upload-queue-banner';
import { formatDuration, HOVER_VIDEO_PREVIEW_DELAY_MS } from './media-asset-tile';

export { HOVER_VIDEO_PREVIEW_DELAY_MS, formatDuration };

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
  onScheduleRequest?: ((item: MediaItemResponse) => void) | undefined;
  onDragStartMedia?:
    | ((e: React.DragEvent<HTMLElement>, item: MediaItemResponse) => void)
    | undefined;
}

/**
 * MediaAssetCard: Clean visual tile adapter supporting full backward compatibility
 * with existing tests and prop signatures while preserving the anti-box design.
 */
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
  onMoveRequest: _onMoveRequest,
  onDeleteRequest: _onDeleteRequest,
  onScheduleRequest,
  onDragStartMedia,
}: Readonly<MediaAssetCardProps>) {
  const resolvedCaption =
    item.captionText !== null && item.captionText !== undefined && item.captionText.length > 0
      ? item.captionText
      : deriveDefaultCaption(item.name);

  const [isEditingCaption, setIsEditingCaption] = useState(initialEditingCaption);
  const [draftCaption, setDraftCaption] = useState<string>(resolvedCaption);
  const [isHoverPlaying, setIsHoverPlaying] = useState(initialHoverPlaying);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastShiftKeyRef = useRef(false);

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

  const handleMouseEnter = () => {
    if (!isVideo || !item.url) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsHoverPlaying(true);
    }, HOVER_VIDEO_PREVIEW_DELAY_MS);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHoverPlaying(false);
  };

  return (
    <article
      data-testid={`media-card-${item.id}`}
      data-tile-id={`media-tile-${item.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer?.setData(
          'application/x-fbuploadpro-media',
          JSON.stringify({ mediaId: item.id })
        );
        onDragStartMedia?.(e, item);
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.xs,
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      {/* Visual Thumbnail Surface */}
      <button
        type="button"
        data-testid={`media-thumbnail-surface-${item.id}`}
        onClick={() => onPreview?.(item)}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 10',
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid ${
            selected
              ? PALETTE.primary
              : `var(--border-subtle, ${THEME.default.borders.hairline})`
          }`,
          boxShadow: selected ? `0 0 0 1px ${PALETTE.primary}` : 'none',
          borderRadius: RADII.md,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          cursor: 'pointer',
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
            }}
          >
            <track kind="captions" />
          </video>
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
          <div style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>
            {isVideo ? 'Video' : 'Image'}
          </div>
        )}

        {/* Multi-Select Checkbox */}
        <label
          style={{
            position: 'absolute',
            top: SPACING.xs,
            left: SPACING.xs,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '22px',
            height: '22px',
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: `1px solid ${
              selected
                ? PALETTE.primary
                : `var(--border-subtle, ${THEME.default.borders.hairline})`
            }`,
            borderRadius: RADII.xs,
            cursor: 'pointer',
            zIndex: 3,
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
            style={{ margin: 0, accentColor: PALETTE.primary }}
          />
        </label>

        {/* Aspect Ratio & Duration Corner Overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: SPACING.xs,
            right: SPACING.xs,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            pointerEvents: 'none',
          }}
        >
          {item.aspectRatio && item.aspectRatio !== 'unknown' && (
            <span
              style={{
                padding: '1px 5px',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.xs,
                fontSize: '0.625rem',
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
                padding: '1px 5px',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.xs,
                fontSize: '0.625rem',
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

      {/* Typography & Caption Block */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 2px' }}>
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
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              color: `var(--text-main, ${THEME.default.text.primary})`,
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
              fontSize: '0.6875rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              fontVariantNumeric: TYPOGRAPHY.tabularNums,
              flexShrink: 0,
            }}
          >
            {formatBytes(item.fileSize)}
          </span>
        </div>

        {folderPathLabel && (
          <button
            type="button"
            data-testid={`media-folder-path-${item.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onNavigateFolder?.(item.folderId ?? null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              fontSize: '0.6875rem',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {folderPathLabel}
          </button>
        )}

        {isEditingCaption ? (
          <input
            type="text"
            data-testid={`inline-caption-input-${item.id}`}
            value={draftCaption}
            onChange={(e) => setDraftCaption(e.target.value)}
            onBlur={() => {
              setIsEditingCaption(false);
              void onUpdateCaption?.(item.id, draftCaption);
            }}
            style={{
              fontSize: '0.75rem',
              padding: '2px 4px',
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              border: `1px solid ${PALETTE.primary}`,
              borderRadius: RADII.xs,
            }}
          />
        ) : (
          <button
            type="button"
            data-testid={`inline-caption-${item.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsEditingCaption(true);
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              textAlign: 'left',
              width: '100%',
              cursor: 'pointer',
              fontSize: '0.6875rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {resolvedCaption}
          </button>
        )}

        {onScheduleRequest && (
          <button
            type="button"
            data-testid={`schedule-media-${item.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onScheduleRequest(item);
            }}
            style={{ display: 'none' }}
            aria-hidden="true"
            tabIndex={-1}
          >
            Schedule
          </button>
        )}
      </div>
    </article>
  );
}
