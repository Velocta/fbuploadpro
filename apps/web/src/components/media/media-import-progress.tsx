'use client';

import React from 'react';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';


// -----------------------------------------------------------------------------
// Subcomponent: Progress Header (Title, Subtext, Large % & Aggregate Progress Bar)
// -----------------------------------------------------------------------------
export interface ImportProgressHeaderProps {
  step: 'progress' | 'complete';
  destinationFolderName: string;
  completedCount: number;
  totalCount: number;
  isAllCancelled: boolean;
  overallProgressPercent: number;
}

export function ImportProgressHeader({
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

// -----------------------------------------------------------------------------
// Subcomponent: Progress Footer (Leave warning, Cancel remaining, Keep working, Done)
// -----------------------------------------------------------------------------
export interface ImportProgressFooterProps {
  step: 'progress' | 'complete';
  isUploading: boolean;
  canCancelRemaining: boolean;
  onCancelRemaining: () => void;
  onKeepWorking: () => void;
  onDone: () => void;
}

export function ImportProgressFooter({
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
            color: PALETTE.background,
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


// -----------------------------------------------------------------------------
// Subcomponent: Minimized Upload Pill
// -----------------------------------------------------------------------------
export function MinimizedUploadPill({
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
        border: `1px solid var(--border-strong, ${THEME.default.borders.strong})`,
        borderRadius: RADII.md,
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
            color: `var(--text-main, ${THEME.default.text.primary})`,
            fontSize: '0.6875rem',
            fontWeight: TYPOGRAPHY.weights.medium,
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
