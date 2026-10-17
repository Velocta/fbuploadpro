'use client';

import React, { useState, useEffect } from 'react';
import {
  type MediaFolder,
  type MediaItemResponse,
  getEligiblePostFormatsForMedia,
} from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY, COMPONENT_STYLES } from '@/lib/theme';
import { deriveDefaultCaption, formatBytes } from './upload-queue-banner';
import { formatDuration } from './media-asset-tile';

export interface MediaInspectorPanelProps {
  item: MediaItemResponse | null;
  selectedCount: number;
  selectedItems: MediaItemResponse[];
  folders: MediaFolder[];
  isOpen: boolean;
  onClose: () => void;
  onPreview?: (item: MediaItemResponse) => void;
  onUpdateCaption: (mediaId: string, captionText: string) => Promise<void> | void;
  onSchedule: (item: MediaItemResponse) => void;
  onMove: (item: MediaItemResponse) => void;
  onDelete: (item: MediaItemResponse) => void;
  onBatchMove?: () => void;
  onBatchCaption?: () => void;
  onBatchSchedule?: () => void;
  onBatchDelete?: () => void;
}

function renderInspectorPreview(item: MediaItemResponse, isVideo: boolean): React.ReactNode {
  if (isVideo && item.url) {
    return (
      <video
        data-testid="inspector-video-player"
        src={item.url}
        controls
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#000000',
        }}
      >
        <track kind="captions" />
      </video>
    );
  }

  if (item.url) {
    return (
      <img
        src={item.url}
        alt={item.name}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    );
  }

  return (
    <div style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>
      Preview unavailable
    </div>
  );
}

export function MediaInspectorPanel({
  item,
  selectedCount,
  selectedItems,
  folders,
  isOpen,
  onClose,
  onPreview,
  onUpdateCaption,
  onSchedule,
  onMove,
  onDelete,
  onBatchMove,
  onBatchCaption,
  onBatchSchedule,
  onBatchDelete,
}: Readonly<MediaInspectorPanelProps>) {
  const [captionDraft, setCaptionDraft] = useState('');
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (item) {
      const initial =
        item.captionText !== null && item.captionText !== undefined && item.captionText.length > 0
          ? item.captionText
          : deriveDefaultCaption(item.name);
      setCaptionDraft(initial);
      setSaveSuccess(false);
    }
  }, [item?.id, item?.captionText, item?.name]);

  if (!isOpen) {
    return null;
  }

  const isBatchMode = selectedCount > 1;

  if (isBatchMode) {
    const totalBytes = selectedItems.reduce((acc, curr) => acc + curr.fileSize, 0);

    return (
      <aside
        data-testid="media-inspector-panel"
        data-inspector-mode="batch"
        aria-label="Batch Actions Panel"
        style={{
          width: '360px',
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          borderLeft: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          boxSizing: 'border-box',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${SPACING.md} ${SPACING.lg}`,
            borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Batch Selection
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                fontVariantNumeric: TYPOGRAPHY.tabularNums,
              }}
            >
              {selectedCount} assets selected · {formatBytes(totalBytes)}
            </div>
          </div>
          <button
            type="button"
            data-testid="close-inspector-btn"
            onClick={onClose}
            aria-label="Close inspector"
            style={{
              background: 'transparent',
              border: 'none',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              cursor: 'pointer',
              padding: '4px',
              borderRadius: RADII.xs,
              display: 'inline-flex',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Batch Content & Actions */}
        <div
          style={{
            padding: SPACING.lg,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.md,
          }}
        >
          <button
            type="button"
            data-testid="inspector-batch-schedule-btn"
            onClick={onBatchSchedule}
            style={{
              ...COMPONENT_STYLES.primaryButton,
              width: '100%',
              justifyContent: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.xs,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>Schedule {selectedCount} Assets to Queue</span>
          </button>

          <button
            type="button"
            data-testid="inspector-batch-move-btn"
            onClick={onBatchMove}
            style={{
              ...COMPONENT_STYLES.secondaryButton(THEME.default),
              width: '100%',
              justifyContent: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.xs,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <polyline points="12 11 12 17" />
              <polyline points="9 14 12 11 15 14" />
            </svg>
            <span>Move to Folder...</span>
          </button>

          <button
            type="button"
            data-testid="inspector-batch-caption-btn"
            onClick={onBatchCaption}
            style={{
              ...COMPONENT_STYLES.secondaryButton(THEME.default),
              width: '100%',
              justifyContent: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.xs,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span>Append Common Caption / Hashtags...</span>
          </button>

          <button
            type="button"
            data-testid="inspector-batch-delete-btn"
            onClick={onBatchDelete}
            style={{
              ...COMPONENT_STYLES.secondaryButton(THEME.default),
              width: '100%',
              justifyContent: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.xs,
              color: PALETTE.accent3,
              borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Delete {selectedCount} Assets</span>
          </button>
        </div>
      </aside>
    );
  }

  if (!item) {
    return (
      <aside
        data-testid="media-inspector-panel"
        data-inspector-mode="empty"
        aria-label="Media Inspector"
        style={{
          width: '360px',
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          borderLeft: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          padding: SPACING.xl,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <p
          style={{
            color: `var(--text-dim, ${THEME.default.text.muted})`,
            fontSize: '0.875rem',
            margin: 0,
          }}
        >
          Select an asset to inspect details, preview media, edit captions, and schedule posts.
        </p>
      </aside>
    );
  }

  const isVideo = item.mediaType === 'video';
  const eligibleFormats = getEligiblePostFormatsForMedia(item);
  const formattedDuration = formatDuration(item.durationSeconds);
  const currentFolder = folders.find((f) => f.id === item.folderId);
  const folderName = currentFolder ? currentFolder.name : 'All Media';

  const handleSaveCaption = async () => {
    const trimmed = captionDraft.trim();
    setIsSavingCaption(true);
    setSaveSuccess(false);
    try {
      await onUpdateCaption(item.id, trimmed);
      setSaveSuccess(true);
    } finally {
      setIsSavingCaption(false);
    }
  };

  return (
    <aside
      data-testid="media-inspector-panel"
      data-inspector-mode="single"
      aria-label={`Details for ${item.name}`}
      style={{
        width: '360px',
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        borderLeft: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${SPACING.md} ${SPACING.lg}`,
          borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        }}
      >
        <div style={{ minWidth: 0, flex: 1, marginRight: SPACING.sm }}>
          <div
            title={item.name}
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
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              fontVariantNumeric: TYPOGRAPHY.tabularNums,
            }}
          >
            {formatBytes(item.fileSize)} · {isVideo ? 'Video' : 'Image'}
          </div>
        </div>
        <button
          type="button"
          data-testid="close-inspector-btn"
          onClick={onClose}
          aria-label="Close inspector"
          style={{
            background: 'transparent',
            border: 'none',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            cursor: 'pointer',
            padding: '4px',
            borderRadius: RADII.xs,
            display: 'inline-flex',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div
        style={{
          padding: SPACING.lg,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.lg,
        }}
      >
        {/* Interactive Media Preview Box */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 10',
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.md,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {renderInspectorPreview(item, isVideo)}

          {/* Fullscreen Modal trigger button */}
          <button
            type="button"
            data-testid="inspector-fullscreen-preview-btn"
            onClick={() => onPreview?.(item)}
            title="Expand Full Preview"
            style={{
              position: 'absolute',
              top: SPACING.xs,
              right: SPACING.xs,
              background: 'rgba(0, 0, 0, 0.75)',
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.xs,
              color: PALETTE.text,
              cursor: 'pointer',
              padding: '4px',
              display: 'inline-flex',
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
        </div>

        {/* Primary Schedule Post Action */}
        <button
          type="button"
          data-testid="inspector-schedule-btn"
          onClick={() => onSchedule(item)}
          style={{
            ...COMPONENT_STYLES.primaryButton,
            width: '100%',
            justifyContent: 'center',
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.xs,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Schedule Post</span>
        </button>

        {/* Secondary Action Row: Move, Download, Delete */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: SPACING.xs,
          }}
        >
          <button
            type="button"
            data-testid="inspector-move-btn"
            onClick={() => onMove(item)}
            style={{
              ...COMPONENT_STYLES.secondaryButton(THEME.default),
              padding: '6px 8px',
              fontSize: '0.75rem',
              justifyContent: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: `var(--text-main, ${THEME.default.text.primary})`,
              borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
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
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Move</span>
          </button>

          <a
            href={item.url}
            download={item.name}
            data-testid="inspector-download-btn"
            style={{
              ...COMPONENT_STYLES.secondaryButton(THEME.default),
              padding: '6px 8px',
              fontSize: '0.75rem',
              justifyContent: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'none',
              color: `var(--text-main, ${THEME.default.text.primary})`,
              borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
              boxSizing: 'border-box',
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download</span>
          </a>

          <button
            type="button"
            data-testid="inspector-delete-btn"
            onClick={() => onDelete(item)}
            style={{
              ...COMPONENT_STYLES.secondaryButton(THEME.default),
              padding: '6px 8px',
              fontSize: '0.75rem',
              justifyContent: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: PALETTE.accent3,
              borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
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
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Delete</span>
          </button>
        </div>

        {/* Caption Studio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <label
              htmlFor="inspector-caption-textarea"
              style={{
                fontSize: '0.75rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              Caption
            </label>
            <span
              style={{
                fontSize: '0.6875rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                fontVariantNumeric: TYPOGRAPHY.tabularNums,
              }}
            >
              {captionDraft.length} characters
            </span>
          </div>

          <textarea
            id="inspector-caption-textarea"
            data-testid="inspector-caption-textarea"
            value={captionDraft}
            onChange={(e) => {
              setCaptionDraft(e.target.value);
              setSaveSuccess(false);
            }}
            placeholder="Write a caption for your automated post..."
            rows={4}
            style={{
              ...COMPONENT_STYLES.input(THEME.default),
              width: '100%',
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              boxSizing: 'border-box',
              resize: 'vertical',
              lineHeight: 1.45,
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '2px',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                color: saveSuccess ? PALETTE.accent4 : 'transparent',
                fontWeight: TYPOGRAPHY.weights.medium,
                transition: 'color 0.2s ease',
              }}
            >
              {saveSuccess ? '✓ Saved' : ''}
            </span>
            <button
              type="button"
              data-testid="inspector-save-caption-btn"
              onClick={() => void handleSaveCaption()}
              disabled={isSavingCaption}
              style={{
                ...COMPONENT_STYLES.secondaryButton(THEME.default),
                padding: '4px 12px',
                fontSize: '0.75rem',
                color: `var(--text-main, ${THEME.default.text.primary})`,
                borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
                opacity: isSavingCaption ? 0.6 : 1,
              }}
            >
              {isSavingCaption ? 'Saving...' : 'Save Caption'}
            </button>
          </div>
        </div>

        {/* Facebook Publishing Eligibility */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Publishing Formats
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
              padding: SPACING.sm,
              borderRadius: RADII.sm,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            }}
          >
            {[
              { format: 'reel', label: 'Reels' },
              { format: 'video', label: 'Feed Video' },
              { format: 'story', label: 'Stories' },
              { format: 'image', label: 'Feed Photo' },
            ].map(({ format, label }) => {
              const isEligible = eligibleFormats.includes(format as any);
              return (
                <div
                  key={format}
                  data-testid={`eligibility-row-${format}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                  }}
                >
                  <span style={{ color: `var(--text-main, ${THEME.default.text.primary})` }}>
                    {label}
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: isEligible
                        ? PALETTE.accent4
                        : `var(--text-dim, ${THEME.default.text.muted})`,
                      fontSize: '0.6875rem',
                      fontWeight: TYPOGRAPHY.weights.medium,
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: isEligible ? PALETTE.accent4 : PALETTE.accent2,
                        boxShadow: isEligible ? `0 0 6px ${PALETTE.accent4}` : 'none',
                        display: 'inline-block',
                      }}
                    />
                    {isEligible ? 'Eligible' : 'Not supported'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Technical Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            File Specifications
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: SPACING.xs,
              fontSize: '0.75rem',
            }}
          >
            <div
              style={{
                backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                padding: '6px 8px',
                borderRadius: RADII.xs,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              }}
            >
              <div style={{ color: `var(--text-dim, ${THEME.default.text.muted})`, fontSize: '0.6875rem' }}>
                Aspect Ratio
              </div>
              <div
                style={{
                  fontWeight: TYPOGRAPHY.weights.medium,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  fontVariantNumeric: TYPOGRAPHY.tabularNums,
                }}
              >
                {item.aspectRatio && item.aspectRatio !== 'unknown' ? item.aspectRatio : '—'}
              </div>
            </div>

            <div
              style={{
                backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                padding: '6px 8px',
                borderRadius: RADII.xs,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              }}
            >
              <div style={{ color: `var(--text-dim, ${THEME.default.text.muted})`, fontSize: '0.6875rem' }}>
                Duration
              </div>
              <div
                style={{
                  fontWeight: TYPOGRAPHY.weights.medium,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  fontVariantNumeric: TYPOGRAPHY.tabularNums,
                }}
              >
                {formattedDuration ?? 'Static Image'}
              </div>
            </div>

            <div
              style={{
                backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                padding: '6px 8px',
                borderRadius: RADII.xs,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              }}
            >
              <div style={{ color: `var(--text-dim, ${THEME.default.text.muted})`, fontSize: '0.6875rem' }}>
                File Size
              </div>
              <div
                style={{
                  fontWeight: TYPOGRAPHY.weights.medium,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  fontVariantNumeric: TYPOGRAPHY.tabularNums,
                }}
              >
                {formatBytes(item.fileSize)}
              </div>
            </div>

            <div
              style={{
                backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                padding: '6px 8px',
                borderRadius: RADII.xs,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              }}
            >
              <div style={{ color: `var(--text-dim, ${THEME.default.text.muted})`, fontSize: '0.6875rem' }}>
                Folder Location
              </div>
              <div
                title={folderName}
                style={{
                  fontWeight: TYPOGRAPHY.weights.medium,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {folderName}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
