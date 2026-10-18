'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { MediaFolder } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface NewFolderModalProps {
  isOpen: boolean;
  folders: MediaFolder[];
  initialParentId: string | null;
  onClose: () => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
}

export function NewFolderModal({
  isOpen,
  folders,
  initialParentId,
  onClose,
  onCreateFolder,
}: Readonly<NewFolderModalProps>) {
  const [folderName, setFolderName] = useState('');
  const [parentId, setParentId] = useState<string | null>(initialParentId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFolderName('');
      setParentId(initialParentId);
      setIsSubmitting(false);
      // Autofocus input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialParentId]);

  if (!isOpen) return null;

  const trimmedName = folderName.trim();
  const isDuplicate =
    trimmedName.length > 0 &&
    folders.some(
      (f) =>
        (f.parentId ?? null) === (parentId ?? null) &&
        f.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

  const canSubmit = trimmedName.length > 0 && !isDuplicate && !isSubmitting;

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await onCreateFolder(trimmedName, parentId);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog
      open
      aria-labelledby="new-folder-title"
      onPointerDown={(e) => {
        if (!isSubmitting && e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(e) => {
        if (!isSubmitting && e.key === 'Escape') {
          onClose();
        }
      }}
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
        zIndex: 9500,
        padding: SPACING.md,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
          borderRadius: RADII.md,
          padding: SPACING.xl,
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.md,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h2
            id="new-folder-title"
            style={{
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            New folder
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              lineHeight: 1.4,
            }}
          >
            Give it a name. Files stay unsorted until you move them in.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          {/* Folder Name Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="folder-name-input"
              style={{
                fontSize: '0.6875rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                letterSpacing: '0.04em',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
              }}
            >
              FOLDER NAME
            </label>
            <input
              id="folder-name-input"
              ref={inputRef}
              type="text"
              data-testid="new-folder-name-input"
              disabled={isSubmitting}
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g. Summer Campaign"
              style={{
                width: '100%',
                padding: `${SPACING.xs} ${SPACING.sm}`,
                backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                border: isDuplicate
                  ? `1px solid ${PALETTE.accent3}`
                  : '1px solid var(--border-strong, rgba(255,255,255,0.15))',
                borderRadius: RADII.xs,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
                opacity: isSubmitting ? 0.6 : 1,
              }}
            />
            {isDuplicate && (
              <span
                data-testid="folder-duplicate-warning"
                style={{
                  fontSize: '0.75rem',
                  color: PALETTE.accent3,
                }}
              >
                A folder with this name already exists
              </span>
            )}
          </div>

          {/* Place Inside Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="place-inside-select"
              style={{
                fontSize: '0.6875rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                letterSpacing: '0.04em',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
              }}
            >
              PLACE INSIDE
            </label>
            <select
              id="place-inside-select"
              data-testid="place-inside-select"
              disabled={isSubmitting}
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
              style={{
                width: '100%',
                padding: `${SPACING.xs} ${SPACING.sm}`,
                backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
                borderRadius: RADII.xs,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.8125rem',
                outline: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxSizing: 'border-box',
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              <option value="">Library</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: SPACING.sm,
              marginTop: SPACING.xs,
            }}
          >
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              style={{
                padding: `${SPACING.xs} ${SPACING.md}`,
                backgroundColor: 'transparent',
                border: 'none',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontSize: '0.8125rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="submit-create-folder"
              disabled={!canSubmit}
              style={{
                padding: `${SPACING.xs} ${SPACING.lg}`,
                backgroundColor: canSubmit ? PALETTE.primary : 'rgba(250, 215, 52, 0.3)',
                color: '#000000',
                border: 'none',
                borderRadius: RADII.xs,
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create folder'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
