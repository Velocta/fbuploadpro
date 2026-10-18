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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

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

interface PreviewMediaViewerProps {
  item: MediaItemResponse;
  isVideo: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isCapturingFrame: boolean;
  frameSuccessMessage: string | null;
  onTimeUpdate: () => void;
  onEnded: () => void;
  onTogglePlay: () => void;
  onScrubberChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCaptureFrame: () => void;
}

function PreviewMediaViewer({
  item,
  isVideo,
  videoRef,
  currentTime,
  duration,
  isPlaying,
  isCapturingFrame,
  frameSuccessMessage,
  onTimeUpdate,
  onEnded,
  onTogglePlay,
  onScrubberChange,
  onCaptureFrame,
}: Readonly<PreviewMediaViewerProps>) {
  return (
    <div
      style={{
        padding: SPACING.xl,
        backgroundColor: PALETTE.background,
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
            onTimeUpdate={onTimeUpdate}
            onEnded={onEnded}
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
              onClick={onTogglePlay}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: PALETTE.text,
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
              onChange={onScrubberChange}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
            <button
              type="button"
              data-testid="set-video-frame-thumbnail-btn"
              onClick={onCaptureFrame}
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
  );
}

interface PreviewMetadataEditorProps {
  item: MediaItemResponse;
  isVideo: boolean;
  nameDraft: string;
  captionDraft: string;
  isSaving: boolean;
  isDeleting: boolean;
  onNameChange: (val: string) => void;
  onCaptionChange: (val: string) => void;
}

function PreviewMetadataEditor({
  item,
  isVideo,
  nameDraft,
  captionDraft,
  isSaving,
  isDeleting,
  onNameChange,
  onCaptionChange,
}: Readonly<PreviewMetadataEditorProps>) {
  const isBusy = isSaving || isDeleting;
  return (
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            htmlFor="preview-filename-input"
            style={{
              fontSize: '0.6875rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
            }}
          >
            File name
          </label>
          <input
            id="preview-filename-input"
            type="text"
            data-testid="modal-filename-input"
            disabled={isBusy}
            value={nameDraft}
            onChange={(e) => onNameChange(e.target.value)}
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
              opacity: isBusy ? 0.6 : 1,
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
              textTransform: 'uppercase',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
            }}
          >
            Caption
          </label>
          <textarea
            id="preview-caption-textarea"
            data-testid="modal-caption-input"
            rows={4}
            disabled={isBusy}
            value={captionDraft}
            onChange={(e) => onCaptionChange(e.target.value)}
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
              opacity: isBusy ? 0.6 : 1,
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
  );
}

interface PreviewModalFooterProps {
  hasDelete: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  onDelete?: () => void;
  onCancel: () => void;
  onSave: () => void;
}

function PreviewModalFooter({
  hasDelete,
  isSaving,
  isDeleting,
  onDelete,
  onCancel,
  onSave,
}: Readonly<PreviewModalFooterProps>) {
  const isBusy = isSaving || isDeleting;
  return (
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
      {hasDelete ? (
        <button
          type="button"
          data-testid="modal-delete-media-btn"
          disabled={isBusy}
          onClick={onDelete}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: PALETTE.accent3,
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            cursor: isBusy ? 'not-allowed' : 'pointer',
            opacity: isBusy ? 0.6 : 1,
            padding: `${SPACING.xs} 0`,
          }}
        >
          {isDeleting ? 'Deleting...' : 'Delete asset'}
        </button>
      ) : (
        <div />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
        <button
          type="button"
          disabled={isBusy}
          onClick={onCancel}
          style={{
            padding: `${SPACING.xs} ${SPACING.md}`,
            backgroundColor: 'transparent',
            border: 'none',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            fontSize: '0.8125rem',
            cursor: isBusy ? 'not-allowed' : 'pointer',
            opacity: isBusy ? 0.6 : 1,
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          data-testid="modal-save-caption-btn"
          disabled={isBusy}
          onClick={onSave}
          style={{
            padding: `${SPACING.xs} ${SPACING.lg}`,
            backgroundColor: PALETTE.primary,
            color: PALETTE.background,
            border: 'none',
            borderRadius: RADII.xs,
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            cursor: isBusy ? 'not-allowed' : 'pointer',
            opacity: isBusy ? 0.6 : 1,
          }}
        >
          {isSaving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
    if (!videoRef.current || !onUpdateThumbnail || isCapturingFrame || isSaving || isDeleting) return;
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
    if (!onSave || isSaving || isDeleting) return;
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

  const handleDelete = () => {
    if (!onDelete || isDeleting || isSaving) return;
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!onDelete || isDeleting || isSaving) return;
    setIsDeleting(true);
    try {
      await onDelete(item.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <dialog
      open
      aria-labelledby="preview-modal-title"
      data-testid="media-preview-modal"
      onPointerDown={(e) => {
        if (!isSaving && !isDeleting && e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
      onKeyDown={(e) => {
        if (!isSaving && !isDeleting && !showDeleteConfirm && e.key === 'Escape') {
          onOpenChange(false);
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: 'none',
        maxHeight: 'none',
        margin: 0,
        border: 'none',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9200,
        padding: SPACING.lg,
        boxSizing: 'border-box',
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
            flex: 1,
            overflowY: 'auto',
          }}
        >
          <PreviewMediaViewer
            item={item}
            isVideo={isVideo}
            videoRef={videoRef}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            isCapturingFrame={isCapturingFrame}
            frameSuccessMessage={frameSuccessMessage}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            onTogglePlay={handleTogglePlay}
            onScrubberChange={handleScrubberChange}
            onCaptureFrame={handleCaptureFrame}
          />

          <PreviewMetadataEditor
            item={item}
            isVideo={isVideo}
            nameDraft={nameDraft}
            captionDraft={captionDraft}
            isSaving={isSaving}
            isDeleting={isDeleting}
            onNameChange={setNameDraft}
            onCaptionChange={setCaptionDraft}
          />
        </div>

        <PreviewModalFooter
          hasDelete={Boolean(onDelete)}
          isSaving={isSaving}
          isDeleting={isDeleting}
          onDelete={handleDelete}
          onCancel={() => onOpenChange(false)}
          onSave={handleSaveChanges}
        />
      </div>

      {/* Single-asset delete confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent style={{ maxWidth: '440px' }} data-testid="preview-delete-confirm-dialog">
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{item.name}&rdquo;?</DialogTitle>
            <DialogDescription>This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              data-testid="preview-delete-keep-btn"
              disabled={isDeleting}
              onClick={() => setShowDeleteConfirm(false)}
              style={{
                height: '36px',
                padding: `0 ${SPACING.md}`,
                backgroundColor: 'transparent',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.sm,
                fontSize: '0.875rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                opacity: isDeleting ? 0.6 : 1,
              }}
            >
              Keep
            </button>
            <button
              type="button"
              data-testid="preview-delete-confirm-btn"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              style={{
                height: '36px',
                padding: `0 ${SPACING.md}`,
                backgroundColor: PALETTE.accent3,
                color: PALETTE.text,
                border: 'none',
                borderRadius: RADII.sm,
                fontSize: '0.875rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                opacity: isDeleting ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: SPACING.xs,
              }}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </dialog>
  );
}
