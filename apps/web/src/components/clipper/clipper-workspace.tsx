'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { assertBridgeVersion, CLIP_LIMITS, type ClipJob, type ClipSelection } from '@fbuploadpro/contracts';
import { Alert, AlertDescription, AlertTitle, Card } from '@/components/shared/ui';
import {
  ClipperBridgeError,
  clipperBridge,
  createClipperJob,
  hashPath,
  type ClipperBridge,
  type JobSession,
  type PickedFolder,
  type PickedSource,
  type ProbeResult,
  type RuntimeStatus,
} from '@/lib/desktop/clipper-bridge';
import { ClipperJobSetup, type ClipperJobSetupValues } from './clipper-job-setup';
import { ClipperJobProgress } from './clipper-job-progress';
import { ClipperClipList } from './clipper-clip-list';
import { ClipperJobList } from './clipper-job-list';
import { ClipperLibraryImportDialog } from './clipper-library-import-dialog';

export interface ClipperWorkspaceProps {
  subdomain: string;
  bridge?: ClipperBridge;
}

const NON_TERMINAL: ClipJob['status'][] = ['probing', 'downloading-model', 'transcribing', 'selecting', 'exporting'];

/**
 * Clipper workspace: setup → run → ready (resting, no auto-export) →
 * export → library import. Job state is local (adapter), polled every
 * 1000 ms while a job is non-terminal, stopped at terminal statuses.
 * `ready` is a real resting stage: nothing exports until the user picks
 * clips and presses Export.
 */
export function ClipperWorkspace({ subdomain, bridge = clipperBridge }: Readonly<ClipperWorkspaceProps>) {
  const [jobs, setJobs] = useState<ClipJob[]>([]);
  const [activeJob, setActiveJob] = useState<ClipJob | null>(null);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [hasAiKey, setHasAiKey] = useState<boolean | null>(null);
  const [source, setSource] = useState<PickedSource | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [output, setOutput] = useState<PickedFolder | null>(null);
  const [starting, setStarting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState<'openai' | 'anthropic' | 'openai-compatible'>('openai');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [importClip, setImportClip] = useState<{ clip: ClipSelection; index: number } | null>(null);
  const [importingClipId, setImportingClipId] = useState<string | null>(null);
  const runTokenRef = useRef(0);

  const refreshJobs = useCallback(() => {
    const next = bridge.listJobs();
    setJobs(next);
    return next;
  }, [bridge]);

  useEffect(() => {
    bridge.markInterruptedJobs();
    refreshJobs();
    let cancelled = false;
    void (async () => {
      try {
        const info = await bridge.getShellInfo();
        assertBridgeVersion(info, 1, 0);
      } catch (err) {
        if (!cancelled) {
          setRuntimeError(err instanceof Error ? err.message : 'The desktop app could not be reached.');
        }
        return;
      }
      try {
        const status = await bridge.getRuntimeStatus();
        if (!cancelled) setRuntime(status);
      } catch {
        if (!cancelled) setRuntimeError('The desktop app could not report its video tools.');
      }
      try {
        const key = await bridge.hasAiKey();
        if (!cancelled) setHasAiKey(key);
      } catch {
        if (!cancelled) setHasAiKey(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bridge, refreshJobs]);

  // Poll the active job every 1000 ms while non-terminal.
  useEffect(() => {
    if (!activeJob || !NON_TERMINAL.includes(activeJob.status)) return undefined;
    const timer = setInterval(() => {
      const fresh = bridge.getJob(activeJob.id);
      if (fresh) {
        setActiveJob(fresh);
        setJobs((prev) => prev.map((j) => (j.id === fresh.id ? fresh : j)));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [bridge, activeJob?.id, activeJob?.status]);

  const handlePickSource = useCallback(async () => {
    setProbeError(null);
    let picked: PickedSource | null;
    try {
      picked = await bridge.pickSource();
    } catch (err) {
      setProbeError(err instanceof Error ? err.message : 'Could not open the file picker.');
      return;
    }
    if (!picked) return; // Cancelled dialog is not an error.
    setSource(picked);
    setProbing(true);
    try {
      const result = await bridge.probeSource(picked);
      if (result.sizeBytes !== null && result.sizeBytes > CLIP_LIMITS.MAX_SIZE_BYTES) {
        throw new ClipperBridgeError('FILE_TOO_LARGE');
      }
      if (result.durationSeconds !== null && result.durationSeconds > CLIP_LIMITS.MAX_DURATION_SECONDS) {
        throw new ClipperBridgeError('DURATION_TOO_LONG');
      }
      setProbe(result);
      setProbeError(null);
    } catch (err) {
      setProbe(null);
      setProbeError(err instanceof Error ? err.message : 'That file could not be read.');
    } finally {
      setProbing(false);
    }
  }, [bridge]);

  const handlePickOutput = useCallback(async () => {
    try {
      const picked = await bridge.pickOutputFolder();
      if (picked) setOutput(picked);
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : 'Could not open the folder picker.');
    }
  }, [bridge]);

  const registerActiveSession = useCallback(
    (job: ClipJob, src: PickedSource, prb: ProbeResult, out: PickedFolder) => {
      const session: JobSession = { source: src, output: out, probe: prb, cancelled: false, currentRunId: null };
      bridge.registerSession(job.id, session);
    },
    [bridge],
  );

  const handleStart = useCallback(
    async (values: ClipperJobSetupValues) => {
      if (!source || !probe || !output) return;
      if (jobs.some((j) => NON_TERMINAL.includes(j.status))) {
        setWorkspaceError('Another job is already running. Wait for it to finish before starting a new one.');
        return;
      }
      setWorkspaceError(null);
      setAiNotice(null);
      setStarting(true);
      const token = ++runTokenRef.current;
      const job = createClipperJob({
        sourceName: source.name,
        sourcePathHash: hashPath(source.path),
        sourceDurationSeconds: probe.durationSeconds,
        model: values.model,
        clipCount: values.clipCount,
        aspect: values.aspect,
      });
      registerActiveSession(job, source, probe, output);
      bridge.saveJob({ ...job, outputFolderPathHash: hashPath(output.path) });
      setActiveJob({ ...job, outputFolderPathHash: hashPath(output.path) });
      refreshJobs();
      try {
        const result = await bridge.runJob(
          { ...job, outputFolderPathHash: hashPath(output.path) },
          { aiEnabled, provider: aiProvider, model: aiModel, ...(aiBaseUrl ? { baseUrl: aiBaseUrl } : {}) },
          (updated) => {
            if (runTokenRef.current !== token) return;
            setActiveJob(updated);
            setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
          },
        );
        if (runTokenRef.current !== token) return;
        setActiveJob(result.job);
        setSelectedIds(result.job.clips.map((c) => c.id));
        if (result.aiNotice) setAiNotice(result.aiNotice);
        refreshJobs();
      } finally {
        if (runTokenRef.current === token) setStarting(false);
      }
    },
    [source, probe, output, jobs, bridge, registerActiveSession, refreshJobs, aiEnabled, aiProvider, aiModel, aiBaseUrl],
  );

  const handleCancel = useCallback(async () => {
    if (!activeJob) return;
    setCancelling(true);
    try {
      await bridge.cancelJob(activeJob.id);
      const fresh = bridge.getJob(activeJob.id);
      if (fresh) setActiveJob(fresh);
      refreshJobs();
    } finally {
      setCancelling(false);
    }
  }, [activeJob, bridge, refreshJobs]);

  /**
   * File scopes do not survive a restart, so an export (or retry) without
   * a live session re-picks the source video and output folder first.
   * Returns false when the user cancels either dialog.
   */
  const ensureSession = useCallback(
    async (job: ClipJob): Promise<JobSession | null> => {
      const existing = bridge.getSession(job.id);
      if (existing) return existing;
      let src: PickedSource | null;
      let prb: ProbeResult | null;
      let out: PickedFolder | null;
      try {
        src = await bridge.pickSource();
        if (!src) return null;
        prb = await bridge.probeSource(src);
        out = await bridge.pickOutputFolder();
        if (!out) return null;
      } catch (err) {
        setWorkspaceError(err instanceof Error ? err.message : 'Export needs the source video and output folder again.');
        return null;
      }
      const session: JobSession = { source: src, output: out, probe: prb, cancelled: false, currentRunId: null };
      bridge.registerSession(job.id, session);
      return session;
    },
    [bridge],
  );

  const handleExport = useCallback(async () => {
    if (!activeJob || selectedIds.length === 0) return;
    const session = await ensureSession(activeJob);
    if (!session) return;
    setExporting(true);
    try {
      const updated = await bridge.exportClips(activeJob, selectedIds, (next) => {
        setActiveJob(next);
        setJobs((prev) => prev.map((j) => (j.id === next.id ? next : j)));
      });
      setActiveJob(updated);
      refreshJobs();
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }, [activeJob, selectedIds, bridge, refreshJobs, ensureSession]);

  const handleSelectJob = useCallback((job: ClipJob) => {
    setActiveJob(job);
    setSelectedIds(job.clips.map((c) => c.id));
    setAiNotice(null);
  }, []);

  const handleRetry = useCallback(
    async (job: ClipJob) => {
      // Re-pick source + output (file scopes do not survive a restart),
      // then resume: clips present → re-export pending clips; otherwise
      // re-run from the last completed stage (transcript is reused).
      setWorkspaceError(null);
      const session = await ensureSession(job);
      if (!session) return;
      const retryJob: ClipJob = { ...job, outputFolderPathHash: hashPath(session.output.path) };
      bridge.saveJob(retryJob);
      setActiveJob(retryJob);
      if (retryJob.clips.length > 0) {
        setSelectedIds(retryJob.clips.filter((c) => c.exportStatus !== 'exported').map((c) => c.id));
        setExporting(true);
        try {
          const pending = retryJob.clips.filter((c) => c.exportStatus !== 'exported').map((c) => c.id);
          if (pending.length > 0) {
            const updated = await bridge.exportClips(retryJob, pending, (next) => {
              setActiveJob(next);
              setJobs((prev) => prev.map((j) => (j.id === next.id ? next : j)));
            });
            setActiveJob(updated);
          }
        } catch (err) {
          setWorkspaceError(err instanceof Error ? err.message : 'Export retry failed.');
        } finally {
          setExporting(false);
        }
        refreshJobs();
        return;
      }
      setStarting(true);
      try {
        const result = await bridge.runJob(
          retryJob,
          { aiEnabled, provider: aiProvider, model: aiModel, ...(aiBaseUrl ? { baseUrl: aiBaseUrl } : {}) },
          (updated) => {
            setActiveJob(updated);
            setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
          },
        );
        setActiveJob(result.job);
        setSelectedIds(result.job.clips.map((c) => c.id));
        if (result.aiNotice) setAiNotice(result.aiNotice);
      } finally {
        setStarting(false);
      }
      refreshJobs();
    },
    [bridge, ensureSession, refreshJobs, aiEnabled, aiProvider, aiModel, aiBaseUrl],
  );

  const handleDelete = useCallback(
    async (job: ClipJob) => {
      await bridge.deleteJob(job.id);
      if (activeJob?.id === job.id) setActiveJob(null);
      refreshJobs();
    },
    [bridge, activeJob, refreshJobs],
  );

  const handleImported = useCallback(
    (clipId: string, mediaId: string) => {
      if (!activeJob) return;
      const updated: ClipJob = {
        ...activeJob,
        clips: activeJob.clips.map((c) => (c.id === clipId ? { ...c, importedMediaId: mediaId } : c)),
        updatedAt: new Date().toISOString(),
      };
      bridge.saveJob(updated);
      setActiveJob(updated);
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    },
    [activeJob, bridge],
  );

  const showProgress = activeJob !== null;
  const canSelectClips = activeJob !== null && (activeJob.status === 'ready' || activeJob.status === 'done');

  return (
    <div data-slot="clipper-workspace" data-testid="clipper-workspace" className="flex flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl leading-heading font-semibold text-ink">Clipper</h1>
        <p className="text-body text-ink-sub">
          Turn a long video into short clips, entirely on this machine. Nothing is uploaded except clips you
          deliberately import into your Media Library.
        </p>
      </div>
      {workspaceError && (
        <Alert variant="destructive" data-testid="clipper-workspace-error">
          <AlertTitle>{workspaceError}</AlertTitle>
        </Alert>
      )}
      {aiNotice && (
        <Alert data-testid="clipper-ai-notice">
          <AlertTitle>AI ranking unavailable</AlertTitle>
          <AlertDescription>{aiNotice}</AlertDescription>
        </Alert>
      )}
      <ClipperJobSetup
        runtime={runtime}
        runtimeError={runtimeError}
        hasAiKey={hasAiKey}
        source={source}
        probe={probe}
        probeError={probeError}
        probing={probing}
        output={output}
        onPickSource={handlePickSource}
        onPickOutput={handlePickOutput}
        onStart={handleStart}
        starting={starting}
        aiEnabled={aiEnabled}
        onAiEnabledChange={setAiEnabled}
        aiProvider={aiProvider}
        onAiProviderChange={setAiProvider}
        aiModel={aiModel}
        onAiModelChange={setAiModel}
        aiBaseUrl={aiBaseUrl}
        onAiBaseUrlChange={setAiBaseUrl}
      />
      {showProgress && activeJob && (
        <Card data-testid="clipper-active-job" className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-body font-semibold text-ink">{activeJob.sourceName}</h2>
            <p className="text-body text-ink-sub">
              {activeJob.model} model · {activeJob.clipCount} {activeJob.clipCount === 1 ? 'clip' : 'clips'} ·{' '}
              {activeJob.aspect === 'vertical' ? 'Vertical 9:16' : 'Original shape'}
            </p>
          </div>
          <ClipperJobProgress job={activeJob} onCancel={handleCancel} cancelling={cancelling} />
          {activeJob.clips.length > 0 && (
            <ClipperClipList
              clips={activeJob.clips}
              selectedIds={selectedIds}
              onSelectedIdsChange={setSelectedIds}
              canSelect={canSelectClips}
              onExport={handleExport}
              exporting={exporting}
              onImport={(clip) => {
                const index = activeJob.clips.findIndex((c) => c.id === clip.id) + 1;
                setImportClip({ clip, index });
                setImportingClipId(clip.id);
              }}
              importingClipId={importingClipId}
            />
          )}
          {activeJob.status === 'failed' && activeJob.error?.code === 'NO_SPEECH_DETECTED' && (
            <p className="text-body text-ink-sub">Try a video with speech in it — music-only videos have no clips to pick.</p>
          )}
        </Card>
      )}
      <ClipperJobList
        jobs={jobs}
        activeJobId={activeJob?.id ?? null}
        onSelectJob={handleSelectJob}
        onRetryJob={handleRetry}
        onDeleteJob={handleDelete}
        onStartNew={() => setActiveJob(null)}
      />
      <ClipperLibraryImportDialog
        open={importClip !== null}
        onOpenChange={(open) => {
          if (!open) {
            setImportClip(null);
            setImportingClipId(null);
          }
        }}
        clip={importClip?.clip ?? null}
        clipIndex={importClip?.index ?? 1}
        subdomain={subdomain}
        onImported={handleImported}
      />
    </div>
  );
}
