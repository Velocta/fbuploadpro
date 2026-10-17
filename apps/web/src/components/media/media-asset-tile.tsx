'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { MediaItemResponse } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { formatBytes } from './upload-queue-banner';

export const HOVER_VIDEO_PREVIEW_DELAY_MS = 300;

export interface MediaAssetTileProps {
  item: MediaItemResponse;
  isSelected?: boolean;
  isInspected?: boolean;
  onToggleSelect?: (mediaId: string, options?: { shiftKey?: boolean }) => void;
  onInspect?: (item: MediaItemResponse) => void;
  onPreview?: (item: MediaItemResponse) => void;
  onDragStartMedia?: (e: React.DragEvent<HTMLElement>, item: MediaItemResponse) => void;
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

function getTileBorderColor(isActive: boolean, isHovered: boolean): string {
  if (isActive) {
    return PALETTE.primary;
  }
  if (isHovered) {
    return `var(--border-strong, ${THEME.default.borders.strong})`;
  }
  return `var(--border-subtle, ${THEME.default.borders.hairline})`;
}

function getTileBoxShadow(isActive: boolean, isHovered: boolean): string {
  if (isActive) {
    return `0 0 0 1px ${PALETTE.primary}`;
  }
  if (isHovered) {
    return `var(--shadow-card, ${THEME.default.shadows.card})`;
  }
  return 'none';
}

interface TileMediaContentProps {
  item: MediaItemResponse;
  isHoverPlaying: boolean;
  previewSrc: string | null;
  isVideo: boolean;
}

function TileMediaContent({ item, isHoverPlaying, previewSrc, isVideo }: Readonly<TileMediaContentProps>) {
  if (isHoverPlaying && isVideo && item.url) {
    return (
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
      >
        <track kind="captions" />
      </video>
    );
  }

  if (previewSrc) {
    return (
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
    );
  }

  return (
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
          width="28"
          height="28"
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
          width="28"
          height="28"
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
    </div>
  );
}

function TileCaptionSnippet({ hasCaption, captionText }: Readonly<{ hasCaption: boolean; captionText?: string | null }>) {
  if (hasCaption) {
    return (
      <span
        title={captionText ?? ''}
        style={{
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}
      >
        {captionText}
      </span>
    );
  }

  return (
    <span
      style={{
        color: PALETTE.accent1,
        fontSize: '0.6875rem',
        fontStyle: 'italic',
      }}
    >
      No caption set
    </span>
  );
}

export function MediaAssetTile({
  item,
  isSelected = false,
  isInspected = false,
  onToggleSelect,
  onInspect,
  onPreview,
  onDragStartMedia,
}: Readonly<MediaAssetTileProps>) {
  const [isHovered, setIsHovered] = useState(false);
  const [isHoverPlaying, setIsHoverPlaying] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastShiftKeyRef = useRef(false);

  const formattedDuration = formatDuration(item.durationSeconds);
  const isVideo = item.mediaType === 'video';
  const previewSrc = item.thumbnailUrl || (!isVideo ? item.url : null);
  const hasCaption = Boolean(item.captionText && item.captionText.trim().length > 0);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (!isVideo || !item.url) return;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = setTimeout(() => {
      setIsHoverPlaying(true);
    }, HOVER_VIDEO_PREVIEW_DELAY_MS);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHoverPlaying(false);
  };

  const handleTileClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input[type="checkbox"], label, button')) {
      return;
    }
    onInspect?.(item);
  };

  const handleThumbnailDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPreview?.(item);
  };

  const isActiveBorder = isSelected || isInspected;

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Inspect ${item.name}`}
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
      onClick={handleTileClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onInspect?.(item);
        }
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
        transition: 'transform 0.15s ease',
      }}
    >
      {/* Visual Thumbnail Surface */}
      <div
        data-testid={`media-tile-surface-${item.id}`}
        onDoubleClick={handleThumbnailDoubleClick}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 10',
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid ${getTileBorderColor(isActiveBorder, isHovered)}`,
          boxShadow: getTileBoxShadow(isActiveBorder, isHovered),
          borderRadius: RADII.md,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        <TileMediaContent
          item={item}
          isHoverPlaying={isHoverPlaying}
          previewSrc={previewSrc}
          isVideo={isVideo}
        />

        {/* Top-Left Selection Checkbox */}
        <label
          htmlFor={`select-media-${item.id}`}
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
              isSelected
                ? PALETTE.primary
                : `var(--border-subtle, ${THEME.default.borders.hairline})`
            }`,
            borderRadius: RADII.xs,
            cursor: 'pointer',
            opacity: isSelected || isHovered ? 1 : 0,
            transition: 'opacity 0.15s ease',
            zIndex: 3,
          }}
        >
          <input
            id={`select-media-${item.id}`}
            type="checkbox"
            data-testid={`select-media-${item.id}`}
            checked={isSelected}
            onMouseDown={(e) => {
              lastShiftKeyRef.current = Boolean(e.shiftKey);
            }}
            onClick={(e) => {
              e.stopPropagation();
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

        {/* Top-Right Double-Click Fullscreen Preview Trigger (Hover Only) */}
        {isHovered && (
          <button
            type="button"
            data-testid={`preview-media-${item.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onPreview?.(item);
            }}
            aria-label={`Preview ${item.name}`}
            style={{
              position: 'absolute',
              top: SPACING.xs,
              right: SPACING.xs,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.xs,
              color: PALETTE.text,
              cursor: 'pointer',
              zIndex: 3,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        )}

        {/* Bottom Metadata Overlay (Aspect Ratio & Duration) */}
        <div
          style={{
            position: 'absolute',
            bottom: SPACING.xs,
            right: SPACING.xs,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            pointerEvents: 'none',
            zIndex: 2,
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

      {/* Clean Typography Caption & File Row */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          padding: `0 2px`,
        }}
      >
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
              color: isInspected
                ? PALETTE.primary
                : `var(--text-main, ${THEME.default.text.primary})`,
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

        {/* Caption Snippet or Uncaptioned Signal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.6875rem',
          }}
        >
          <TileCaptionSnippet hasCaption={hasCaption} captionText={item.captionText} />
        </div>
      </div>
    </article>
  );
}
