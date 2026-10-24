/**
 * Video Suite bridge client (spec §6.7) — the ONLY Video Suite module
 * that invokes the desktop bridge. Reconciled against frozen bridge
 * contract v1.0 (spec 145): every command below is a real v1.0 command;
 * §6 requirements with no v1.0 command are reported by
 * `supportsLibraryUpload` / `supportsReveal` (both false in v1.0) instead
 * of being faked. See reconciliation-145.md.
 *
 * - Invoke convention: the frozen `__TAURI_INTERNALS__` / `__TAURI__.core`
 *   helpers from the contracts barrel (no second invoke convention).
 * - Every inbound payload/event is zod-validated; invalid payloads are
 *   logged and mapped to `unknown`, never rendered raw.
 * - Progress events are the frozen `desktop:media:progress` /
 *   `desktop:media:done` events: percent + detail only. Bytes, speed and
 *   ETA are unavailable in v1.0 and stay null (indeterminate UI), never
 *   fabricated.
 */
import {
  DESKTOP_BRIDGE_COMMANDS,
  DesktopBridgeError,
  MediaDoneEventSchema,
  MediaProgressEventSchema,
  binaryList,
  binaryEnsure,
  CONVERSION_QUALITY_BITRATES,
  CONVERSION_TARGET_EXTENSION,
  dialogOpenDirectory,
  dialogOpenFile,
  fsDelete,
  fsExists,
  fsList,
  fsScopeList,
  fsStat,
  isDesktopApp,
  mediaConvert,
  mediaProbe,
  presetToFormatSelector,
  processCancel,
  subscribeDesktopEvent,
  ytDlpDownload,
  ytDlpMetadata,
  type BinaryReadiness,
  type ConversionQuality,
  type ConversionResolution,
  type ConversionTarget,
  type DownloadChoice,
  type FormatListing,
  type LocalFile,
  type VideoFormat,
  type VideoSuiteErrorCode,
} from '@fbuploadpro/contracts';
import { parseResolutionString, sanitizeFileName } from './filenames';

export class NotDesktopError extends Error {
  constructor() {
    super('Video Suite requires the FBUploadPro desktop app.');
    this.name = 'NotDesktopError';
  }
}

function requireDesktop(): void {
  if (!isDesktopApp()) throw new NotDesktopError();
}

function bridgeCodeOf(err: unknown): string | null {
  if (err instanceof DesktopBridgeError) return err.code;
  if (typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  return null;
}

function bridgeMessageOf(err: unknown): string | null {
  if (err instanceof Error) return err.message;
  return null;
}

/**
 * Bridge error → Video Suite error code (§4.4). The frozen bridge
 * collapses yt-dlp failure modes: a metadata fetch that fails is
 * reported as MEDIA_NOT_FOUND regardless of whether the site is
 * unsupported, the video is private, or the page is not a video — the
 * client maps that to `unsupported_url` (the actionable message: "try a
 * direct video link") and keeps the bridge's user-safe message as the
 * local-only detail. This collapse is a v1.0 limitation, documented in
 * reconciliation-145.md — it is not papered over with a guessed code.
 */
export function mapBridgeErrorToVideoSuiteCode(
  err: unknown,
  context: 'metadata' | 'download' | 'convert' | 'generic',
): { code: VideoSuiteErrorCode; detail: string | null } {
  const code = bridgeCodeOf(err);
  const detail = bridgeMessageOf(err);
  switch (code) {
    case 'BINARY_NOT_READY':
    case 'ARTIFACT_UNSUPPORTED_PLATFORM':
    case 'ARTIFACT_CHECKSUM_MISMATCH':
    case 'ARTIFACT_CORRUPT':
    case 'ARTIFACT_OFFLINE':
    case 'ARTIFACT_CANCELLED':
      return { code: 'binary_not_ready', detail };
    case 'MEDIA_TIMEOUT':
      return { code: 'network_failure', detail };
    case 'MEDIA_NOT_FOUND':
      return { code: context === 'metadata' ? 'unsupported_url' : 'unknown', detail };
    case 'MEDIA_DOWNLOAD_FAILED':
      return { code: 'unknown', detail };
    case 'MEDIA_CONVERT_FAILED':
      return { code: 'conversion_failed', detail };
    case 'MEDIA_PROBE_FAILED':
      return { code: 'unknown', detail };
    case 'FS_PERMISSION_DENIED':
      return { code: 'permission_denied', detail };
    default:
      return { code: 'unknown', detail };
  }
}

// ---------------------------------------------------------------------------
// Capability probes (structural: read from the frozen command index)
// ---------------------------------------------------------------------------

/** v1.0 has no disk→presigned-URL upload command, so §5.1 step 3 cannot run. */
export function supportsLibraryUpload(): boolean {
  return (DESKTOP_BRIDGE_COMMANDS as readonly string[]).includes('media_upload_file');
}

/** v1.0 has no reveal-in-folder command. */
export function supportsReveal(): boolean {
  return (DESKTOP_BRIDGE_COMMANDS as readonly string[]).includes('fs_reveal');
}

// ---------------------------------------------------------------------------
// BR-7 — Binary readiness
// ---------------------------------------------------------------------------

export async function getBinaryReadiness(): Promise<BinaryReadiness> {
  requireDesktop();
  try {
    const list = await binaryList();
    const byId = new Map(list.artifacts.map((a) => [a.artifactId, a]));
    const ytDlp = byId.get('yt-dlp');
    const ffmpeg = byId.get('ffmpeg');
    const states = [ytDlp?.state, ffmpeg?.state];
    let status: BinaryReadiness['status'];
    if (states.includes('corrupt') || states.includes('error')) status = 'error';
    else if (states.includes('missing') || ytDlp === undefined || ffmpeg === undefined) status = 'missing';
    else if (states.includes('downloading')) status = 'downloading';
    else status = 'ready';
    const detail = ytDlp?.error?.message ?? ffmpeg?.error?.message ?? null;
    return {
      status,
      ytDlpVersion: ytDlp?.version ?? null,
      ffmpegVersion: ffmpeg?.version ?? null,
      detail,
    };
  } catch (err) {
    const { detail } = mapBridgeErrorToVideoSuiteCode(err, 'generic');
    return { status: 'error', ytDlpVersion: null, ffmpegVersion: null, detail };
  }
}

// ---------------------------------------------------------------------------
// BR-1 — Format fetch (media_yt_dlp_metadata)
// ---------------------------------------------------------------------------

function mapBridgeFormat(raw: {
  formatId: string;
  ext: string | null;
  resolution: string | null;
  filesizeBytes: number | null;
}): VideoFormat {
  const { width, height } = parseResolutionString(raw.resolution);
  const isAudioOnly = raw.resolution?.trim().toLowerCase() === 'audio only';
  return {
    formatId: raw.formatId,
    ext: raw.ext,
    width,
    height,
    fps: null,
    // v1.0 bridge shape carries no codec fields — null means "not
    // reported", never "none". The advanced picker says so explicitly.
    vcodec: null,
    acodec: null,
    filesizeApprox: raw.filesizeBytes,
    formatNote: raw.resolution,
    isVideoOnly: false,
    isAudioOnly,
  };
}

export async function fetchFormats(url: string): Promise<FormatListing> {
  requireDesktop();
  const response = await ytDlpMetadata({ url });
  const metadata = response.metadata;
  const formats = metadata.formats
    .filter((f) => f.formatId !== '')
    .map((f) => mapBridgeFormat({ formatId: f.formatId, ext: f.ext, resolution: f.resolution, filesizeBytes: f.filesizeBytes }));
  if (formats.length === 0) {
    throw new Error('No formats were reported for this video.');
  }
  return {
    url,
    title: metadata.title,
    durationSeconds: metadata.durationSeconds,
    thumbnailUrl: metadata.thumbnailUrl,
    formats,
  };
}

// ---------------------------------------------------------------------------
// BR-2 — Download (media_yt_dlp_download)
// ---------------------------------------------------------------------------

export interface StartDownloadInput {
  url: string;
  title: string | null;
  choice: DownloadChoice;
  outputScopeId: string;
  jobId: string;
}

export interface StartDownloadResult {
  runId: string;
  outputScopeId: string;
  /** The yt-dlp output template sent (title literal, sanitised). */
  outputTemplate: string;
}

/** Build the frozen-template-safe output template for a title. */
export function downloadOutputTemplate(title: string | null): string {
  // '%' must not appear in the literal: a stray "%(" would be parsed as
  // a template field by the bridge validator and fail the download.
  const literal = sanitizeFileName(title ?? 'download').replace(/%/g, '_');
  return `${literal}.%(ext)s`;
}

export function downloadFormatSelector(choice: DownloadChoice): string | undefined {
  if (choice.kind === 'preset') return presetToFormatSelector(choice.preset);
  return choice.formatId;
}

export async function startDownload(input: StartDownloadInput): Promise<StartDownloadResult> {
  requireDesktop();
  const outputTemplate = downloadOutputTemplate(input.title);
  const formatSelector = downloadFormatSelector(input.choice);
  const response = await ytDlpDownload({
    url: input.url,
    outputScopeId: input.outputScopeId,
    outputTemplate,
    ...(formatSelector !== undefined ? { formatSelector } : {}),
    namespace: 'video-suite',
    jobId: input.jobId,
  });
  return { runId: response.runId, outputScopeId: response.outputScopeId, outputTemplate };
}

// ---------------------------------------------------------------------------
// BR-3 — Conversion (media_convert)
// ---------------------------------------------------------------------------

export interface StartConversionInput {
  inputScopeId: string;
  inputRelativePath: string;
  outputScopeId: string;
  outputRelativePath: string;
  target: ConversionTarget;
  resolution: ConversionResolution;
  quality: ConversionQuality;
  /** Source height for downscale-only decisions (already applied by caller). */
  width: number | null;
  height: number | null;
}

export async function startConversion(input: StartConversionInput): Promise<{ runId: string }> {
  requireDesktop();
  const bitrates = CONVERSION_QUALITY_BITRATES[input.target][input.quality];
  const response = await mediaConvert({
    inputScopeId: input.inputScopeId,
    inputRelativePath: input.inputRelativePath,
    outputScopeId: input.outputScopeId,
    outputRelativePath: input.outputRelativePath,
    ...(bitrates.videoBitrateKbps !== null
      ? {
          video: {
            codec: input.target === 'webm' ? 'vp9' : 'h264',
            ...(input.width !== null ? { width: input.width } : {}),
            ...(input.height !== null ? { height: input.height } : {}),
            bitrateKbps: bitrates.videoBitrateKbps,
          },
        }
      : {}),
    audio: {
      codec: input.target === 'webm' || input.target === 'opus' ? 'opus' : 'aac',
      bitrateKbps: bitrates.audioBitrateKbps,
    },
    overwrite: false,
    namespace: 'video-suite',
  });
  return { runId: response.runId };
}

/** Output filename for a conversion: stem + target extension. */
export function conversionOutputFileName(sourceName: string, target: ConversionTarget): string {
  const stem = sourceName.includes('.') ? sourceName.slice(0, sourceName.lastIndexOf('.')) : sourceName;
  return `${sanitizeFileName(stem)}.${CONVERSION_TARGET_EXTENSION[target]}`;
}

// ---------------------------------------------------------------------------
// BR-4 — List / probe / delete local files
// ---------------------------------------------------------------------------

export interface ProbeResult {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  vcodec: string | null;
  acodec: string | null;
  sizeBytes: number | null;
}

export async function probeFile(scopeId: string, relativePath: string): Promise<ProbeResult> {
  requireDesktop();
  const probe = await mediaProbe({ scopeId, relativePath });
  const video = probe.streams.find((s) => s.codecType === 'video');
  const audio = probe.streams.find((s) => s.codecType === 'audio');
  return {
    durationSeconds: probe.durationSeconds,
    width: video?.width ?? null,
    height: video?.height ?? null,
    vcodec: video?.codecName ?? null,
    acodec: audio?.codecName ?? null,
    sizeBytes: probe.sizeBytes,
  };
}

const MEDIA_EXTS: readonly string[] = ['mp4', 'mov', 'webm', 'mkv', 'm4a', 'mp3', 'opus', 'avi', 'flv', 'wmv'];

export async function listLocalFiles(scopeId: string, scopePath: string): Promise<LocalFile[]> {
  requireDesktop();
  const response = await fsList({ scopeId });
  const files: LocalFile[] = [];
  for (const entry of response.entries) {
    if (entry.kind !== 'file') continue;
    const name = entry.name;
    // Partial downloads are never presented as complete files (§4.1.7).
    if (name.endsWith('.part') || name.endsWith('.ytdl')) continue;
    const ext = name.includes('.') ? (name.split('.').pop()?.toLowerCase() ?? '') : '';
    if (!(MEDIA_EXTS as readonly string[]).includes(ext)) continue;
    let probe: ProbeResult = { durationSeconds: null, width: null, height: null, vcodec: null, acodec: null, sizeBytes: null };
    try {
      probe = await probeFile(scopeId, entry.relativePath);
    } catch {
      // Unprobeable files still list, with null metadata (§4.3).
      probe = { durationSeconds: null, width: null, height: null, vcodec: null, acodec: null, sizeBytes: null };
    }
    files.push({
      name,
      absolutePath: `${scopePath.replace(/\/$/, '')}/${entry.relativePath}`,
      scopeId,
      relativePath: entry.relativePath,
      sizeBytes: entry.sizeBytes ?? probe.sizeBytes ?? 0,
      ext,
      durationSeconds: probe.durationSeconds,
      width: probe.width,
      height: probe.height,
      vcodec: probe.vcodec,
      acodec: probe.acodec,
    });
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  return files;
}

/** Delete of a missing file is a no-op success (§4.3). */
export async function deleteLocalFile(scopeId: string, relativePath: string): Promise<void> {
  requireDesktop();
  try {
    await fsDelete({ scopeId, relativePath });
  } catch (err) {
    if (bridgeCodeOf(err) === 'FS_NOT_FOUND' || bridgeCodeOf(err) === 'SCOPE_NOT_FOUND') return;
    throw err;
  }
}

export async function scopedFileExists(scopeId: string, relativePath: string): Promise<boolean> {
  requireDesktop();
  try {
    const result = await fsExists({ scopeId, relativePath });
    return result.exists;
  } catch (err) {
    if (bridgeCodeOf(err) === 'FS_NOT_FOUND') return false;
    throw err;
  }
}

/** Flat file names in a scope (no probing) — used for collision checks. */
export async function listFileNames(scopeId: string): Promise<string[]> {
  requireDesktop();
  const response = await fsList({ scopeId });
  return response.entries.filter((e) => e.kind === 'file').map((e) => e.name);
}

/** Size of a scoped file, for completed-job rows (null when unstatable). */
export async function statFileSize(scopeId: string, relativePath: string): Promise<number | null> {
  requireDesktop();
  try {
    const stat = await fsStat({ scopeId, relativePath });
    return stat.sizeBytes;
  } catch {
    return null;
  }
}

export async function isFolderScopeKnown(scopeId: string): Promise<boolean> {
  requireDesktop();
  const scopes = await fsScopeList();
  return scopes.scopes.some((s) => s.scopeId === scopeId);
}

// ---------------------------------------------------------------------------
// BR-5 — Native dialogs
// ---------------------------------------------------------------------------

export async function pickFolder(): Promise<{ path: string; scopeId: string } | null> {
  requireDesktop();
  const response = await dialogOpenDirectory({});
  if (response.cancelled || response.directories.length === 0) return null;
  const dir = response.directories[0];
  return { path: dir.path, scopeId: dir.scopeId };
}

export async function pickMediaFile(): Promise<{ path: string; scopeId: string; name: string } | null> {
  requireDesktop();
  const response = await dialogOpenFile({
    filters: [{ name: 'Media', extensions: ['mp4', 'mov', 'webm', 'mkv', 'm4a', 'mp3', 'opus'] }],
  });
  if (response.cancelled || response.files.length === 0) return null;
  const file = response.files[0];
  return { path: file.path, scopeId: file.scopeId, name: file.name };
}

// ---------------------------------------------------------------------------
// Cancellation (§6.5) — idempotent: unknown/finished runs are no-op success
// ---------------------------------------------------------------------------

export async function cancelRun(runId: string): Promise<void> {
  requireDesktop();
  try {
    await processCancel({ runId });
  } catch (err) {
    if (bridgeCodeOf(err) === 'PROCESS_NOT_FOUND') return;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Progress subscriptions (§6.6) — zod-validated, dispatched by runId.
// The workspace subscribes ONCE on mount (global listener) so no event
// can be missed between starting a run and subscribing to it.
// ---------------------------------------------------------------------------

export interface MediaRunProgress {
  runId: string;
  percent: number | null;
}

export interface MediaRunDone {
  runId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  outputs: { scopeId: string; relativePath: string }[];
  errorCode: VideoSuiteErrorCode | null;
  errorDetail: string | null;
}

export interface MediaEventHandlers {
  onProgress: (event: MediaRunProgress) => void;
  onDone: (event: MediaRunDone) => void;
}

export async function subscribeMediaEvents(handlers: MediaEventHandlers): Promise<() => void> {
  requireDesktop();
  const unlistenProgress = await subscribeDesktopEvent<unknown>('desktop:media:progress', (payload) => {
    const parsed = MediaProgressEventSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn('[video-suite] Dropping invalid media progress event.');
      return;
    }
    handlers.onProgress({ runId: parsed.data.runId, percent: parsed.data.percent });
  });
  const unlistenDone = await subscribeDesktopEvent<unknown>('desktop:media:done', (payload) => {
    const parsed = MediaDoneEventSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn('[video-suite] Dropping invalid media done event.');
      return;
    }
    const error = parsed.data.error;
    handlers.onDone({
      runId: parsed.data.runId,
      status: parsed.data.status,
      outputs: parsed.data.outputs,
      errorCode: error === undefined ? null : mapBridgeErrorToVideoSuiteCode(error, 'generic').code,
      errorDetail: error?.message ?? null,
    });
  });
  return () => {
    void unlistenProgress();
    void unlistenDone();
  };
}

// ---------------------------------------------------------------------------
// BR-7 — Binary setup (artifact ensure, best-effort)
// ---------------------------------------------------------------------------

export async function ensureBinaries(): Promise<void> {
  requireDesktop();
  await Promise.allSettled([binaryEnsure({ binaryId: 'yt-dlp' }), binaryEnsure({ binaryId: 'ffmpeg' })]);
}
