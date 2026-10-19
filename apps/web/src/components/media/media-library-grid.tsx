'use client';

import React from 'react';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { MediaAssetCard } from './media-asset-card';
import { MediaTableRow } from './media-table-row';
import type { MediaViewMode, MediaSmartViewKey } from './media-types';
import { formatFolderAncestryPath } from './media-library-breadcrumbs';
import { getEmptyStateInfo } from './media-library-filters';

export interface MediaCanvasProps {
  displayedMediaItems: MediaItemResponse[];
  viewMode: MediaViewMode;
  isLoading: boolean;
  selectedIds: string[];
  debouncedSearch: string;
  folders: MediaFolder[];
  activeSmartView: MediaSmartViewKey | null;
  onNavigateFolder: (folderId: string | null) => void;
  onToggleSelect: (mediaId: string, options?: { shiftKey?: boolean | undefined }) => void;
  onPreview: (item: MediaItemResponse) => void;
  onUpdateCaption: (mediaId: string, captionText: string) => void;
  onMoveRequest: (item: MediaItemResponse) => void;
  onDeleteRequest: (mediaId: string) => void;
}

export function MediaCanvas({
  displayedMediaItems,
  viewMode,
  isLoading,
  selectedIds,
  debouncedSearch,
  folders,
  activeSmartView,
  onNavigateFolder,
  onToggleSelect,
  onPreview,
  onUpdateCaption,
  onMoveRequest,
  onDeleteRequest,
}: Readonly<MediaCanvasProps>) {
  if (displayedMediaItems.length > 0) {
    if (viewMode === 'grid') {
      return (
        <div
          data-testid="media-assets-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: SPACING.lg,
            marginTop: SPACING.xs,
          }}
        >
          {displayedMediaItems.map((item) => (
            <MediaAssetCard
              key={item.id}
              item={item}
              selected={selectedIds.includes(item.id)}
              folderPathLabel={
                debouncedSearch ? `in ${formatFolderAncestryPath(item.folderId, folders)}` : null
              }
              onNavigateFolder={onNavigateFolder}
              onToggleSelect={onToggleSelect}
              onPreview={onPreview}
              onUpdateCaption={onUpdateCaption}
              onMoveRequest={onMoveRequest}
              onDeleteRequest={() => onDeleteRequest(item.id)}
            />
          ))}
        </div>
      );
    }

    return (
      <div
        data-testid="media-table-view"
        style={{
          width: '100%',
          overflowX: 'auto',
          marginTop: SPACING.xs,
        }}
      >
        <table
          data-testid="media-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
          }}
        >
          <thead
            style={{
              position: 'sticky',
              top: 0,
              backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
              borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
              zIndex: 2,
            }}
          >
            <tr>
              <th style={{ width: '40px', padding: `${SPACING.sm} ${SPACING.md}` }}>
                <span className="sr-only">Select</span>
              </th>
              <th style={{ width: '48px', padding: `${SPACING.sm} 0` }}>
                <span className="sr-only">Thumbnail</span>
              </th>
              <th
                style={{
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  fontSize: '0.6875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                File
              </th>
              <th
                style={{
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  fontSize: '0.6875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                Caption
              </th>
              <th
                style={{
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  fontSize: '0.6875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                Details
              </th>
              <th
                style={{
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  fontSize: '0.6875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                Size
              </th>
              <th
                style={{
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  fontSize: '0.6875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                Date
              </th>
              <th
                style={{
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  textAlign: 'right',
                  fontSize: '0.6875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedMediaItems.map((item) => (
              <MediaTableRow
                key={item.id}
                item={item}
                selected={selectedIds.includes(item.id)}
                folderPathLabel={
                  debouncedSearch ? `in ${formatFolderAncestryPath(item.folderId, folders)}` : null
                }
                onNavigateFolder={onNavigateFolder}
                onToggleSelect={onToggleSelect}
                onPreview={onPreview}
                onUpdateCaption={onUpdateCaption}
                onMoveRequest={onMoveRequest}
                onDeleteRequest={() => onDeleteRequest(item.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!isLoading) {
    const { title: emptyTitle, subtext: emptySubtext } = getEmptyStateInfo(
      activeSmartView,
      debouncedSearch
    );

    return (
      <div
        data-testid="media-empty-state"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${SPACING.xxl} 0`,
          gap: SPACING.md,
          color: `var(--text-dim, ${THEME.default.text.muted})`,
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.9375rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            {emptyTitle}
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem' }}>
            {emptySubtext}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
