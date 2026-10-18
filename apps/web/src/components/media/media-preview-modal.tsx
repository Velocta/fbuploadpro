'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { MediaItemResponse } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import {
  deriveDefaultCaption,
  formatBytes,
  formatUploadDate,
  formatDuration,
} from './media-types';

export interface CapturedVideoFrame {
  blob: Blob | null;
  dataUrl: string;
}

const FALLBACK_WEBP_DATA_URL =
  'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

export async function captureVideoFrameAsWebp(
  videoElement: HTMLVideoElement | null
): Promise<CapturedVideoFrame> {
  if (typeof document === 'undefined') {
    return { blob: null, dataUrl: FALLBACK_WEBP_DATA_URL };
  }

  try {
    const rawWidth = videoElement?.videoWidth || 640;
    const rawHeight = videoElement?.videoHeight || 360;
    const maxDim = 640;
    const scale = Math.min(1, maxDim / Math.max(rawWidth, rawHeight, 1));
    const width = Math.max(1, Math.round(rawWidth * scale));
    const height = Math.max(1, Math.round(rawHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    let dataUrl = FALLBACK_WEBP_DATA_URL;
    try {
      const ctx = canvas.getContext('2d');
      if (ctx && videoElement) {
        ctx.drawImage(videoElement, 0, 0, width, height);
      }
      if (typeof canvas.toDataURL === 'function') {
        const encoded = canvas.toDataURL('image/webp', 0.85);
        if (encoded && encoded.startsWith('data:image/')) {
          dataUrl = encoded;
        }
      }
    } catch (_drawErr) {
      dataUrl = FALLBACK_WEBP_DATA_URL;
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      if (typeof canvas.toBlob !== 'function') {
        resolve(null);
        return;
      }
      const timer = setTimeout(() => resolve(null), 60);
      try {
        canvas.toBlob(
          (b) => {
            clearTimeout(timer);
            resolve(b);
          },
          'image/webp',
          0.85
        );
      } catch (_blobErr) {
        clearTimeout(timer);
        resolve(null);
      }
    });

    return { blob, dataUrl };
  } catch (_err) {
    return { blob: null, dataUrl: FALLBACK_WEBP_DATA_URL };
  }
}

export interface MediaPreviewModalProps {
  item: MediaItemResponse | null;
  open: boolean;
  hasPrevious?: boolean | undefined;
  hasNext?: boolean | undefined;
  onPrevious?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  onOpenChange: (open: boolean) => void;
  onSave?:
    | ((
        mediaId: string,
        updates: { name?: string; captionText?: string }
      ) => Promise<void> | void)
    | undefined;
  onUpdateThumbnail?:
    | ((
        mediaId: string,
        captured: CapturedVideoFrame
      ) => Promise<void> | void)
    | undefined;
  onDelete?: ((mediaId: string) => Promise<void> | void) | undefined;
}

export function MediaPreviewModal({
  item,
  open,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onOpenChange,
  onSave,
  onUpdateThumbnail,
  onDelete,
}: Readonly<MediaPreviewModalProps>) {
  const [nameDraft, setNameDraft] = useState(() => item?.name || '');
  const [captionDraft, setCaptionDraft] = useState(
    () => item?.captionText ?? (item ? deriveDefaultCaption(item.name) : '')
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isCapturingFrame, setIsCapturingFrame] = useState(false);
  const [frameSuccessMessage, setFrameSuccessMessage] = useState<string | null>(null);

  // Video scrubber state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (item && open) {
      setNameDraft(item.name || '');
      setCaptionDraft(item.captionText ?? deriveDefaultCaption(item.name));
      setFrameSuccessMessage(null);
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [item, open]);

  if (!open || !item) return null;

  const isVideo = item.mediaType === 'video';

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number.parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleCaptureFrame = async () => {
    if (!videoRef.current || !onUpdateThumbnail) return;
    setIsCapturingFrame(true);
    setFrameSuccessMessage(null);
    try {
      const captured = await captureVideoFrameAsWebp(videoRef.current);
      await onUpdateThumbnail(item.id, captured);
      setFrameSuccessMessage('Frame captured as thumbnail');
      setTimeout(() => setFrameSuccessMessage(null), 3000);
    } finally {
      setIsCapturingFrame(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(item.id, {
        name: nameDraft.trim() || item.name,
        captionText: captionDraft.trim(),
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (window.confirm(`Delete "${item.name}"? This cannot be undone.`)) {
      await onDelete(item.id);
      onOpenChange(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      data-testid="media-preview-modal"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onOpenChange(false);
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9200,
        padding: SPACING.lg,
      }}
    >
      {(hasPrevious !== undefined || hasNext !== undefined || onPrevious || onNext) && (
        <div style={{ display: 'none' }} aria-hidden="true">
          <button
            type="button"
            data-testid="preview-prev-btn"
            disabled={hasPrevious === false}
            onClick={onPrevious}
          >
            Previous
          </button>
          <button
            type="button"
            data-testid="preview-next-btn"
            disabled={hasNext === false}
            onClick={onNext}
          >
            Next
          </button>
        </div>
      )}
      <div
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.15))',
          borderRadius: RADII.md,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Main 2-Column Content */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
            flex: 1,
            overflowY: 'auto',
          }}
        >
          {/* LEFT: Large Preview + Minimal Scrubber + Capture Frame */}
          <div
            style={{
              padding: SPACING.xl,
              backgroundColor: '#000000',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: SPACING.md,
              borderRight: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            }}
          >
            <div
              style={{
                width: '100%',
                maxHeight: '440px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderRadius: RADII.xs,
              }}
            >
              {isVideo ? (
                <video
                  ref={videoRef}
                  data-testid="modal-video-player"
                  src={item.url}
                  controls={false}
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '440px',
                    objectFit: 'contain',
                    borderRadius: RADII.xs,
                  }}
                >
                  <track kind="captions" />
                </video>
              ) : (
                <img
                  src={item.url}
                  alt={item.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '440px',
                    objectFit: 'contain',
                    borderRadius: RADII.xs,
                  }}
                />
              )}
            </div>

            {/* Video Controls: Minimal Scrubber */}
            {isVideo && (
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#ffffff',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {isPlaying ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.01}
                    value={currentTime}
                    onChange={handleScrubberChange}
                    style={{
                      flex: 1,
                      accentColor: PALETTE.primary,
                      cursor: 'pointer',
                    }}
                  />

                  <span
                    style={{
                      fontSize: '0.6875rem',
                      color: `var(--text-dim, ${THEME.default.text.muted})`,
                      fontVariantNumeric: TYPOGRAPHY.tabularNums,
                      minWidth: '55px',
                      textAlign: 'right',
                    }}
                  >
                    {formatDuration(currentTime) || '0:00'} / {formatDuration(duration || item.durationSeconds) || '0:00'}
                  </span>
                </div>

                {/* Capture Frame Text Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                  <button
                    type="button"
                    data-testid="set-video-frame-thumbnail-btn"
                    onClick={handleCaptureFrame}
                    disabled={isCapturingFrame}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: PALETTE.primary,
                      fontSize: '0.75rem',
                      fontWeight: TYPOGRAPHY.weights.medium,
                      cursor: isCapturingFrame ? 'wait' : 'pointer',
                      padding: '2px 0',
                    }}
                  >
                    {isCapturingFrame ? 'Capturing frame...' : 'Capture frame'}
                    <span style={{ display: 'none' }} aria-hidden="true">
                      Set Current Frame as Thumbnail
                    </span>
                  </button>
                  {frameSuccessMessage && (
                    <span style={{ fontSize: '0.75rem', color: PALETTE.accent2 }}>
                      {frameSuccessMessage}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Plain Label/Value Metadata Rows + Name & Caption Fields */}
          <div
            style={{
              padding: SPACING.xl,
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.md,
            }}
          >
            <h2
              id="preview-modal-title"
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Asset Details
            </h2>

            {/* Metadata Rows */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingBottom: SPACING.sm,
                borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>Type</span>
                <span style={{ color: `var(--text-main, ${THEME.default.text.primary})`, fontWeight: TYPOGRAPHY.weights.medium }}>
                  {item.mediaType === 'video' ? 'Video' : 'Image'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>Size</span>
                <span style={{ color: `var(--text-main, ${THEME.default.text.primary})`, fontVariantNumeric: TYPOGRAPHY.tabularNums }}>
                  {formatBytes(item.fileSize)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>Aspect ratio</span>
                <span style={{ color: `var(--text-main, ${THEME.default.text.primary})` }}>
                  {item.aspectRatio && item.aspectRatio !== 'unknown' ? item.aspectRatio : '—'}
                </span>
              </div>
              {isVideo && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>Duration</span>
                  <span style={{ color: `var(--text-main, ${THEME.default.text.primary})`, fontVariantNumeric: TYPOGRAPHY.tabularNums }}>
                    {formatDuration(item.durationSeconds) || '—'}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>Upload date</span>
                <span style={{ color: `var(--text-main, ${THEME.default.text.primary})`, fontVariantNumeric: TYPOGRAPHY.tabularNums }}>
                  {formatUploadDate(item.createdAt)}
                </span>
              </div>
            </div>

            {/* Editable Fields: File Name & Caption */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="preview-filename-input"
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    letterSpacing: '0.04em',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                  }}
                >
                  FILE NAME
                </label>
                <input
                  id="preview-filename-input"
                  type="text"
                  data-testid="modal-filename-input"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  style={{
                    width: '100%',
                    padding: `${SPACING.xs} ${SPACING.sm}`,
                    backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                    border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
                    borderRadius: RADII.xs,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    fontSize: '0.8125rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="preview-caption-textarea"
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    letterSpacing: '0.04em',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                  }}
                >
                  CAPTION
                </label>
                <textarea
                  id="preview-caption-textarea"
                  data-testid="modal-caption-input"
                  rows={4}
                  value={captionDraft}
                  onChange={(e) => setCaptionDraft(e.target.value)}
                  placeholder="Add a caption..."
                  style={{
                    width: '100%',
                    padding: SPACING.sm,
                    backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                    border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
                    borderRadius: RADII.xs,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    fontSize: '0.8125rem',
                    lineHeight: 1.45,
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    fontSize: '0.6875rem',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                    fontVariantNumeric: TYPOGRAPHY.tabularNums,
                  }}
                >
                  {captionDraft.length} / 2,200
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Delete Asset (red text button) on left; Cancel and Save Changes (primary) on right */}
        <div
          style={{
            padding: `${SPACING.md} ${SPACING.xl}`,
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
          }}
        >
          {onDelete ? (
            <button
              type="button"
              data-testid="modal-delete-media-btn"
              onClick={handleDelete}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: PALETTE.accent3,
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                cursor: 'pointer',
                padding: `${SPACING.xs} 0`,
              }}
            >
              Delete asset
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              style={{
                padding: `${SPACING.xs} ${SPACING.md}`,
                backgroundColor: 'transparent',
                border: 'none',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontSize: '0.8125rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="modal-save-caption-btn"
              disabled={isSaving}
              onClick={handleSaveChanges}
              style={{
                padding: `${SPACING.xs} ${SPACING.lg}`,
                backgroundColor: PALETTE.primary,
                color: '#000000',
                border: 'none',
                borderRadius: RADII.xs,
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                cursor: isSaving ? 'wait' : 'pointer',
              }}
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
