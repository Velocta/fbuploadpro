'use client';

import React, { useState } from 'react';
import type { MediaFolder } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import type { SmartCollectionKey, SmartCollectionCounts } from './smart-collections';

export interface MediaFolderRailProps {
  folders: MediaFolder[];
  currentFolderId: string | null;
  activeSmartCollection: SmartCollectionKey;
  counts: SmartCollectionCounts;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectCollection: (key: SmartCollectionKey) => void;
  onNavigateFolder: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folder: MediaFolder) => void;
  onMoveFolder: (folder: MediaFolder) => void;
  onDeleteFolder: (folder: MediaFolder) => void;
  onDropMediaOnFolder: (mediaId: string, targetFolderId: string | null) => Promise<void> | void;
}

export function MediaFolderRail({
  folders,
  currentFolderId,
  activeSmartCollection,
  counts,
  isCollapsed,
  onToggleCollapse,
  onSelectCollection,
  onNavigateFolder,
  onCreateFolder,
  onRenameFolder,
  onMoveFolder,
  onDeleteFolder,
  onDropMediaOnFolder,
}: Readonly<MediaFolderRailProps>) {
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [activeMenuFolderId, setActiveMenuFolderId] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(folderId ?? 'root');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
  };

  const handleDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    try {
      const raw = e.dataTransfer.getData('application/x-fbuploadpro-media');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { mediaId?: string };
      if (parsed.mediaId) {
        await onDropMediaOnFolder(parsed.mediaId, folderId);
      }
    } catch {
      // Ignored non-json drag payload
    }
  };

  if (isCollapsed) {
    return (
      <aside
        data-testid="media-folder-rail"
        data-collapsed="true"
        aria-label="Folder Navigation Rail Collapsed"
        style={{
          width: '56px',
          backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
          borderRight: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: `${SPACING.md} 0`,
          gap: SPACING.md,
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          data-testid="toggle-folder-rail-btn"
          onClick={onToggleCollapse}
          title="Expand Folder Rail"
          style={{
            background: 'transparent',
            border: 'none',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            cursor: 'pointer',
            padding: '8px',
            borderRadius: RADII.xs,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => {
            onNavigateFolder(null);
            onSelectCollection('all');
          }}
          title={`All Media (${counts.all})`}
          style={{
            background:
              currentFolderId === null && activeSmartCollection === 'all'
                ? `var(--bg-active, ${THEME.default.surfaces.active})`
                : 'transparent',
            border: 'none',
            color:
              currentFolderId === null && activeSmartCollection === 'all'
                ? PALETTE.primary
                : `var(--text-sub, ${THEME.default.text.secondary})`,
            cursor: 'pointer',
            padding: '8px',
            borderRadius: RADII.xs,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside
      data-testid="media-folder-rail"
      data-collapsed="false"
      aria-label="Folder Navigation Rail"
      style={{
        width: '250px',
        backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
        borderRight: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      {/* Header & Rail Collapse Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${SPACING.md} ${SPACING.md}`,
          borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        }}
      >
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Library
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            data-testid="new-folder-btn"
            onClick={() => onCreateFolder(currentFolderId)}
            title="Create New Folder"
            style={{
              background: 'transparent',
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.xs,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              cursor: 'pointer',
              padding: '4px 6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
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
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Folder</span>
          </button>

          <button
            type="button"
            data-testid="toggle-folder-rail-btn"
            onClick={onToggleCollapse}
            title="Collapse Rail"
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
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Smart Collections Section */}
      <div style={{ padding: `${SPACING.sm} ${SPACING.xs}` }}>
        <div
          style={{
            padding: `4px ${SPACING.sm}`,
            fontSize: '0.6875rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-dim, ${THEME.default.text.muted})`,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Collections
        </div>

        {[
          {
            key: 'all' as const,
            label: 'All Media',
            count: counts.all,
            icon: (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
            ),
          },
          {
            key: 'video' as const,
            label: 'Videos',
            count: counts.video,
            icon: (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect width="14" height="14" x="1" y="5" rx="2" ry="2" />
              </svg>
            ),
          },
          {
            key: 'image' as const,
            label: 'Images',
            count: counts.image,
            icon: (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            ),
          },
          {
            key: 'uncaptioned' as const,
            label: 'Uncaptioned',
            count: counts.uncaptioned,
            icon: (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ),
          },
        ].map((col) => {
          const isActive =
            currentFolderId === null && activeSmartCollection === col.key;
          const isDragOver = dragOverFolderId === 'root' && col.key === 'all';

          return (
            <button
              key={col.key}
              type="button"
              data-testid={`collection-tab-${col.key}`}
              onClick={() => {
                onNavigateFolder(null);
                onSelectCollection(col.key);
              }}
              onDragOver={(e) => {
                if (col.key === 'all') handleDragOver(e, null);
              }}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                if (col.key === 'all') void handleDrop(e, null);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: RADII.xs,
                border: isDragOver
                  ? `1px solid ${PALETTE.primary}`
                  : '1px solid transparent',
                backgroundColor: isDragOver
                  ? `var(--bg-active, ${THEME.default.surfaces.active})`
                  : isActive
                    ? `var(--bg-active, ${THEME.default.surfaces.active})`
                    : 'transparent',
                color: isActive
                  ? `var(--text-main, ${THEME.default.text.primary})`
                  : `var(--text-sub, ${THEME.default.text.secondary})`,
                fontSize: '0.8125rem',
                fontWeight: isActive
                  ? TYPOGRAPHY.weights.semibold
                  : TYPOGRAPHY.weights.medium,
                cursor: 'pointer',
                textAlign: 'left',
                boxSizing: 'border-box',
                transition: 'background-color 0.1s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.xs }}>
                <span
                  style={{
                    color: isActive
                      ? PALETTE.primary
                      : col.key === 'uncaptioned' && col.count > 0
                        ? PALETTE.accent1
                        : 'inherit',
                    display: 'inline-flex',
                  }}
                >
                  {col.icon}
                </span>
                <span>{col.label}</span>
              </div>
              <span
                style={{
                  fontSize: '0.6875rem',
                  color:
                    col.key === 'uncaptioned' && col.count > 0
                      ? PALETTE.accent1
                      : `var(--text-dim, ${THEME.default.text.muted})`,
                  fontVariantNumeric: TYPOGRAPHY.tabularNums,
                }}
              >
                {col.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Folders Tree Section */}
      <div style={{ padding: `${SPACING.sm} ${SPACING.xs}`, flex: 1 }}>
        <div
          style={{
            padding: `4px ${SPACING.sm}`,
            fontSize: '0.6875rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-dim, ${THEME.default.text.muted})`,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Folders</span>
          <span style={{ fontVariantNumeric: TYPOGRAPHY.tabularNums }}>
            {folders.length}
          </span>
        </div>

        {folders.length === 0 ? (
          <div
            style={{
              padding: `${SPACING.md} ${SPACING.sm}`,
              fontSize: '0.75rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              textAlign: 'center',
            }}
          >
            No folders created yet
          </div>
        ) : (
          <div
            data-testid="subfolders-grid"
            style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
          >
            {folders.map((folder) => {
              const isSelected = currentFolderId === folder.id;
              const isDragOver = dragOverFolderId === folder.id;
              const isMenuOpen = activeMenuFolderId === folder.id;

              return (
                <div
                  key={folder.id}
                  data-testid={`folder-card-${folder.id}`}
                  data-folder-item={`folder-item-${folder.id}`}
                  onDragOver={(e) => handleDragOver(e, folder.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => void handleDrop(e, folder.id)}
                  style={{
                    position: 'relative',
                    borderRadius: RADII.xs,
                    border: isDragOver
                      ? `1px solid ${PALETTE.primary}`
                      : '1px solid transparent',
                    backgroundColor: isDragOver
                      ? `var(--bg-active, ${THEME.default.surfaces.active})`
                      : isSelected
                        ? `var(--bg-active, ${THEME.default.surfaces.active})`
                        : 'transparent',
                    transition: 'border-color 0.15s ease, background-color 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                    }}
                  >
                    <button
                      type="button"
                      data-testid={`open-folder-${folder.id}`}
                      data-select-folder={`select-folder-${folder.id}`}
                      onClick={() => onNavigateFolder(folder.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: isSelected
                          ? `var(--text-main, ${THEME.default.text.primary})`
                          : `var(--text-sub, ${THEME.default.text.secondary})`,
                        fontSize: '0.8125rem',
                        fontWeight: isSelected
                          ? TYPOGRAPHY.weights.semibold
                          : TYPOGRAPHY.weights.medium,
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        minWidth: 0,
                        flex: 1,
                        textAlign: 'left',
                      }}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={isSelected ? PALETTE.primary : 'currentColor'}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        style={{ flexShrink: 0 }}
                      >
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      <span
                        title={folder.name}
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {folder.name}
                      </span>
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          color: `var(--text-dim, ${THEME.default.text.muted})`,
                          fontVariantNumeric: TYPOGRAPHY.tabularNums,
                        }}
                      >
                        {folder.itemCount}
                      </span>

                      {/* Folder contextual action menu button */}
                      <button
                        type="button"
                        data-testid={`folder-actions-btn-${folder.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuFolderId(isMenuOpen ? null : folder.id);
                        }}
                        aria-label={`Actions for folder ${folder.name}`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: `var(--text-dim, ${THEME.default.text.muted})`,
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: RADII.xs,
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
                          <circle cx="12" cy="12" r="1" />
                          <circle cx="19" cy="12" r="1" />
                          <circle cx="5" cy="12" r="1" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Contextual Menu Dropdown */}
                  {isMenuOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: '8px',
                        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                        borderRadius: RADII.xs,
                        boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
                        zIndex: 10,
                        padding: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: '110px',
                      }}
                    >
                      <button
                        type="button"
                        data-testid={`rename-folder-${folder.id}`}
                        onClick={() => {
                          setActiveMenuFolderId(null);
                          onRenameFolder(folder);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: `var(--text-main, ${THEME.default.text.primary})`,
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          borderRadius: RADII.xs,
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        data-testid={`move-folder-${folder.id}`}
                        onClick={() => {
                          setActiveMenuFolderId(null);
                          onMoveFolder(folder);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: `var(--text-main, ${THEME.default.text.primary})`,
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          borderRadius: RADII.xs,
                        }}
                      >
                        Move
                      </button>
                      <button
                        type="button"
                        data-testid={`delete-folder-${folder.id}`}
                        onClick={() => {
                          setActiveMenuFolderId(null);
                          onDeleteFolder(folder);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: PALETTE.accent3,
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          borderRadius: RADII.xs,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
