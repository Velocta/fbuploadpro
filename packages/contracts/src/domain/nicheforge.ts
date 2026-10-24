/**
 * NicheForge — viral-video research (spec 147, desktop only).
 *
 * Contracts-first module: every schema is validated at each boundary
 * (intake, bridge payloads, provider response parsing, run-file read/write).
 * No key material ever appears in any schema here — key records carry
 * metadata only (masked suffix, never the key).
 *
 * Reconciliation against the frozen desktop bridge contract v1.0
 * (packages/contracts/src/domain/desktop-bridge.ts), recorded in the
 * spec 147 §7 addendum — the frozen contract provides NO nicheforge_*
 * commands, so this module binds to the generic primitives:
 * - media: media_yt_dlp_metadata / media_yt_dlp_subtitles /
 *   media_yt_dlp_download (§9 of the bridge contract).
 * - AI: ai_complete / ai_complete_stream / ai_cancel / ai_status (§10).
 *   The bridge AI provider enum is openai | anthropic | openai-compatible
 *   (no native gemini). NicheForge's `gemini` provider maps to the bridge's
 *   openai-compatible provider with Google's OpenAI-compatible endpoint
 *   (GEMINI_OPENAI_COMPAT_BASE_URL) — Bearer auth, chat-completions shape.
 * - secrets: one key per (service, "ai") pair. Multi-key rotation is
 *   achieved by giving each key slot its own service name
 *   (`nicheforge-<slot>`); ai_complete(service) then uses that slot's key.
 *   Slot metadata (label, masked suffix, base URL, model override,
 *   cooldown) lives in the local store's keys file — metadata only.
 * - filesystem: scopes are granted ONLY by a dialog pick (§7.4 of the
 *   bridge contract). There is no app-private data directory command, so
 *   the research store lives under a user-picked folder scope (see the
 *   web layer's run-store); paths below are relative to that scope root.
 */
import { z } from 'zod';
import { detectSourcePlatform } from './downloader.js';

// ---------------------------------------------------------------------------
// Constants (single source — components never hard-code these numbers)
// ---------------------------------------------------------------------------

export const NICHEFORGE_MAX_URLS = 20;
export const NICHEFORGE_MAX_RUNS = 200;
export const NICHEFORGE_MAX_DURATION_SECONDS = 3600;
export const NICHEFORGE_TRANSCRIPT_PROMPT_CHARS = 12000;
export const NICHEFORGE_PROMPT_VERSION = '1';
/** Cooldown applied to a key slot after a quota/rate-limit response. */
export const NICHEFORGE_KEY_COOLDOWN_MS = 60_000;
/** Bridge ai_complete timeout for a breakdown/report call (ms). */
export const NICHEFORGE_PROVIDER_TIMEOUT_MS = 120_000;
/** Cheap validation probe: a tiny completion, not a models-list call — the
 *  frozen bridge contract exposes no models-list endpoint. */
export const NICHEFORGE_VALIDATION_PROBE_PROMPT = 'Reply with exactly: OK';
/** Gemini default model id, re-checked at build time (model ids churn). */
export const NICHEFORGE_GEMINI_DEFAULT_MODEL_ID = 'gemini-2.5-flash';
/** Google's OpenAI-compatible endpoint for Gemini keys (Bearer auth). */
export const NICHEFORGE_GEMINI_OPENAI_COMPAT_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/';
/** Local-store layout, relative to the user-picked folder scope root. */
export const NICHEFORGE_STORE_RUNS_DIR = 'nicheforge/runs';
export const NICHEFORGE_STORE_INDEX_PATH = 'nicheforge/runs/index.json';
export const NICHEFORGE_STORE_KEYS_PATH = 'nicheforge/keys.json';
export const NICHEFORGE_STORE_TMP_DIR = 'nicheforge/tmp';
/** localStorage key holding ONLY the opaque folder-scope id (not a secret). */
export const NICHEFORGE_SCOPE_CACHE_KEY = 'nicheforge.storeScopeId';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const NicheforgePlatformSchema = z.enum(['youtube', 'tiktok', 'instagram', 'facebook']);
export type NicheforgePlatform = z.infer<typeof NicheforgePlatformSchema>;

export const NicheforgeProviderSchema = z.enum(['gemini', 'openai-compatible']);
export type NicheforgeProvider = z.infer<typeof NicheforgeProviderSchema>;

export const NicheforgeRunStatusSchema = z.enum([
  'queued',
  'downloading',
  'analysing',
  'mining',
  'done',
  'failed',
  'cancelled',
  'interrupted',
]);
export type NicheforgeRunStatus = z.infer<typeof NicheforgeRunStatusSchema>;

export const NicheforgeVideoStatusSchema = z.enum([
  'pending',
  'downloading',
  'downloaded',
  'analysing',
  'done',
  'failed',
]);
export type NicheforgeVideoStatus = z.infer<typeof NicheforgeVideoStatusSchema>;

/** Closed failure catalogue (spec §3). NO_TRANSCRIPT is informational: it
 *  flags a metadata-only breakdown, it never fails a video by itself. */
export const NicheforgeFailureReasonSchema = z.enum([
  'INVALID_URL',
  'VIDEO_TOO_LONG',
  'METADATA_FAILED',
  'DOWNLOAD_FAILED',
  'DOWNLOAD_TIMEOUT',
  'NO_TRANSCRIPT',
  'PROVIDER_AUTH_FAILED',
  'PROVIDER_RATE_LIMITED',
  'ALL_KEYS_EXHAUSTED',
  'PROVIDER_UNREACHABLE',
  'PROVIDER_TIMEOUT',
  'ANALYSIS_PARSE_FAILED',
  'ANALYSIS_EMPTY',
  'REPORT_FAILED',
  'CANCELLED',
  'INTERRUPTED',
  'STORAGE_FAILED',
]);
export type NicheforgeFailureReason = z.infer<typeof NicheforgeFailureReasonSchema>;

export const NicheforgeConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type NicheforgeConfidence = z.infer<typeof NicheforgeConfidenceSchema>;

export const NicheforgeHookTypeSchema = z.enum([
  'question',
  'bold-claim',
  'visual-gag',
  'story-opening',
  'list-tease',
  'other',
]);
export type NicheforgeHookType = z.infer<typeof NicheforgeHookTypeSchema>;

export const NicheforgeKeyValidationSchema = z.enum(['valid', 'invalid', 'unreachable', 'quota-exhausted']);
export type NicheforgeKeyValidation = z.infer<typeof NicheforgeKeyValidationSchema>;

/** Plain-language copy for every failure reason (web layer renders this). */
export const NICHEFORGE_FAILURE_COPY: Record<NicheforgeFailureReason, string> = {
  INVALID_URL: 'This link is not a supported video link. Only YouTube, TikTok, Instagram and Facebook video links are supported.',
  VIDEO_TOO_LONG: 'This video is longer than 60 minutes, so it was skipped.',
  METADATA_FAILED: 'Could not read this video’s details.',
  DOWNLOAD_FAILED: 'This video could not be downloaded. It may have been removed, made private, or need a login to view.',
  DOWNLOAD_TIMEOUT: 'Downloading this video timed out.',
  NO_TRANSCRIPT: 'Breakdown from title and details only — no captions were available for this video.',
  PROVIDER_AUTH_FAILED: 'The AI key was rejected. Check the key and try again.',
  PROVIDER_RATE_LIMITED: 'The AI provider rate limit was hit on every key.',
  ALL_KEYS_EXHAUSTED: 'Every AI key for this provider is out of quota. Add a key or wait, then run again.',
  PROVIDER_UNREACHABLE: 'The AI provider could not be reached. Check your connection and try again.',
  PROVIDER_TIMEOUT: 'The AI provider took too long to respond.',
  ANALYSIS_PARSE_FAILED: 'The AI reply could not be read as a breakdown.',
  ANALYSIS_EMPTY: 'The AI reply was empty.',
  REPORT_FAILED: 'The pattern report could not be generated, but the video breakdowns below are complete.',
  CANCELLED: 'Cancelled.',
  INTERRUPTED: 'The app closed before this run finished. Its completed results are kept.',
  STORAGE_FAILED: 'The research could not be saved on this device.',
};

// ---------------------------------------------------------------------------
// Shared validators
// ---------------------------------------------------------------------------

/** http(s) URL without embedded userinfo (same rule as the shell's
 *  openExternalUrl validation). Kept module-private: the frozen bridge
 *  module already exports an isCleanHttpUrl and the barrel cannot hold two. */
function isCleanHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    if (u.username !== '' || u.password !== '') return false;
    return true;
  } catch {
    return false;
  }
}

export const NicheforgeCleanUrlSchema = z.string().refine(isCleanHttpUrl, 'URL must be http(s) without embedded credentials');

const YyyyMmDdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'uploadDate must be YYYY-MM-DD');

/** Bridge model-id rule (frozen contract §10): the bridge rejects model ids
 *  outside this shape, so forms enforce it with a plain-language message
 *  rather than letting a run fail mid-flight. */
export const NICHEFORGE_BRIDGE_MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
export function isBridgeSafeModelId(value: string): boolean {
  return NICHEFORGE_BRIDGE_MODEL_PATTERN.test(value);
}

/** A base URL must never point at an FBUploadPro host — a misconfigured
 *  provider must never become a key-exfiltration channel to our own servers. */
export function isForbiddenProviderHost(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return host === 'fbuploadpro.com' || host.endsWith('.fbuploadpro.com');
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Video metadata. The frozen yt-dlp metadata primitive returns title,
 * uploader, duration, thumbnail and formats only — view/like counts,
 * upload date and description are optional because the bridge cannot
 * supply them; they stay null rather than being invented.
 */
export const NicheforgeVideoMetadataSchema = z.object({
  url: NicheforgeCleanUrlSchema,
  platform: NicheforgePlatformSchema,
  title: z.string().min(1).max(500),
  channel: z.string().max(200).optional(),
  durationSeconds: z.number().int().nonnegative(),
  viewCount: z.number().int().nonnegative().optional(),
  likeCount: z.number().int().nonnegative().optional(),
  uploadDate: YyyyMmDdSchema.optional(),
  description: z.string().max(2000).optional(),
  thumbnailUrl: NicheforgeCleanUrlSchema.optional(),
});
export type NicheforgeVideoMetadata = z.infer<typeof NicheforgeVideoMetadataSchema>;

export const NicheforgeVideoInputSchema = z.object({
  url: NicheforgeCleanUrlSchema,
  platform: NicheforgePlatformSchema,
});
export type NicheforgeVideoInput = z.infer<typeof NicheforgeVideoInputSchema>;

export const NicheforgeRunCreateSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  videoUrls: z.array(z.string()).min(1).max(NICHEFORGE_MAX_URLS),
  provider: NicheforgeProviderSchema,
  modelId: z.string().min(1).max(200).optional(),
  keySlotId: z.string().uuid().optional(),
});
export type NicheforgeRunCreate = z.infer<typeof NicheforgeRunCreateSchema>;

export const NicheforgeBreakdownSchema = z.object({
  hook: z.string().min(1).max(500),
  hookType: NicheforgeHookTypeSchema,
  structure: z.array(z.string().max(120)).min(1).max(12),
  pacing: z.string().min(1).max(500),
  topic: z.string().min(1).max(200),
  format: z.string().min(1).max(100),
  whyItWorked: z.string().min(1).max(1000),
  replicableTakeaways: z.array(z.string().max(300)).min(1).max(5),
  transcriptAvailable: z.boolean(),
  transcriptTruncated: z.boolean(),
  confidence: NicheforgeConfidenceSchema,
  confidenceReason: z.string().min(1).max(300),
});
export type NicheforgeBreakdown = z.infer<typeof NicheforgeBreakdownSchema>;

export const NicheforgeVideoRecordSchema = z.object({
  id: z.string().uuid(),
  url: NicheforgeCleanUrlSchema,
  platform: NicheforgePlatformSchema,
  status: NicheforgeVideoStatusSchema,
  failureReason: NicheforgeFailureReasonSchema.nullable(),
  failureDetail: z.string().max(500).nullable(),
  metadata: NicheforgeVideoMetadataSchema.nullable(),
  transcript: z.string().nullable(),
  transcriptLanguage: z.string().nullable(),
  transcriptTruncated: z.boolean(),
  breakdown: NicheforgeBreakdownSchema.nullable(),
});
export type NicheforgeVideoRecord = z.infer<typeof NicheforgeVideoRecordSchema>;

export const NicheforgePatternReportSchema = z.object({
  recurringHooks: z.array(
    z.object({ hookType: NicheforgeHookTypeSchema, count: z.number().int().nonnegative(), exampleVideoIds: z.array(z.string().uuid()) }),
  ),
  commonFormats: z.array(z.object({ format: z.string().max(100), count: z.number().int().nonnegative() })),
  lengthInsights: z.array(z.string().max(300)),
  postingPatterns: z.array(z.string().max(300)),
  topicClusters: z.array(z.object({ topic: z.string().max(200), videoIds: z.array(z.string().uuid()) })),
  actionablePlaybook: z.array(
    z.object({
      kind: z.enum(['do', 'dont']),
      text: z.string().max(300),
      sourceVideoIds: z.array(z.string().uuid()),
    }),
  ),
  coverage: z.object({
    attempted: z.number().int().nonnegative(),
    analysed: z.number().int().nonnegative(),
    transcriptBased: z.number().int().nonnegative(),
    metadataOnly: z.number().int().nonnegative(),
  }),
  modelId: z.string().min(1).max(200),
  provider: NicheforgeProviderSchema,
  promptVersion: z.string().min(1),
  generatedAt: z.string().min(1),
});
export type NicheforgePatternReport = z.infer<typeof NicheforgePatternReportSchema>;

export const NicheforgeRunRecordSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(100),
  provider: NicheforgeProviderSchema,
  modelId: z.string().min(1).max(200),
  promptVersion: z.string().min(1),
  status: NicheforgeRunStatusSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  completedAt: z.string().nullable(),
  videos: z.array(NicheforgeVideoRecordSchema).min(1).max(NICHEFORGE_MAX_URLS),
  report: NicheforgePatternReportSchema.nullable(),
  reportError: NicheforgeFailureReasonSchema.nullable(),
});
export type NicheforgeRunRecord = z.infer<typeof NicheforgeRunRecordSchema>;

export const NicheforgeRunIndexEntrySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(100),
  status: NicheforgeRunStatusSchema,
  createdAt: z.string().min(1),
  videoCount: z.number().int().nonnegative(),
  successCount: z.number().int().nonnegative(),
});
export type NicheforgeRunIndexEntry = z.infer<typeof NicheforgeRunIndexEntrySchema>;

export const NicheforgeRunIndexSchema = z.array(NicheforgeRunIndexEntrySchema).max(NICHEFORGE_MAX_RUNS);

/** Key metadata ONLY — never key material. */
export const NicheforgeKeyRecordSchema = z.object({
  id: z.string().uuid(),
  provider: NicheforgeProviderSchema,
  label: z.string().min(1).max(100),
  maskedSuffix: z.string().length(4),
  createdAt: z.string().min(1),
  lastValidatedAt: z.string().nullable(),
  lastValidation: NicheforgeKeyValidationSchema.nullable(),
  cooldownUntil: z.string().nullable(),
});
export type NicheforgeKeyRecord = z.infer<typeof NicheforgeKeyRecordSchema>;

/** Stored key slot: key metadata + the bridge service name that holds the
 *  key material in encrypted storage + provider connection details. The
 *  service name is an opaque slot handle, never key material. */
export const NicheforgeKeySlotSchema = NicheforgeKeyRecordSchema.extend({
  service: z.string().min(1).max(32),
  baseUrl: z.string().optional(),
  modelId: z.string().max(200).optional(),
});
export type NicheforgeKeySlot = z.infer<typeof NicheforgeKeySlotSchema>;

export const NicheforgeKeySlotsSchema = z.array(NicheforgeKeySlotSchema);

export const NicheforgeKeyCreateSchema = z.object({
  provider: NicheforgeProviderSchema,
  label: z.string().trim().min(1).max(100),
  key: z.string().min(1).max(500),
  baseUrl: z.string().optional(),
  modelId: z.string().min(1).max(200).optional(),
}).superRefine((v, ctx) => {
  if (v.provider === 'openai-compatible') {
    if (v.baseUrl !== undefined && !isCleanHttpUrl(v.baseUrl)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Base URL must be https without embedded credentials' });
    }
    if (v.baseUrl !== undefined && isForbiddenProviderHost(v.baseUrl)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Base URL must not point at an FBUploadPro host' });
    }
  } else if (v.baseUrl !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Base URL is only used for OpenAI-compatible providers' });
  }
});
export type NicheforgeKeyCreate = z.infer<typeof NicheforgeKeyCreateSchema>;

// ---------------------------------------------------------------------------
// Intake: platform derivation (values, not exceptions — the form renders
// per-URL errors inline)
// ---------------------------------------------------------------------------

export type NicheforgeIntakeResult =
  | { ok: true; input: NicheforgeVideoInput }
  | { ok: false; reason: 'INVALID_URL'; detail: string };

export function deriveVideoInput(rawUrl: string): NicheforgeIntakeResult {
  const url = rawUrl.trim();
  if (!isCleanHttpUrl(url)) {
    return { ok: false, reason: 'INVALID_URL', detail: 'Enter a valid http(s) video link without embedded credentials.' };
  }
  const platform = detectSourcePlatform(url);
  if (!NicheforgePlatformSchema.safeParse(platform).success) {
    return {
      ok: false,
      reason: 'INVALID_URL',
      detail: 'Only YouTube, TikTok, Instagram and Facebook video links are supported.',
    };
  }
  return { ok: true, input: { url, platform: platform as NicheforgePlatform } };
}

/** Parse a pasted block (one URL per line) into inputs + per-line errors,
 *  collapsing exact duplicates with a note count. */
export function parseVideoUrlBlock(block: string): {
  inputs: NicheforgeVideoInput[];
  errors: { line: number; url: string; detail: string }[];
  duplicateCount: number;
} {
  const inputs: NicheforgeVideoInput[] = [];
  const errors: { line: number; url: string; detail: string }[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;
  for (const [index, rawLine] of block.split('\n').entries()) {
    const line = rawLine.trim();
    if (line === '') continue;
    if (seen.has(line)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(line);
    const result = deriveVideoInput(line);
    if (result.ok) inputs.push(result.input);
    else errors.push({ line: index + 1, url: line, detail: result.detail });
  }
  return { inputs, errors, duplicateCount };
}

// ---------------------------------------------------------------------------
// Subtitle language choice + caption text conversion (pure)
// ---------------------------------------------------------------------------

export function pickSubtitleLanguage(
  manual: { language: string }[],
  automatic: { language: string }[],
): { language: string; manual: boolean } | null {
  const hasEn = (list: { language: string }[]) =>
    list.find((e) => e.language === 'en' || e.language.startsWith('en-')) ?? null;
  const manualEn = hasEn(manual);
  if (manualEn) return { language: manualEn.language, manual: true };
  const autoEn = hasEn(automatic);
  if (autoEn) return { language: autoEn.language, manual: false };
  if (manual.length > 0) return { language: manual[0].language, manual: true };
  if (automatic.length > 0) return { language: automatic[0].language, manual: false };
  return null;
}

/** Convert WebVTT/SRT caption text to plain text: drop headers, cue
 *  numbers and timestamps, strip inline tags, collapse whitespace, and
 *  drop consecutive duplicate lines (captions repeat lines across cues). */
export function stripCaptionText(raw: string): string {
  const lines: string[] = [];
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();
    if (line === '') continue;
    if (/^WEBVTT/i.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    if (/-->/.test(line)) continue;
    if (/^(NOTE|STYLE|REGION)\b/i.test(line)) continue;
    const text = line.replace(/<[^>]*>/g, '').trim();
    if (text === '') continue;
    if (lines.length > 0 && lines[lines.length - 1] === text) continue;
    lines.push(text);
  }
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

export function truncateTranscriptForPrompt(transcript: string): { text: string; truncated: boolean } {
  if (transcript.length <= NICHEFORGE_TRANSCRIPT_PROMPT_CHARS) return { text: transcript, truncated: false };
  return { text: transcript.slice(0, NICHEFORGE_TRANSCRIPT_PROMPT_CHARS), truncated: true };
}

// ---------------------------------------------------------------------------
// Prompt builders (pure; versioned via NICHEFORGE_PROMPT_VERSION)
// ---------------------------------------------------------------------------

const BREAKDOWN_SCHEMA_TEXT = `{"hook": string (the opening hook as observed, max 500 chars), "hookType": "question" | "bold-claim" | "visual-gag" | "story-opening" | "list-tease" | "other", "structure": string[] (ordered beats, each max 120 chars, 1-12 items), "pacing": string (max 500 chars), "topic": string (max 200 chars), "format": string (max 100 chars), "whyItWorked": string (2-4 sentences grounded in THIS video, max 1000 chars), "replicableTakeaways": string[] (1-5 concrete video-specific items, each max 300 chars), "confidence": "high" | "medium" | "low", "confidenceReason": string (max 300 chars)}`;

export function buildVideoBreakdownPrompt(input: {
  metadata: NicheforgeVideoMetadata;
  transcript: string | null;
  transcriptLanguage: string | null;
}): string {
  const { metadata, transcript, transcriptLanguage } = input;
  const promptTranscript = transcript === null ? null : truncateTranscriptForPrompt(transcript);
  const lines = [
    'You analyse short-form videos for creators studying what makes videos work.',
    'Return ONLY valid JSON matching this schema, with no markdown fences and no commentary:',
    BREAKDOWN_SCHEMA_TEXT,
    `Video title: ${metadata.title}`,
    `Platform: ${metadata.platform}`,
    metadata.channel ? `Channel: ${metadata.channel}` : null,
    `Duration: ${metadata.durationSeconds} seconds`,
    metadata.viewCount !== undefined ? `Views: ${metadata.viewCount}` : null,
    metadata.likeCount !== undefined ? `Likes: ${metadata.likeCount}` : null,
    metadata.uploadDate ? `Uploaded: ${metadata.uploadDate}` : null,
    metadata.description ? `Description: ${metadata.description}` : null,
    transcript === null
      ? 'No transcript is available for this video. Base the breakdown on the title and details above, and set confidence to "low" with a confidenceReason stating no transcript was available. Do not invent transcript content.'
      : [
          `Transcript language: ${transcriptLanguage ?? 'unknown'}`,
          `Transcript truncated for this prompt: ${promptTranscript?.truncated ? 'yes' : 'no'}`,
          `Transcript:\n${promptTranscript?.text ?? ''}`,
        ].join('\n'),
  ];
  return lines.filter((l): l is string => l !== null).join('\n');
}

const REPORT_SCHEMA_TEXT = `{"recurringHooks": [{"hookType": ..., "count": number, "exampleVideoIds": string[]}], "commonFormats": [{"format": string, "count": number}], "lengthInsights": string[] (observed duration ranges only — never prescribe a posting time beyond the data), "postingPatterns": string[] (ONLY what the upload dates in this run support, with a coverage caveat — never claim a channel schedule from a handful of videos), "topicClusters": [{"topic": string, "videoIds": string[]}], "actionablePlaybook": [{"kind": "do" | "dont", "text": string, "sourceVideoIds": string[]}]}`;

export function buildPatternMiningPrompt(input: {
  breakdowns: { videoId: string; title: string; breakdown: NicheforgeBreakdown }[];
  metadata: NicheforgeVideoMetadata[];
}): string {
  const breakdownText = input.breakdowns
    .map((b) => `Video ${b.videoId} (${b.title}): ${JSON.stringify(b.breakdown)}`)
    .join('\n');
  const uploadDates = input.metadata
    .map((m) => m.uploadDate)
    .filter((d): d is string => d !== undefined);
  return [
    'You mine patterns across several short-form video breakdowns for creators studying what makes videos work.',
    'Return ONLY valid JSON matching this schema, with no markdown fences and no commentary:',
    REPORT_SCHEMA_TEXT,
    `Videos analysed: ${input.breakdowns.length}`,
    uploadDates.length > 0
      ? `Upload dates in this run (the ONLY dates you may reason about for posting patterns): ${uploadDates.join(', ')}`
      : 'No upload dates are available in this run. postingPatterns must be an empty array.',
    'Breakdowns:',
    breakdownText,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Report Markdown (single source for on-screen copy and .md export)
// ---------------------------------------------------------------------------

export function slugifyRunTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug === '' ? 'research-run' : slug;
}

export function reportFilename(title: string): string {
  return `${slugifyRunTitle(title)}-nicheforge-report.md`;
}

export function buildReportMarkdown(run: NicheforgeRunRecord): string {
  const succeeded = run.videos.filter((v) => v.status === 'done' && v.breakdown !== null);
  const transcriptBased = succeeded.filter((v) => v.breakdown?.transcriptAvailable).length;
  const metadataOnly = succeeded.length - transcriptBased;
  const lines: string[] = [];
  lines.push(`# ${run.title}`);
  lines.push('');
  lines.push(`Coverage: ${succeeded.length} of ${run.videos.length} videos analysed (${transcriptBased} with captions, ${metadataOnly} from details only).`);
  lines.push('');
  for (const video of run.videos) {
    const title = video.metadata?.title ?? video.url;
    lines.push(`## ${title}`);
    lines.push('');
    lines.push(`Platform: ${video.platform} · Status: ${video.status}`);
    if (video.metadata) {
      const meta = video.metadata;
      lines.push(`Duration: ${meta.durationSeconds}s${meta.channel ? ` · Channel: ${meta.channel}` : ''}`);
    }
    if (video.status === 'failed') {
      lines.push('');
      lines.push(`Failed: ${video.failureDetail ?? video.failureReason ?? 'Unknown reason'}`);
      lines.push('');
      continue;
    }
    const b = video.breakdown;
    if (b === null) {
      lines.push('');
      continue;
    }
    lines.push('');
    lines.push(`Hook (${b.hookType}): ${b.hook}`);
    lines.push('');
    lines.push('Structure:');
    for (const beat of b.structure) lines.push(`- ${beat}`);
    lines.push('');
    lines.push(`Pacing: ${b.pacing}`);
    lines.push('');
    lines.push(`Topic: ${b.topic} · Format: ${b.format}`);
    lines.push('');
    lines.push(`Why it worked: ${b.whyItWorked}`);
    lines.push('');
    lines.push('Replicable takeaways:');
    for (const item of b.replicableTakeaways) lines.push(`- ${item}`);
    lines.push('');
    lines.push(
      b.transcriptAvailable
        ? `Confidence: ${b.confidence} — ${b.confidenceReason}`
        : `Confidence: low — no captions were available for this video, so this breakdown is from title and details only.`,
    );
    lines.push('');
  }
  if (run.report !== null) {
    const r = run.report;
    lines.push('## Pattern report');
    lines.push('');
    if (r.recurringHooks.length > 0) {
      lines.push('Recurring hooks:');
      for (const h of r.recurringHooks) lines.push(`- ${h.hookType} (seen in ${h.count} videos)`);
      lines.push('');
    }
    if (r.commonFormats.length > 0) {
      lines.push('Common formats:');
      for (const f of r.commonFormats) lines.push(`- ${f.format} (${f.count})`);
      lines.push('');
    }
    if (r.lengthInsights.length > 0) {
      lines.push('Length insights:');
      for (const item of r.lengthInsights) lines.push(`- ${item}`);
      lines.push('');
    }
    if (r.postingPatterns.length > 0) {
      lines.push('Posting patterns (only what this run’s videos support):');
      for (const item of r.postingPatterns) lines.push(`- ${item}`);
      lines.push('');
    }
    if (r.topicClusters.length > 0) {
      lines.push('Topic clusters:');
      for (const t of r.topicClusters) lines.push(`- ${t.topic} (${t.videoIds.length} videos)`);
      lines.push('');
    }
    if (r.actionablePlaybook.length > 0) {
      lines.push('Playbook:');
      for (const item of r.actionablePlaybook) lines.push(`- ${item.kind === 'do' ? 'Do' : 'Don’t'}: ${item.text}`);
      lines.push('');
    }
  } else if (run.reportError !== null) {
    lines.push('## Pattern report');
    lines.push('');
    lines.push(`The pattern report could not be generated (${NICHEFORGE_FAILURE_COPY[run.reportError]}).`);
    lines.push('');
  }
  lines.push(`Generated with ${run.provider} model ${run.modelId}, prompt version ${run.promptVersion}.`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Provider error classification (pure; pipeline maps kinds to §3 reasons)
// ---------------------------------------------------------------------------

export type NicheforgeProviderErrorKind = 'auth' | 'rate-limited' | 'quota-exhausted' | 'unreachable' | 'timeout' | 'unknown';

const QUOTA_KEYWORDS = ['quota', 'exhausted', 'insufficient', 'billing', 'rate limit', 'too many requests'];

export function classifyProviderError(status: number | null, bodyText: string | null): NicheforgeProviderErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate-limited';
  const body = (bodyText ?? '').toLowerCase();
  if (status === null) {
    if (body.includes('timeout') || body.includes('timed out')) return 'timeout';
    return 'unreachable';
  }
  if ((status === 400 || status === 402) && QUOTA_KEYWORDS.some((k) => body.includes(k))) return 'quota-exhausted';
  if (body.includes('timeout') || body.includes('timed out')) return 'timeout';
  return 'unknown';
}

/** Map a frozen bridge AI error code to a provider error kind. */
export function classifyBridgeAiError(code: string): NicheforgeProviderErrorKind {
  switch (code) {
    case 'AI_RATE_LIMITED':
      return 'rate-limited';
    case 'AI_KEY_MISSING':
      return 'auth';
    case 'AI_TIMEOUT':
      return 'timeout';
    case 'AI_PROVIDER_ERROR':
      return 'unreachable';
    default:
      return 'unknown';
  }
}

/** Default model id for a provider (openai-compatible has no safe default —
 *  the user must supply a model id). */
export function defaultModelIdForProvider(provider: NicheforgeProvider): string | null {
  return provider === 'gemini' ? NICHEFORGE_GEMINI_DEFAULT_MODEL_ID : null;
}
