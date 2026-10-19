'use client';

import React from 'react';
import type { MediaFolder } from '@fbuploadpro/contracts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  THEME,
  PALETTE,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
} from '@/lib/theme';

/**
 * New-folder dialog for the downloader, extracted from media-downloader.tsx.
 * No behavior changes — moved verbatim.
 */

export function DownloaderNewFolderDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  folderName,
  onFolderNameChange,
  folderParentId,
  onFolderParentIdChange,
  folderError,
  sortedFolderOptions,
  isCreatingFolder,
}: Readonly<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void;
  folderName: string;
  onFolderNameChange: (name: string) => void;
  folderParentId: string | null;
  onFolderParentIdChange: (parentId: string | null) => void;
  folderError: string | null;
  sortedFolderOptions: Array<{ folder: MediaFolder; pathLabel: string }>;
  isCreatingFolder: boolean;
}>) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent data-testid="downloader-new-folder-dialog">
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
          <DialogDescription>
            Create a destination folder in your Media Library and select it for upcoming downloads.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <DialogBody>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: SPACING.md,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: SPACING.xs,
                }}
              >
                <label
                  htmlFor="downloader-new-folder-input"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                  }}
                >
                  Folder name
                </label>
                <input
                  id="downloader-new-folder-input"
                  data-testid="downloader-new-folder-input"
                  type="text"
                  value={folderName}
                  onChange={(e) => onFolderNameChange(e.target.value)}
                  placeholder="e.g. Viral Hooks Q4"
                  maxLength={100}
                  style={{
                    ...COMPONENT_STYLES.input(THEME.default),
                    backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                    width: '100%',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: SPACING.xs,
                }}
              >
                <label
                  htmlFor="downloader-new-folder-parent-select"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                  }}
                >
                  Parent location
                </label>
                <select
                  id="downloader-new-folder-parent-select"
                  data-testid="downloader-new-folder-parent-select"
                  value={folderParentId ?? ''}
                  onChange={(e) =>
                    onFolderParentIdChange(e.target.value ? e.target.value : null)
                  }
                  style={{
                    ...COMPONENT_STYLES.input(THEME.default),
                    backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                    width: '100%',
                  }}
                >
                  <option value="">All Media (Root)</option>
                  {sortedFolderOptions.map(({ folder, pathLabel }) => (
                    <option key={folder.id} value={folder.id}>
                      {pathLabel}
                    </option>
                  ))}
                </select>
              </div>

              {folderError && (
                <div
                  role="alert"
                  data-testid="downloader-new-folder-error"
                  style={{
                    color: PALETTE.accent3,
                    fontSize: '0.8125rem',
                    fontWeight: TYPOGRAPHY.weights.medium,
                  }}
                >
                  {folderError}
                </div>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              style={COMPONENT_STYLES.secondaryButton(THEME.default)}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="downloader-new-folder-submit"
              disabled={isCreatingFolder}
              style={COMPONENT_STYLES.primaryButton}
            >
              {isCreatingFolder ? 'Creating...' : 'Create folder'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

