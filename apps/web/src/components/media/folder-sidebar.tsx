'use client';

import React, { useState } from 'react';
import type { FolderResponse } from '@fbuploadpro/contracts';

export interface FolderSidebarProps {
  folders: FolderResponse[];
  unorganizedCount: number;
  totalCount: number;
  selectedFolderId: string | 'unorganized' | null;
  selectedTag: string | null;
  availableTags: string[];
  onSelectFolder: (folderId: string | 'unorganized' | null) => void;
  onSelectTag: (tag: string | null) => void;
  onCreateFolder: (name: string, color: string) => void;
  onDeleteFolder?: (folderId: string) => void;
}

const COLOR_MAP: Record<string, string> = {
  slate: '#64748b',
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#a855f7',
  amber: '#f59e0b',
  rose: '#f43f5e',
  emerald: '#10b981',
  indigo: '#6366f1',
};

export function FolderSidebar({
  folders,
  unorganizedCount,
  totalCount,
  selectedFolderId,
  selectedTag,
  availableTags,
  onSelectFolder,
  onSelectTag,
  onCreateFolder,
  onDeleteFolder,
}: FolderSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('blue');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onCreateFolder(newFolderName.trim(), newFolderColor);
    setNewFolderName('');
    setIsCreating(false);
  };

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        width: '260px',
        flexShrink: 0,
      }}
    >
      {/* Folders Section */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px solid #e2e8f0',
          padding: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Folders
          </span>
          <button
            type="button"
            onClick={() => setIsCreating(!isCreating)}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              fontWeight: 500,
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            {isCreating ? 'Cancel' : '+ New'}
          </button>
        </div>

        {/* Create Folder Form */}
        {isCreating && (
          <form
            onSubmit={handleCreateSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              padding: '0.75rem',
              backgroundColor: '#f8fafc',
              borderRadius: '0.5rem',
              marginBottom: '0.75rem',
            }}
          >
            <input
              type="text"
              placeholder="Folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              style={{
                padding: '0.375rem 0.5rem',
                fontSize: '0.8125rem',
                border: '1px solid #cbd5e1',
                borderRadius: '0.375rem',
                outline: 'none',
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
              {Object.keys(COLOR_MAP).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewFolderColor(color)}
                  style={{
                    width: '1rem',
                    height: '1rem',
                    borderRadius: '50%',
                    backgroundColor: COLOR_MAP[color],
                    border: newFolderColor === color ? '2px solid #0f172a' : 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  title={color}
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={!newFolderName.trim()}
              style={{
                marginTop: '0.25rem',
                padding: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: newFolderName.trim() ? 'pointer' : 'not-allowed',
                opacity: newFolderName.trim() ? 1 : 0.6,
              }}
            >
              Save Folder
            </button>
          </form>
        )}

        {/* Navigation List */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {/* All Media */}
          <button
            type="button"
            onClick={() => onSelectFolder(null)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              backgroundColor: selectedFolderId === null ? '#eff6ff' : 'transparent',
              color: selectedFolderId === null ? '#1d4ed8' : '#334155',
              fontWeight: selectedFolderId === null ? 600 : 400,
              fontSize: '0.875rem',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <span>All Media</span>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.125rem 0.375rem',
                borderRadius: '9999px',
                backgroundColor: selectedFolderId === null ? '#dbeafe' : '#f1f5f9',
                color: selectedFolderId === null ? '#1e40af' : '#64748b',
              }}
            >
              {totalCount}
            </span>
          </button>

          {/* Unorganized */}
          <button
            type="button"
            onClick={() => onSelectFolder('unorganized')}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              backgroundColor: selectedFolderId === 'unorganized' ? '#eff6ff' : 'transparent',
              color: selectedFolderId === 'unorganized' ? '#1d4ed8' : '#334155',
              fontWeight: selectedFolderId === 'unorganized' ? 600 : 400,
              fontSize: '0.875rem',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <span>Unorganized</span>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.125rem 0.375rem',
                borderRadius: '9999px',
                backgroundColor: selectedFolderId === 'unorganized' ? '#dbeafe' : '#f1f5f9',
                color: selectedFolderId === 'unorganized' ? '#1e40af' : '#64748b',
              }}
            >
              {unorganizedCount}
            </span>
          </button>

          {/* Custom Folders */}
          {folders.map((folder) => {
            const isSelected = selectedFolderId === folder.id;
            const folderColor = COLOR_MAP[folder.color] || '#64748b';

            return (
              <div
                key={folder.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '0.5rem',
                  backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectFolder(folder.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    color: isSelected ? '#1d4ed8' : '#334155',
                    fontWeight: isSelected ? 600 : 400,
                    fontSize: '0.875rem',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    backgroundColor: 'transparent',
                  }}
                >
                  <span
                    style={{
                      width: '0.625rem',
                      height: '0.625rem',
                      borderRadius: '50%',
                      backgroundColor: folderColor,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {folder.name}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.125rem 0.375rem',
                      borderRadius: '9999px',
                      backgroundColor: isSelected ? '#dbeafe' : '#f1f5f9',
                      color: isSelected ? '#1e40af' : '#64748b',
                      flexShrink: 0,
                    }}
                  >
                    {folder.itemCount}
                  </span>
                </button>

                {onDeleteFolder && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFolder(folder.id);
                    }}
                    title="Delete folder"
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '0.375rem 0.5rem',
                      fontSize: '0.875rem',
                      borderRadius: '0.25rem',
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Tags Section */}
      {availableTags.length > 0 && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0',
            padding: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Tags
            </span>
            {selectedTag && (
              <button
                type="button"
                onClick={() => onSelectTag(null)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#2563eb',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Clear
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {availableTags.map((tag) => {
              const isTagSelected = selectedTag === tag;

              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onSelectTag(isTagSelected ? null : tag)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    border: isTagSelected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                    backgroundColor: isTagSelected ? '#eff6ff' : '#f8fafc',
                    color: isTagSelected ? '#1d4ed8' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  {`#${tag}`}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
