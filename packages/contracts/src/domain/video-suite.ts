/**
 * Video Suite contracts (spec 146 §7) — RECONCILED against the frozen
 * desktop bridge contract v1.0 (spec 145, packages/contracts
 * desktop-bridge.ts). See ~/workspace/specs/146-desktop-video-suite/
 * reconciliation-145.md for the requirement → command mapping and the
 * known v1.0 gaps (no disk→R2 upload primitive, no reveal primitive, no
 * stream-drop flag on media_convert, bridge format shape without codecs).
 *
 * This module is zod schemas + types + pure helpers only. No bridge calls:
 * the only bridge caller is components/video-suite/bridge-client.ts.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// §4.4 — Error taxonomy (stable codes + exact user copy)
// ---------------------------------------------------------------------------

export const VideoSuiteErrorCodeEnum = z.enum([
  'unsupported_url',
  'private_or_removed',
  'network_failure',
  'format_unavailable',
  'binary_not_ready',
  'disk_full',
  'permission_denied',
  'file_too_large_for_library',
  'import_failed',
  'conversion_failed',
  'cancelled',
  'unknown',
]);
export type VideoSuiteErrorCode = z.infer<typeof VideoSuiteErrorCodeEnum>;

/** Plain-language user message per code. Raw tool stderr is NEVER a message. */
export const VIDEO_SUITE_ERROR_MESSAGES: Record<VideoSuiteErrorCode, string> = {
  unsupported_url: "This link isn't supported. Try a direct video link from YouTube, TikTok, Instagram, or Facebook.",
  private_or_removed: "This video is private, removed, or needs an account to view, so it can't be downloaded here.",
  network_failure: "Couldn't reach the video site. Check your connection and try again.",
  format_unavailable: 'That format is no longer available for this video. Pick another format and try again.',
  binary_not_ready: "The video tools aren't ready yet. Wait for setup to finish, then try again.",
  disk_full: "There's not enough disk space for this file. Free up space and try again.",
  permission_denied: "Can't write to that folder. Choose a folder you have access to.",
  file_too_large_for_library: 'This file is over the 500 MB Media Library limit. Convert it smaller first, or keep it local.',
  import_failed: 'Import failed. Check your connection and try again.',
  conversion_failed: 'Conversion failed. The source file may be damaged or in an unsupported format.',
  cancelled: 'Cancelled.',
  unknown: 'Something went wrong. Try again.',
};

// ---------------------------------------------------------------------------
// §7.2 — Format listing and choice
// ---------------------------------------------------------------------------

export const DownloadPresetEnum = z.enum(['best', 'best_1080', 'best_720', 'best_480', 'audio_only']);
export type DownloadPreset = z.infer<typeof DownloadPresetEnum>;

export const VideoFormatSchema = z.object({
  formatId: z.string().min(1),
  ext: z.string().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  fps: z.number().positive().nullable(),
  vcodec: z.string().nullable(),
  acodec: z.string().nullable(),
  filesizeApprox: z.number().int().nonnegative().nullable(),
  formatNote: z.string().nullable(),
  isVideoOnly: z.boolean(),
  isAudioOnly: z.boolean(),
});
export type VideoFormat = z.infer<typeof VideoFormatSchema>;

export const FormatListingSchema = z.object({
  url: z.string(),
  title: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  thumbnailUrl: z.string().nullable(),
  formats: z.array(VideoFormatSchema),
});
export type FormatListing = z.infer<typeof FormatListingSchema>;

export const DownloadChoiceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('preset'), preset: DownloadPresetEnum }),
  z.object({ kind: z.literal('format'), formatId: z.string().min(1) }),
]);
export type DownloadChoice = z.infer<typeof DownloadChoiceSchema>;

/**
 * Preset → frozen-bridge yt-dlp format selector (spec §6.7 reconciliation).
 * The frozen selector charset excludes `*` and `/`, so the classic
 * `bv*+ba/b` spellings are INVALID here; `bestvideo`/`bestaudio` long
 * forms are used instead. Cap semantics are contractual (§7.2): the
 * selector never reaches above the cap; when nothing satisfies the cap
 * the bridge falls back to the best available below it.
 */
const FORMAT_SELECTOR_CHARSET = /^[A-Za-z0-9_+[\]:<>=]+$/;

export function presetToFormatSelector(preset: DownloadPreset): string {
  switch (preset) {
    case 'best':
      return 'bestvideo+bestaudio';
    case 'best_1080':
      return 'bestvideo[height<=1080]+bestaudio';
    case 'best_720':
      return 'bestvideo[height<=720]+bestaudio';
    case 'best_480':
      return 'bestvideo[height<=480]+bestaudio';
    case 'audio_only':
      return 'bestaudio';
  }
}

export function isValidFormatSelector(selector: string): boolean {
  return selector.length > 0 && FORMAT_SELECTOR_CHARSET.test(selector);
}

/**
 * Cap selection against a listing (§7.2): the tallest video format at or
 * below `capHeight`, never above it; ties break toward the larger
 * approximate size. Returns null when no format satisfies the cap.
 */
export function pickBestFormatAtOrBelowCap(formats: VideoFormat[], capHeight: number): VideoFormat | null {
  let best: VideoFormat | null = null;
  for (const format of formats) {
    if (format.isAudioOnly) continue;
    if (format.height === null || format.height > capHeight) continue;
    if (best === null) {
      best = format;
      continue;
    }
    const bestHeight = best.height ?? 0;
    if (format.height > bestHeight) {
      best = format;
    } else if (format.height === bestHeight && (format.filesizeApprox ?? 0) > (best.filesizeApprox ?? 0)) {
      best = format;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// §7.3 — Conversion inputs
// ---------------------------------------------------------------------------

export const ConversionTargetEnum = z.enum(['mp4', 'webm', 'm4a', 'opus']);
export type ConversionTarget = z.infer<typeof ConversionTargetEnum>;

export const ConversionResolutionEnum = z.enum(['original', '1080p', '720p', '480p']);
export type ConversionResolution = z.infer<typeof ConversionResolutionEnum>;

export const ConversionQualityEnum = z.enum(['high', 'balanced', 'small']);
export type ConversionQuality = z.infer<typeof ConversionQualityEnum>;

export const ConversionRequestSchema = z.object({
  sourcePath: z.string().min(1),
  target: ConversionTargetEnum,
  resolution: ConversionResolutionEnum,
  quality: ConversionQualityEnum,
  outputFolder: z.string().min(1),
  outputFileNameBase: z.string().min(1),
});
export type ConversionRequest = z.infer<typeof ConversionRequestSchema>;

/**
 * Quality → bridge bitrate mapping (§4.2.2). The frozen media_convert
 * primitive accepts bitrates only (no CRF flag), so the levels are
 * expressed as video/audio bitrates. Documented here so reviewers can
 * check high/balanced/small behaviour without reading UI code.
 */
export const CONVERSION_QUALITY_BITRATES: Record<
  ConversionTarget,
  Record<ConversionQuality, { videoBitrateKbps: number | null; audioBitrateKbps: number }>
> = {
  mp4: {
    high: { videoBitrateKbps: 8000, audioBitrateKbps: 192 },
    balanced: { videoBitrateKbps: 4000, audioBitrateKbps: 160 },
    small: { videoBitrateKbps: 1500, audioBitrateKbps: 128 },
  },
  webm: {
    high: { videoBitrateKbps: 6000, audioBitrateKbps: 192 },
    balanced: { videoBitrateKbps: 3000, audioBitrateKbps: 160 },
    small: { videoBitrateKbps: 1200, audioBitrateKbps: 128 },
  },
  m4a: {
    high: { videoBitrateKbps: null, audioBitrateKbps: 192 },
    balanced: { videoBitrateKbps: null, audioBitrateKbps: 160 },
    small: { videoBitrateKbps: null, audioBitrateKbps: 128 },
  },
  opus: {
    high: { videoBitrateKbps: null, audioBitrateKbps: 192 },
    balanced: { videoBitrateKbps: null, audioBitrateKbps: 160 },
    small: { videoBitrateKbps: null, audioBitrateKbps: 128 },
  },
};

/** Target → output extension (mp3 is NOT expressible: frozen audio codecs are aac/opus/copy only). */
export const CONVERSION_TARGET_EXTENSION: Record<ConversionTarget, string> = {
  mp4: 'mp4',
  webm: 'webm',
  m4a: 'm4a',
  opus: 'opus',
};

export const CONVERSION_RESOLUTION_HEIGHT: Record<ConversionResolution, number | null> = {
  original: null,
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
};

// ---------------------------------------------------------------------------
// §7.4 — Progress events and local files
// ---------------------------------------------------------------------------

export const ProgressPhaseEnum = z.enum([
  'downloading',
  'postprocessing',
  'converting',
  'uploading',
  'done',
  'failed',
  'cancelled',
]);
export type ProgressPhase = z.infer<typeof ProgressPhaseEnum>;

export const ProgressEventSchema = z.object({
  operationId: z.string().min(1),
  phase: ProgressPhaseEnum,
  bytesProcessed: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative().nullable(),
  speedBytesPerSecond: z.number().nonnegative().nullable(),
  etaSeconds: z.number().nonnegative().nullable(),
  /** Present ONLY when totalBytes is known — never a fabricated percent. */
  percent: z.number().min(0).max(100).nullable(),
  finalPath: z.string().nullable(),
  finalSizeBytes: z.number().int().nonnegative().nullable(),
  errorCode: VideoSuiteErrorCodeEnum.nullable(),
  errorDetail: z.string().nullable(),
});
export type ProgressEvent = z.infer<typeof ProgressEventSchema>;

/**
 * Bridge progress event (frozen desktop:media:progress) mapped into the
 * Video Suite shape. The frozen event carries percent + detail only — no
 * bytes, speed, or ETA — so those fields are null (indeterminate UI),
 * never invented.
 */
export function bridgeMediaProgressToProgressEvent(
  operationId: string,
  phase: 'downloading' | 'converting',
  percent: number | null,
): ProgressEvent {
  return {
    operationId,
    phase,
    bytesProcessed: 0,
    totalBytes: null,
    speedBytesPerSecond: null,
    etaSeconds: null,
    percent: percent === null ? null : Math.min(100, Math.max(0, percent)),
    finalPath: null,
    finalSizeBytes: null,
    errorCode: null,
    errorDetail: null,
  };
}

export const LocalFileSchema = z.object({
  name: z.string().min(1),
  absolutePath: z.string().min(1),
  scopeId: z.string().min(1),
  relativePath: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  ext: z.string(),
  durationSeconds: z.number().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  vcodec: z.string().nullable(),
  acodec: z.string().nullable(),
});
export type LocalFile = z.infer<typeof LocalFileSchema>;

// ---------------------------------------------------------------------------
// §7.1 — Job state machines
// ---------------------------------------------------------------------------

export const VideoSuiteVideoSuiteDownloadJobStatusEnum = z.enum(['queued', 'downloading', 'postprocessing', 'completed', 'failed', 'cancelled']);
export type VideoSuiteDownloadJobStatus = z.infer<typeof VideoSuiteVideoSuiteDownloadJobStatusEnum>;

export const VideoSuiteVideoSuiteConversionJobStatusEnum = z.enum(['queued', 'converting', 'completed', 'failed', 'cancelled']);
export type VideoSuiteConversionJobStatus = z.infer<typeof VideoSuiteVideoSuiteConversionJobStatusEnum>;

export const DownloadJobSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  title: z.string().nullable(),
  choice: DownloadChoiceSchema,
  destinationFolder: z.string(),
  fileName: z.string(),
  status: VideoSuiteVideoSuiteDownloadJobStatusEnum,
  progress: ProgressEventSchema.nullable(),
  errorCode: VideoSuiteErrorCodeEnum.nullable(),
  errorDetail: z.string().nullable(),
  finalPath: z.string().nullable(),
  finalSizeBytes: z.number().int().nonnegative().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DownloadJob = z.infer<typeof DownloadJobSchema>;

export const ConversionJobSchema = z.object({
  id: z.string().uuid(),
  sourcePath: z.string().min(1),
  sourceName: z.string().min(1),
  sourceScopeId: z.string().min(1),
  inputRelativePath: z.string(),
  target: ConversionTargetEnum,
  resolution: ConversionResolutionEnum,
  quality: ConversionQualityEnum,
  outputFolder: z.string().min(1),
  outputFileName: z.string().min(1),
  status: VideoSuiteVideoSuiteConversionJobStatusEnum,
  progress: ProgressEventSchema.nullable(),
  errorCode: VideoSuiteErrorCodeEnum.nullable(),
  errorDetail: z.string().nullable(),
  finalPath: z.string().nullable(),
  finalSizeBytes: z.number().int().nonnegative().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ConversionJob = z.infer<typeof ConversionJobSchema>;

// ---------------------------------------------------------------------------
// §7.4 — Binary readiness (BR-7, mapped from binary_list states)
// ---------------------------------------------------------------------------

export const BinaryReadinessStatusEnum = z.enum(['ready', 'downloading', 'verifying', 'missing', 'error']);
export type BinaryReadinessStatus = z.infer<typeof BinaryReadinessStatusEnum>;

export const BinaryReadinessSchema = z.object({
  status: BinaryReadinessStatusEnum,
  ytDlpVersion: z.string().nullable(),
  ffmpegVersion: z.string().nullable(),
  detail: z.string().nullable(),
});
export type BinaryReadiness = z.infer<typeof BinaryReadinessSchema>;

// ---------------------------------------------------------------------------
// Library import eligibility (§5.2)
// ---------------------------------------------------------------------------

export const LIBRARY_MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

export const LIBRARY_IMPORTABLE_MIME_BY_EXT: Record<string, string | undefined> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

export const LIBRARY_AUDIO_EXTS: readonly string[] = ['mp3', 'm4a', 'opus'];

export type LibraryImportEligibility =
  | { eligible: true; mimeType: string }
  | { eligible: false; reason: 'audio' | 'convert_first' | 'too_large'; mimeType: string | null };

export function libraryImportEligibility(fileName: string, sizeBytes: number): LibraryImportEligibility {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (sizeBytes > LIBRARY_MAX_FILE_SIZE_BYTES) {
    return { eligible: false, reason: 'too_large', mimeType: LIBRARY_IMPORTABLE_MIME_BY_EXT[ext] ?? null };
  }
  const mimeType = LIBRARY_IMPORTABLE_MIME_BY_EXT[ext];
  if (mimeType !== undefined) return { eligible: true, mimeType };
  if ((LIBRARY_AUDIO_EXTS as readonly string[]).includes(ext)) {
    return { eligible: false, reason: 'audio', mimeType: null };
  }
  return { eligible: false, reason: 'convert_first', mimeType: null };
}
