'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  bridgeMediaProgressToProgressEvent,
  type BinaryReadiness,
  type ConversionJob,
  type DownloadChoice,
  type DownloadJob,
  type LocalFile,
} from '@fbuploadpro/contracts';
import { Button } from '@/components/shared/ui/button';
import { Banner } from '@/components/shared/ui/banner';
import { Card } from '@/components/shared/ui/card';
import {
  cancelRun,
  ensureBinaries,
  getBinaryReadiness,
  isFolderScopeKnown,
  listFileNames,
  listLocalFiles,
  pickFolder,
  probeFile,
  startConversion,
  startDownload,
  statFileSize,
  subscribeMediaEvents,
  supportsLibraryUpload,
  conversionOutputFileName,
  mapBridgeErrorToVideoSuiteCode,
} from './bridge-client';
import {
  applyConversionProgress,
  applyDownloadProgress,
  cancelConversionJob,
  cancelDownloadJob,
  completeConversionJob,
  completeDownloadJob,
  createConversionJob,
  createDownloadJob,
  failConversionJob,
  failDownloadJob,
  isConversionTerminal,
  isDownloadTerminal,
  renameConversionJob,
  retryConversionJob,
  retryDownloadJob,
  startConversionJob,
  startDownloadJob,
} from './job-machines';
import { loadFolderPreference, loadJobs, saveFolderPreference, saveJobs } from './storage';
import { nextAvailableName, sanitizeFileName } from './filenames';
import { DownloaderPanel, type FolderRef } from './downloader-panel';
import { ConverterPanel, type ConverterSource } from './converter-panel';
import { FilesPanel } from './files-panel';
import { ImportDialog } from './import-dialog';

const STALL_MS = 60_000;
const MAX_DOWNLOADS = 2;

interface ActiveRun {
  jobId: string;
  kind: 'download' | 'conversion';
  runId: string;
  stallTimer: ReturnType<typeof setTimeout> | null;
  downscaleNote: string | null;
  outputFileName: string | null;
}

/**
 * Desktop workspace (§4.5): downloader + converter + files in one view.
 * Owns job state, queueing (max 2 downloads, 1 conversion), the single
 * global media-event subscription, stall timers, and localStorage
 * persistence. Panels own their forms; only this module + bridge-client
 * touch job transitions.
 */
export function VideoSuiteWorkspace({ subdomain }: { subdomain: string }) {
  const [downloads, setDownloads] = useState<DownloadJob[]>([]);
  const [conversions, setConversions] = useState<ConversionJob[]>([]);
  const [folder, setFolder] = useState<FolderRef | null>(null);
  const [folderNotice, setFolderNotice] = useState<string | null>(null);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [readiness, setReadiness] = useState<BinaryReadiness | null>(null);
  const [ensuring, setEnsuring] = useState(false);
  const [convertPrefill, setConvertPrefill] = useState<LocalFile | null>(null);
  const [importTarget, setImportTarget] = useState<LocalFile | null>(null);
  const [importedNotice, setImportedNotice] = useState<string | null>(null);

  const runsRef = useRef<Map<string, ActiveRun>>(new Map());
  const startingRef = useRef<Set<string>>(new Set());
  const folderRef = useRef<FolderRef | null>(null);
  folderRef.current = folder;

  const toolsReady = readiness?.status === 'ready';

  const refreshFiles = useCallback(async (scope: FolderRef | null): Promise<void> => {
    if (scope === null) {
      setFiles([]);
      return;
    }
    setFilesLoading(true);
    try {
      setFiles(await listLocalFiles(scope.scopeId, scope.path));
    } catch {
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, []);

  // Mount: restore jobs + folder + readiness; subscribe to media events.
  useEffect(() => {
    const persisted = loadJobs();
    setDownloads(persisted.downloads);
    setConversions(persisted.conversions);
    const pref = loadFolderPreference();
    if (pref !== null) {
      void isFolderScopeKnown(pref.scopeId)
        .then((known) => {
          if (known) {
            const ref = { scopeId: pref.scopeId, path: pref.path };
            setFolder(ref);
            void refreshFiles(ref);
          } else {
            setFolderNotice('Your previous download folder is no longer available — choose a folder.');
          }
        })
        .catch(() => {
          setFolderNotice('Your previous download folder could not be checked — choose a folder.');
        });
    }
    void getBinaryReadiness().then(setReadiness).catch(() => {
      setReadiness({ status: 'error', ytDlpVersion: null, ffmpegVersion: null, detail: null });
    });
    let unlisten: (() => void) | null = null;
    void subscribeMediaEvents({
      onProgress: (event) => {
        const run = runsRef.current.get(event.runId);
        if (run === undefined) return;
        if (run.stallTimer !== null) clearTimeout(run.stallTimer);
        run.stallTimer = setTimeout(() => void handleStall(run), STALL_MS);
        const progress = bridgeMediaProgressToProgressEvent(event.runId, run.kind === 'conversion' ? 'converting' : 'downloading', event.percent);
        if (run.kind === 'download') {
          setDownloads((jobs) => jobs.map((job) => (job.id === run.jobId ? applyDownloadProgress(job, progress) : job)));
        } else {
          setConversions((jobs) => jobs.map((job) => (job.id === run.jobId ? applyConversionProgress(job, progress) : job)));
        }
      },
      onDone: (event) => {
        const run = runsRef.current.get(event.runId);
        if (run === undefined) return;
        if (run.stallTimer !== null) clearTimeout(run.stallTimer);
        runsRef.current.delete(event.runId);
        void handleDone(run, event);
      },
    })
      .then((stop) => {
        unlisten = stop;
      })
      .catch(() => {
        // Outside the shell this subscription cannot exist; the gate
        // prevents this workspace from rendering there.
      });
    return () => {
      if (unlisten !== null) unlisten();
      for (const run of runsRef.current.values()) {
        if (run.stallTimer !== null) clearTimeout(run.stallTimer);
      }
      runsRef.current.clear();
    };
  }, []);

  // Persistence (§4.6).
  useEffect(() => {
    saveJobs({ downloads, conversions });
  }, [downloads, conversions]);

  function clearRun(run: ActiveRun): void {
    if (run.stallTimer !== null) clearTimeout(run.stallTimer);
    runsRef.current.delete(run.runId);
  }

  function handleStall(run: ActiveRun): void {
    void cancelRun(run.runId).catch(() => undefined);
    clearRun(run);
    if (run.kind === 'download') {
      setDownloads((jobs) =>
        jobs.map((job) => (job.id === run.jobId ? failDownloadJob(job, 'network_failure', 'No progress for 60 seconds.') : job)),
      );
    } else {
      setConversions((jobs) =>
        jobs.map((job) => (job.id === run.jobId ? failConversionJob(job, 'conversion_failed', 'No progress for 60 seconds.') : job)),
      );
    }
    const scope = folderRef.current;
    if (scope !== null) void refreshFiles(scope);
  }

  async function handleDone(
    run: ActiveRun,
    event: { status: 'succeeded' | 'failed' | 'cancelled'; outputs: { scopeId: string; relativePath: string }[]; errorCode: string | null; errorDetail: string | null },
  ): Promise<void> {
    const scope = folderRef.current;
    if (run.kind === 'download') {
      if (event.status === 'cancelled') {
        setDownloads((jobs) => jobs.map((job) => (job.id === run.jobId ? cancelDownloadJob(job) : job)));
      } else if (event.status === 'failed') {
        const code = (event.errorCode as DownloadJob['errorCode']) ?? 'unknown';
        setDownloads((jobs) => jobs.map((job) => (job.id === run.jobId ? failDownloadJob(job, code, event.errorDetail) : job)));
      } else if (event.outputs.length > 0 && scope !== null) {
        const output = event.outputs[0];
        const size = await statFileSize(output.scopeId, output.relativePath);
        setDownloads((jobs) =>
          jobs.map((job) =>
            job.id === run.jobId ? completeDownloadJob(job, `${scope.path.replace(/\/$/, '')}/${output.relativePath}`, size) : job,
          ),
        );
      } else {
        setDownloads((jobs) =>
          jobs.map((job) =>
            job.id === run.jobId ? failDownloadJob(job, 'unknown', 'The download finished but no output file was reported.') : job,
          ),
        );
      }
    } else {
      if (event.status === 'cancelled') {
        setConversions((jobs) => jobs.map((job) => (job.id === run.jobId ? cancelConversionJob(job) : job)));
      } else if (event.status === 'failed') {
        const code = (event.errorCode as ConversionJob['errorCode']) ?? 'conversion_failed';
        setConversions((jobs) => jobs.map((job) => (job.id === run.jobId ? failConversionJob(job, code, event.errorDetail) : job)));
      } else {
        // Convert outputs are the requested relative path (known at start).
        let size: number | null = null;
        if (scope !== null && run.outputFileName !== null) {
          size = await statFileSize(scope.scopeId, run.outputFileName);
        }
        setConversions((jobs) =>
          jobs.map((job) => {
            if (job.id !== run.jobId) return job;
            const finalPath = `${job.outputFolder.replace(/\/$/, '')}/${job.outputFileName}`;
            return completeConversionJob(job, finalPath, size, run.downscaleNote);
          }),
        );
      }
    }
    if (scope !== null) void refreshFiles(scope);
  }

  async function runDownloadJob(job: DownloadJob): Promise<void> {
    const scope = folderRef.current;
    if (scope === null || startingRef.current.has(job.id)) return;
    startingRef.current.add(job.id);
    setDownloads((jobs) => jobs.map((candidate) => (candidate.id === job.id ? startDownloadJob(candidate) : candidate)));
    try {
      const started = await startDownload({
        url: job.url,
        title: job.title,
        choice: job.choice,
        outputScopeId: scope.scopeId,
        jobId: job.id,
      });
      const run: ActiveRun = { jobId: job.id, kind: 'download', runId: started.runId, stallTimer: null, downscaleNote: null, outputFileName: null };
      run.stallTimer = setTimeout(() => void handleStall(run), STALL_MS);
      runsRef.current.set(started.runId, run);
    } catch (err) {
      const mapped = mapBridgeErrorToVideoSuiteCode(err, 'download');
      setDownloads((jobs) => jobs.map((candidate) => (candidate.id === job.id ? failDownloadJob(candidate, mapped.code, mapped.detail) : candidate)));
    } finally {
      startingRef.current.delete(job.id);
    }
  }

  async function runConversionJob(job: ConversionJob): Promise<void> {
    const scope = folderRef.current;
    if (scope === null || startingRef.current.has(job.id)) return;
    startingRef.current.add(job.id);
    try {
      // Non-overwrite naming at START time (§4.2.3), not queue time.
      const names = await listFileNames(scope.scopeId);
      const finalName = nextAvailableName(new Set(names), job.outputFileName);
      if (finalName !== job.outputFileName) {
        setConversions((jobs) => jobs.map((candidate) => (candidate.id === job.id ? renameConversionJob(candidate, finalName) : candidate)));
      }
      // Downscale-only: probe the source; a requested height above the
      // source keeps the original and says so on the completed row.
      const width: number | null = null;
      let height: number | null = null;
      let downscaleNote: string | null = null;
      const requestedHeight = job.resolution === 'original' ? null : job.resolution === '1080p' ? 1080 : job.resolution === '720p' ? 720 : 480;
      if ((job.target === 'mp4' || job.target === 'webm') && requestedHeight !== null) {
        try {
          const probe = await probeFile(job.sourceScopeId, job.inputRelativePath);
          if (probe.height !== null && requestedHeight > probe.height) {
            downscaleNote = `Kept ${probe.height}p — the source is ${probe.height}p, so it was not upscaled.`;
          } else {
            height = requestedHeight;
          }
        } catch {
          height = requestedHeight;
        }
      }
      setConversions((jobs) => jobs.map((candidate) => (candidate.id === job.id ? startConversionJob(candidate) : candidate)));
      const started = await startConversion({
        inputScopeId: job.sourceScopeId,
        inputRelativePath: job.inputRelativePath,
        outputScopeId: scope.scopeId,
        outputRelativePath: finalName,
        target: job.target,
        resolution: job.resolution,
        quality: job.quality,
        width,
        height,
      });
      const run: ActiveRun = { jobId: job.id, kind: 'conversion', runId: started.runId, stallTimer: null, downscaleNote, outputFileName: finalName };
      run.stallTimer = setTimeout(() => void handleStall(run), STALL_MS);
      runsRef.current.set(started.runId, run);
    } catch (err) {
      const mapped = mapBridgeErrorToVideoSuiteCode(err, 'convert');
      setConversions((jobs) =>
        jobs.map((candidate) => (candidate.id === job.id ? failConversionJob(candidate, mapped.code, mapped.detail) : candidate)),
      );
    } finally {
      startingRef.current.delete(job.id);
    }
  }

  // Queue processors: max 2 downloads, 1 conversion (§4.1.6, §4.2.5).
  useEffect(() => {
    if (folder === null) return;
    const running = downloads.filter((job) => job.status === 'downloading' || job.status === 'postprocessing').length;
    if (running >= MAX_DOWNLOADS) return;
    const next = downloads.find((job) => job.status === 'queued');
    if (next !== undefined) void runDownloadJob(next);
  }, [downloads, folder]);

  useEffect(() => {
    if (folder === null) return;
    const running = conversions.filter((job) => job.status === 'converting').length;
    if (running >= 1) return;
    const next = conversions.find((job) => job.status === 'queued');
    if (next !== undefined) void runConversionJob(next);
  }, [conversions, folder]);

  async function handleChooseFolder(): Promise<void> {
    try {
      const picked = await pickFolder();
      if (picked === null) return; // Picker cancelled — no-op, never an error.
      setFolder(picked);
      saveFolderPreference(picked);
      setFolderNotice(null);
      void refreshFiles(picked);
    } catch {
      setFolderNotice('Could not open the folder picker. Try again.');
    }
  }

  async function handleEnsureTools(): Promise<void> {
    setEnsuring(true);
    try {
      await ensureBinaries();
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const next = await getBinaryReadiness();
        setReadiness(next);
        if (next.status === 'ready' || next.status === 'error') break;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    } finally {
      setEnsuring(false);
    }
  }

  function handleQueueDownload(input: { url: string; title: string | null; choice: DownloadChoice }): void {
    if (folder === null) return;
    const job = createDownloadJob({
      url: input.url,
      title: input.title,
      choice: input.choice,
      destinationFolder: folder.path,
      fileName: sanitizeFileName(input.title ?? 'download'),
    });
    setDownloads((jobs) => [...jobs, job]);
  }

  function handleQueueConversion(input: {
    source: ConverterSource;
    target: ConversionJob['target'];
    resolution: ConversionJob['resolution'];
    quality: ConversionJob['quality'];
  }): void {
    if (folder === null) return;
    const outputFileName = conversionOutputFileName(input.source.name, input.target);
    const job = createConversionJob({
      sourcePath: input.source.displayPath,
      sourceName: input.source.name,
      sourceScopeId: input.source.scopeId,
      inputRelativePath: input.source.relativePath,
      target: input.target,
      resolution: input.resolution,
      quality: input.quality,
      outputFolder: folder.path,
      outputFileName,
    });
    setConversions((jobs) => [...jobs, job]);
    setConvertPrefill(null);
  }

  function handleCancelDownload(id: string): void {
    const job = downloads.find((candidate) => candidate.id === id);
    if (job === undefined) return;
    if (job.status === 'queued') {
      setDownloads((jobs) => jobs.filter((candidate) => candidate.id !== id));
      return;
    }
    if (isDownloadTerminal(job)) return;
    const run = [...runsRef.current.values()].find((candidate) => candidate.jobId === id);
    if (run !== undefined) {
      void cancelRun(run.runId).catch(() => undefined);
      clearRun(run);
    }
    setDownloads((jobs) => jobs.map((candidate) => (candidate.id === id ? cancelDownloadJob(candidate) : candidate)));
    const scope = folderRef.current;
    if (scope !== null) void refreshFiles(scope);
  }

  function handleCancelConversion(id: string): void {
    const job = conversions.find((candidate) => candidate.id === id);
    if (job === undefined) return;
    if (job.status === 'queued') {
      setConversions((jobs) => jobs.filter((candidate) => candidate.id !== id));
      return;
    }
    if (isConversionTerminal(job)) return;
    const run = [...runsRef.current.values()].find((candidate) => candidate.jobId === id);
    if (run !== undefined) {
      void cancelRun(run.runId).catch(() => undefined);
      clearRun(run);
    }
    setConversions((jobs) => jobs.map((candidate) => (candidate.id === id ? cancelConversionJob(candidate) : candidate)));
    const scope = folderRef.current;
    if (scope !== null) void refreshFiles(scope);
  }

  const readinessLine =
    readiness === null
      ? 'Checking video tools…'
      : readiness.status === 'ready'
        ? `Video tools ready — yt-dlp ${readiness.ytDlpVersion ?? 'installed'}, ffmpeg ${readiness.ffmpegVersion ?? 'installed'}`
        : readiness.status === 'downloading'
          ? 'Video tools are downloading…'
          : readiness.status === 'verifying'
            ? 'Video tools are verifying…'
            : readiness.status === 'missing'
              ? 'Video tools are not set up yet.'
              : `Video tools had a problem.${readiness.detail !== null ? ` ${readiness.detail}` : ''}`;

  return (
    <div data-testid="video-suite-workspace" className="flex flex-col gap-6 px-4 py-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl leading-heading font-semibold text-ink">Video Suite</h1>
        <Banner
          variant="info"
          title="Only download videos you have the right to use — your own content, or content the owner has allowed you to reuse."
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p data-testid="video-suite-readiness" className="flex-1 text-body text-ink-sub">
          {readinessLine}
        </p>
        {(readiness?.status === 'missing' || readiness?.status === 'error') && (
          <Button variant="secondary" size="sm" disabled={ensuring} onClick={() => void handleEnsureTools()}>
            {ensuring ? 'Setting up…' : 'Set up video tools'}
          </Button>
        )}
      </div>

      {!supportsLibraryUpload() ? (
        <Banner
          variant="warning"
          title="Library import needs a newer desktop app"
          description="This desktop app version has no file-upload command, so local files can't be imported to the Media Library yet. Downloads, conversions, and file management work normally."
        />
      ) : null}

      {folderNotice !== null ? (
        <p role="alert" className="text-body text-ink">
          {folderNotice}
        </p>
      ) : null}
      {importedNotice !== null ? (
        <p role="status" className="text-body text-ink">
          {importedNotice}
        </p>
      ) : null}

      <DownloaderPanel
        folder={folder}
        toolsReady={toolsReady}
        readinessDetail={readiness?.detail ?? null}
        jobs={downloads}
        onChooseFolder={() => void handleChooseFolder()}
        onQueueDownload={handleQueueDownload}
        onCancel={handleCancelDownload}
        onRetry={(id) => {
          const job = downloads.find((candidate) => candidate.id === id);
          if (job !== undefined) setDownloads((jobs) => [...jobs, retryDownloadJob(job)]);
        }}
      />

      <ConverterPanel
        folder={folder}
        toolsReady={toolsReady}
        readinessDetail={readiness?.detail ?? null}
        prefill={convertPrefill}
        onClearPrefill={() => setConvertPrefill(null)}
        jobs={conversions}
        onQueueConversion={handleQueueConversion}
        onCancel={handleCancelConversion}
        onRetry={(id) => {
          const job = conversions.find((candidate) => candidate.id === id);
          if (job !== undefined) setConversions((jobs) => [...jobs, retryConversionJob(job)]);
        }}
      />

      {folder !== null ? (
        <FilesPanel
          files={files}
          loading={filesLoading}
          onRefresh={() => void refreshFiles(folder)}
          onConvert={(file) => setConvertPrefill(file)}
          onImport={(file) => setImportTarget(file)}
        />
      ) : (
        <Card className="gap-2 px-4 py-4">
          <h2 className="text-lg leading-heading font-semibold text-ink">Files</h2>
          <p className="text-body text-ink-sub">Choose a download folder to see your local files.</p>
          <Button variant="secondary" size="sm" className="self-start" onClick={() => void handleChooseFolder()}>
            Choose folder…
          </Button>
        </Card>
      )}

      <ImportDialog
        subdomain={subdomain}
        file={importTarget}
        onClose={() => setImportTarget(null)}
        onConvertFirst={(file) => {
          setConvertPrefill(file);
          setImportTarget(null);
        }}
        onImported={(itemId) => setImportedNotice(`Imported to your Media Library (item ${itemId}).`)}
      />
    </div>
  );
}
