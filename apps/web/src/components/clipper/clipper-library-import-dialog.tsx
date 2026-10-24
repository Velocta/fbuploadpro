'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClipSelection } from '@fbuploadpro/contracts';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/ui';
import { invalidateMediaList, mediaFoldersQuery } from '@/components/media/media-data';
import { importClipToLibrary } from './clipper-library-import';
import { clipFileName } from './clipper-captions';

export interface ClipperLibraryImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clip: ClipSelection | null;
  clipIndex: number;
  subdomain: string;
  onImported: (clipId: string, mediaId: string) => void;
}

/**
 * Import dialog (spec OD-148-7, variance V-IMPORT): folder picker from the
 * existing folders endpoint (read-only), a file picker for the exported
 * clip (the frozen bridge cannot hand the web layer binary bytes), Import
 * progress + result. On success the existing media list key is invalidated
 * so the clip appears in the library without a reload. `captionText` is
 * null — the transcript excerpt is shown in Clipper, never written as a
 * caption. Importing twice creates two items, deliberately.
 */
export function ClipperLibraryImportDialog(props: Readonly<ClipperLibraryImportDialogProps>) {
  const { open, onOpenChange, clip, clipIndex, subdomain, onImported } = props;
  const queryClient = useQueryClient();
  const foldersQuery = useQuery(mediaFoldersQuery(subdomain));
  const [file, setFile] = useState<File | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedName, setImportedName] = useState<string | null>(null);

  const close = () => {
    setFile(null);
    setError(null);
    setImportedName(null);
    onOpenChange(false);
  };

  const handleImport = async () => {
    if (!clip || !file) return;
    setImporting(true);
    setError(null);
    try {
      const item = await importClipToLibrary({ subdomain, clip, clipIndex, file, folderId });
      await invalidateMediaList(queryClient, subdomain);
      onImported(clip.id, item.id);
      setImportedName(item.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed. Your exported files are untouched — try again.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent data-testid="clipper-import-dialog">
        <DialogHeader>
          <DialogTitle>Import clip into Media Library</DialogTitle>
          <DialogDescription>
            {clip
              ? `Choose the exported file ${clipFileName(clipIndex, clip.excerpt)} from your output folder, pick a library folder, and import it.`
              : 'Import an exported clip into your Media Library.'}
          </DialogDescription>
        </DialogHeader>
        {importedName ? (
          <div className="flex flex-col gap-3">
            <p data-testid="clipper-import-success" className="text-body text-ink">
              Imported {importedName} into your Media Library.
            </p>
            <a data-testid="clipper-import-view-link" className="text-body font-medium text-primary" href={`/tenant/${subdomain}/media`}>
              View in Media Library
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-body font-medium text-ink" htmlFor="clipper-import-file">
                Exported clip file
              </label>
              <Input
                id="clipper-import-file"
                data-testid="clipper-import-file"
                type="file"
                accept="video/mp4,video/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-body font-medium text-ink" htmlFor="clipper-import-folder">
                Library folder
              </label>
              <Select
                value={folderId ?? 'none'}
                onValueChange={(v) => setFolderId(v === 'none' ? null : v)}
              >
                <SelectTrigger id="clipper-import-folder" data-testid="clipper-import-folder-select">
                  <SelectValue placeholder="No folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No folder</SelectItem>
                  {(foldersQuery.data ?? []).map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {foldersQuery.isError && (
                <p className="text-body text-ink-sub">Folders could not be loaded; importing without a folder still works.</p>
              )}
            </div>
            {error && (
              <p data-testid="clipper-import-error" role="alert" className="text-body text-brand-rose">
                {error}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          {importedName ? (
            <Button type="button" data-testid="clipper-import-done-btn" onClick={close}>
              Done
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="button" data-testid="clipper-import-btn" onClick={handleImport} disabled={!clip || !file || importing}>
                {importing ? 'Importing…' : 'Import'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
