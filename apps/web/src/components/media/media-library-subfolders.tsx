'use client';

import React from 'react';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import type { MediaSmartViewKey, MediaViewMode } from './media-types';

export interface SubfolderRowsSectionProps {
  currentSubfolders: MediaFolder[];
  folders: MediaFolder[];
  mediaItems: MediaItemResponse[];
  isLocked: boolean;
  onSelectFolder: (id: string) => void;
  onStartRename: (folder: MediaFolder) => void;
  onStartMove: (folder: MediaFolder) => void;
  onStartDelete: (folder: MediaFolder) => void;
  onFilesDrop: (e: React.DragEvent, targetFolderId: string | null) => void;
}

export function SubfolderRowsSection({
  currentSubfolders,
  folders,
  mediaItems,
  isLocked,
  onSelectFolder,
  onStartRename,
  onStartMove,
  onStartDelete,
  onFilesDrop,
}: Readonly<SubfolderRowsSectionProps>) {
  return (
    <section
      aria-label="Subfolders"
      data-testid="subfolders-grid"
      style={{
        marginBottom: SPACING.xl,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}
    >
      <span
        style={{
          fontSize: '0.6875rem',
          fontWeight: TYPOGRAPHY.weights.semibold,
          letterSpacing: '0.04em',
          color: `var(--text-dim, ${THEME.default.text.muted})`,
          marginBottom: '6px',
        }}
      >
        FOLDERS ({currentSubfolders.length})
      </span>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
        }}
      >
        {currentSubfolders.map((folder) => {
          const childSubfolders = folders.filter((f) => f.parentId === folder.id);
          const folderItems = mediaItems.filter((m) => m.folderId === folder.id);
          const subCount = childSubfolders.length;
          const fileCount = folder.itemCount ?? folderItems.length;

          return (
            <div
              key={folder.id}
              data-testid={`folder-row-${folder.id}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectFolder(folder.id);
                }
              }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  'application/x-fbuploadpro-folder',
                  JSON.stringify({ folderId: folder.id })
                );
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onFilesDrop(e, folder.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `${SPACING.sm} ${SPACING.xs}`,
                borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
                cursor: 'pointer',
                transition: 'background-color 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `var(--bg-hover, ${THEME.default.surfaces.hover})`;
                const actionContainer = e.currentTarget.querySelector('.folder-hover-actions') as HTMLElement | null;
                if (actionContainer) actionContainer.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                const actionContainer = e.currentTarget.querySelector('.folder-hover-actions') as HTMLElement | null;
                if (actionContainer) actionContainer.style.opacity = '0';
              }}
              onClick={() => onSelectFolder(folder.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                <svg
                  width="18"
                  height="18"
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
                <span
                  data-testid={`folder-name-${folder.id}`}
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: TYPOGRAPHY.weights.medium,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                  }}
                >
                  {folder.name}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                  }}
                >
                  {subCount} subfolder{subCount === 1 ? '' : 's'} · {fileCount} file{fileCount === 1 ? '' : 's'}
                </span>
              </div>

              <div
                className="folder-hover-actions"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: 0,
                  transition: 'opacity 0.12s ease',
                }}
              >
                <button
                  type="button"
                  data-testid={`rename-folder-${folder.id}`}
                  aria-label={`Rename ${folder.name}`}
                  disabled={isLocked}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLocked) return;
                    onStartRename(folder);
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.6 : 1,
                    padding: '4px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </button>

                <button
                  type="button"
                  data-testid={`move-folder-${folder.id}`}
                  aria-label={`Move ${folder.name}`}
                  disabled={isLocked}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLocked) return;
                    onStartMove(folder);
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.6 : 1,
                    padding: '4px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </button>

                <button
                  type="button"
                  data-testid={`delete-folder-${folder.id}`}
                  aria-label={`Delete ${folder.name}`}
                  disabled={isLocked}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLocked) return;
                    onStartDelete(folder);
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: PALETTE.accent3,
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.6 : 1,
                    padding: '4px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

