'use client';

import React, { useEffect, useState } from 'react';
import type { LocalFile, MediaFolder } from '@fbuploadpro/contracts';
import { FolderListResponseSchema } from '@fbuploadpro/contracts';
import { Button } from '@/components/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/shared/ui/dialog';
import { Input } from '@/components/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shared/ui/select';
import { api, buildTenantApiPath } from '@/lib/api';
import { importDialogDefaults, importEligibility, presignLibraryImport, uploadViaBridge, confirmLibraryImport, BridgeUploadUnavailableError } from './library-import';

/**
 * Import dialog (§5). Eligibility is enforced before any presign call.
 * Audio files: import disabled with the honest reason. Other containers:
 * a Convert-to-MP4-first affordance. Over 500 MB: refused. In v1.0 the
 * bridge cannot upload, so eligible files show the structural note and
 * the action stays disabled — no wasted presign, no fake progress.
 * Retry (once upload exists) restarts at presign with fresh URLs.
 */
export function ImportDialog({
  subdomain,
  file,
  onClose,
  onConvertFirst,
  onImported,
}: {
  subdomain: string;
  file: LocalFile | null;
  onClose: () => void;
  onConvertFirst: (file: LocalFile) => void;
  onImported: (itemId: string) => void;
}) {
  const [caption, setCaption] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [foldersError, setFoldersError] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedId, setImportedId] = useState<string | null>(null);

  useEffect(() => {
    if (file !== null) {
      const defaults = importDialogDefaults(file);
      setCaption(defaults.caption);
      setFolderId(null);
      setImportError(null);
      setImportedId(null);
    }
  }, [file]);

  useEffect(() => {
    if (file === null) return;
    let cancelled = false;
    void api
      .get(buildTenantApiPath(subdomain, '/media/folders'), { schema: FolderListResponseSchema })
      .then((data) => {
        if (!cancelled) setFolders(data.folders);
      })
      .catch(() => {
        if (!cancelled) setFoldersError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [file, subdomain]);

  if (file === null) return null;
  const targetFile = file;
  const eligibility = importEligibility(targetFile);

  async function handleImport(): Promise<void> {
    if (eligibility.state !== 'eligible') return;
    setImporting(true);
    setImportError(null);
    try {
      const presign = await presignLibraryImport(subdomain, targetFile, eligibility.mimeType);
      const upload = await uploadViaBridge(targetFile, presign);
      const itemId = await confirmLibraryImport(subdomain, targetFile, eligibility.mimeType, presign, {
        caption,
        folderId,
        thumbnailDone: upload.thumbnailDone,
      });
      setImportedId(itemId);
      onImported(itemId);
    } catch (err) {
      if (err instanceof BridgeUploadUnavailableError) {
        setImportError('This desktop app version cannot upload local files to the Media Library yet: the bridge has no file-upload command. A bridge update is required.');
      } else {
        setImportError('Import failed. Check your connection and try again.');
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import to Media Library</DialogTitle>
          <DialogDescription>{targetFile.name}</DialogDescription>
        </DialogHeader>
        {eligibility.state === 'eligible' ? (
          <div className="flex flex-col gap-3">
            <label htmlFor="video-suite-import-caption" className="text-body font-medium text-ink">
              Caption
            </label>
            <Input id="video-suite-import-caption" value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={5000} />
            <label htmlFor="video-suite-import-folder" className="text-body font-medium text-ink">
              Library folder
            </label>
            <Select value={folderId ?? '__root'} onValueChange={(value) => setFolderId(value === '__root' ? null : value)}>
              <SelectTrigger id="video-suite-import-folder" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__root">Library root</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {foldersError ? <p className="text-body text-ink-sub">Couldn&apos;t load library folders — importing to the library root.</p> : null}
            <p className="text-body text-ink-sub">The local file stays on this computer. The library copy is independent afterwards.</p>
          </div>
        ) : null}
        {eligibility.state === 'audio' ? (
          <p role="alert" className="text-body text-ink">
            Audio can&apos;t be added to the Media Library. The library holds video and images only.
          </p>
        ) : null}
        {eligibility.state === 'convert_first' ? (
          <div className="flex flex-col gap-2">
            <p role="alert" className="text-body text-ink">
              This format can&apos;t go into the Media Library directly. Convert it to MP4 first, then import the MP4.
            </p>
            <Button
              variant="secondary"
              className="self-start"
              onClick={() => {
                onConvertFirst(targetFile);
                onClose();
              }}
            >
              Convert to MP4 first
            </Button>
          </div>
        ) : null}
        {eligibility.state === 'too_large' ? (
          <p role="alert" className="text-body text-ink">
            This file is over the 500 MB Media Library limit. Convert it smaller first, or keep it local.
          </p>
        ) : null}
        {eligibility.state === 'upload_unavailable' ? (
          <p role="alert" className="text-body text-ink">
            Library import isn&apos;t available in this desktop app version yet: the bridge has no file-upload command. A bridge update is required before local files can be imported.
          </p>
        ) : null}
        {importError !== null ? (
          <p role="alert" className="text-body text-ink">
            {importError}
          </p>
        ) : null}
        {importedId !== null ? (
          <p role="status" className="text-body text-ink">
            Imported to your Media Library.{' '}
            <a href={`/tenant/${subdomain}/media`} className="text-link underline-offset-4 hover:underline">
              View in library
            </a>
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {eligibility.state === 'eligible' ? (
            <Button disabled={importing} onClick={() => void handleImport()}>
              {importing ? 'Importing…' : 'Import'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
