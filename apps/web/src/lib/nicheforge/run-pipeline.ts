/**
 * NicheForge research pipeline (spec 147, plan §3).
 *
 * Sequential, single-active-run orchestration: intake → readiness gate →
 * key gate → per-video loop (metadata → subtitles best-effort → download →
 * provider breakdown with rotation → parse + one repair retry) → pattern
 * mining (≥1 breakdown only) → terminal state. The run is persisted after
 * EVERY step, transient media are deleted after every video, and a failure
 * in one video never fails the run. No step logs prompts, transcripts,
 * breakdowns or key material — only run/video ids, step names and outcome
 * kinds (and this module logs nothing at all).
 */
import {
  buildPatternMiningPrompt,
  buildVideoBreakdownPrompt,
  defaultModelIdForProvider,
  isBridgeSafeModelId,
  NICHEFORGE_FAILURE_COPY,
  NICHEFORGE_KEY_COOLDOWN_MS,
  NICHEFORGE_MAX_DURATION_SECONDS,
  NICHEFORGE_MAX_RUNS,
  NICHEFORGE_PROMPT_VERSION,
  NICHEFORGE_TRANSCRIPT_PROMPT_CHARS,
  NicheforgeBreakdownSchema,
  NicheforgePatternReportSchema,
  NicheforgeRunCreateSchema,
  pickSubtitleLanguage,
  stripCaptionText,
  type NicheforgeBreakdown,
  type NicheforgeFailureReason,
  type NicheforgeKeySlot,
  type NicheforgePatternReport,
  type NicheforgeProvider,
  type NicheforgeRunRecord,
  type NicheforgeVideoInput,
  type NicheforgeVideoMetadata,
  type NicheforgeVideoRecord,
} from '@fbuploadpro/contracts';
import { BridgeError, type NicheforgeBridge, type ProviderCallResult } from './bridge-adapter';
import { saveRun } from './run-store';

export function newId(): string {
  return globalThis.crypto.randomUUID();
}

export interface RunController {
  cancel(): void;
  readonly isCancelled: boolean;
}

export function createRunController(): RunController {
  let cancelled = false;
  return {
    cancel() {
      cancelled = true;
    },
    get isCancelled() {
      return cancelled;
    },
  };
}

export type PipelineGateFailure = {
  outcome: 'gate-failed';
  reason: NicheforgeFailureReason;
  detail: string;
};

export type PipelineResult = { outcome: 'completed'; run: NicheforgeRunRecord } | PipelineGateFailure;

export interface PipelineInput {
  title?: string;
  inputs: NicheforgeVideoInput[];
  provider: NicheforgeProvider;
  modelId?: string;
}

type RotationOutcome =
  | { ok: true; text: string }
  | { ok: false; reason: NicheforgeFailureReason; detail: string };

const REPAIR_SUFFIX =
  '\nYour previous reply could not be read as JSON. Return ONLY valid JSON matching the schema, with no markdown fences and no commentary.';

/** Strip a markdown fence wrapper if the model added one despite the
 *  instruction, then parse. The fence tolerance never turns raw prose
 *  into a breakdown — the JSON schema parse still has to pass. */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
}

async function callWithRotation(
  bridge: NicheforgeBridge,
  slots: NicheforgeKeySlot[],
  modelId: string,
  prompt: string,
  controller: RunController,
): Promise<RotationOutcome> {
  const now = () => new Date();
  let attempted = 0;
  let rateLimitedCount = 0;
  let authCount = 0;
  for (const slot of slots) {
    if (controller.isCancelled) return { ok: false, reason: 'CANCELLED', detail: NICHEFORGE_FAILURE_COPY.CANCELLED };
    if (slot.cooldownUntil !== null && new Date(slot.cooldownUntil) > now()) continue;
    attempted += 1;
    const result: ProviderCallResult = await bridge.callProvider({ slot, modelId, prompt });
    if (result.status === 'ok') return { ok: true, text: result.text };
    if (result.status === 'cancelled') return { ok: false, reason: 'CANCELLED', detail: NICHEFORGE_FAILURE_COPY.CANCELLED };
    if (result.kind === 'rate-limited' || result.kind === 'quota-exhausted') {
      rateLimitedCount += 1;
      await bridge.updateKeySlot({
        ...slot,
        cooldownUntil: new Date(now().getTime() + NICHEFORGE_KEY_COOLDOWN_MS).toISOString(),
        lastValidation: 'quota-exhausted',
        lastValidatedAt: now().toISOString(),
      });
      continue;
    }
    if (result.kind === 'auth') {
      authCount += 1;
      await bridge.updateKeySlot({ ...slot, lastValidation: 'invalid', lastValidatedAt: now().toISOString() });
      continue;
    }
    if (result.kind === 'timeout') return { ok: false, reason: 'PROVIDER_TIMEOUT', detail: NICHEFORGE_FAILURE_COPY.PROVIDER_TIMEOUT };
    if (result.kind === 'unreachable') return { ok: false, reason: 'PROVIDER_UNREACHABLE', detail: NICHEFORGE_FAILURE_COPY.PROVIDER_UNREACHABLE };
    return { ok: false, reason: 'PROVIDER_UNREACHABLE', detail: 'The AI provider returned an unexpected error.' };
  }
  if (attempted === 0) {
    return { ok: false, reason: 'ALL_KEYS_EXHAUSTED', detail: NICHEFORGE_FAILURE_COPY.ALL_KEYS_EXHAUSTED };
  }
  if (rateLimitedCount > 0 && rateLimitedCount === attempted) {
    return { ok: false, reason: 'ALL_KEYS_EXHAUSTED', detail: NICHEFORGE_FAILURE_COPY.ALL_KEYS_EXHAUSTED };
  }
  if (authCount > 0 && authCount === attempted) {
    return { ok: false, reason: 'PROVIDER_AUTH_FAILED', detail: NICHEFORGE_FAILURE_COPY.PROVIDER_AUTH_FAILED };
  }
  return { ok: false, reason: 'PROVIDER_RATE_LIMITED', detail: NICHEFORGE_FAILURE_COPY.PROVIDER_RATE_LIMITED };
}

async function analyseWithRepair<T>(
  bridge: NicheforgeBridge,
  slots: NicheforgeKeySlot[],
  modelId: string,
  prompt: string,
  controller: RunController,
  parse: (value: unknown) => T | null,
): Promise<{ ok: true; value: T } | { ok: false; reason: NicheforgeFailureReason; detail: string }> {
  const first = await callWithRotation(bridge, slots, modelId, prompt, controller);
  if (!first.ok) return first;
  if (first.text.trim() === '') return { ok: false, reason: 'ANALYSIS_EMPTY', detail: NICHEFORGE_FAILURE_COPY.ANALYSIS_EMPTY };
  const parsed = parse(extractJsonObject(first.text));
  if (parsed !== null) return { ok: true, value: parsed };
  // One repair retry, against the same prompt + repair instruction.
  const repaired = await callWithRotation(bridge, slots, modelId, prompt + REPAIR_SUFFIX, controller);
  if (!repaired.ok) return repaired;
  if (repaired.text.trim() === '') return { ok: false, reason: 'ANALYSIS_EMPTY', detail: NICHEFORGE_FAILURE_COPY.ANALYSIS_EMPTY };
  const reparsed = parse(extractJsonObject(repaired.text));
  if (reparsed !== null) return { ok: true, value: reparsed };
  return { ok: false, reason: 'ANALYSIS_PARSE_FAILED', detail: NICHEFORGE_FAILURE_COPY.ANALYSIS_PARSE_FAILED };
}

function parseBreakdown(value: unknown): NicheforgeBreakdown | null {
  const parsed = NicheforgeBreakdownSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseReport(value: unknown): NicheforgePatternReport | null {
  const parsed = NicheforgePatternReportSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function runResearchRun(
  input: PipelineInput,
  bridge: NicheforgeBridge,
  controller: RunController,
  onUpdate?: (run: NicheforgeRunRecord) => void,
): Promise<PipelineResult> {
  const created = NicheforgeRunCreateSchema.safeParse({
    title: input.title,
    videoUrls: input.inputs.map((i) => i.url),
    provider: input.provider,
    modelId: input.modelId,
  });
  if (!created.success || input.inputs.length === 0) {
    return { outcome: 'gate-failed', reason: 'INVALID_URL', detail: 'Check the video links and try again.' };
  }

  // Readiness gate (pipeline re-checks — UI state is never trusted).
  const readiness = await bridge.checkReadiness();
  if (!readiness.binaryReady) {
    return { outcome: 'gate-failed', reason: 'DOWNLOAD_FAILED', detail: 'The video download tool is not ready yet. Wait for it to finish setting up, then try again.' };
  }
  if (!readiness.storageReady) {
    return { outcome: 'gate-failed', reason: 'STORAGE_FAILED', detail: 'Choose a folder for your research before starting a run.' };
  }

  // Key gate.
  const allSlots = await bridge.listKeySlots();
  const slots = allSlots.filter((s) => s.provider === input.provider);
  if (slots.length === 0) {
    return { outcome: 'gate-failed', reason: 'PROVIDER_AUTH_FAILED', detail: 'Add an AI key before running research.' };
  }
  const modelId = input.modelId ?? slots[0].modelId ?? defaultModelIdForProvider(input.provider) ?? null;
  if (modelId === null || !isBridgeSafeModelId(modelId)) {
    return {
      outcome: 'gate-failed',
      reason: 'PROVIDER_AUTH_FAILED',
      detail: 'Add a model name for this provider (letters, numbers, dots, dashes and underscores only).',
    };
  }

  // Scale bound: refuse, never silently evict old research.
  const index = await bridge.readIndex();
  if (index.length >= NICHEFORGE_MAX_RUNS) {
    return {
      outcome: 'gate-failed',
      reason: 'STORAGE_FAILED',
      detail: `You have ${NICHEFORGE_MAX_RUNS} saved research runs. Delete an old run before starting a new one.`,
    };
  }

  const nowIso = () => new Date().toISOString();
  const run: NicheforgeRunRecord = {
    id: newId(),
    title:
      input.title?.trim() !== undefined && input.title.trim() !== ''
        ? input.title.trim()
        : `Research run — ${new Date().toLocaleDateString()}`,
    provider: input.provider,
    modelId,
    promptVersion: NICHEFORGE_PROMPT_VERSION,
    status: 'queued',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: null,
    videos: input.inputs.map((v) => ({
      id: newId(),
      url: v.url,
      platform: v.platform,
      status: 'pending' as const,
      failureReason: null,
      failureDetail: null,
      metadata: null,
      transcript: null,
      transcriptLanguage: null,
      transcriptTruncated: false,
      breakdown: null,
    })),
    report: null,
    reportError: null,
  };

  const persist = async () => {
    run.updatedAt = nowIso();
    await saveRun(bridge, run);
    onUpdate?.(run);
  };

  try {
    await persist();
  } catch {
    return { outcome: 'gate-failed', reason: 'STORAGE_FAILED', detail: NICHEFORGE_FAILURE_COPY.STORAGE_FAILED };
  }

  const failVideo = (video: NicheforgeVideoRecord, reason: NicheforgeFailureReason, detail?: string) => {
    video.status = 'failed';
    video.failureReason = reason;
    video.failureDetail = (detail ?? NICHEFORGE_FAILURE_COPY[reason]).slice(0, 500);
  };

  // Sequential per-video loop.
  for (const video of run.videos) {
    if (controller.isCancelled) break;
    run.status = 'downloading';
    video.status = 'downloading';
    await persist();

    let metadata: NicheforgeVideoMetadata;
    try {
      const raw = await bridge.fetchMetadata(video.url);
      if (controller.isCancelled) break;
      metadata = {
        url: video.url,
        platform: video.platform,
        title: (raw.title ?? video.url).slice(0, 500),
        channel: raw.uploader ?? undefined,
        durationSeconds: raw.durationSeconds ?? 0,
        thumbnailUrl: raw.thumbnailUrl ?? undefined,
      };
    } catch (err) {
      if (err instanceof BridgeError && err.kind === 'cancelled') break;
      failVideo(video, err instanceof BridgeError && err.kind === 'timeout' ? 'DOWNLOAD_TIMEOUT' : 'METADATA_FAILED');
      await persist();
      continue;
    }
    video.metadata = metadata;
    await persist();

    if (metadata.durationSeconds > NICHEFORGE_MAX_DURATION_SECONDS) {
      failVideo(video, 'VIDEO_TOO_LONG');
      await persist();
      continue;
    }

    // Subtitles are best-effort: failure degrades to metadata-only, it
    // never fails the video (spec OD-147-2).
    let subtitleLanguage: string | null = null;
    try {
      const availability = await bridge.fetchSubtitleAvailability(video.url);
      const picked = pickSubtitleLanguage(availability.manual, availability.automatic);
      subtitleLanguage = picked?.language ?? null;
    } catch {
      subtitleLanguage = null;
    }
    if (controller.isCancelled) break;

    // Download media (+ subtitles sidecar) into the per-run temp dir.
    let subtitleText: string | null = null;
    try {
      const downloaded = await bridge.downloadMedia({
        url: video.url,
        runId: run.id,
        videoId: video.id,
        subtitleLanguage,
      });
      subtitleText = downloaded.subtitleText !== null ? stripCaptionText(downloaded.subtitleText) : null;
      if (subtitleText === '') subtitleText = null;
    } catch (err) {
      if (err instanceof BridgeError && err.kind === 'cancelled') break;
      failVideo(video, err instanceof BridgeError && err.kind === 'timeout' ? 'DOWNLOAD_TIMEOUT' : 'DOWNLOAD_FAILED');
      await persist();
      try {
        await bridge.cleanRunTemp(run.id);
      } catch {
        // Temp cleanup failure is best-effort; the video already failed loudly.
      }
      continue;
    }
    if (controller.isCancelled) break;
    video.status = 'downloaded';
    video.transcript = subtitleText;
    video.transcriptLanguage = subtitleText !== null ? subtitleLanguage : null;
    video.transcriptTruncated = subtitleText !== null && subtitleText.length > NICHEFORGE_TRANSCRIPT_PROMPT_CHARS;
    await persist();

    run.status = 'analysing';
    video.status = 'analysing';
    await persist();
    const prompt = buildVideoBreakdownPrompt({
      metadata,
      transcript: subtitleText,
      transcriptLanguage: video.transcriptLanguage,
    });
    const analysed = await analyseWithRepair(bridge, slots, modelId, prompt, controller, parseBreakdown);
    if (controller.isCancelled) break;
    if (!analysed.ok) {
      failVideo(video, analysed.reason, analysed.detail);
      await persist();
    } else {
      const breakdown = analysed.value;
      // The pipeline enforces transcript honesty even if the model
      // overstates confidence for a transcript it never saw.
      if (subtitleText === null) {
        breakdown.transcriptAvailable = false;
        breakdown.transcriptTruncated = false;
        breakdown.confidence = 'low';
        breakdown.confidenceReason = 'No captions were available, so this breakdown is from title and details only.';
      } else {
        breakdown.transcriptAvailable = true;
        breakdown.transcriptTruncated = video.transcriptTruncated;
      }
      video.breakdown = breakdown;
      video.status = 'done';
      video.failureReason = null;
      video.failureDetail = null;
      await persist();
    }
    // Transient media never survive a video's completion.
    try {
      await bridge.cleanRunTemp(run.id);
    } catch {
      // Best-effort; terminal cleanup retries below.
    }
  }

  if (controller.isCancelled) {
    await bridge.cancelCurrentOperation().catch(() => undefined);
    run.status = 'cancelled';
    run.completedAt = nowIso();
    for (const video of run.videos) {
      if (video.status === 'downloading' || video.status === 'analysing' || video.status === 'downloaded') {
        failVideo(video, 'CANCELLED');
      }
    }
    try {
      await bridge.cleanRunTemp(run.id);
    } catch {
      // Best-effort.
    }
    await persist();
    return { outcome: 'completed', run };
  }

  const succeeded = run.videos.filter((v) => v.status === 'done' && v.breakdown !== null);
  if (succeeded.length === 0) {
    run.status = 'failed';
    run.completedAt = nowIso();
    try {
      await bridge.cleanRunTemp(run.id);
    } catch {
      // Best-effort.
    }
    await persist();
    return { outcome: 'completed', run };
  }

  // Pattern mining (≥1 breakdown only).
  run.status = 'mining';
  await persist();
  const miningPrompt = buildPatternMiningPrompt({
    breakdowns: succeeded.map((v) => ({ videoId: v.id, title: v.metadata?.title ?? v.url, breakdown: v.breakdown as NicheforgeBreakdown })),
    metadata: succeeded.map((v) => v.metadata as NicheforgeVideoMetadata).filter((m) => m !== null),
  });
  const mined = await analyseWithRepair(bridge, slots, modelId, miningPrompt, controller, parseReport);
  if (controller.isCancelled) {
    run.status = 'cancelled';
    run.completedAt = nowIso();
    await persist();
    return { outcome: 'completed', run };
  }
  if (mined.ok) {
    const report = mined.value;
    report.coverage = {
      attempted: run.videos.length,
      analysed: succeeded.length,
      transcriptBased: succeeded.filter((v) => v.breakdown?.transcriptAvailable).length,
      metadataOnly: succeeded.filter((v) => !v.breakdown?.transcriptAvailable).length,
    };
    report.modelId = modelId;
    report.provider = input.provider;
    report.promptVersion = NICHEFORGE_PROMPT_VERSION;
    report.generatedAt = nowIso();
    run.report = report;
    run.reportError = null;
  } else {
    run.report = null;
    run.reportError = 'REPORT_FAILED';
  }
  run.status = 'done';
  run.completedAt = nowIso();
  try {
    await bridge.cleanRunTemp(run.id);
  } catch {
    // Best-effort.
  }
  await persist();
  return { outcome: 'completed', run };
}
