'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import { AllowedMediaMimeTypes } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import {
  type ImportQueueItem,
  formatBytes,
  deriveDefaultCaption,
} from './media-types';

export const MAX_CONCURRENT_UPLOADS = 3;
export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

const EXTENSION_TO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function resolveMimeType(file: File): string {
  if (file.type && AllowedMediaMimeTypes.includes(file.type as any)) {
    return file.type;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_TO_MIME[ext] || '';
}

function resolveMediaType(mimeType: string): 'video' | 'image' {
  return mimeType.startsWith('video/') ? 'video' : 'image';
}

function classifyAspectRatio(width: number, height: number): string {
  if (!width || !height) return 'unknown';
  const ratio = width / height;
  if (Math.abs(ratio - 9 / 16) < 0.08) return '9:16';
  if (Math.abs(ratio - 16 / 9) < 0.08) return '16:9';
  if (Math.abs(ratio - 1) < 0.08) return '1:1';
  if (Math.abs(ratio - 4 / 5) < 0.08) return '4:5';
  return `${width}:${height}`;
}

async function generateThumbnailBlob(
  file: File,
  mediaType: 'video' | 'image'
): Promise<{ blob: Blob | null; width: number | null; height: number | null; duration: number | null }> {
  const fallback = { blob: null, width: null, height: null, duration: null };
  if (typeof window === 'undefined') return fallback;

  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(fallback);
      }
    }, 3000);

    const finish = (result: { blob: Blob | null; width: number | null; height: number | null; duration: number | null }) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve(result);
    };

    try {
      const url = URL.createObjectURL(file);

      if (mediaType === 'image') {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 480;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, w, h);
            canvas.toBlob(
              (blob) => {
                URL.revokeObjectURL(url);
                finish({ blob, width: img.width, height: img.height, duration: null });
              },
              'image/webp',
              0.82
            );
          } catch {
            URL.revokeObjectURL(url);
            finish(fallback);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          finish(fallback);
        };
        img.src = url;
      } else {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';

        video.onloadedmetadata = () => {
          video.currentTime = Math.min(1.0, (video.duration || 1) / 2);
        };

        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 480;
            let w = video.videoWidth;
            let h = video.videoHeight;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            canvas.width = w || 320;
            canvas.height = h || 240;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
              (blob) => {
                URL.revokeObjectURL(url);
                finish({
                  blob,
                  width: video.videoWidth || null,
                  height: video.videoHeight || null,
                  duration: Number.isFinite(video.duration) ? video.duration : null,
                });
              },
              'image/webp',
              0.82
            );
          } catch {
            URL.revokeObjectURL(url);
            finish(fallback);
          }
        };

        video.onerror = () => {
          URL.revokeObjectURL(url);
          finish(fallback);
        };
        video.src = url;
      }
    } catch {
      finish(fallback);
    }
  });
}

// -----------------------------------------------------------------------------
// Subcomponent: Staging Header & Destination Pill Dropdown
// -----------------------------------------------------------------------------
interface ImportStagingHeaderProps {
  totalCount: number;
  destinationFolderName: string;
  selectedFolderId: string | null;
  folders: MediaFolder[];
  isDropdownOpen: boolean;
  onToggleDropdown: () => void;
  onSelectFolder: (folderId: string | null) => void;
}

function ImportStagingHeader({
  totalCount,
  destinationFolderName,
  selectedFolderId,
  folders,
  isDropdownOpen,
  onToggleDropdown,
  onSelectFolder,
}: Readonly<ImportStagingHeaderProps>) {
  return (
    <div
      style={{
        padding: `${SPACING.md} ${SPACING.lg}`,
        borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.md,
      }}
    >
      <div>
        <h2
          id="import-media-title"
          data-testid="import-modal-title"
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Import media
        </h2>
        <p
          data-testid="import-staging-subtext"
          style={{
            margin: '4px 0 0 0',
            fontSize: '0.8125rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          {totalCount} file{totalCount === 1 ? '' : 's'} selected · will be added to {destinationFolderName}
        </p>
      </div>

      {/* Destination Pill Button */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          data-testid="destination-folder-pill"
          onClick={onToggleDropdown}
          aria-haspopup="listbox"
          aria-expanded={isDropdownOpen}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
            borderRadius: RADII.full,
            color: `var(--text-main, ${THEME.default.text.primary})`,
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={PALETTE.primary}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>To: {destinationFolderName}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {isDropdownOpen && (
          <div
            data-testid="destination-dropdown"
            role="listbox"
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              minWidth: '180px',
              maxHeight: '220px',
              overflowY: 'auto',
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.15))',
              borderRadius: RADII.xs,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              padding: '4px',
            }}
          >
            <button
              type="button"
              data-testid="destination-option-root"
              role="option"
              aria-selected={selectedFolderId === null}
              onClick={() => onSelectFolder(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                backgroundColor:
                  selectedFolderId === null
                    ? `var(--bg-hover, ${THEME.default.surfaces.hover})`
                    : 'transparent',
                border: 'none',
                borderRadius: RADII.xs,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.8125rem',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span>Library</span>
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                data-testid={`destination-option-${f.id}`}
                role="option"
                aria-selected={selectedFolderId === f.id}
                onClick={() => onSelectFolder(f.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 8px',
                  backgroundColor:
                    selectedFolderId === f.id
                      ? `var(--bg-hover, ${THEME.default.surfaces.hover})`
                      : 'transparent',
                  border: 'none',
                  borderRadius: RADII.xs,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  fontSize: '0.8125rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span>{f.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subcomponent: Staging Row (46px thumbnail tile, name/size, flags, X)
// -----------------------------------------------------------------------------
interface ImportStagingRowProps {
  item: ImportQueueItem;
  onRemove: (id: string) => void;
  onKeepDuplicate: (id: string) => void;
}

function ImportStagingRow({
  item,
  onRemove,
  onKeepDuplicate,
}: Readonly<ImportStagingRowProps>) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      data-testid={`import-row-${item.id}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${SPACING.xs} ${SPACING.sm}`,
        backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
        border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
        borderRadius: RADII.xs,
        gap: SPACING.sm,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.sm,
          overflow: 'hidden',
          flex: 1,
        }}
      >
        {/* 46px Thumbnail Tile */}
        <div
          data-testid={`thumbnail-tile-${item.id}`}
          style={{
            width: '46px',
            height: '46px',
            minWidth: '46px',
            borderRadius: RADII.xs,
            overflow: 'hidden',
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {item.mediaType === 'image' && item.previewUrl && !imageError ? (
            <img
              src={item.previewUrl}
              alt={item.name}
              onError={() => setImageError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={PALETTE.primary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {item.mediaType === 'video' ? (
                <>
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </>
              ) : (
                <>
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </>
              )}
            </svg>
          )}
        </div>

        {/* File Name & Size */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <span
            title={item.name}
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
          <span
            style={{
              fontSize: '0.75rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              fontVariantNumeric: TYPOGRAPHY.tabularNums,
            }}
          >
            {formatBytes(item.size)}
          </span>
        </div>
      </div>

      {/* Row Status & Per-Row Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
        {item.validationError && (
          <span
            data-testid={`validation-error-${item.id}`}
            style={{
              fontSize: '0.75rem',
              color: PALETTE.accent3,
              fontWeight: TYPOGRAPHY.weights.medium,
            }}
          >
            {item.validationError}
          </span>
        )}

        {item.isDuplicate && !item.validationError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              data-testid={`duplicate-flag-${item.id}`}
              style={{
                fontSize: '0.6875rem',
                color: PALETTE.primary,
                fontWeight: TYPOGRAPHY.weights.semibold,
              }}
            >
              possible duplicate
            </span>
            <button
              type="button"
              data-testid={`keep-duplicate-${item.id}`}
              onClick={() => onKeepDuplicate(item.id)}
              style={{
                padding: '2px 6px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                borderRadius: RADII.xs,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.6875rem',
                cursor: 'pointer',
              }}
            >
              Keep
            </button>
          </div>
        )}

        {/* Per-Row X Button */}
        <button
          type="button"
          data-testid={`remove-staged-${item.id}`}
          onClick={() => onRemove(item.id)}
          aria-label={item.isDuplicate ? `Skip ${item.name}` : `Remove ${item.name}`}
          title={item.isDuplicate ? 'Skip' : 'Remove'}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            cursor: 'pointer',
            padding: '4px',
            opacity: isHovered ? 1 : 0.6,
            transition: 'opacity 0.15s ease',
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subcomponent: Staging Footer
// -----------------------------------------------------------------------------
interface ImportStagingFooterProps {
  validCount: number;
  isStarting: boolean;
  onAddMore: () => void;
  onCancel: () => void;
  onStart: () => void;
}

function ImportStagingFooter({
  validCount,
  isStarting,
  onAddMore,
  onCancel,
  onStart,
}: Readonly<ImportStagingFooterProps>) {
  const isStartDisabled = validCount === 0 || isStarting;
  return (
    <div
      style={{
        padding: `${SPACING.md} ${SPACING.lg}`,
        borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <button
        type="button"
        data-testid="add-more-files-btn"
        onClick={onAddMore}
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          color: PALETTE.primary,
          fontSize: '0.8125rem',
          fontWeight: TYPOGRAPHY.weights.medium,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        + Add more
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
        <button
          type="button"
          data-testid="cancel-staging-btn"
          onClick={onCancel}
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
          data-testid="start-import-btn"
          disabled={isStartDisabled}
          onClick={onStart}
          style={{
            padding: `${SPACING.xs} ${SPACING.lg}`,
            backgroundColor: !isStartDisabled ? PALETTE.primary : 'rgba(250, 215, 52, 0.3)',
            color: '#000000',
            border: 'none',
            borderRadius: RADII.xs,
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            cursor: !isStartDisabled ? 'pointer' : 'not-allowed',
            opacity: isStarting ? 0.6 : 1,
          }}
        >
          {isStarting ? 'Starting...' : `Start import (${validCount})`}
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subcomponent: Progress Header (Title, Subtext, Large % & Aggregate Progress Bar)
// -----------------------------------------------------------------------------
interface ImportProgressHeaderProps {
  step: 'progress' | 'complete';
  destinationFolderName: string;
  completedCount: number;
  totalCount: number;
  isAllCancelled: boolean;
  overallProgressPercent: number;
}

function ImportProgressHeader({
  step,
  destinationFolderName,
  completedCount,
  totalCount,
  isAllCancelled,
  overallProgressPercent,
}: Readonly<ImportProgressHeaderProps>) {
  const getTitle = () => {
    if (step === 'complete') {
      return isAllCancelled ? 'Import canceled' : 'Import complete';
    }
    return 'Importing media';
  };

  const getSubtext = () => {
    if (step === 'complete') {
      if (isAllCancelled) {
        return 'Import canceled — nothing was uploaded';
      }
      return `${completedCount} of ${totalCount} added to ${destinationFolderName}`;
    }
    return `Adding to ${destinationFolderName}`;
  };

  const barPercent = step === 'complete' && !isAllCancelled ? 100 : overallProgressPercent;

  return (
    <div
      style={{
        padding: `${SPACING.md} ${SPACING.lg}`,
        borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.xs,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2
            id="import-media-title"
            data-testid="import-modal-title"
            style={{
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            {getTitle()}
          </h2>
          <p
            data-testid="import-progress-subtext"
            style={{
              margin: '4px 0 0 0',
              fontSize: '0.8125rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            {getSubtext()}
          </p>
        </div>

        {/* Large Overall Percentage */}
        <div
          data-testid="overall-progress-percentage"
          style={{
            fontSize: '1.5rem',
            fontWeight: TYPOGRAPHY.weights.bold,
            color: PALETTE.primary,
            fontVariantNumeric: TYPOGRAPHY.tabularNums,
            lineHeight: 1,
          }}
        >
          {barPercent}%
        </div>
      </div>

      {/* Full-Width Aggregate Progress Track */}
      <div
        style={{
          width: '100%',
          height: '6px',
          backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
          borderRadius: '3px',
          overflow: 'hidden',
          marginTop: SPACING.xs,
        }}
      >
        <div
          data-testid="aggregate-progress-bar"
          style={{
            width: `${barPercent}%`,
            height: '100%',
            backgroundColor: PALETTE.primary,
            transition: 'width 0.2s ease',
          }}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subcomponent: Progress Row (uploading, paused, queued, failed, done, cancelled)
// -----------------------------------------------------------------------------
interface ImportProgressRowProps {
  item: ImportQueueItem;
  destinationFolderName: string;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}

function ImportProgressRow({
  item,
  destinationFolderName,
  onPause,
  onResume,
  onCancel,
  onRetry,
}: Readonly<ImportProgressRowProps>) {
  const isQueued = item.status === 'queued';
  const isUploading = item.status === 'uploading';
  const isCompleted = item.status === 'completed';
  const isFailed = item.status === 'failed';
  const isPaused = item.status === 'paused';
  const isCancelled = item.status === 'cancelled';

  return (
    <div
      data-testid={`import-row-${item.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${SPACING.xs} ${SPACING.sm}`,
        backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
        border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
        borderRadius: RADII.xs,
        gap: SPACING.sm,
        opacity: isCancelled ? 0.45 : 1,
      }}
    >
      {/* 46px Thumbnail & File Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.sm,
          overflow: 'hidden',
          flex: 1,
        }}
      >
        <div
          style={{
            width: '46px',
            height: '46px',
            minWidth: '46px',
            borderRadius: RADII.xs,
            overflow: 'hidden',
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {item.mediaType === 'image' && item.previewUrl ? (
            <img
              src={item.previewUrl}
              alt={item.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={PALETTE.primary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {item.mediaType === 'video' ? (
                <>
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </>
              ) : (
                <>
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </>
              )}
            </svg>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <span
            title={item.name}
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
          <span
            style={{
              fontSize: '0.75rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              fontVariantNumeric: TYPOGRAPHY.tabularNums,
            }}
          >
            {formatBytes(item.size)}
          </span>
        </div>
      </div>

      {/* Row Status & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
        {isQueued && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: `var(--text-dim, ${THEME.default.text.muted})` }}>
              queued
            </span>
            <button
              type="button"
              data-testid={`cancel-queued-${item.id}`}
              onClick={() => onCancel(item.id)}
              aria-label={`Cancel ${item.name}`}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                cursor: 'pointer',
                padding: '2px',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {isUploading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '130px' }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  width: '100%',
                  height: '4px',
                  backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${item.progressPercent}%`,
                    height: '100%',
                    backgroundColor: PALETTE.primary,
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  fontVariantNumeric: TYPOGRAPHY.tabularNums,
                }}
              >
                {item.progressPercent}%
              </span>
            </div>
            <button
              type="button"
              data-testid={`pause-upload-${item.id}`}
              onClick={() => onPause(item.id)}
              aria-label={`Pause ${item.name}`}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                cursor: 'pointer',
                fontSize: '0.6875rem',
              }}
            >
              Pause
            </button>
            <button
              type="button"
              data-testid={`cancel-upload-${item.id}`}
              onClick={() => onCancel(item.id)}
              aria-label={`Cancel ${item.name}`}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                cursor: 'pointer',
                fontSize: '0.6875rem',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {isPaused && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '130px' }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  width: '100%',
                  height: '4px',
                  backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${item.progressPercent}%`,
                    height: '100%',
                    backgroundColor: `var(--text-dim, ${THEME.default.text.muted})`,
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  fontVariantNumeric: TYPOGRAPHY.tabularNums,
                }}
              >
                {item.progressPercent}%
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: `var(--text-dim, ${THEME.default.text.muted})` }}>
              paused
            </span>
            <button
              type="button"
              data-testid={`resume-upload-${item.id}`}
              onClick={() => onResume(item.id)}
              style={{
                padding: '2px 6px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                borderRadius: RADII.xs,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.6875rem',
                cursor: 'pointer',
              }}
            >
              Resume
            </button>
          </div>
        )}

        {isCompleted && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                color: PALETTE.accent2,
                fontWeight: TYPOGRAPHY.weights.medium,
              }}
            >
              uploaded to {destinationFolderName}
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={PALETTE.accent2}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}

        {isFailed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: PALETTE.accent3 }}>
              {item.validationError || 'failed — retry'}
            </span>
            <button
              type="button"
              data-testid={`retry-upload-${item.id}`}
              onClick={() => onRetry(item.id)}
              style={{
                padding: '2px 6px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                borderRadius: RADII.xs,
                color: PALETTE.primary,
                fontSize: '0.6875rem',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {isCancelled && (
          <span style={{ fontSize: '0.75rem', color: `var(--text-dim, ${THEME.default.text.muted})` }}>
            cancelled
          </span>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subcomponent: Progress Footer (Leave warning, Cancel remaining, Keep working, Done)
// -----------------------------------------------------------------------------
interface ImportProgressFooterProps {
  step: 'progress' | 'complete';
  isUploading: boolean;
  canCancelRemaining: boolean;
  onCancelRemaining: () => void;
  onKeepWorking: () => void;
  onDone: () => void;
}

function ImportProgressFooter({
  step,
  isUploading,
  canCancelRemaining,
  onCancelRemaining,
  onKeepWorking,
  onDone,
}: Readonly<ImportProgressFooterProps>) {
  if (step === 'complete') {
    return (
      <div
        style={{
          padding: `${SPACING.md} ${SPACING.lg}`,
          borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <button
          type="button"
          data-testid="import-done-btn"
          onClick={onDone}
          style={{
            padding: `${SPACING.xs} ${SPACING.lg}`,
            backgroundColor: PALETTE.primary,
            color: '#000000',
            border: 'none',
            borderRadius: RADII.xs,
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: `${SPACING.md} ${SPACING.lg}`,
        borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.md,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' }}>
        {canCancelRemaining && (
          <button
            type="button"
            data-testid="cancel-remaining-btn"
            onClick={onCancelRemaining}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: PALETTE.accent3,
              fontSize: '0.75rem',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Cancel remaining
          </button>
        )}
        {isUploading && (
          <span
            style={{
              fontSize: '0.75rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
            }}
          >
            Leaving now will cancel the remaining uploads.
          </span>
        )}
      </div>

      <button
        type="button"
        data-testid="keep-working-btn"
        onClick={onKeepWorking}
        style={{
          padding: `${SPACING.xs} ${SPACING.md}`,
          backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
          border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
          borderRadius: RADII.xs,
          color: `var(--text-main, ${THEME.default.text.primary})`,
          fontSize: '0.8125rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Keep working
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subcomponent: Minimized Floating Pill Dock
// -----------------------------------------------------------------------------
interface MinimizedUploadPillProps {
  completedCount: number;
  totalCount: number;
  overallPercent: number;
  onRestore: () => void;
}

let itemSeq = 0;
function nextUniqueId(): string {
  itemSeq += 1;
  return `${Date.now()}-${itemSeq}`;
}

function computeOverallProgress(nonCancelledItems: ImportQueueItem[]): number {
  if (nonCancelledItems.length === 0) return 0;
  const total = nonCancelledItems.reduce(
    (acc, it) => acc + (it.status === 'completed' ? 100 : it.progressPercent),
    0
  );
  return Math.round(total / nonCancelledItems.length);
}

function computeFurthestAlong(
  uploadingItems: ImportQueueItem[]
): { name: string; progressPercent: number } | null {
  if (uploadingItems.length === 0) return null;
  return uploadingItems.reduce<{ name: string; progressPercent: number } | null>((acc, curr) => {
    if (!acc || curr.progressPercent > acc.progressPercent) {
      return { name: curr.name, progressPercent: curr.progressPercent };
    }
    return acc;
  }, null);
}

function handleModalKeyDown(
  key: string,
  step: 'staging' | 'progress' | 'complete',
  onClose: () => void,
  onDone: () => void
) {
  if (key !== 'Escape') return;
  if (step === 'staging') {
    onClose();
  } else if (step === 'complete') {
    onDone();
  }
}

function MinimizedUploadPill({
  completedCount,
  totalCount,
  overallPercent,
  onRestore,
}: Readonly<MinimizedUploadPillProps>) {
  return (
    <aside
      aria-label="Upload progress dock"
      data-testid="minimized-upload-dock"
      style={{
        position: 'fixed',
        bottom: SPACING.md,
        right: SPACING.md,
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
        borderRadius: RADII.full,
        padding: `${SPACING.xs} ${SPACING.md}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.sm,
      }}
    >
      <button
        type="button"
        data-testid="restore-modal-btn"
        onClick={onRestore}
        aria-label={`Restore upload dialog: Uploading ${completedCount} of ${totalCount}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.sm,
          backgroundColor: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'inherit',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '130px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Uploading {completedCount} of {totalCount}
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                color: PALETTE.primary,
                fontWeight: TYPOGRAPHY.weights.semibold,
                fontVariantNumeric: TYPOGRAPHY.tabularNums,
              }}
            >
              {overallPercent}%
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '3px',
              backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${overallPercent}%`,
                height: '100%',
                backgroundColor: PALETTE.primary,
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        </div>
        <span
          style={{
            padding: '2px 8px',
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
            borderRadius: RADII.full,
            color: `var(--text-main, ${THEME.default.text.primary})`,
            fontSize: '0.6875rem',
          }}
        >
          View
        </span>
      </button>
    </aside>
  );
}

// -----------------------------------------------------------------------------
// Main Component: MediaImportModal
// -----------------------------------------------------------------------------
export interface MediaImportModalProps {
  subdomain: string;
  isOpen: boolean;
  initialFiles: File[];
  currentFolderId: string | null;
  folders: MediaFolder[];
  onClose: () => void;
  onUploadSuccess: (item: MediaItemResponse) => void;
  onActiveUploadsChange?: (count: number, furthestAlong: { name: string; progressPercent: number } | null) => void;
}

function validateFileForImport(file: File, mime: string): string | null {
  if (file.size === 0) {
    return 'empty file';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'too large — 500 MB max';
  }
  if (!mime || !AllowedMediaMimeTypes.includes(mime as any)) {
    return "can't upload — not a supported format";
  }
  return null;
}

function createImagePreviewUrl(file: File, mime: string): string | null {
  if (!mime.startsWith('image/')) return null;
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

function generateQueueItemId(): string {
  const uniqueId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : nextUniqueId();
  return `item-${Date.now()}-${uniqueId}`;
}

function buildImportQueueItems(
  files: File[],
  folderId: string | null,
  existingQueue: ImportQueueItem[] = []
): ImportQueueItem[] {
  const existingKeys = new Set(existingQueue.map((item) => `${item.name}-${item.size}`));
  const existingNames = new Set(existingQueue.map((item) => item.name));
  const newItems: ImportQueueItem[] = [];

  for (const file of files) {
    const key = `${file.name}-${file.size}`;
    if (existingKeys.has(key)) continue;

    const mime = resolveMimeType(file);
    const isDuplicateName =
      existingNames.has(file.name) ||
      newItems.some((it) => it.name === file.name);

    newItems.push({
      id: generateQueueItemId(),
      file,
      name: file.name,
      size: file.size,
      mimeType: mime,
      mediaType: resolveMediaType(mime),
      destinationFolderId: folderId,
      status: 'staged',
      progressPercent: 0,
      isDuplicate: isDuplicateName,
      validationError: validateFileForImport(file, mime),
      retryCount: 0,
      previewUrl: createImagePreviewUrl(file, mime),
    });
  }

  return newItems;
}

function isItemReadyToImport(item: ImportQueueItem): boolean {
  return item.status === 'staged' && !item.validationError && !item.isDuplicate;
}

function isBatchCompleted(queue: ImportQueueItem[], step: string): boolean {
  if (step !== 'progress' || queue.length === 0) return false;
  const inFlight = queue.filter(
    (it) => it.status === 'queued' || it.status === 'uploading'
  );
  if (inFlight.length > 0) return false;
  return queue.some(
    (it) => it.status === 'completed' || it.status === 'failed' || it.status === 'cancelled'
  );
}

export function MediaImportModal({
  subdomain,
  isOpen,
  initialFiles,
  currentFolderId,
  folders,
  onClose,
  onUploadSuccess,
  onActiveUploadsChange,
}: Readonly<MediaImportModalProps>) {
  const [step, setStep] = useState<'staging' | 'progress' | 'complete'>('staging');
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId);
  const [isDestinationDropdownOpen, setIsDestinationDropdownOpen] = useState(false);
  const [queue, setQueue] = useState<ImportQueueItem[]>(() =>
    isOpen && initialFiles && initialFiles.length > 0
      ? buildImportQueueItems(initialFiles, currentFolderId)
      : []
  );
  const [userInitiatedCancel, setUserInitiatedCancel] = useState(false);
  const [isStartingImport, setIsStartingImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync destination folder default when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedFolderId(currentFolderId);
      setIsDestinationDropdownOpen(false);
    } else {
      setIsStartingImport(false);
    }
  }, [isOpen, currentFolderId]);

  // Synchronize initial files into staging queue with 46px preview object URLs
  useEffect(() => {
    if (!isOpen || initialFiles.length === 0 || step !== 'staging') return;

    setQueue((prevQueue) => {
      const newItems = buildImportQueueItems(initialFiles, selectedFolderId, prevQueue);
      if (newItems.length === 0) return prevQueue;
      return [...prevQueue, ...newItems];
    });
  }, [isOpen, initialFiles, selectedFolderId, step]);

  // Server-side duplicate detection check
  useEffect(() => {
    if (step !== 'staging' || queue.length === 0) return;

    const checkDuplicates = async () => {
      try {
        const entries = queue.map((item) => ({
          clientKey: item.id,
          name: item.name,
          fileSize: item.size,
          folderId: selectedFolderId,
        }));

        const res = await fetch(`/api/tenant/${subdomain}/media/check-duplicates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries, folderId: selectedFolderId }),
        });

        if (!res.ok) return;
        const data = await res.json();
        const duplicateIds = new Set(
          (data.duplicates || []).map((d: any) => d.clientKey)
        );

        if (duplicateIds.size > 0) {
          setQueue((prev) =>
            prev.map((item) =>
              duplicateIds.has(item.id)
                ? { ...item, isDuplicate: true }
                : item
            )
          );
        }
      } catch {
        // Ignore check-duplicates network errors
      }
    };

    void checkDuplicates();
  }, [step, subdomain, selectedFolderId, queue.length]);

  // Derived counts
  const validStagedItems = queue.filter(isItemReadyToImport);
  const activeUploadingItems = queue.filter((item) => item.status === 'uploading');
  const queuedItems = queue.filter((item) => item.status === 'queued');
  const completedItems = queue.filter((item) => item.status === 'completed');
  const nonCancelledItems = queue.filter((item) => item.status !== 'cancelled');

  // Furthest along progress
  const furthestAlong = computeFurthestAlong(activeUploadingItems);

  // Notify parent of active upload state for leave-page protection
  useEffect(() => {
    const totalActive = activeUploadingItems.length + queuedItems.length;
    onActiveUploadsChange?.(totalActive, furthestAlong);
  }, [activeUploadingItems.length, queuedItems.length, furthestAlong, onActiveUploadsChange]);

  const updateItemProgress = useCallback((id: string, pct: number) => {
    setQueue((prev) =>
      prev.map((it) => (it.id === id ? { ...it, progressPercent: pct } : it))
    );
  }, []);

  // Upload Engine Execution
  const uploadFile = useCallback(
    async (item: ImportQueueItem) => {
      const abortCtrl = new AbortController();

      setQueue((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, status: 'uploading', abortController: abortCtrl, progressPercent: 1 }
            : it
        )
      );

      try {
        // 1. Request presigned upload URL
        const presignRes = await fetch(`/api/tenant/${subdomain}/media/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: item.name,
            fileSize: item.size,
            mimeType: item.mimeType,
          }),
          signal: abortCtrl.signal,
        });

        if (!presignRes.ok) {
          throw new Error('Failed to get presigned upload URL');
        }

        const presignData = await presignRes.json();
        const mediaUploadUrl = presignData.mediaUploadUrl || presignData.uploadUrl;
        const mediaKey = presignData.mediaKey || presignData.storageKey;
        const mediaId = presignData.mediaId;
        const thumbnailUploadUrl = presignData.thumbnailUploadUrl;
        const thumbnailKey = presignData.thumbnailKey;
        const publicMediaUrl = presignData.publicMediaUrl || presignData.url || '';
        const publicThumbnailUrl = presignData.publicThumbnailUrl || presignData.thumbnailUrl || null;

        if (!mediaUploadUrl) {
          throw new Error('Upload URL missing from presign response');
        }

        // 2. Direct R2 upload via XHR for real progress events
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', mediaUploadUrl, true);
          xhr.setRequestHeader('Content-Type', item.mimeType);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.min(95, Math.round((e.loaded / e.total) * 100));
              updateItemProgress(item.id, pct);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.onabort = () => reject(new Error('Upload aborted'));

          abortCtrl.signal.addEventListener('abort', () => xhr.abort());
          xhr.send(item.file);
        });

        // 3. Client-side thumbnail generation
        const thumbData = await generateThumbnailBlob(item.file, item.mediaType);
        let uploadedThumbnailUrl: string | null = null;

        if (thumbData.blob && thumbnailUploadUrl) {
          try {
            await fetch(thumbnailUploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'image/webp' },
              body: thumbData.blob,
            });
            uploadedThumbnailUrl = publicThumbnailUrl;
          } catch {
            // Ignore thumbnail upload error; fall back to type icon
          }
        }

        // 4. Confirm upload to Supabase DB
        const confirmRes = await fetch(`/api/tenant/${subdomain}/media/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaId,
            name: item.name,
            fileSize: item.size,
            mimeType: item.mimeType,
            mediaType: item.mediaType,
            storageKey: mediaKey,
            folderId: selectedFolderId,
            url: publicMediaUrl,
            thumbnailKey: uploadedThumbnailUrl ? thumbnailKey : null,
            thumbnailUrl: uploadedThumbnailUrl,
            durationSeconds: thumbData.duration,
            aspectRatio: classifyAspectRatio(thumbData.width || 0, thumbData.height || 0),
            width: thumbData.width,
            height: thumbData.height,
            captionText: deriveDefaultCaption(item.name),
          }),
        });

        if (!confirmRes.ok) {
          const errText = await confirmRes.text();
          throw new Error(`Failed to confirm upload in library: ${errText}`);
        }

        const confirmData = await confirmRes.json();
        const uploadedItem = confirmData.item as MediaItemResponse;

        setQueue((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: 'completed',
                  progressPercent: 100,
                  uploadedItem,
                }
              : it
          )
        );

        if (uploadedItem) {
          onUploadSuccess(uploadedItem);
        }
      } catch (err: any) {
        if (err.message === 'Upload aborted') {
          return;
        }

        // Auto-retry up to 3 times with exponential backoff
        if (item.retryCount < 3) {
          setTimeout(() => {
            setQueue((prev) =>
              prev.map((it) =>
                it.id === item.id
                  ? { ...it, status: 'queued', retryCount: it.retryCount + 1 }
                  : it
              )
            );
          }, 1000 * Math.pow(2, item.retryCount));
        } else {
          setQueue((prev) =>
            prev.map((it) =>
              it.id === item.id ? { ...it, status: 'failed', validationError: 'failed — retry' } : it
            )
          );
        }
      }
    },
    [subdomain, selectedFolderId, onUploadSuccess, updateItemProgress]
  );

  // Concurrency Engine Loop (Cap = MAX_CONCURRENT_UPLOADS)
  useEffect(() => {
    if (step !== 'progress') return;

    const currentUploading = queue.filter((it) => it.status === 'uploading');
    const availableSlots = MAX_CONCURRENT_UPLOADS - currentUploading.length;

    if (availableSlots > 0) {
      const nextItems = queue
        .filter((it) => it.status === 'queued')
        .slice(0, availableSlots);

      for (const item of nextItems) {
        void uploadFile(item);
      }
    }

    if (isBatchCompleted(queue, step)) {
      setStep('complete');
    }
  }, [step, queue, uploadFile]);

  // Actions
  const handleStartImport = () => {
    if (isStartingImport || validStagedItems.length === 0) return;
    setIsStartingImport(true);
    setUserInitiatedCancel(false);
    setQueue((prev) =>
      prev.map((it) => (isItemReadyToImport(it) ? { ...it, status: 'queued' } : it))
    );
    setStep('progress');
  };

  const handleRemoveStagedItem = (id: string) => {
    setQueue((prev) => prev.filter((it) => it.id !== id));
  };

  const handleKeepDuplicate = (id: string) => {
    setQueue((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, isDuplicate: false, duplicateResolution: 'keep' } : it
      )
    );
  };

  const handleSkipAllDuplicates = () => {
    setQueue((prev) => prev.filter((it) => !it.isDuplicate));
  };

  const handlePauseUpload = (id: string) => {
    setQueue((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          it.abortController?.abort();
          return { ...it, status: 'paused' };
        }
        return it;
      })
    );
  };

  const handleResumeUpload = (id: string) => {
    const item = queue.find((it) => it.id === id);
    if (item) {
      void uploadFile(item);
    }
  };

  const handleCancelUpload = (id: string) => {
    setUserInitiatedCancel(true);
    setQueue((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          it.abortController?.abort();
          return { ...it, status: 'cancelled' };
        }
        return it;
      })
    );
  };

  const handleRetryUpload = (id: string) => {
    setQueue((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, status: 'queued', retryCount: 0, validationError: null } : it
      )
    );
  };

  const handleCancelRemaining = () => {
    setUserInitiatedCancel(true);
    // Cancels queued only, never in-flight
    setQueue((prev) =>
      prev.map((it) => (it.status === 'queued' ? { ...it, status: 'cancelled' } : it))
    );
  };

  const handleDone = () => {
    setQueue([]);
    setStep('staging');
    setIsMinimized(false);
    onClose();
  };

  if (!isOpen && queue.length === 0) return null;

  // Minimized dock
  if (isMinimized) {
    const totalCount = nonCancelledItems.length;
    const completedCount = completedItems.length;
    const overallPct =
      totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
      <MinimizedUploadPill
        completedCount={completedCount}
        totalCount={totalCount}
        overallPercent={overallPct}
        onRestore={() => setIsMinimized(false)}
      />
    );
  }

  const destinationFolderName =
    (selectedFolderId ? folders.find((f) => f.id === selectedFolderId)?.name : null) || 'Library';

  const overallProgressPercent = computeOverallProgress(nonCancelledItems);

  const duplicatesCount = queue.filter((it) => it.isDuplicate).length;
  const isAllCancelled =
    completedItems.length === 0 && (userInitiatedCancel || queue.every((it) => it.status === 'cancelled'));

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="import-media-title"
      data-testid="media-import-modal"
      onPointerDown={(e) => {
        if (step === 'staging' && e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(e) => handleModalKeyDown(e.key, step, onClose, handleDone)}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: 'none',
        maxHeight: 'none',
        margin: 0,
        border: 'none',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9000,
        padding: SPACING.md,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: '85vh',
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
          borderRadius: RADII.md,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        {step === 'staging' ? (
          <ImportStagingHeader
            totalCount={queue.length}
            destinationFolderName={destinationFolderName}
            selectedFolderId={selectedFolderId}
            folders={folders}
            isDropdownOpen={isDestinationDropdownOpen}
            onToggleDropdown={() => setIsDestinationDropdownOpen((prev) => !prev)}
            onSelectFolder={(fId) => {
              setSelectedFolderId(fId);
              setIsDestinationDropdownOpen(false);
            }}
          />
        ) : (
          <ImportProgressHeader
            step={step}
            destinationFolderName={destinationFolderName}
            completedCount={completedItems.length}
            totalCount={queue.length}
            isAllCancelled={isAllCancelled}
            overallProgressPercent={overallProgressPercent}
          />
        )}

        {/* Scrollable File List */}
        <div
          data-testid="import-files-list"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: `${SPACING.sm} ${SPACING.lg}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Duplicate Banner (staging mode only) */}
          {step === 'staging' && duplicatesCount > 0 && (
            <div
              data-testid="duplicate-banner"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `${SPACING.xs} ${SPACING.sm}`,
                backgroundColor: 'rgba(250, 215, 52, 0.1)',
                border: '1px solid rgba(250, 215, 52, 0.25)',
                borderRadius: RADII.xs,
                fontSize: '0.8125rem',
                color: PALETTE.primary,
              }}
            >
              <span>
                {duplicatesCount} possible duplicate{duplicatesCount === 1 ? '' : 's'} found
              </span>
              <button
                type="button"
                data-testid="skip-all-duplicates-btn"
                onClick={handleSkipAllDuplicates}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: PALETTE.primary,
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Skip all
              </button>
            </div>
          )}

          {queue.map((item) =>
            step === 'staging' ? (
              <ImportStagingRow
                key={item.id}
                item={item}
                onRemove={handleRemoveStagedItem}
                onKeepDuplicate={handleKeepDuplicate}
              />
            ) : (
              <ImportProgressRow
                key={item.id}
                item={item}
                destinationFolderName={destinationFolderName}
                onPause={handlePauseUpload}
                onResume={handleResumeUpload}
                onCancel={handleCancelUpload}
                onRetry={handleRetryUpload}
              />
            )
          )}
        </div>

        {/* Footer */}
        {step === 'staging' ? (
          <ImportStagingFooter
            validCount={validStagedItems.length}
            isStarting={isStartingImport}
            onAddMore={() => fileInputRef.current?.click()}
            onCancel={onClose}
            onStart={handleStartImport}
          />
        ) : (
          <ImportProgressFooter
            step={step}
            isUploading={activeUploadingItems.length > 0}
            canCancelRemaining={queuedItems.length > activeUploadingItems.length}
            onCancelRemaining={handleCancelRemaining}
            onKeepWorking={() => setIsMinimized(true)}
            onDone={handleDone}
          />
        )}

        {/* Hidden File Input for "+ Add more" */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={AllowedMediaMimeTypes.join(',')}
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) {
              const newFiles = Array.from(e.target.files);
              e.target.value = '';
              setQueue((prev) => [
                ...prev,
                ...buildImportQueueItems(newFiles, selectedFolderId, prev),
              ]);
            }
          }}
        />
      </div>
    </dialog>
  );
}
