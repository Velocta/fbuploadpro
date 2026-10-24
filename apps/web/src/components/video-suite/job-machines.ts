/**
 * Job state machines (spec §7.1). Pure transition functions, unit-tested
 * exhaustively: illegal transitions are no-ops (never throws in the UI),
 * terminal states are absorbing, progress updates are ignored for
 * terminal jobs, and Retry creates a NEW job with the same inputs.
 */
import {
  DownloadJobSchema,
  ConversionJobSchema,
  type ConversionJob,
  type DownloadJob,
  type ProgressEvent,
  type VideoSuiteErrorCode,
} from '@fbuploadpro/contracts';

export type { ConversionJob, DownloadJob };

function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `00000000-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, '0')}`;
}

const DOWNLOAD_TERMINAL: readonly DownloadJob['status'][] = ['completed', 'failed', 'cancelled'];
const CONVERSION_TERMINAL: readonly ConversionJob['status'][] = ['completed', 'failed', 'cancelled'];

export function isDownloadTerminal(job: DownloadJob): boolean {
  return (DOWNLOAD_TERMINAL as readonly string[]).includes(job.status);
}
export function isConversionTerminal(job: ConversionJob): boolean {
  return (CONVERSION_TERMINAL as readonly string[]).includes(job.status);
}

export function createDownloadJob(input: {
  url: string;
  title: string | null;
  choice: DownloadJob['choice'];
  destinationFolder: string;
  fileName: string;
}): DownloadJob {
  const now = nowIso();
  return {
    id: newId(),
    url: input.url,
    title: input.title,
    choice: input.choice,
    destinationFolder: input.destinationFolder,
    fileName: input.fileName,
    status: 'queued',
    progress: null,
    errorCode: null,
    errorDetail: null,
    finalPath: null,
    finalSizeBytes: null,
    note: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createConversionJob(input: {
  sourcePath: string;
  sourceName: string;
  sourceScopeId: string;
  inputRelativePath: string;
  target: ConversionJob['target'];
  resolution: ConversionJob['resolution'];
  quality: ConversionJob['quality'];
  outputFolder: string;
  outputFileName: string;
}): ConversionJob {
  const now = nowIso();
  return {
    id: newId(),
    sourcePath: input.sourcePath,
    sourceName: input.sourceName,
    sourceScopeId: input.sourceScopeId,
    inputRelativePath: input.inputRelativePath,
    target: input.target,
    resolution: input.resolution,
    quality: input.quality,
    outputFolder: input.outputFolder,
    outputFileName: input.outputFileName,
    status: 'queued',
    progress: null,
    errorCode: null,
    errorDetail: null,
    finalPath: null,
    finalSizeBytes: null,
    note: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Progress updates apply only to non-terminal jobs; terminal jobs ignore them. */
export function startDownloadJob(job: DownloadJob): DownloadJob {
  if (job.status !== 'queued') return job;
  return { ...job, status: 'downloading', updatedAt: nowIso() };
}

export function startConversionJob(job: ConversionJob): ConversionJob {
  if (job.status !== 'queued') return job;
  return { ...job, status: 'converting', updatedAt: nowIso() };
}

/** The workspace sets the final non-overwriting output name at start time. */
export function renameConversionJob(job: ConversionJob, outputFileName: string): ConversionJob {
  if (job.status !== 'queued') return job;
  return { ...job, outputFileName, updatedAt: nowIso() };
}
export function applyDownloadProgress(job: DownloadJob, progress: ProgressEvent): DownloadJob {
  if (isDownloadTerminal(job)) return job;
  const status =
    progress.phase === 'postprocessing' ? 'postprocessing' : job.status === 'queued' ? 'downloading' : job.status;
  return { ...job, progress, status, updatedAt: nowIso() };
}

export function applyConversionProgress(job: ConversionJob, progress: ProgressEvent): ConversionJob {
  if (isConversionTerminal(job)) return job;
  return { ...job, progress, status: job.status === 'queued' ? 'converting' : job.status, updatedAt: nowIso() };
}

export function completeDownloadJob(job: DownloadJob, finalPath: string, finalSizeBytes: number | null): DownloadJob {
  if (isDownloadTerminal(job)) return job;
  return { ...job, status: 'completed', finalPath, finalSizeBytes, updatedAt: nowIso() };
}

export function completeConversionJob(
  job: ConversionJob,
  finalPath: string,
  finalSizeBytes: number | null,
  note: string | null,
): ConversionJob {
  if (isConversionTerminal(job)) return job;
  return { ...job, status: 'completed', finalPath, finalSizeBytes, note, updatedAt: nowIso() };
}

export function failDownloadJob(job: DownloadJob, code: VideoSuiteErrorCode, detail: string | null): DownloadJob {
  if (isDownloadTerminal(job)) return job;
  return { ...job, status: 'failed', errorCode: code, errorDetail: detail, updatedAt: nowIso() };
}

export function failConversionJob(job: ConversionJob, code: VideoSuiteErrorCode, detail: string | null): ConversionJob {
  if (isConversionTerminal(job)) return job;
  return { ...job, status: 'failed', errorCode: code, errorDetail: detail, updatedAt: nowIso() };
}

/** Cancel is idempotent: cancelling a finished/cancelled job is a no-op. */
export function cancelDownloadJob(job: DownloadJob): DownloadJob {
  if (isDownloadTerminal(job)) return job;
  return { ...job, status: 'cancelled', errorCode: 'cancelled', progress: null, updatedAt: nowIso() };
}

export function cancelConversionJob(job: ConversionJob): ConversionJob {
  if (isConversionTerminal(job)) return job;
  return { ...job, status: 'cancelled', errorCode: 'cancelled', progress: null, updatedAt: nowIso() };
}

/** Retry creates a NEW job with the same inputs; history keeps the old row. */
export function retryDownloadJob(job: DownloadJob): DownloadJob {
  const fresh = createDownloadJob({
    url: job.url,
    title: job.title,
    choice: job.choice,
    destinationFolder: job.destinationFolder,
    fileName: job.fileName,
  });
  return fresh;
}

export function retryConversionJob(job: ConversionJob): ConversionJob {
  return createConversionJob({
    sourcePath: job.sourcePath,
    sourceName: job.sourceName,
    sourceScopeId: job.sourceScopeId,
    inputRelativePath: job.inputRelativePath,
    target: job.target,
    resolution: job.resolution,
    quality: job.quality,
    outputFolder: job.outputFolder,
    outputFileName: job.outputFileName,
  });
}

/**
 * Reload rule (§4.6): any job still marked running/queued on reload is
 * re-marked failed/unknown — the bridge owns no job resurrection and the
 * UI never shows a stale spinner for a dead process.
 */
export function markStaleDownloadJobsOnLoad(jobs: DownloadJob[]): DownloadJob[] {
  return jobs.map((job) =>
    isDownloadTerminal(job)
      ? job
      : { ...job, status: 'failed' as const, errorCode: 'unknown' as const, errorDetail: 'The app was closed while this was running.', updatedAt: nowIso() },
  );
}

export function markStaleConversionJobsOnLoad(jobs: ConversionJob[]): ConversionJob[] {
  return jobs.map((job) =>
    isConversionTerminal(job)
      ? job
      : { ...job, status: 'failed' as const, errorCode: 'unknown' as const, errorDetail: 'The app was closed while this was running.', updatedAt: nowIso() },
  );
}

/** Validate a persisted record; returns null for corrupt entries (dropped individually). */
export function parsePersistedDownloadJob(value: unknown): DownloadJob | null {
  const parsed = DownloadJobSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parsePersistedConversionJob(value: unknown): ConversionJob | null {
  const parsed = ConversionJobSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
