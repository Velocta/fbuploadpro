/**
 * NicheForge production bridge adapter (spec 147, plan §6 / tasks E1).
 *
 * Thin mapping from the bridge-adapter interface to the FROZEN desktop
 * bridge contract v1.0 (packages/contracts/src/domain/desktop-bridge.ts).
 * This is the ONLY file that names Tauri commands. It never returns key
 * material: secrets are written with secrets_set and read back ONLY
 * natively by ai_complete/ai_complete_stream, which inject the key
 * bridge-side.
 *
 * Reconciliation notes (frozen contract vs spec §7):
 * - No nicheforge_* commands exist: media uses media_yt_dlp_* (§9),
 *   AI uses ai_* (§10), keys use secrets_* (§8), store uses fs_* (§7.4).
 * - Gemini maps to bridge provider "openai-compatible" with Google's
 *   OpenAI-compatible endpoint (contracts constant).
 * - Each key slot is its own secrets service (`nicheforge-<id>`), because
 *   ai_* reads exactly one key per service ("ai"). Rotation iterates
 *   slots, calling ai_* with each slot's service.
 * - The subtitles primitive returns language/format lists, NOT text.
 *   Transcript text is read from the subtitle sidecar file written by
 *   media_yt_dlp_download into the per-run temp dir, then converted to
 *   plain text by the pipeline. The primitive writes manual subtitles
 *   only (--write-subs), so an auto-caption-only video degrades to
 *   metadata-only if no sidecar file appears.
 * - Filesystem scopes are granted ONLY by a dialog pick, so the store
 *   root is a user-picked folder (cached scope id in localStorage —
 *   an opaque handle, never a secret — re-validated on every mount).
 * - The yt-dlp metadata primitive returns title/uploader/duration/
 *   thumbnail only; view/like counts, upload date and description are
 *   unavailable and stay absent, never invented.
 * - Validation is a tiny ai_complete probe, not a models-list call: the
 *   frozen contract exposes no models-list endpoint. Validation stays
 *   advisory (spec OD-147-4).
 */
import {
  aiCancel,
  aiComplete,
  aiCompleteStream,
  binaryStatus,
  classifyBridgeAiError,
  defaultModelIdForProvider,
  DesktopBridgeError,
  dialogOpenDirectory,
  dialogSaveFile,
  fsDelete,
  fsList,
  fsMove,
  fsReadText,
  fsScopeList,
  fsWriteText,
  getShellInfo,
  isForbiddenProviderHost,
  NICHEFORGE_GEMINI_OPENAI_COMPAT_BASE_URL,
  NICHEFORGE_PROVIDER_TIMEOUT_MS,
  NICHEFORGE_SCOPE_CACHE_KEY,
  NICHEFORGE_STORE_INDEX_PATH,
  NICHEFORGE_STORE_KEYS_PATH,
  NICHEFORGE_STORE_RUNS_DIR,
  NICHEFORGE_STORE_TMP_DIR,
  NICHEFORGE_VALIDATION_PROBE_PROMPT,
  NicheforgeKeyCreateSchema,
  NicheforgeKeySlotSchema,
  NicheforgeKeySlotsSchema,
  NicheforgeRunIndexEntrySchema,
  NicheforgeRunRecordSchema,
  processCancel,
  processStatus,
  secretsDelete,
  secretsSet,
  subscribeDesktopEvent,
  ytDlpDownload,
  ytDlpMetadata,
  ytDlpSubtitles,
} from '@fbuploadpro/contracts';
import {
  BridgeError,
  type BridgeMetadata,
  type DownloadProgress,
  type DownloadResult,
  type NicheforgeBridge,
  type ProviderCallResult,
  type SubtitleAvailability,
} from './bridge-adapter';
import type {
  NicheforgeKeyCreate,
  NicheforgeKeySlot,
  NicheforgeKeyValidation,
  NicheforgeRunIndexEntry,
  NicheforgeRunRecord,
} from '@fbuploadpro/contracts';

// Event payload wire shapes, described locally (the frozen contract
// validates these shapes bridge-side; the web side reads fields only).
type MediaDonePayload = {
  runId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  outputs: { scopeId: string; relativePath: string }[];
  error?: { code: string; message: string };
};
type MediaProgressPayload = { runId: string; percent: number | null; detail: string | null };
type AiDonePayload = {
  requestId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  output: string | null;
  error?: { code: string; message: string };
};

function mapBridgeError(err: unknown): BridgeError {
  if (err instanceof BridgeError) return err;
  if (err instanceof DesktopBridgeError) {
    switch (err.code) {
      case 'BRIDGE_UNAVAILABLE':
        return new BridgeError('not-ready', 'This feature requires the FBUploadPro desktop app.');
      case 'MEDIA_TIMEOUT':
      case 'AI_TIMEOUT':
        return new BridgeError('timeout', err.message);
      case 'FS_NOT_FOUND':
      case 'FS_ALREADY_EXISTS':
      case 'FS_NOT_EMPTY':
      case 'FS_NOT_TEXT':
      case 'FS_PERMISSION_DENIED':
      case 'FS_TOO_MANY_ENTRIES':
      case 'SCOPE_NOT_FOUND':
      case 'PATH_TRAVERSAL':
        return new BridgeError('storage', err.message);
      default:
        return new BridgeError('unknown', err.message);
    }
  }
  return new BridgeError('unknown', 'The desktop bridge returned an unexpected error.');
}

function isNotFound(err: unknown): boolean {
  return err instanceof DesktopBridgeError && (err.code === 'FS_NOT_FOUND' || err.code === 'SCOPE_NOT_FOUND');
}

function slotService(slotId: string): string {
  return `nicheforge-${slotId.replace(/-/g, '').slice(0, 12)}`;
}

function newSlotId(): string {
  return globalThis.crypto.randomUUID();
}

export class TauriNicheforgeBridge implements NicheforgeBridge {
  private scopeId: string | null = null;
  private currentDownloadRunId: string | null = null;
  private currentAiRequestId: string | null = null;
  private aiCancelRequested = false;

  setStoreScope(scopeId: string): void {
    this.scopeId = scopeId;
    try {
      globalThis.localStorage.setItem(NICHEFORGE_SCOPE_CACHE_KEY, scopeId);
    } catch {
      // Cache failure is non-fatal; the user re-picks the folder.
    }
  }

  getStoreScope(): string | null {
    return this.scopeId;
  }

  private requireScope(): string {
    if (this.scopeId === null) throw new BridgeError('not-ready', 'Choose a folder for your research first.');
    return this.scopeId;
  }

  async resolveStoreScope(): Promise<{ scopeId: string } | { needsPick: true }> {
    let cached: string | null = null;
    try {
      cached = globalThis.localStorage.getItem(NICHEFORGE_SCOPE_CACHE_KEY);
    } catch {
      cached = null;
    }
    try {
      const scopes = await fsScopeList();
      if (cached !== null) {
        const match = scopes.scopes.find((s) => s.scopeId === cached && s.kind === 'directory');
        if (match) {
          this.scopeId = cached;
          return { scopeId: cached };
        }
      }
    } catch (err) {
      throw mapBridgeError(err);
    }
    return { needsPick: true };
  }

  async pickStoreFolder(): Promise<{ scopeId: string } | { cancelled: true }> {
    const picked = await dialogOpenDirectory({ title: 'Choose a folder for NicheForge research' }).catch((err: unknown) => {
      throw mapBridgeError(err);
    });
    if (picked.cancelled || picked.directories.length === 0) return { cancelled: true };
    const scopeId = picked.directories[0].scopeId;
    this.setStoreScope(scopeId);
    return { scopeId };
  }

  async checkReadiness(): Promise<{ binaryReady: boolean; storageReady: boolean; detail?: string }> {
    try {
      const info = await getShellInfo();
      const binary = await binaryStatus('yt-dlp');
      return {
        binaryReady: binary.artifact.state === 'ready',
        storageReady: info.capabilities.secrets === true,
        ...(binary.artifact.state === 'ready' ? {} : { detail: 'The video download tool is still setting up.' }),
      };
    } catch (err) {
      throw mapBridgeError(err);
    }
  }

  async fetchMetadata(url: string): Promise<BridgeMetadata> {
    try {
      const res = await ytDlpMetadata({ url });
      return {
        title: res.metadata.title,
        uploader: res.metadata.uploader,
        durationSeconds: res.metadata.durationSeconds !== null ? Math.round(res.metadata.durationSeconds) : null,
        thumbnailUrl: res.metadata.thumbnailUrl,
      };
    } catch (err) {
      throw mapBridgeError(err);
    }
  }

  async fetchSubtitleAvailability(url: string): Promise<SubtitleAvailability> {
    try {
      const res = await ytDlpSubtitles({ url });
      return {
        manual: res.subtitles.map((s) => ({ language: s.language })),
        automatic: res.automaticCaptions.map((s) => ({ language: s.language })),
      };
    } catch (err) {
      throw mapBridgeError(err);
    }
  }

  async downloadMedia(input: {
    url: string;
    runId: string;
    videoId: string;
    subtitleLanguage: string | null;
    onProgress?: (progress: DownloadProgress) => void;
  }): Promise<DownloadResult> {
    const scopeId = this.requireScope();
    const dir = `${NICHEFORGE_STORE_TMP_DIR}/${input.runId}`;
    const template = `${dir}/%(id)s.%(ext)s`;
    // Subscribe BEFORE spawning so the done event cannot be missed; the
    // handler only accepts this job's runId (set once spawn returns).
    let wantedRunId: string | null = null;
    // Unlisten fns live in an array: TS narrows closure-assigned locals to
    // never at the finally block, but array elements keep their call type.
    const unlistens: Array<() => Promise<void> | void> = [];
    const eventDone = new Promise<MediaDonePayload>((resolve) => {
      subscribeDesktopEvent<MediaDonePayload>('desktop:media:done', (payload) => {
        if (wantedRunId !== null && payload.runId === wantedRunId) resolve(payload);
      })
        .then((u) => {
          unlistens.push(u);
        })
        .catch(() => undefined);
    });
    try {
      if (input.onProgress) {
        const progressUnlisten = await subscribeDesktopEvent<MediaProgressPayload>('desktop:media:progress', (payload) => {
          if (wantedRunId === null || payload.runId === wantedRunId) {
            input.onProgress?.({ percent: payload.percent, detail: payload.detail });
          }
        }).catch(() => null);
        if (progressUnlisten !== null) unlistens.push(progressUnlisten);
      }
      const job = await ytDlpDownload({
        url: input.url,
        outputScopeId: scopeId,
        outputTemplate: template,
        subtitles: input.subtitleLanguage !== null ? { languages: [input.subtitleLanguage], format: 'vtt' } : undefined,
        namespace: 'nicheforge',
      }).catch((err: unknown) => {
        throw mapBridgeError(err);
      });
      wantedRunId = job.runId;
      this.currentDownloadRunId = job.runId;
      // Completion: whichever settles first — the filtered media:done
      // event, or process_status polling (fallback if events are lost).
      const pollDone = (async (): Promise<MediaDonePayload> => {
        for (;;) {
          const status = await processStatus({ runId: job.runId }).catch(() => null);
          if (status !== null && status.state !== 'running') {
            return {
              runId: job.runId,
              status: status.state === 'cancelled' ? 'cancelled' : status.exitCode === 0 ? 'succeeded' : 'failed',
              outputs: [],
            };
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
      })();
      const done = await Promise.race([eventDone, pollDone]);
      this.currentDownloadRunId = null;
      if (done.status === 'cancelled') throw new BridgeError('cancelled', 'Download cancelled.');
      if (done.status === 'failed') {
        if (done.error?.code === 'MEDIA_TIMEOUT') throw new BridgeError('timeout', done.error.message);
        throw new BridgeError('unknown', done.error?.message ?? 'The video could not be downloaded.');
      }
      // Read the subtitle sidecar, if yt-dlp wrote one.
      let subtitleText: string | null = null;
      if (input.subtitleLanguage !== null) {
        try {
          const listing = await fsList({ scopeId, relativePath: dir, recursive: true });
          const sidecar = listing.entries.find(
            (e) =>
              e.kind === 'file' &&
              (e.relativePath.endsWith(`.${input.subtitleLanguage}.vtt`) ||
                e.relativePath.endsWith(`.${input.subtitleLanguage}.srt`) ||
                e.relativePath.endsWith('.vtt') ||
                e.relativePath.endsWith('.srt')),
          );
          if (sidecar) {
            const text = await fsReadText({ scopeId, relativePath: sidecar.relativePath });
            subtitleText = text.content;
          }
        } catch {
          subtitleText = null;
        }
      }
      return { subtitleText, subtitleLanguage: subtitleText !== null ? input.subtitleLanguage : null };
    } catch (err) {
      this.currentDownloadRunId = null;
      throw err instanceof BridgeError ? err : mapBridgeError(err);
    } finally {
      for (const unlisten of unlistens) void unlisten();
    }
  }

  async cancelCurrentOperation(): Promise<void> {
    if (this.currentDownloadRunId !== null) {
      const runId = this.currentDownloadRunId;
      this.currentDownloadRunId = null;
      await processCancel({ runId }).catch(() => undefined);
    }
    if (this.currentAiRequestId !== null) {
      const requestId = this.currentAiRequestId;
      this.aiCancelRequested = true;
      await aiCancel(requestId).catch(() => undefined);
    }
  }

  // -- Keys (metadata in keys.json; material in secrets under slot service) --

  private async readKeysFile(): Promise<NicheforgeKeySlot[]> {
    const scopeId = this.requireScope();
    let content: string;
    try {
      const res = await fsReadText({ scopeId, relativePath: NICHEFORGE_STORE_KEYS_PATH });
      content = res.content;
    } catch (err) {
      if (isNotFound(err)) return [];
      throw mapBridgeError(err);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content) as unknown;
    } catch {
      throw new BridgeError('storage', 'The saved keys file is damaged.');
    }
    const validated = NicheforgeKeySlotsSchema.safeParse(parsed);
    if (!validated.success) throw new BridgeError('storage', 'The saved keys file is damaged.');
    return validated.data;
  }

  private async writeKeysFile(slots: NicheforgeKeySlot[]): Promise<void> {
    const scopeId = this.requireScope();
    await this.atomicWrite(scopeId, NICHEFORGE_STORE_KEYS_PATH, JSON.stringify(slots, null, 2));
  }

  private async atomicWrite(scopeId: string, relativePath: string, content: string): Promise<void> {
    const tmpPath = `${relativePath}.tmp`;
    try {
      await fsWriteText({ scopeId, relativePath: tmpPath, content, createParents: true, overwrite: true });
    } catch (err) {
      throw mapBridgeError(err);
    }
    try {
      await fsMove({ sourceScopeId: scopeId, sourceRelativePath: tmpPath, destScopeId: scopeId, destRelativePath: relativePath, overwrite: true });
    } catch {
      // Move without overwrite support: delete then move.
      await fsDelete({ scopeId, relativePath, recursive: false }).catch(() => undefined);
      try {
        await fsMove({ sourceScopeId: scopeId, sourceRelativePath: tmpPath, destScopeId: scopeId, destRelativePath: relativePath, overwrite: true });
      } catch (err) {
        throw mapBridgeError(err);
      }
    }
  }

  async listKeySlots(): Promise<NicheforgeKeySlot[]> {
    return this.readKeysFile();
  }

  async storeKey(input: NicheforgeKeyCreate): Promise<NicheforgeKeySlot> {
    const parsed = NicheforgeKeyCreateSchema.safeParse(input);
    if (!parsed.success) throw new BridgeError('unknown', parsed.error.issues[0]?.message ?? 'Invalid key.');
    const value = parsed.data;
    if (value.provider === 'openai-compatible' && (value.baseUrl === undefined || value.baseUrl === '')) {
      throw new BridgeError('unknown', 'A base URL is required for OpenAI-compatible providers.');
    }
    const slotId = newSlotId();
    const service = slotService(slotId);
    try {
      await secretsSet({ service, keyName: 'ai', value: value.key });
    } catch (err) {
      throw mapBridgeError(err);
    }
    const slot: NicheforgeKeySlot = {
      id: slotId,
      provider: value.provider,
      label: value.label,
      maskedSuffix: value.key.slice(-4),
      createdAt: new Date().toISOString(),
      lastValidatedAt: null,
      lastValidation: null,
      cooldownUntil: null,
      service,
      baseUrl: value.baseUrl,
      modelId: value.modelId,
    };
    const validated = NicheforgeKeySlotSchema.safeParse(slot);
    if (!validated.success) {
      await secretsDelete({ service, keyName: 'ai' }).catch(() => undefined);
      throw new BridgeError('unknown', 'The key could not be saved.');
    }
    const slots = await this.readKeysFile();
    slots.push(validated.data);
    await this.writeKeysFile(slots);
    return validated.data;
  }

  async deleteKey(slotId: string): Promise<void> {
    const slots = await this.readKeysFile();
    const slot = slots.find((s) => s.id === slotId);
    if (slot) await secretsDelete({ service: slot.service, keyName: 'ai' }).catch(() => undefined);
    await this.writeKeysFile(slots.filter((s) => s.id !== slotId));
  }

  async updateKeySlot(slot: NicheforgeKeySlot): Promise<void> {
    const parsed = NicheforgeKeySlotSchema.safeParse(slot);
    if (!parsed.success) throw new BridgeError('unknown', 'Invalid key metadata.');
    const slots = await this.readKeysFile();
    await this.writeKeysFile(slots.map((s) => (s.id === slot.id ? parsed.data : s)));
  }

  async reorderKeySlots(idsInOrder: string[]): Promise<void> {
    const slots = await this.readKeysFile();
    const byId = new Map(slots.map((s) => [s.id, s]));
    const ordered = idsInOrder.map((id) => byId.get(id)).filter((s): s is NicheforgeKeySlot => s !== undefined);
    const rest = slots.filter((s) => !idsInOrder.includes(s.id));
    await this.writeKeysFile([...ordered, ...rest]);
  }

  private bridgeProviderFor(slot: NicheforgeKeySlot): { provider: 'openai-compatible'; baseUrl: string } {
    if (slot.provider === 'gemini') {
      return { provider: 'openai-compatible', baseUrl: slot.baseUrl ?? NICHEFORGE_GEMINI_OPENAI_COMPAT_BASE_URL };
    }
    if (slot.baseUrl === undefined || slot.baseUrl === '') {
      throw new BridgeError('unknown', 'This key has no base URL configured.');
    }
    if (isForbiddenProviderHost(slot.baseUrl)) {
      throw new BridgeError('unknown', 'This key’s base URL points at an FBUploadPro host.');
    }
    return { provider: 'openai-compatible', baseUrl: slot.baseUrl };
  }

  async validateKey(slot: NicheforgeKeySlot): Promise<NicheforgeKeyValidation> {
    let mapped: { provider: 'openai-compatible'; baseUrl: string };
    try {
      mapped = this.bridgeProviderFor(slot);
    } catch {
      return 'invalid';
    }
    const model = slot.modelId ?? defaultModelIdForProvider(slot.provider);
    if (model === null) return 'invalid';
    try {
      await aiComplete({
        service: slot.service,
        provider: mapped.provider,
        baseUrl: mapped.baseUrl,
        model,
        messages: [{ role: 'user', content: NICHEFORGE_VALIDATION_PROBE_PROMPT }],
        maxTokens: 10,
        timeoutMs: 30000,
      });
      return 'valid';
    } catch (err) {
      if (err instanceof DesktopBridgeError) {
        if (err.code === 'AI_KEY_MISSING' || err.code === 'VALIDATION_ERROR') return 'invalid';
        if (err.code === 'AI_RATE_LIMITED') return 'quota-exhausted';
        return 'unreachable';
      }
      return 'unreachable';
    }
  }

  async callProvider(input: { slot: NicheforgeKeySlot; modelId: string; prompt: string }): Promise<ProviderCallResult> {
    let mapped: { provider: 'openai-compatible'; baseUrl: string };
    try {
      mapped = this.bridgeProviderFor(input.slot);
    } catch (err) {
      return { status: 'error', kind: 'unknown', detail: err instanceof Error ? err.message : 'Invalid provider configuration.' };
    }
    this.aiCancelRequested = false;
    let stream: { requestId: string };
    try {
      stream = await aiCompleteStream({
        service: input.slot.service,
        provider: mapped.provider,
        baseUrl: mapped.baseUrl,
        model: input.modelId,
        messages: [
          { role: 'system', content: 'You return strict JSON only, with no markdown fences and no commentary.' },
          { role: 'user', content: input.prompt },
        ],
        maxTokens: 4000,
        temperature: 0.2,
        timeoutMs: NICHEFORGE_PROVIDER_TIMEOUT_MS,
        namespace: 'nicheforge',
      });
    } catch (err) {
      if (err instanceof DesktopBridgeError) {
        return { status: 'error', kind: classifyBridgeAiError(err.code), detail: err.message };
      }
      return { status: 'error', kind: 'unknown', detail: 'The AI provider call failed.' };
    }
    this.currentAiRequestId = stream.requestId;
    try {
      const result = await new Promise<ProviderCallResult>((resolve) => {
        let settled = false;
        let unlisten: (() => Promise<void> | void) | null = null;
        const settle = (value: ProviderCallResult) => {
          if (settled) return;
          settled = true;
          if (timeoutId !== undefined) clearTimeout(timeoutId);
          if (unlisten) void unlisten();
          resolve(value);
        };
        const timeoutId = setTimeout(() => {
          void aiCancel(stream.requestId).catch(() => undefined);
          settle({ status: 'error', kind: 'timeout', detail: 'The AI provider took too long to respond.' });
        }, NICHEFORGE_PROVIDER_TIMEOUT_MS + 5000);
        subscribeDesktopEvent<AiDonePayload>('desktop:ai:done', (payload) => {
          if (payload.requestId !== stream.requestId) return;
          if (payload.status === 'succeeded') settle({ status: 'ok', text: payload.output ?? '' });
          else if (payload.status === 'cancelled') settle({ status: 'cancelled' });
          else {
            const code = payload.error?.code ?? 'AI_PROVIDER_ERROR';
            settle({ status: 'error', kind: classifyBridgeAiError(code), detail: payload.error?.message ?? 'The AI provider call failed.' });
          }
        })
          .then((u) => {
            unlisten = u;
          })
          .catch(() => settle({ status: 'error', kind: 'unreachable', detail: 'The AI provider could not be reached.' }));
      });
      return result;
    } finally {
      this.currentAiRequestId = null;
      this.aiCancelRequested = false;
    }
  }

  // -- Runs (fs under the store scope) --

  async readRun(runId: string): Promise<NicheforgeRunRecord> {
    const scopeId = this.requireScope();
    try {
      const res = await fsReadText({ scopeId, relativePath: `${NICHEFORGE_STORE_RUNS_DIR}/${runId}/run.json` });
      const parsed = NicheforgeRunRecordSchema.safeParse(JSON.parse(res.content) as unknown);
      if (!parsed.success) throw new BridgeError('storage', 'The research run file is damaged.');
      return parsed.data;
    } catch (err) {
      throw err instanceof BridgeError ? err : mapBridgeError(err);
    }
  }

  async writeRun(run: NicheforgeRunRecord): Promise<void> {
    const scopeId = this.requireScope();
    const parsed = NicheforgeRunRecordSchema.safeParse(run);
    if (!parsed.success) throw new BridgeError('storage', 'The research run failed validation before saving.');
    await this.atomicWrite(scopeId, `${NICHEFORGE_STORE_RUNS_DIR}/${run.id}/run.json`, JSON.stringify(parsed.data, null, 2));
  }

  async readIndex(): Promise<NicheforgeRunIndexEntry[]> {
    const scopeId = this.requireScope();
    try {
      const res = await fsReadText({ scopeId, relativePath: NICHEFORGE_STORE_INDEX_PATH });
      const parsed = NicheforgeRunIndexEntrySchema.array().safeParse(JSON.parse(res.content) as unknown);
      if (!parsed.success) throw new BridgeError('storage', 'The research list file is damaged.');
      return parsed.data;
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err instanceof BridgeError ? err : mapBridgeError(err);
    }
  }

  async writeIndex(entries: NicheforgeRunIndexEntry[]): Promise<void> {
    const scopeId = this.requireScope();
    await this.atomicWrite(scopeId, NICHEFORGE_STORE_INDEX_PATH, JSON.stringify(entries, null, 2));
  }

  async deleteRun(runId: string): Promise<void> {
    const scopeId = this.requireScope();
    await fsDelete({ scopeId, relativePath: `${NICHEFORGE_STORE_RUNS_DIR}/${runId}`, recursive: true }).catch((err: unknown) => {
      if (!isNotFound(err)) throw mapBridgeError(err);
    });
  }

  async cleanRunTemp(runId: string): Promise<void> {
    const scopeId = this.requireScope();
    await fsDelete({ scopeId, relativePath: `${NICHEFORGE_STORE_TMP_DIR}/${runId}`, recursive: true }).catch((err: unknown) => {
      if (!isNotFound(err)) throw mapBridgeError(err);
    });
  }

  async saveMarkdownReport(filename: string, markdown: string): Promise<{ saved: boolean; cancelled: boolean }> {
    try {
      const picked = await dialogSaveFile({
        title: 'Save research report',
        defaultName: filename,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (picked.cancelled || picked.scopeId === null) return { saved: false, cancelled: true };
      await fsWriteText({ scopeId: picked.scopeId, relativePath: '', content: markdown, overwrite: true });
      return { saved: true, cancelled: false };
    } catch (err) {
      throw mapBridgeError(err);
    }
  }
}

/** Production adapter singleton (created lazily so importing this module
 *  never touches the bridge — tests import the interface + stubs only). */
let singleton: TauriNicheforgeBridge | null = null;
export function getTauriNicheforgeBridge(): TauriNicheforgeBridge {
  if (singleton === null) singleton = new TauriNicheforgeBridge();
  return singleton;
}
