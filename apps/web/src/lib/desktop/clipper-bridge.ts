/**
 * Clipper bridge adapter (spec 148 §11, T1 reconciliation in spec plan §10).
 *
 * The ONLY Clipper module that names 145 bridge commands. Everything above
 * it (workspace, scorer, captions) talks to the `ClipperBridge` interface,
 * so a renamed command after any future reconciliation is a one-file edit.
 *
 * Commands used (all FROZEN v1.0, no new Tauri command, no main.rs edit):
 * dialog pickers, media_probe, sidecar_model_*, media_transcribe,
 * process_spawn / process_cancel / process_status (ffmpeg via the `ffmpeg`
 * binaryId — resolved ONLY through 145's runtime manager, never PATH),
 * fs_* (scoped reads/writes inside the picked output folder), ai_status /
 * ai_complete (shell-side key use; the key never enters web JS), and the
 * desktop:* progress/exit events. Variances V-RUST / V-FFMPEG / V-DISK /
 * V-IMPORT are recorded in spec plan §10 — notably: there is no landed
 * job-store command (jobs persist in webview localStorage, records only,
 * path hashes never raw paths) and no binary-read command (library import
 * therefore re-picks the exported file with a browser file input; see
 * clipper-library-import.ts).
 *
 * Bridge → clip error mapping (R11): every failure surfaces as a
 * ClipperBridgeError carrying a ClipErrorCode + plain message; technical
 * detail goes behind a Details expander in the UI, never as the message.
 */
import {
  aiComplete,
  aiStatus,
  binaryList,
  CLIP_ERROR_MESSAGES,
  ClipJobSchema,
  dialogOpenDirectory,
  dialogOpenFile,
  fsDelete,
  fsExists,
  fsMkdir,
  fsScopeList,
  fsReadText,
  fsWriteText,
  getShellInfo,
  isLegalClipTransition,
  mediaProbe,
  mediaTranscribe,
  processCancel,
  processSpawn,
  processStatus,
  sidecarModelEnsure,
  sidecarModelList,
  sidecarModelStatus,
  subscribeDesktopEvent,
  type ClipAspect,
  type ClipErrorCode,
  type ClipJob,
  type ClipJobStatus,
  type ClipModel,
  type ClipSelection,
  type TranscriptSegment,
} from '@fbuploadpro/contracts';
import { CLIP_LIMITS } from '@fbuploadpro/contracts';
import { selectClips } from '@/components/clipper/clipper-selection';
import { clipFileName, clipSrtFileName, clipThumbFileName, segmentsToAss, segmentsToSrt } from '@/components/clipper/clipper-captions';
import { buildAstatsArgs, buildExportArgs, buildThumbnailArgs, buildWavExtractArgs } from '@/components/clipper/clipper-ffmpeg';
import { parseAstatsStderr, parseWhisperJson } from '@/components/clipper/clipper-transcript';

export class ClipperBridgeError extends Error {
  readonly code: ClipErrorCode;
  readonly detail?: string;
  constructor(code: ClipErrorCode, detail?: string) {
    super(CLIP_ERROR_MESSAGES[code]);
    this.name = 'ClipperBridgeError';
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

export function clipError(code: ClipErrorCode, detail?: string): ClipperBridgeError {
  return new ClipperBridgeError(code, detail);
}

/** Bridge error codes → clip error codes (context fallback when unknown). */
export function mapBridgeError(err: unknown, fallback: ClipErrorCode = 'BRIDGE_ERROR'): ClipperBridgeError {
  if (err instanceof ClipperBridgeError) return err;
  const code = (err as { code?: string } | null)?.code;
  const detail = (err as { message?: string } | null)?.message;
  switch (code) {
    case 'BRIDGE_UNAVAILABLE':
      return clipError('BRIDGE_UNAVAILABLE');
    case 'BRIDGE_VERSION_MISMATCH':
      return clipError('BRIDGE_UNAVAILABLE', detail);
    case 'VALIDATION_ERROR':
      return clipError('BRIDGE_PROTOCOL_ERROR', detail);
    case 'MEDIA_PROBE_FAILED':
      return clipError('SOURCE_UNREADABLE', detail);
    case 'ARTIFACT_CHECKSUM_MISMATCH':
      return clipError('MODEL_CHECKSUM_MISMATCH', detail);
    case 'ARTIFACT_OFFLINE':
      return clipError('MODEL_DOWNLOAD_FAILED', detail);
    case 'TRANSCRIBE_FAILED':
      return clipError('TRANSCRIPTION_FAILED', detail);
    case 'MEDIA_CONVERT_FAILED':
      return clipError('EXPORT_FAILED', detail);
    case 'AI_KEY_MISSING':
    case 'AI_PROVIDER_ERROR':
    case 'AI_TIMEOUT':
    case 'AI_RATE_LIMITED':
      return clipError('AI_PROVIDER_FAILED', detail);
    default:
      return clipError(fallback, detail);
  }
}

/** Identity hash for a path (FNV-1a, NOT cryptographic — identity only). */
export function hashPath(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${value.length}-${hash.toString(16).padStart(8, '0')}`;
}

export interface PickedSource {
  scopeId: string;
  path: string;
  name: string;
}

export interface PickedFolder {
  scopeId: string;
  path: string;
}

export interface ProbeResult {
  durationSeconds: number | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
}

export type ModelState = 'not-installed' | 'downloading' | 'installed' | 'corrupt';

export interface RuntimeStatus {
  ffmpegReady: boolean;
  whisperReady: boolean;
  models: Record<ClipModel, ModelState>;
}

export interface JobSession {
  source: PickedSource;
  output: PickedFolder;
  probe: ProbeResult;
  cancelled: boolean;
  currentRunId: string | null;
}

export interface RunJobResult {
  job: ClipJob;
  aiNotice?: string;
}

const JOBS_STORAGE_KEY = 'fbuploadpro-clipper-jobs-v1';
const WORK_DIR_PREFIX = 'clipper-work-';
const MODEL_ARTIFACT_ID: Record<ClipModel, string> = {
  tiny: 'whisper-tiny',
  base: 'whisper-base',
  small: 'whisper-small',
};

function newJobId(): string {
  const cryptoObj = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `job-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ClipperBridge {
  getShellInfo(): Promise<{ bridgeVersion: string }>;
  pickSource(): Promise<PickedSource | null>;
  pickOutputFolder(): Promise<PickedFolder | null>;
  probeSource(source: PickedSource): Promise<ProbeResult>;
  getRuntimeStatus(): Promise<RuntimeStatus>;
  ensureModel(model: ClipModel, onProgress?: (downloadedBytes: number, totalBytes: number | null) => void): Promise<void>;
  hasAiKey(): Promise<boolean>;
  aiRerank(input: {
    segments: TranscriptSegment[];
    clips: ClipSelection[];
    provider: 'openai' | 'anthropic' | 'openai-compatible';
    model: string;
    baseUrl?: string | undefined;
  }): Promise<Array<{ clipId: string; aiReason: string }>>;
  listJobs(): ClipJob[];
  getJob(id: string): ClipJob | null;
  saveJob(job: ClipJob): void;
  deleteJob(id: string): Promise<void>;
  markInterruptedJobs(): void;
  registerSession(jobId: string, session: JobSession): void;
  getSession(jobId: string): JobSession | undefined;
  runJob(
    job: ClipJob,
    opts: { aiEnabled: boolean; provider: 'openai' | 'anthropic' | 'openai-compatible'; model: string; baseUrl?: string | undefined },
    onUpdate: (job: ClipJob) => void,
  ): Promise<RunJobResult>;
  exportClips(job: ClipJob, clipIds: string[], onUpdate: (job: ClipJob) => void): Promise<ClipJob>;
  cancelJob(id: string): Promise<void>;
}

function readStoredJobs(): ClipJob[] {
  try {
    const raw = globalThis.localStorage?.getItem(JOBS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const jobs: ClipJob[] = [];
    for (const item of parsed) {
      const result = ClipJobSchema.safeParse(item);
      if (result.success) jobs.push(result.data);
    }
    return jobs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, CLIP_LIMITS.MAX_JOBS);
  } catch {
    return [];
  }
}

function writeStoredJobs(jobs: ClipJob[]): void {
  try {
    globalThis.localStorage?.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs.slice(0, CLIP_LIMITS.MAX_JOBS)));
  } catch {
    // Storage full or unavailable: jobs stay in memory for this session.
    // Failing loud here would lose the user's in-flight job state, so the
    // failure is swallowed only for persistence, never for pipeline work.
  }
}

export function createClipperJob(input: {
  sourceName: string;
  sourcePathHash: string;
  sourceDurationSeconds: number | null;
  model: ClipModel;
  clipCount: number;
  aspect: ClipAspect;
}): ClipJob {
  const now = nowIso();
  return {
    id: newJobId(),
    schemaVersion: 1,
    sourceName: input.sourceName,
    sourcePathHash: input.sourcePathHash,
    sourceDurationSeconds: input.sourceDurationSeconds,
    model: input.model,
    clipCount: input.clipCount,
    aspect: input.aspect,
    status: 'probing',
    stagePercent: 0,
    clips: [],
    createdAt: now,
    updatedAt: now,
  };
}

class DesktopClipperBridge implements ClipperBridge {
  private sessions = new Map<string, JobSession>();

  async getShellInfo(): Promise<{ bridgeVersion: string }> {
    const info = await getShellInfo();
    return { bridgeVersion: info.bridgeVersion };
  }

  async pickSource(): Promise<PickedSource | null> {
    const result = await dialogOpenFile({
      title: 'Choose a video',
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'webm'] }],
    });
    if (result.cancelled || result.files.length === 0) return null;
    const file = result.files[0];
    return { scopeId: file.scopeId, path: file.path, name: file.name };
  }

  async pickOutputFolder(): Promise<PickedFolder | null> {
    const result = await dialogOpenDirectory({ title: 'Choose an output folder' });
    if (result.cancelled || result.directories.length === 0) return null;
    const dir = result.directories[0];
    return { scopeId: dir.scopeId, path: dir.path };
  }

  async probeSource(source: PickedSource): Promise<ProbeResult> {
    let probe;
    try {
      probe = await mediaProbe({ scopeId: source.scopeId, relativePath: '' });
    } catch (err) {
      throw mapBridgeError(err, 'SOURCE_UNREADABLE');
    }
    const video = probe.streams.find((s) => s.codecType === 'video');
    const audio = probe.streams.find((s) => s.codecType === 'audio');
    return {
      durationSeconds: probe.durationSeconds,
      sizeBytes: probe.sizeBytes,
      width: video?.width ?? null,
      height: video?.height ?? null,
      hasAudio: Boolean(audio),
    };
  }

  async getRuntimeStatus(): Promise<RuntimeStatus> {
    const [binaries, models] = await Promise.all([binaryList(), sidecarModelList()]);
    const find = (id: string) => binaries.artifacts.find((a) => a.artifactId === id)?.state;
    const modelState = (model: ClipModel): ModelState => {
      const entry = models.artifacts.find((a) => a.artifactId === MODEL_ARTIFACT_ID[model]);
      if (!entry) return 'not-installed';
      if (entry.state === 'ready') return 'installed';
      if (entry.state === 'downloading') return 'downloading';
      if (entry.state === 'corrupt') return 'corrupt';
      return 'not-installed';
    };
    return {
      ffmpegReady: find('ffmpeg') === 'ready',
      whisperReady: find('whisper') === 'ready',
      models: { tiny: modelState('tiny'), base: modelState('base'), small: modelState('small') },
    };
  }

  async ensureModel(
    model: ClipModel,
    onProgress?: (downloadedBytes: number, totalBytes: number | null) => void,
  ): Promise<void> {
    const artifactId = MODEL_ARTIFACT_ID[model];
    let status;
    try {
      status = await sidecarModelStatus(artifactId);
    } catch (err) {
      throw mapBridgeError(err, 'MODEL_DOWNLOAD_FAILED');
    }
    if (status.artifact.state === 'ready') return;
    if (status.artifact.state === 'corrupt') {
      throw clipError('MODEL_CHECKSUM_MISMATCH');
    }
    let unlisten: (() => Promise<void> | void) | null = null;
    try {
      unlisten = await subscribeDesktopEvent<{ artifactId: string; downloadedBytes: number; totalBytes: number | null }>(
        'desktop:artifact:progress',
        (payload) => {
          if (payload.artifactId === artifactId) onProgress?.(payload.downloadedBytes, payload.totalBytes);
        },
      );
    } catch {
      unlisten = null; // Progress events are best-effort; polling still works.
    }
    try {
      try {
        await sidecarModelEnsure({ modelId: artifactId });
      } catch (err) {
        throw mapBridgeError(err, 'MODEL_DOWNLOAD_FAILED');
      }
      for (let attempt = 0; attempt < 3600; attempt += 1) {
        await sleep(2000);
        let current;
        try {
          current = await sidecarModelStatus(artifactId);
        } catch (err) {
          throw mapBridgeError(err, 'MODEL_DOWNLOAD_FAILED');
        }
        if (current.artifact.state === 'ready') return;
        if (current.artifact.state === 'corrupt' || current.artifact.state === 'error') {
          const code = current.artifact.error?.code;
          if (code === 'ARTIFACT_CHECKSUM_MISMATCH') throw clipError('MODEL_CHECKSUM_MISMATCH');
          throw clipError('MODEL_DOWNLOAD_FAILED', current.artifact.error?.message);
        }
      }
      throw clipError('MODEL_DOWNLOAD_FAILED', 'The model download timed out.');
    } finally {
      if (unlisten) {
        try {
          await unlisten();
        } catch {
          // Unlisten failures are ignorable.
        }
      }
    }
  }

  async hasAiKey(): Promise<boolean> {
    try {
      const status = await aiStatus('clipper');
      return status.hasKey;
    } catch {
      return false;
    }
  }

  async aiRerank(input: {
    segments: TranscriptSegment[];
    clips: ClipSelection[];
    provider: 'openai' | 'anthropic' | 'openai-compatible';
    model: string;
    baseUrl?: string;
  }): Promise<Array<{ clipId: string; aiReason: string }>> {
    // Transcript text + timestamps ONLY — never audio or video bytes — and
    // only to the user's own provider, from the user's own machine.
    // The bridge caps a message at 100,000 chars, so the transcript is
    // truncated to fit (clips are always sent in full); a truncated
    // transcript still ranks the given clips, it never invents new ones.
    const clipsPayload = input.clips.map((c) => ({
      id: c.id,
      startSeconds: c.startSeconds,
      endSeconds: c.endSeconds,
      excerpt: c.excerpt,
      reasons: c.reasons,
    }));
    const clipsJson = JSON.stringify({ clips: clipsPayload });
    const budget = 95000 - clipsJson.length;
    const transcript: Array<{ start: number; end: number; text: string }> = [];
    let used = 0;
    for (const s of input.segments) {
      const entry = JSON.stringify({ start: s.startSeconds, end: s.endSeconds, text: s.text });
      if (used + entry.length > budget && transcript.length > 0) break;
      transcript.push({ start: s.startSeconds, end: s.endSeconds, text: s.text });
      used += entry.length;
    }
    const request = {
      service: 'clipper',
      provider: input.provider,
      ...(input.baseUrl ? { baseUrl: input.baseUrl } : {}),
      model: input.model,
      messages: [
        {
          role: 'system' as const,
          content:
            'You rank short video clips for social media. Reply with JSON only: {"ranking":[{"id":"<clip id>","reason":"<short reason, max 30 words>"}]} covering every clip id given, best first.',
        },
        {
          role: 'user' as const,
          content: JSON.stringify({ clips: clipsPayload, transcript }),
        },
      ],
    };
    let output: string;
    try {
      const response = await aiComplete(request);
      output = response.output;
    } catch (err) {
      throw mapBridgeError(err, 'AI_PROVIDER_FAILED');
    }
    try {
      const start = output.indexOf('{');
      const end = output.lastIndexOf('}');
      if (start < 0 || end <= start) throw new Error('No JSON object in AI output.');
      const parsed = JSON.parse(output.slice(start, end + 1)) as {
        ranking?: Array<{ id?: unknown; reason?: unknown }>;
      };
      if (!Array.isArray(parsed.ranking) || parsed.ranking.length === 0) throw new Error('Empty AI ranking.');
      const known = new Set(input.clips.map((c) => c.id));
      const ranking: Array<{ clipId: string; aiReason: string }> = [];
      for (const entry of parsed.ranking) {
        if (typeof entry.id === 'string' && known.has(entry.id) && !ranking.some((r) => r.clipId === entry.id)) {
          ranking.push({
            clipId: entry.id,
            aiReason: typeof entry.reason === 'string' ? entry.reason.slice(0, 200) : '',
          });
        }
      }
      if (ranking.length === 0) throw new Error('AI ranking named no known clip.');
      return ranking;
    } catch {
      throw clipError('AI_PROVIDER_FAILED', 'The AI response could not be read.');
    }
  }

  listJobs(): ClipJob[] {
    return readStoredJobs();
  }

  getJob(id: string): ClipJob | null {
    return readStoredJobs().find((j) => j.id === id) ?? null;
  }

  saveJob(job: ClipJob): void {
    const parsed = ClipJobSchema.safeParse(job);
    if (!parsed.success) throw clipError('BRIDGE_PROTOCOL_ERROR', 'Refusing to store an invalid job record.');
    const jobs = readStoredJobs().filter((j) => j.id !== job.id);
    jobs.unshift(parsed.data);
    writeStoredJobs(jobs.slice(0, CLIP_LIMITS.MAX_JOBS));
  }

  async deleteJob(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      try {
        await fsDelete({ scopeId: session.output.scopeId, relativePath: `${WORK_DIR_PREFIX}${id}`, recursive: true });
      } catch {
        // Work-dir cleanup is best-effort; the record is still deleted and
        // exports/library items are never touched by job deletion.
      }
      this.sessions.delete(id);
    } else {
      // After a reload there is no session, but directory scopes persist
      // in the shell: sweep them for this job's work dir only. The name
      // is job-scoped, so no other folder content is ever touched.
      try {
        const scopes = await fsScopeList();
        for (const scope of scopes.scopes) {
          if (scope.kind !== 'directory') continue;
          try {
            await fsDelete({ scopeId: scope.scopeId, relativePath: `${WORK_DIR_PREFIX}${id}`, recursive: true });
          } catch {
            // Not present under this scope — try the next one.
          }
        }
      } catch {
        // Scope listing is best-effort; the record is still deleted.
      }
    }
    writeStoredJobs(readStoredJobs().filter((j) => j.id !== id));
  }

  markInterruptedJobs(): void {
    const jobs = readStoredJobs();
    let changed = false;
    const updated = jobs.map((job) => {
      // `ready` is a resting stage, not an interrupted one: its clips and
      // segments survive a reload (export re-picks folders on demand).
      const resting: ClipJobStatus[] = ['done', 'failed', 'cancelled', 'ready'];
      if (!resting.includes(job.status)) {
        changed = true;
        return {
          ...job,
          status: 'failed' as ClipJobStatus,
          stagePercent: job.stagePercent,
          error: { code: 'INTERRUPTED' as const, message: CLIP_ERROR_MESSAGES.INTERRUPTED },
          updatedAt: nowIso(),
        };
      }
      return job;
    });
    if (changed) writeStoredJobs(updated);
  }

  registerSession(jobId: string, session: JobSession): void {
    this.sessions.set(jobId, session);
  }

  getSession(jobId: string): JobSession | undefined {
    return this.sessions.get(jobId);
  }

  private updateJob(job: ClipJob, patch: Partial<ClipJob>, onUpdate: (job: ClipJob) => void): ClipJob {
    // Cancel wins: once the stored record is `cancelled`, in-flight
    // progress updates must not resurrect it. This closes the race where
    // cancelJob saves `cancelled` and a late stage update overwrites it
    // with a stale non-terminal status. `failed` and `done` are NOT
    // blocked here: retry (failed → exporting/selecting) and re-export
    // (done → exporting) are legitimate transitions from those states.
    const stored = this.getJob(job.id);
    if (stored && stored.status === 'cancelled') {
      onUpdate(stored);
      return stored;
    }
    const next: ClipJob = { ...job, ...patch, updatedAt: nowIso() };
    if (patch.status && patch.status !== job.status && !isLegalClipTransition(job.status, patch.status)) {
      throw clipError('BRIDGE_PROTOCOL_ERROR', `Illegal clip stage transition: ${job.status} -> ${patch.status}`);
    }
    this.saveJob(next);
    onUpdate(next);
    return next;
  }

  private async waitForProcess(
    runId: string,
    onStderr?: (chunk: string) => void,
  ): Promise<{ state: 'exited' | 'cancelled'; exitCode: number | null }> {
    const unlistens: Array<() => Promise<void> | void> = [];
    // Holder object (not a narrowed local): the exit handler assigns from
    // an event callback, which TypeScript cannot track on a plain local.
    const exitState: { current: { exitCode: number | null; reason: string } | null } = { current: null };
    if (onStderr) {
      try {
        const unlisten = await subscribeDesktopEvent<{ runId: string; chunk: string }>(
          'desktop:process:stderr',
          (payload) => {
            if (payload.runId === runId) onStderr(payload.chunk);
          },
        );
        unlistens.push(unlisten);
      } catch {
        // Stderr capture is best-effort; polling still reports completion.
      }
    }
    try {
      const exitUnlisten = await subscribeDesktopEvent<{
        runId: string;
        exitCode: number | null;
        reason: string;
      }>('desktop:process:exit', (payload) => {
        if (payload.runId === runId) exitState.current = { exitCode: payload.exitCode, reason: payload.reason };
      }).catch(() => null);
      if (exitUnlisten) unlistens.push(exitUnlisten);
    } catch {
      // Polling below is the fallback.
    }
    try {
      // 28,800 × 750 ms ≈ 6 h: a 2 h source on a slow CPU must not be cut
      // off by the wait itself; the shell's own spawn timeout still bounds it.
      for (let attempt = 0; attempt < 28800; attempt += 1) {
        if (exitState.current) {
          const seen = exitState.current;
          return { state: seen.reason === 'cancelled' ? 'cancelled' : 'exited', exitCode: seen.exitCode };
        }
        let status;
        try {
          status = await processStatus({ runId });
        } catch {
          await sleep(750);
          continue;
        }
        if (status.state === 'cancelled') return { state: 'cancelled', exitCode: status.exitCode };
        if (status.state === 'exited') return { state: 'exited', exitCode: status.exitCode };
        await sleep(750);
      }
      throw clipError('BRIDGE_ERROR', 'A desktop process did not finish in time.');
    } finally {
      for (const unlisten of unlistens) {
        try {
          await unlisten();
        } catch {
          // Unlisten failures are ignorable.
        }
      }
    }
  }

  async runJob(
    job: ClipJob,
    opts: { aiEnabled: boolean; provider: 'openai' | 'anthropic' | 'openai-compatible'; model: string; baseUrl?: string | undefined },
    onUpdate: (job: ClipJob) => void,
  ): Promise<RunJobResult> {
    const session = this.sessions.get(job.id);
    if (!session) throw clipError('BRIDGE_PROTOCOL_ERROR', 'This job has no source or output folder in this session. Retry it to pick them again.');
    let current = job;
    const startedAt = Date.now();
    const elapsed = () => Math.floor((Date.now() - startedAt) / 1000) + (job.elapsedSeconds ?? 0);
    try {
      // Pre-flight (spec OD-148-5): limits are enforced BEFORE any download.
      if (session.probe.sizeBytes !== null && session.probe.sizeBytes > CLIP_LIMITS.MAX_SIZE_BYTES) {
        throw clipError('FILE_TOO_LARGE');
      }
      if (session.probe.durationSeconds !== null && session.probe.durationSeconds > CLIP_LIMITS.MAX_DURATION_SECONDS) {
        throw clipError('DURATION_TOO_LONG');
      }
      if (!session.probe.hasAudio) {
        throw clipError('NO_SPEECH_DETECTED', 'The video has no audio track.');
      }
      // Model ensure (skipped when the model is already installed).
      const runtime = await this.getRuntimeStatus();
      if (runtime.models[job.model] !== 'installed') {
        current = this.updateJob(current, { status: 'downloading-model', stagePercent: 0, elapsedSeconds: elapsed() }, onUpdate);
        await this.ensureModel(job.model, (downloaded, total) => {
          const percent = total !== null && total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
          try {
            current = this.updateJob(current, { stagePercent: percent, elapsedSeconds: elapsed() }, onUpdate);
          } catch {
            // Progress updates must never fail the job.
          }
        });
        if (session.cancelled) {
          return { job: this.getJob(job.id) ?? { ...current, status: 'cancelled' as ClipJobStatus } };
        }
      }
      // Transcription (skipped on retry when segments already exist).
      let segments = current.segments;
      if (!segments || segments.length === 0) {
        current = this.updateJob(current, { status: 'transcribing', stagePercent: 0, elapsedSeconds: elapsed() }, onUpdate);
        const workDir = `${WORK_DIR_PREFIX}${job.id}`;
        await fsMkdir({ scopeId: session.output.scopeId, relativePath: workDir, recursive: true });
        const wavRel = `${workDir}/audio.wav`;
        const wavRun = await processSpawn({
          binaryId: 'ffmpeg',
          args: buildWavExtractArgs(session.source.path, wavRel),
          cwdScopeId: session.output.scopeId,
          timeoutMs: 1800000,
        });
        session.currentRunId = wavRun.runId;
        const wavDone = await this.waitForProcess(wavRun.runId);
        session.currentRunId = null;
        if (wavDone.state === 'cancelled' || session.cancelled) {
          current = this.updateJob(current, { status: 'cancelled', stagePercent: 0 }, onUpdate);
          return { job: current };
        }
        if (wavDone.exitCode !== 0) throw clipError('TRANSCRIPTION_FAILED', 'Audio extraction failed.');
        // Energy pre-pass: best-effort — its absence only drops the
        // high-energy signal; it never fails the job.
        let energySeries: number[] | undefined;
        try {
          let stderr = '';
          const astatsRun = await processSpawn({
            binaryId: 'ffmpeg',
            args: buildAstatsArgs(session.source.path),
            cwdScopeId: session.output.scopeId,
            timeoutMs: 1800000,
          });
          session.currentRunId = astatsRun.runId;
          const astatsDone = await this.waitForProcess(astatsRun.runId, (chunk) => {
            stderr += chunk;
          });
          session.currentRunId = null;
          if (astatsDone.state === 'exited' && astatsDone.exitCode === 0) {
            const series = parseAstatsStderr(stderr);
            if (series.length > 0) energySeries = series;
          }
        } catch {
          energySeries = undefined;
        }
        if (session.cancelled) {
          current = this.updateJob(current, { status: 'cancelled', stagePercent: 0 }, onUpdate);
          return { job: current };
        }
        const transcribeRun = await mediaTranscribe({
          inputScopeId: session.output.scopeId,
          inputRelativePath: wavRel,
          modelId: MODEL_ARTIFACT_ID[job.model],
          outputScopeId: session.output.scopeId,
          outputRelativePath: `${workDir}/transcript.json`,
          outputFormat: 'json',
        });
        session.currentRunId = transcribeRun.runId;
        const transcribeDone = await this.waitForProcess(transcribeRun.runId);
        session.currentRunId = null;
        if (transcribeDone.state === 'cancelled' || session.cancelled) {
          current = this.updateJob(current, { status: 'cancelled', stagePercent: 0 }, onUpdate);
          return { job: current };
        }
        if (transcribeDone.exitCode !== 0) throw clipError('TRANSCRIPTION_FAILED');
        let transcriptText: string;
        try {
          const read = await fsReadText({ scopeId: session.output.scopeId, relativePath: `${workDir}/transcript.json` });
          transcriptText = read.content;
        } catch (err) {
          throw mapBridgeError(err, 'TRANSCRIPTION_FAILED');
        }
        try {
          segments = parseWhisperJson(transcriptText);
        } catch {
          throw clipError('TRANSCRIPTION_FAILED', 'The transcription output could not be read.');
        }
        const wordCount = segments.reduce((sum, s) => sum + s.text.split(/\s+/).filter(Boolean).length, 0);
        if (segments.length === 0 || wordCount < CLIP_LIMITS.MIN_SPEECH_WORDS) {
          throw clipError('NO_SPEECH_DETECTED');
        }
        current = this.updateJob(
          current,
          { segments, stagePercent: 100, elapsedSeconds: elapsed() },
          onUpdate,
        );
        // Stash the energy series for the selection step below via a
        // closure variable (it is derived data, not a job record field).
        (current as unknown as { __energySeries?: number[] | undefined }).__energySeries = energySeries;
      }
      // Selection (web layer, deterministic heuristic). On retry, existing
      // clips are kept: re-selecting after a partial export would discard
      // already-exported clips (and the energy series is not persisted).
      // Fresh selection only happens when this run produced the transcript.
      // The selecting stage is still entered so stage transitions stay
      // legal (failed → selecting → ready).
      const hadClips = current.clips.length > 0;
      let clips: ClipSelection[] = current.clips;
      let aiNotice: string | undefined;
      current = this.updateJob(current, { status: 'selecting', stagePercent: 0, elapsedSeconds: elapsed() }, onUpdate);
      if (!hadClips) {
        const energySeries = (current as unknown as { __energySeries?: number[] | undefined }).__energySeries;
        const picked = selectClips(current.segments ?? [], {
          clipCount: job.clipCount,
          energySeries,
        });
        if (picked.length === 0) {
          throw clipError('SELECTION_FAILED', 'No clips cleared the quality bar for this transcript.');
        }
        clips = picked;
      }
      if (opts.aiEnabled && !hadClips) {
        try {
          const hasKey = await this.hasAiKey();
          if (!hasKey) {
            aiNotice = 'No AI key is stored in the desktop app, so local picks are shown.';
          } else {
            const ranking = await this.aiRerank({
              segments: current.segments ?? [],
              clips,
              provider: opts.provider,
              model: opts.model,
              ...(opts.baseUrl ? { baseUrl: opts.baseUrl } : {}),
            });
            const byId = new Map(clips.map((c) => [c.id, c]));
            const ranked: ClipSelection[] = [];
            for (const entry of ranking) {
              const clip = byId.get(entry.clipId);
              if (clip) ranked.push({ ...clip, aiRanked: true, aiReason: entry.aiReason });
            }
            for (const clip of clips) {
              if (!ranked.some((c) => c.id === clip.id)) ranked.push(clip);
            }
            clips = ranked;
          }
        } catch (err) {
          if (err instanceof ClipperBridgeError && err.code === 'AI_PROVIDER_FAILED') {
            aiNotice = err.message;
          } else {
            throw err;
          }
        }
      }
      if (session.cancelled) {
        return { job: this.getJob(job.id) ?? { ...current, status: 'cancelled' as ClipJobStatus } };
      }
      current = this.updateJob(
        current,
        { status: 'ready', stagePercent: 100, clips, elapsedSeconds: elapsed() },
        onUpdate,
      );
      return { job: current, ...(aiNotice ? { aiNotice } : {}) };
    } catch (err) {
      if (err instanceof ClipperBridgeError) {
        if (err.code === 'CANCELLED') {
          const cancelled = this.updateJob(current, { status: 'cancelled', stagePercent: 0 }, onUpdate);
          return { job: cancelled };
        }
        const failed = this.updateJob(
          current,
          {
            status: 'failed',
            stagePercent: 0,
            error: { code: err.code, message: err.message, ...(err.detail ? { detail: err.detail } : {}) },
            elapsedSeconds: elapsed(),
          },
          onUpdate,
        );
        return { job: failed };
      }
      const stageFallback: ClipErrorCode =
        current.status === 'transcribing'
          ? 'TRANSCRIPTION_FAILED'
          : current.status === 'downloading-model'
            ? 'MODEL_DOWNLOAD_FAILED'
            : current.status === 'selecting'
              ? 'SELECTION_FAILED'
              : 'BRIDGE_ERROR';
      const mapped = mapBridgeError(err, stageFallback);
      const failed = this.updateJob(
        current,
        {
          status: 'failed',
          stagePercent: 0,
          error: { code: mapped.code, message: mapped.message, ...(mapped.detail ? { detail: mapped.detail } : {}) },
          elapsedSeconds: elapsed(),
        },
        onUpdate,
      );
      return { job: failed };
    }
  }

  async exportClips(job: ClipJob, clipIds: string[], onUpdate: (job: ClipJob) => void): Promise<ClipJob> {
    const session = this.sessions.get(job.id);
    if (!session) throw clipError('BRIDGE_PROTOCOL_ERROR', 'This job has no source or output folder in this session. Retry it to pick them again.');
    let current = job;
    const startedAt = Date.now();
    const elapsed = () => Math.floor((Date.now() - startedAt) / 1000) + (job.elapsedSeconds ?? 0);
    const selected = current.clips.filter((c) => clipIds.includes(c.id));
    if (selected.length === 0) throw clipError('BRIDGE_PROTOCOL_ERROR', 'No clips were selected for export.');
    const workDir = `${WORK_DIR_PREFIX}${job.id}`;
    try {
      current = this.updateJob(current, { status: 'exporting', stagePercent: 0, elapsedSeconds: elapsed() }, onUpdate);
      await fsMkdir({ scopeId: session.output.scopeId, relativePath: workDir, recursive: true });
      const selectedTotal = selected.length;
      let selectedExported = selected.filter((c) => c.exportStatus === 'exported').length;
      for (const clip of selected) {
        if (session.cancelled) break;
        if (clip.exportStatus === 'exported') continue;
        const clipIndex = current.clips.findIndex((c) => c.id === clip.id) + 1;
        const fileName = clipFileName(clipIndex, clip.excerpt);
        const assRel = `${workDir}/clip-${String(clipIndex).padStart(2, '0')}.ass`;
        const srtName = clipSrtFileName(clipIndex, clip.excerpt);
        const thumbName = clipThumbFileName(clipIndex);
        const setClipStatus = (exportStatus: ClipSelection['exportStatus'], exportPathHash?: string) => {
          const clips = current.clips.map((c) =>
            c.id === clip.id ? { ...c, exportStatus, ...(exportPathHash ? { exportPathHash } : {}) } : c,
          );
          current = this.updateJob(
            current,
            {
              clips,
              stagePercent: selectedTotal > 0 ? Math.round((selectedExported / selectedTotal) * 100) : 100,
              elapsedSeconds: elapsed(),
            },
            onUpdate,
          );
        };
        setClipStatus('exporting');
        try {
          const assWidth = job.aspect === 'vertical' ? 1080 : (session.probe.width ?? 1920);
          const assHeight = job.aspect === 'vertical' ? 1920 : (session.probe.height ?? 1080);
          await fsWriteText({
            scopeId: session.output.scopeId,
            relativePath: assRel,
            content: segmentsToAss(current.segments ?? [], clip.startSeconds, clip.endSeconds, assWidth, assHeight),
            overwrite: true,
          });
          await fsWriteText({
            scopeId: session.output.scopeId,
            relativePath: srtName,
            content: segmentsToSrt(current.segments ?? [], clip.startSeconds, clip.endSeconds),
            overwrite: true,
          });
          const exportRun = await processSpawn({
            binaryId: 'ffmpeg',
            args: buildExportArgs({
              inputAbsolutePath: session.source.path,
              startSeconds: clip.startSeconds,
              endSeconds: clip.endSeconds,
              aspect: job.aspect,
              assRelativePath: assRel,
              outputRelativePath: fileName,
            }),
            cwdScopeId: session.output.scopeId,
            timeoutMs: 600000,
          });
          session.currentRunId = exportRun.runId;
          const done = await this.waitForProcess(exportRun.runId);
          session.currentRunId = null;
          if (done.state === 'cancelled' || session.cancelled) {
            await fsDelete({ scopeId: session.output.scopeId, relativePath: fileName }).catch(() => undefined);
            setClipStatus('failed');
            break;
          }
          if (done.exitCode !== 0) throw new Error('ffmpeg export failed');
          const exists = await fsExists({ scopeId: session.output.scopeId, relativePath: fileName });
          if (!exists.exists) throw new Error('Export output missing after ffmpeg success.');
          // Thumbnail frame: best-effort, never fails the clip.
          try {
            const thumbRun = await processSpawn({
              binaryId: 'ffmpeg',
              args: buildThumbnailArgs(session.source.path, (clip.startSeconds + clip.endSeconds) / 2, thumbName),
              cwdScopeId: session.output.scopeId,
              timeoutMs: 120000,
            });
            session.currentRunId = thumbRun.runId;
            await this.waitForProcess(thumbRun.runId);
            session.currentRunId = null;
          } catch {
            session.currentRunId = null;
          }
          selectedExported += 1;
          setClipStatus('exported', hashPath(fileName));
        } catch {
          await fsDelete({ scopeId: session.output.scopeId, relativePath: fileName }).catch(() => undefined);
          setClipStatus('failed');
        }
      }
      if (session.cancelled) {
        current = this.updateJob(current, { status: 'cancelled', stagePercent: 0 }, onUpdate);
        return current;
      }
      const anyExported = current.clips.some((c) => c.exportStatus === 'exported');
      if (!anyExported) {
        current = this.updateJob(
          current,
          { status: 'failed', stagePercent: 0, error: { code: 'EXPORT_FAILED', message: CLIP_ERROR_MESSAGES.EXPORT_FAILED }, elapsedSeconds: elapsed() },
          onUpdate,
        );
        return current;
      }
      current = this.updateJob(current, { status: 'done', stagePercent: 100, elapsedSeconds: elapsed() }, onUpdate);
      return current;
    } catch (err) {
      if (session.cancelled) {
        current = this.updateJob(current, { status: 'cancelled', stagePercent: 0 }, onUpdate);
        return current;
      }
      const mapped = mapBridgeError(err, 'EXPORT_FAILED');
      const failed = this.updateJob(
        current,
        {
          status: 'failed',
          stagePercent: 0,
          error: { code: mapped.code, message: mapped.message, ...(mapped.detail ? { detail: mapped.detail } : {}) },
          elapsedSeconds: elapsed(),
        },
        onUpdate,
      );
      return failed;
    }
  }

  async cancelJob(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.cancelled = true;
      if (session.currentRunId) {
        try {
          await processCancel({ runId: session.currentRunId });
        } catch {
          // Cancel that cannot kill the process surfaces via the job's
          // own completion path; never a silent no-op in the UI: the
          // workspace keeps polling and reports the terminal state.
        }
      }
    }
    const job = this.getJob(id);
    if (job && !['done', 'failed', 'cancelled'].includes(job.status)) {
      this.saveJob({ ...job, status: 'cancelled', stagePercent: 0, updatedAt: nowIso() });
    }
  }
}

export const clipperBridge: ClipperBridge = new DesktopClipperBridge();

/** Test seam: a bridge whose methods a test controls. Production uses `clipperBridge`. */
export type { ClipperBridge as ClipperBridgeType };
