'use client';

import React, { useState } from 'react';
import type { LocalFile } from '@fbuploadpro/contracts';
import { Button } from '@/components/shared/ui/button';
import { Card } from '@/components/shared/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/shared/ui/table';
import { EmptyState } from '@/components/shared/ui/empty-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shared/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/shared/ui/dialog';
import { deleteLocalFile } from './bridge-client';
import { formatDuration, humanizeBytes } from './filenames';

/**
 * Local file management (§4.3). Disk is the source of truth: the list
 * refreshes on view entry, after every job completion/cancel, and on
 * manual Refresh. A file deleted outside the app disappears on refresh.
 * "Show folder path" replaces the spec's reveal-in-folder action: v1.0
 * has no reveal command, so the honest affordance is the folder path
 * with a copy button (see reconciliation-145.md).
 */
export function FilesPanel({
  files,
  loading,
  onRefresh,
  onConvert,
  onImport,
}: {
  files: LocalFile[];
  loading: boolean;
  onRefresh: () => void;
  onConvert: (file: LocalFile) => void;
  onImport: (file: LocalFile) => void;
}) {
  const [deleteTarget, setDeleteTarget] = useState<LocalFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pathTarget, setPathTarget] = useState<LocalFile | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleDelete(): Promise<void> {
    if (deleteTarget === null) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteLocalFile(deleteTarget.scopeId, deleteTarget.relativePath);
      setDeleteTarget(null);
      onRefresh();
    } catch {
      setDeleteError('Could not delete that file. Try again.');
    } finally {
      setDeleting(false);
    }
  }

  function folderOf(file: LocalFile): string {
    const idx = file.absolutePath.lastIndexOf('/');
    return idx > 0 ? file.absolutePath.slice(0, idx) : file.absolutePath;
  }

  return (
    <section aria-label="Local files" className="flex flex-col gap-4">
      <Card className="gap-2 px-0 py-2">
        <div className="flex flex-wrap items-center gap-2 px-4">
          <h2 className="flex-1 text-lg leading-heading font-semibold text-ink">Files</h2>
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
        {deleteError !== null ? (
          <p role="alert" className="px-4 text-body text-ink">
            {deleteError}
          </p>
        ) : null}
        {files.length === 0 && !loading ? (
          <EmptyState type="first-use" title="No local files yet" description="Downloaded and converted files in your Video Suite folder appear here." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.absolutePath}>
                    <TableCell className="max-w-64 truncate" title={file.absolutePath}>
                      {file.name}
                    </TableCell>
                    <TableCell>{file.ext || '—'}</TableCell>
                    <TableCell title={`${file.sizeBytes} bytes`}>{humanizeBytes(file.sizeBytes)}</TableCell>
                    <TableCell>{formatDuration(file.durationSeconds)}</TableCell>
                    <TableCell>{file.width !== null && file.height !== null ? `${file.width} × ${file.height}` : '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setPathTarget(file)}>
                          Show folder path
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => onConvert(file)}>
                          Convert
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => onImport(file)}>
                          Import to library
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(file)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget !== null ? `“${deleteTarget.name}” will be deleted from this computer. This does not touch any copy already in your Media Library.` : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={pathTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPathTarget(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>File location</DialogTitle>
            <DialogDescription>
              This desktop app version can&apos;t open the file manager directly yet. Copy the folder path below and paste it into your file manager.
            </DialogDescription>
          </DialogHeader>
          <p className="break-all text-body text-ink">{pathTarget !== null ? folderOf(pathTarget) : ''}</p>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                if (pathTarget !== null && typeof navigator !== 'undefined') {
                  void navigator.clipboard
                    .writeText(folderOf(pathTarget))
                    .then(() => setCopied(true))
                    .catch(() => undefined);
                }
              }}
            >
              {copied ? 'Copied' : 'Copy folder path'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
