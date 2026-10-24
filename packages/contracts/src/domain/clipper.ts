/**
 * Clipper contracts (spec 148) — local clip jobs only, no database table.
 *
 * A clip job is working state, not product data: it lives in the desktop
 * shell's local storage (see the bridge adapter) and is never sent to
 * Supabase or any FBUploadPro server. `media_items` remains the single
 * product model for assets; a job's files become assets only when imported
 * through the existing Media Library upload flow.
 *
 * Path rule (spec §5 note): the web layer NEVER persists or transmits raw
 * filesystem paths. Job records carry path HASHES for identity only; the
 * shell/adapter holds real paths in memory for the duration of a job.
 */
import { z } from 'zod';

export const ClipJobStatusSchema = z.enum([
  'probing',
  'downloading-model',
  'transcribing',
  'selecting',
  'ready',
  'exporting',
  'done',
  'failed',
  'cancelled',
]);
export type ClipJobStatus = z.infer<typeof ClipJobStatusSchema>;

export const ClipModelSchema = z.enum(['tiny', 'base', 'small']);
export type ClipModel = z.infer<typeof ClipModelSchema>;

export const ClipAspectSchema = z.enum(['vertical', 'original']);
export type ClipAspect = z.infer<typeof ClipAspectSchema>;

export const ClipReasonSchema = z.enum([
  'question',
  'high-energy',
  'punchline',
  'topic-change',
  'strong-opening',
]);
export type ClipReason = z.infer<typeof ClipReasonSchema>;

export const ClipExportStatusSchema = z.enum(['pending', 'exporting', 'exported', 'failed']);
export type ClipExportStatus = z.infer<typeof ClipExportStatusSchema>;

export const ClipErrorCodeSchema = z.enum([
  'SOURCE_UNREADABLE',
  'FILE_TOO_LARGE',
  'DURATION_TOO_LONG',
  'DISK_FULL',
  'NO_SPEECH_DETECTED',
  'MODEL_DOWNLOAD_FAILED',
  'MODEL_CHECKSUM_MISMATCH',
  'TRANSCRIPTION_FAILED',
  'SELECTION_FAILED',
  'AI_PROVIDER_FAILED',
  'EXPORT_FAILED',
  'IMPORT_FAILED',
  'EXPORT_NOT_FOUND',
  'INTERRUPTED',
  'CANCELLED',
  'BRIDGE_UNAVAILABLE',
  'BRIDGE_PROTOCOL_ERROR',
  'BRIDGE_ERROR',
]);
export type ClipErrorCode = z.infer<typeof ClipErrorCodeSchema>;

/** Plain-language messages for every clip error code (single source). */
export const CLIP_ERROR_MESSAGES: Record<ClipErrorCode, string> = {
  SOURCE_UNREADABLE: 'That file could not be read. It may be corrupt or in an unsupported format.',
  FILE_TOO_LARGE: 'Videos over 4 GB are not supported yet.',
  DURATION_TOO_LONG: "Videos over 2 hours aren't supported yet.",
  DISK_FULL: 'There is not enough free disk space for this job.',
  NO_SPEECH_DETECTED: 'No speech was found in this video.',
  MODEL_DOWNLOAD_FAILED: 'The transcription model could not be downloaded. Check your connection and try again.',
  MODEL_CHECKSUM_MISMATCH: 'The downloaded transcription model failed its safety check and was deleted. Try again to re-download it.',
  TRANSCRIPTION_FAILED: 'Transcription failed. Try again.',
  SELECTION_FAILED: 'Picking clips failed. Try again.',
  AI_PROVIDER_FAILED: 'AI ranking failed — showing local picks.',
  EXPORT_FAILED: 'Export failed. Completed clips were kept; try exporting again.',
  IMPORT_FAILED: 'Import into the Media Library failed. Your exported files are untouched — try again.',
  EXPORT_NOT_FOUND: 'The exported clip file could not be found.',
  INTERRUPTED: 'This job was interrupted. You can retry it.',
  CANCELLED: 'This job was cancelled.',
  BRIDGE_UNAVAILABLE: 'Clipper runs in the FBUploadPro desktop app.',
  BRIDGE_PROTOCOL_ERROR: 'The desktop app sent an unexpected response. Try again.',
  BRIDGE_ERROR: 'Something went wrong in the desktop app. Try again.',
};

export const TranscriptSegmentSchema = z
  .object({
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().positive(),
    text: z.string().trim().min(1),
  })
  .refine((v) => v.endSeconds > v.startSeconds, 'endSeconds must be > startSeconds');
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

export const TranscriptSegmentsSchema = z.array(TranscriptSegmentSchema);

export const ClipErrorSchema = z.object({
  code: ClipErrorCodeSchema,
  message: z.string().min(1),
  detail: z.string().max(4000).optional(),
});
export type ClipError = z.infer<typeof ClipErrorSchema>;

export const ClipSelectionSchema = z
  .object({
    id: z.string().min(1),
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().positive(),
    durationSeconds: z.number().positive(),
    excerpt: z.string().trim().min(1).max(500),
    reasons: z.array(ClipReasonSchema).min(1),
    score: z.number(),
    aiRanked: z.boolean().default(false),
    aiReason: z.string().max(200).optional(),
    exportStatus: ClipExportStatusSchema,
    exportPathHash: z.string().optional(),
    importedMediaId: z.string().uuid().optional(),
  })
  .refine((v) => v.endSeconds > v.startSeconds, 'endSeconds must be > startSeconds')
  .refine(
    (v) => Math.abs(v.durationSeconds - (v.endSeconds - v.startSeconds)) <= 0.5,
    'durationSeconds must match endSeconds - startSeconds within 0.5s',
  );
export type ClipSelection = z.infer<typeof ClipSelectionSchema>;

export const ClipJobSchema = z
  .object({
    id: z.string().min(1),
    schemaVersion: z.literal(1),
    sourceName: z.string().min(1),
    sourcePathHash: z.string().min(1),
    sourceDurationSeconds: z.number().positive().nullable(),
    model: ClipModelSchema,
    clipCount: z.number().int().min(1).max(10),
    aspect: ClipAspectSchema,
    status: ClipJobStatusSchema,
    stagePercent: z.number().int().min(0).max(100),
    elapsedSeconds: z.number().nonnegative().optional(),
    segments: z.array(TranscriptSegmentSchema).optional(),
    clips: z.array(ClipSelectionSchema),
    error: ClipErrorSchema.optional(),
    outputFolderPathHash: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.status === 'failed' && !v.error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'a failed job must carry an error' });
    }
    if (v.status === 'cancelled' && v.error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'a cancelled job must not carry an error' });
    }
  });
export type ClipJob = z.infer<typeof ClipJobSchema>;

export const ClipJobCreateSchema = z.object({
  model: ClipModelSchema,
  clipCount: z.number().int().min(1).max(10),
  aspect: ClipAspectSchema,
});
export type ClipJobCreate = z.infer<typeof ClipJobCreateSchema>;

export const ClipJobListSchema = z.object({
  jobs: z.array(ClipJobSchema).max(20),
});
export type ClipJobList = z.infer<typeof ClipJobListSchema>;

/** Limits (spec OD-148-5). Single source — the adapter and UI read these. */
export const CLIP_LIMITS = {
  MAX_DURATION_SECONDS: 7200,
  MAX_SIZE_BYTES: 4_294_967_296,
  MAX_CLIPS: 10,
  MIN_CLIP_SECONDS: 15,
  MAX_CLIP_SECONDS: 90,
  TARGET_CLIP_SECONDS: 60,
  MIN_SPEECH_WORDS: 30,
  MAX_JOBS: 20,
} as const;

/** Plain-language reason labels (single source for the clip UI). */
export const CLIP_REASON_LABELS: Record<ClipReason, string> = {
  question: 'Asks a question',
  'high-energy': 'High energy',
  punchline: 'Punchline',
  'topic-change': 'New topic',
  'strong-opening': 'Strong opening',
};

/** Plain-language stage labels (single source for the progress UI). */
export const CLIP_STAGE_LABELS: Record<ClipJobStatus, string> = {
  probing: 'Checking your video',
  'downloading-model': 'Downloading the transcription model',
  transcribing: 'Transcribing',
  selecting: 'Picking clips',
  ready: 'Clips ready',
  exporting: 'Exporting',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/** Model download sizes shown in the setup form (approximate, honest). */
export const CLIP_MODEL_INFO: Record<ClipModel, { label: string; sizeNote: string }> = {
  tiny: { label: 'Tiny', sizeNote: 'about 75 MB — fastest, lowest accuracy' },
  base: { label: 'Base', sizeNote: 'about 145 MB — recommended' },
  small: { label: 'Small', sizeNote: 'about 466 MB — best accuracy, slowest' },
};

/** Legal stage transitions. Anything else is a protocol error, never silent. */
export const CLIP_STAGE_TRANSITIONS: Record<ClipJobStatus, ClipJobStatus[]> = {
  probing: ['downloading-model', 'transcribing', 'failed', 'cancelled'],
  'downloading-model': ['transcribing', 'failed', 'cancelled'],
  transcribing: ['selecting', 'failed', 'cancelled'],
  selecting: ['ready', 'failed', 'cancelled'],
  ready: ['exporting', 'failed', 'cancelled'],
  exporting: ['done', 'failed', 'cancelled'],
  // done → exporting: re-export of failed/pending clips after a partial export.
  done: ['exporting'],
  failed: ['probing', 'transcribing', 'selecting', 'exporting'],
  cancelled: ['probing', 'transcribing', 'selecting', 'exporting'],
};

export function isLegalClipTransition(from: ClipJobStatus, to: ClipJobStatus): boolean {
  return CLIP_STAGE_TRANSITIONS[from].includes(to);
}
