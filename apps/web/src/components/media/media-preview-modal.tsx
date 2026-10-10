'use client';

import React, { useState } from 'react';
import type { MediaItemResponse } from '@fbuploadpro/contracts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY, COMPONENT_STYLES } from '@/lib/theme';
import { deriveDefaultCaption, formatBytes } from './upload-queue-banner';
import { formatDuration } from './media-asset-card';

export interface MediaPreviewModalProps {
  item: MediaItemResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?:
    | ((
        mediaId: string,
        updates: { name?: string; captionText?: string }
      ) => Promise<void> | void)
    | undefined;
  onDelete?: ((mediaId: string) => Promise<void> | void) | undefined;
}

export function MediaPreviewModal({
  item,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: Readonly<MediaPreviewModalProps>) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="media-preview-modal"
        style={{ maxWidth: '680px' }}
      >
        <MediaPreviewModalBody
          key={`${item.id}-${item.updatedAt}`}
          item={item}
          onClose={() => onOpenChange(false)}
          onSave={onSave}
          onDelete={onDelete}
        />
      </DialogContent>
    </Dialog>
  );
}

interface MediaPreviewModalBodyProps {
  item: MediaItemResponse;
  onClose: () => void;
  onSave?:
    | ((
        mediaId: string,
        updates: { name?: string; captionText?: string }
      ) => Promise<void> | void)
    | undefined;
  onDelete?: ((mediaId: string) => Promise<void> | void) | undefined;
}

function MediaPreviewModalBody({
  item,
  onClose,
  onSave,
  onDelete,
}: Readonly<MediaPreviewModalBodyProps>) {
  const defaultCaption =
    item.captionText !== null && item.captionText !== undefined && item.captionText.length > 0
      ? item.captionText
      : deriveDefaultCaption(item.name);

  const [name, setName] = useState(item.name);
  const [captionText, setCaptionText] = useState(defaultCaption);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isVideo = item.mediaType === 'video';
  const durationLabel = formatDuration(item.durationSeconds);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave?.(item.id, {
        name: name.trim() || item.name,
        captionText: captionText.trim(),
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete?.(item.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{item.name}</DialogTitle>
        <DialogDescription>
          Review your media asset and edit its publishing caption.
        </DialogDescription>
      </DialogHeader>

      <DialogBody
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.md,
        }}
      >
        {/* Video Player or High-Res Image Preview */}
        <div
          style={{
            width: '100%',
            maxHeight: '360px',
            backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.md,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isVideo ? (
            <video
              data-testid="modal-video-player"
              src={item.url}
              poster={item.thumbnailUrl ?? undefined}
              controls
              playsInline
              style={{
                width: '100%',
                maxHeight: '360px',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <img
              data-testid="modal-image-preview"
              src={item.url}
              alt={item.name}
              style={{
                width: '100%',
                maxHeight: '360px',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          )}
        </div>

        {/* Technical Metadata Readout */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.md,
            flexWrap: 'wrap',
            padding: `${SPACING.xs} ${SPACING.sm}`,
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.xs,
            fontSize: '0.75rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            fontVariantNumeric: TYPOGRAPHY.tabularNums,
          }}
        >
          <span>
            <strong>Type:</strong> {isVideo ? 'Video' : 'Image'}
          </span>
          <span>
            <strong>Size:</strong> {formatBytes(item.fileSize)}
          </span>
          {item.aspectRatio && item.aspectRatio !== 'unknown' && (
            <span>
              <strong>Aspect ratio:</strong> {item.aspectRatio}
            </span>
          )}
          {durationLabel && (
            <span>
              <strong>Duration:</strong> {durationLabel}
            </span>
          )}
        </div>

        {/* File Name Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
          <label
            htmlFor="modal-filename-input"
            style={{
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            File name
          </label>
          <input
            id="modal-filename-input"
            type="text"
            data-testid="modal-filename-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              ...COMPONENT_STYLES.input(THEME.default),
              width: '100%',
              backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Multi-Line Caption Editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
          <label
            htmlFor="modal-caption-input"
            style={{
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Caption
          </label>
          <textarea
            id="modal-caption-input"
            data-testid="modal-caption-input"
            rows={4}
            value={captionText}
            onChange={(e) => setCaptionText(e.target.value)}
            placeholder="Write a caption for when this post is published..."
            style={{
              width: '100%',
              padding: SPACING.sm,
              backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.sm,
              fontSize: '0.875rem',
              fontFamily: TYPOGRAPHY.fontFamily,
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </DialogBody>

      <DialogFooter
        style={{
          justifyContent: 'space-between',
        }}
      >
        <div>
          {onDelete && (
            <button
              type="button"
              data-testid="modal-delete-media-btn"
              disabled={isDeleting || isSaving}
              onClick={() => void handleDelete()}
              style={{
                height: '38px',
                padding: `0 ${SPACING.md}`,
                backgroundColor: 'transparent',
                color: PALETTE.accent3,
                border: `1px solid ${PALETTE.accent3}`,
                borderRadius: RADII.sm,
                fontSize: '0.875rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                cursor: isDeleting || isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {isDeleting ? 'Deleting...' : 'Delete asset'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              ...COMPONENT_STYLES.secondaryButton(THEME.default),
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            data-testid="modal-save-caption-btn"
            disabled={isSaving || isDeleting}
            onClick={() => void handleSave()}
            style={{
              ...COMPONENT_STYLES.primaryButton,
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </DialogFooter>
    </>
  );
}
