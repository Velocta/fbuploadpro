'use client';

import React, { useState } from 'react';
import type { MediaFolder } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import {
  type ImportQueueItem,
  formatBytes,
  deriveDefaultCaption,
} from './media-types';


// -----------------------------------------------------------------------------
// Subcomponent: Staging Header & Destination Pill Dropdown
// -----------------------------------------------------------------------------
export interface ImportStagingHeaderProps {
  totalCount: number;
  destinationFolderName: string;
  selectedFolderId: string | null;
  folders: MediaFolder[];
  isDropdownOpen: boolean;
  onToggleDropdown: () => void;
  onSelectFolder: (folderId: string | null) => void;
}

export function ImportStagingHeader({
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
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.sm,
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
export interface ImportStagingRowProps {
  item: ImportQueueItem;
  onRemove: (id: string) => void;
  onKeepDuplicate: (id: string) => void;
}

export function ImportStagingRow({
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
export interface ImportStagingFooterProps {
  validCount: number;
  isStarting: boolean;
  onAddMore: () => void;
  onCancel: () => void;
  onStart: () => void;
}

export function ImportStagingFooter({
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
            color: PALETTE.background,
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