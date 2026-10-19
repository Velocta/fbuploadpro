'use client';

import React from 'react';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import { THEME, SPACING, TYPOGRAPHY } from '@/lib/theme';
import type { MediaSmartViewKey, MediaViewMode } from './media-types';
import { MediaCanvas } from './media-library-grid';
import { SubfolderRowsSection } from './media-library-subfolders';

/**
 * Main explorer canvas section, extracted from media-library-explorer.tsx.
 * Includes the breadcrumb context row, subfolder rows, and the media canvas.
 * No behavior changes — moved verbatim.
 */

export interface BreadcrumbItem {
  id: string;
  name: string;
}

export interface MediaLibraryMainProps {
  breadcrumbs: BreadcrumbItem[];
  activeSmartView: MediaSmartViewKey | null;
  currentFolderId: string | null;
  displayedMediaItems: MediaItemResponse[];
  selectedIds: string[];
  currentSubfolders: MediaFolder[];
  folders: MediaFolder[];
  mediaItems: MediaItemResponse[];
  debouncedSearch: string;
  viewMode: MediaViewMode;
  isLoading: boolean;
  isLocked: boolean;
  onNavigateRoot: () => void;
  onNavigateFolder: (folderId: string | null) => void;
  onSelectAll: () => void;
  onToggleSelect: (mediaId: string, options?: { shiftKey?: boolean | undefined }) => void;
  onPreview: (item: MediaItemResponse) => void;
  onUpdateCaption: (mediaId: string, captionText: string) => void;
  onDeleteItem: (mediaId: string) => void;
  onStartRename: (folder: MediaFolder) => void;
  onStartMove: (folder: MediaFolder) => void;
  onStartDelete: (folder: MediaFolder) => void;
  onMoveMediaRequest: (item: MediaItemResponse) => void;
  onFilesDrop: (e: React.DragEvent, targetFolderId?: string | null) => void;
}

export function MediaLibraryMain({
  breadcrumbs,
  activeSmartView,
  currentFolderId,
  displayedMediaItems,
  selectedIds,
  currentSubfolders,
  folders,
  mediaItems,
  debouncedSearch,
  viewMode,
  isLoading,
  isLocked,
  onNavigateRoot,
  onNavigateFolder,
  onSelectAll,
  onToggleSelect,
  onPreview,
  onUpdateCaption,
  onDeleteItem,
  onStartRename,
  onStartMove,
  onStartDelete,
  onMoveMediaRequest,
  onFilesDrop,
}: Readonly<MediaLibraryMainProps>) {
  return (
    <main
      data-testid="media-explorer-body"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Slim Context Row: Breadcrumb in Plain Text on Left, "Select all" on Right */}
      <div
        data-testid="context-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${SPACING.md} 0`,
          gap: SPACING.md,
          flexWrap: 'wrap',
        }}
      >
        {/* Breadcrumb Trail in Plain Text (Clickable & Drag-Drop Reparenting) */}
        <nav
          aria-label="Folder path"
          data-testid="folder-breadcrumbs"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          <button
            type="button"
            data-testid="breadcrumb-root"
            onClick={onNavigateRoot}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onFilesDrop(e, null)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: 0,
              color:
                activeSmartView === null && currentFolderId === null
                  ? `var(--text-main, ${THEME.default.text.primary})`
                  : `var(--text-sub, ${THEME.default.text.secondary})`,
              fontWeight:
                activeSmartView === null && currentFolderId === null
                  ? TYPOGRAPHY.weights.semibold
                  : TYPOGRAPHY.weights.regular,
              cursor: 'pointer',
            }}
          >
            Library
          </button>

          {activeSmartView === 'everything' && (
            <>
              <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>/</span>
              <span
                style={{
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  fontWeight: TYPOGRAPHY.weights.semibold,
                }}
              >
                Everything
              </span>
            </>
          )}

          {activeSmartView === 'needs_caption' && (
            <>
              <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>/</span>
              <span
                style={{
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  fontWeight: TYPOGRAPHY.weights.semibold,
                }}
              >
                Needs caption
              </span>
            </>
          )}

          {!activeSmartView &&
            breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.id}>
                  <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>/</span>
                  <button
                    type="button"
                    data-testid={`breadcrumb-folder-${crumb.id}`}
                    onClick={() => onNavigateFolder(crumb.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onFilesDrop(e, crumb.id)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      padding: 0,
                      color: isLast
                        ? `var(--text-main, ${THEME.default.text.primary})`
                        : `var(--text-sub, ${THEME.default.text.secondary})`,
                      fontWeight: isLast
                        ? TYPOGRAPHY.weights.semibold
                        : TYPOGRAPHY.weights.regular,
                      cursor: 'pointer',
                    }}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              );
            })}
        </nav>

        {/* Right: "Select all" toggle */}
        {displayedMediaItems.length > 0 && (
          <button
            type="button"
            data-testid="select-all-btn"
            onClick={onSelectAll}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: 0,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor: 'pointer',
            }}
          >
            {selectedIds.length === displayedMediaItems.length
              ? 'Deselect all'
              : 'Select all'}
          </button>
        )}
      </div>

      {/* Subfolders as ROWS (NOT cards) */}
      {currentSubfolders.length > 0 && !debouncedSearch && !activeSmartView && (
        <SubfolderRowsSection
          currentSubfolders={currentSubfolders}
          folders={folders}
          mediaItems={mediaItems}
          isLocked={isLocked}
          onSelectFolder={(id) => onNavigateFolder(id)}
          onStartRename={onStartRename}
          onStartMove={onStartMove}
          onStartDelete={onStartDelete}
          onFilesDrop={(e, folderId) => onFilesDrop(e, folderId)}
        />
      )}

      {/* Main Media Asset Canvas: Grid or Table View */}
      <MediaCanvas
        displayedMediaItems={displayedMediaItems}
        viewMode={viewMode}
        isLoading={isLoading}
        selectedIds={selectedIds}
        debouncedSearch={debouncedSearch}
        folders={folders}
        activeSmartView={activeSmartView}
        onNavigateFolder={onNavigateFolder}
        onToggleSelect={onToggleSelect}
        onPreview={onPreview}
        onUpdateCaption={onUpdateCaption}
        onMoveRequest={onMoveMediaRequest}
        onDeleteRequest={onDeleteItem}
      />
    </main>
  );
}
