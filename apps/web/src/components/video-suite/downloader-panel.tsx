'use client';

import React, { useState } from 'react';
import {
  VIDEO_SUITE_ERROR_MESSAGES,
  isCleanHttpUrl,
  pickBestFormatAtOrBelowCap,
  type DownloadChoice,
  type DownloadJob,
  type DownloadPreset,
  type FormatListing,
  type VideoSuiteErrorCode,
} from '@fbuploadpro/contracts';
import { Button } from '@/components/shared/ui/button';
import { Card } from '@/components/shared/ui/card';
import { Input } from '@/components/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shared/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/shared/ui/table';
import { Banner } from '@/components/shared/ui/banner';
import { EmptyState } from '@/components/shared/ui/empty-state';
import { fetchFormats, listFileNames, mapBridgeErrorToVideoSuiteCode } from './bridge-client';
import { humanizeBytes, sanitizeFileName, splitStemExt } from './filenames';
import { DownloadJobRow } from './job-rows';

export interface FolderRef {
  scopeId: string;
  path: string;
}

const PRESET_LABELS: Record<DownloadPreset, string> = {
  best: 'Best quality (video + audio)',
  best_1080: 'Best up to 1080p',
  best_720: 'Best up to 720p',
  best_480: 'Best up to 480p',
  audio_only: 'Audio only',
};

export function DownloaderPanel({
  folder,
  toolsReady,
  readinessDetail,
  jobs,
  onChooseFolder,
  onQueueDownload,
  onCancel,
  onRetry,
}: {
  folder: FolderRef | null;
  toolsReady: boolean;
  readinessDetail: string | null;
  jobs: DownloadJob[];
  onChooseFolder: () => void;
  onQueueDownload: (input: { url: string; title: string | null; choice: DownloadChoice }) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<{ code: VideoSuiteErrorCode; detail: string | null } | null>(null);
  const [listing, setListing] = useState<FormatListing | null>(null);
  const [preset, setPreset] = useState<DownloadPreset>('best');
  const [advanced, setAdvanced] = useState(false);
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
  const [nameCollision, setNameCollision] = useState(false);
  const [collisionChecked, setCollisionChecked] = useState(false);

  async function handleFetchFormats(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setUrlError(null);
    setFetchError(null);
    setNameCollision(false);
    setCollisionChecked(false);
    const trimmed = url.trim();
    if (trimmed === '') {
      setUrlError('Paste a video link first.');
      return;
    }
    if (!isCleanHttpUrl(trimmed)) {
      setUrlError('Enter a valid http(s) link without embedded credentials.');
      return;
    }
    setFetching(true);
    try {
      const result = await fetchFormats(trimmed);
      setListing(result);
    } catch (err) {
      const mapped = mapBridgeErrorToVideoSuiteCode(err, 'metadata');
      setFetchError(mapped);
      setListing(null);
    } finally {
      setFetching(false);
    }
  }

  function currentChoice(): DownloadChoice {
    if (advanced && selectedFormatId !== null) return { kind: 'format', formatId: selectedFormatId };
    return { kind: 'preset', preset };
  }

  async function handleDownload(): Promise<void> {
    if (listing === null) return;
    // Never overwrite silently (§4.1.4): warn on a same-stem collision
    // and require an explicit second click to replace.
    if (folder !== null && !collisionChecked) {
      try {
        const names = await listFileNames(folder.scopeId);
        const stem = splitStemExt(sanitizeFileName(listing.title ?? 'download')).stem;
        const collision = names.some((name) => splitStemExt(name).stem === stem);
        if (collision) {
          setNameCollision(true);
          setCollisionChecked(true);
          return;
        }
      } catch {
        // Collision check is best-effort; the download itself still runs.
      }
    }
    onQueueDownload({ url: listing.url, title: listing.title, choice: currentChoice() });
    setNameCollision(false);
    setCollisionChecked(false);
  }

  const cappedHint =
    listing !== null && (preset === 'best_1080' || preset === 'best_720' || preset === 'best_480')
      ? pickBestFormatAtOrBelowCap(listing.formats, preset === 'best_1080' ? 1080 : preset === 'best_720' ? 720 : 480)
      : null;

  return (
    <section aria-label="Downloader" className="flex flex-col gap-4">
      <Card className="gap-4 px-4 py-4">
        <h2 className="text-lg leading-heading font-semibold text-ink">Downloader</h2>
        {!toolsReady ? (
          <Banner
            variant="warning"
            title="The video tools aren't ready yet. Wait for setup to finish, then try again."
            {...(readinessDetail !== null ? { description: readinessDetail } : {})}
          />
        ) : null}
        <form onSubmit={(event) => void handleFetchFormats(event)} className="flex flex-col gap-2">
          <label htmlFor="video-suite-url" className="text-body font-medium text-ink">
            Video link
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="video-suite-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://…"
              aria-invalid={urlError !== null}
              className="min-w-0 flex-1"
            />
            <Button type="submit" disabled={fetching || !toolsReady}>
              {fetching ? 'Reading formats…' : 'Read formats'}
            </Button>
          </div>
          {urlError !== null ? (
            <p role="alert" className="text-body text-ink">
              {urlError}
            </p>
          ) : null}
          {fetching ? <p className="text-body text-ink-sub">Reading available formats…</p> : null}
          {fetchError !== null ? (
            <div>
              <p role="alert" className="text-body text-ink">
                {VIDEO_SUITE_ERROR_MESSAGES[fetchError.code]}
              </p>
              {fetchError.detail ? (
                <details className="text-body text-ink-sub">
                  <summary>Show details</summary>
                  <p className="break-words">{fetchError.detail}</p>
                </details>
              ) : null}
            </div>
          ) : null}
        </form>

        {listing !== null ? (
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-medium text-ink">{listing.title ?? 'Untitled video'}</p>
              <p className="text-body text-ink-sub">
                {listing.formats.length} formats available · YouTube, TikTok, Instagram, and Facebook links work where the video tool supports them.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="video-suite-preset" className="text-body font-medium text-ink">
                Quality
              </label>
              <Select value={preset} onValueChange={(value) => setPreset(value as DownloadPreset)}>
                <SelectTrigger id="video-suite-preset" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRESET_LABELS) as DownloadPreset[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {PRESET_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {preset === 'audio_only' ? (
                <p className="text-body text-ink-sub">Downloads the best audio track in its original container.</p>
              ) : null}
              {cappedHint !== null ? (
                <p className="text-body text-ink-sub">
                  This preset will aim for {cappedHint.formatNote ?? `${cappedHint.height}p`} or below — never above the cap.
                </p>
              ) : null}
              {preset !== 'best' && preset !== 'audio_only' && cappedHint === null ? (
                <p className="text-body text-ink-sub">No format at or below this cap was reported; the download will use the best available below the cap.</p>
              ) : null}
              <Button variant="ghost" size="sm" className="self-start" onClick={() => setAdvanced((value) => !value)}>
                {advanced ? 'Hide advanced formats' : 'Show advanced formats'}
              </Button>
            </div>
            {advanced ? (
              <div className="flex flex-col gap-2">
                <p className="text-body text-ink-sub">
                  The bridge doesn&apos;t report audio/video streams for formats, so combined vs video-only can&apos;t be distinguished here — presets always include audio.
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Format</TableHead>
                        <TableHead>Container</TableHead>
                        <TableHead>Resolution</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listing.formats.map((format) => (
                        <TableRow key={format.formatId} data-state={selectedFormatId === format.formatId ? 'selected' : undefined}>
                          <TableCell>{format.formatId}</TableCell>
                          <TableCell>{format.ext ?? '—'}</TableCell>
                          <TableCell>{format.formatNote ?? '—'}</TableCell>
                          <TableCell>{format.filesizeApprox !== null ? humanizeBytes(format.filesizeApprox) : '—'}</TableCell>
                          <TableCell>
                            <Button
                              variant={selectedFormatId === format.formatId ? 'default' : 'secondary'}
                              size="sm"
                              onClick={() => setSelectedFormatId(format.formatId)}
                            >
                              {selectedFormatId === format.formatId ? 'Selected' : 'Use this format'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body text-ink-sub">Download to:</span>
                <span className="min-w-0 flex-1 truncate text-body text-ink">{folder?.path ?? 'No folder chosen'}</span>
                <Button variant="secondary" size="sm" onClick={onChooseFolder}>
                  Choose folder…
                </Button>
              </div>
              {nameCollision ? (
                <p role="alert" className="text-body text-ink">
                  A file with this name already exists in that folder. Downloading again will replace it.
                </p>
              ) : null}
              <Button disabled={folder === null || !toolsReady} onClick={() => void handleDownload()} className="self-start">
                {nameCollision ? 'Download anyway (replace)' : 'Download'}
              </Button>
              {folder === null ? <p className="text-body text-ink-sub">Choose a download folder first.</p> : null}
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="gap-2 px-0 py-2">
        <h3 className="px-4 text-body font-semibold text-ink">Downloads</h3>
        {jobs.length === 0 ? (
          <EmptyState type="first-use" title="No downloads yet" description="Paste a video link above to download it to this computer." />
        ) : (
          <ul className="flex flex-col">
            {jobs.map((job) => (
              <DownloadJobRow key={job.id} job={job} onCancel={onCancel} onRetry={onRetry} />
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
