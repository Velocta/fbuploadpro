'use client';

import React from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

/**
 * Page header section for the media library, extracted from
 * media-library-explorer.tsx. Includes the toast notification,
 * hidden file picker, and the title/action header.
 * No behavior changes — moved verbatim.
 */

export interface MediaLibraryHeaderProps {
  toastMessage: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileInputChange: (files: File[]) => void;
  onNewFolderClick: () => void;
  onUploadClick: () => void;
}

export function MediaLibraryHeader({
  toastMessage,
  fileInputRef,
  onFileInputChange,
  onNewFolderClick,
  onUploadClick,
}: Readonly<MediaLibraryHeaderProps>) {
  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          data-testid="media-toast"
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: '1px solid var(--border-strong, rgba(255,255,255,0.2))',
            borderRadius: RADII.xs,
            padding: `${SPACING.xs} ${SPACING.md}`,
            fontSize: '0.8125rem',
            color: `var(--text-main, ${THEME.default.text.primary})`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 9999,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Hidden File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            e.target.value = '';
            onFileInputChange(files);
          }
        }}
      />

      {/* 1. Page Header (No box, plain text) */}
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: SPACING.md,
          marginBottom: SPACING.xl,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1
            data-testid="media-library-title"
            style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: TYPOGRAPHY.weights.bold,
              letterSpacing: '-0.02em',
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Media Library
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Upload, organize, and caption your media for publishing queues.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.lg }}>
          {/* Quiet New Folder Link */}
          <button
            type="button"
            data-testid="new-folder-link"
            onClick={onNewFolderClick}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: 0,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            + New Folder
          </button>

          {/* Single Primary Button: Upload Files */}
          <button
            type="button"
            data-testid="upload-files-btn"
            onClick={onUploadClick}
            style={{
              padding: `${SPACING.xs} ${SPACING.lg}`,
              backgroundColor: PALETTE.primary,
              border: 'none',
              borderRadius: RADII.xs,
              color: PALETTE.background,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Upload Files</span>
          </button>
        </div>
      </header>
    </>
  );
}
