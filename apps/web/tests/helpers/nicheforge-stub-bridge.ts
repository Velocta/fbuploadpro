/**
 * Stub NicheForge bridge for tests ONLY. Never imported by production
 * components. Drives the pipeline from canned metadata/subtitles and a
 * scripted provider handler, with an in-memory run store.
 */
import {
  NICHEFORGE_STORE_KEYS_PATH,
  type NicheforgeKeyCreate,
  type NicheforgeKeySlot,
  type NicheforgeKeyValidation,
  type NicheforgeRunIndexEntry,
  type NicheforgeRunRecord,
} from '@fbuploadpro/contracts';
import {
  BridgeError,
  type BridgeMetadata,
  type DownloadResult,
  type NicheforgeBridge,
  type ProviderCallResult,
  type SubtitleAvailability,
} from '@/lib/nicheforge/bridge-adapter';

void NICHEFORGE_STORE_KEYS_PATH;

export interface StubVideo {
  metadata: BridgeMetadata;
  subtitles?: SubtitleAvailability;
  subtitleText?: string | null;
  downloadError?: 'failed' | 'timeout' | 'cancelled';
}

export interface StubBridgeConfig {
  binaryReady?: boolean;
  storageReady?: boolean;
  videos?: Record<string, StubVideo>;
  keys?: NicheforgeKeySlot[];
  provider?: (call: { slot: NicheforgeKeySlot; modelId: string; prompt: string; callIndex: number }) => ProviderCallResult;
  validateResult?: NicheforgeKeyValidation;
}

function slotId(n: number): string {
  return `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
}

export function makeStubSlot(overrides: Partial<NicheforgeKeySlot> & { n: number }): NicheforgeKeySlot {
  const { n, ...rest } = overrides;
  return {
    id: slotId(n),
    provider: 'gemini',
    label: `Key ${n}`,
    maskedSuffix: 'abcd',
    createdAt: '2026-10-24T00:00:00Z',
    lastValidatedAt: null,
    lastValidation: null,
    cooldownUntil: null,
    service: `nicheforge-stub${n}`,
    ...rest,
  };
}

export class StubNicheforgeBridge implements NicheforgeBridge {
  readonly runs = new Map<string, NicheforgeRunRecord>();
  readonly index: NicheforgeRunIndexEntry[] = [];
  readonly cleanCalls: string[] = [];
  readonly downloadCalls: string[] = [];
  readonly providerCalls: { slot: NicheforgeKeySlot; modelId: string; prompt: string }[] = [];
  keys: NicheforgeKeySlot[];
  private scopeId: string | null = 'stub-scope';
  private readonly config: StubBridgeConfig;

  constructor(config: StubBridgeConfig = {}) {
    this.config = config;
    this.keys = config.keys ?? [makeStubSlot({ n: 1 })];
  }

  async checkReadiness() {
    return {
      binaryReady: this.config.binaryReady ?? true,
      storageReady: this.config.storageReady ?? true,
    };
  }

  async resolveStoreScope() {
    return { scopeId: 'stub-scope' } as const;
  }

  async pickStoreFolder() {
    return { scopeId: 'stub-scope' } as const;
  }

  setStoreScope(scopeId: string) {
    this.scopeId = scopeId;
  }

  getStoreScope() {
    return this.scopeId;
  }

  private videoFor(url: string): StubVideo {
    return (
      this.config.videos?.[url] ?? {
        metadata: { title: `Video for ${url}`, uploader: 'Some channel', durationSeconds: 42, thumbnailUrl: null },
        subtitles: { manual: [{ language: 'en' }], automatic: [] },
        subtitleText: 'Hello world this is a caption.',
      }
    );
  }

  async fetchMetadata(url: string): Promise<BridgeMetadata> {
    return this.videoFor(url).metadata;
  }

  async fetchSubtitleAvailability(url: string): Promise<SubtitleAvailability> {
    return this.videoFor(url).subtitles ?? { manual: [], automatic: [] };
  }

  async downloadMedia(input: { url: string; runId: string; videoId: string; subtitleLanguage: string | null }): Promise<DownloadResult> {
    this.downloadCalls.push(input.url);
    const video = this.videoFor(input.url);
    if (video.downloadError === 'failed') throw new BridgeError('unknown', 'Download failed.');
    if (video.downloadError === 'timeout') throw new BridgeError('timeout', 'Download timed out.');
    if (video.downloadError === 'cancelled') throw new BridgeError('cancelled', 'Download cancelled.');
    const text = input.subtitleLanguage !== null ? (video.subtitleText ?? null) : null;
    return { subtitleText: text, subtitleLanguage: text !== null ? input.subtitleLanguage : null };
  }

  async cancelCurrentOperation() {
    // No-op in the stub; cancellation is observed via the controller flag.
  }

  async listKeySlots() {
    return [...this.keys];
  }

  async storeKey(input: NicheforgeKeyCreate): Promise<NicheforgeKeySlot> {
    const slot = makeStubSlot({
      n: this.keys.length + 1,
      provider: input.provider,
      label: input.label,
      maskedSuffix: input.key.slice(-4),
      baseUrl: input.baseUrl,
      modelId: input.modelId,
    });
    this.keys.push(slot);
    return slot;
  }

  async deleteKey(slotId: string) {
    this.keys = this.keys.filter((k) => k.id !== slotId);
  }

  async updateKeySlot(slot: NicheforgeKeySlot) {
    this.keys = this.keys.map((k) => (k.id === slot.id ? slot : k));
  }

  async reorderKeySlots(idsInOrder: string[]) {
    const byId = new Map(this.keys.map((k) => [k.id, k]));
    const ordered = idsInOrder.map((id) => byId.get(id)).filter((k): k is NicheforgeKeySlot => k !== undefined);
    const rest = this.keys.filter((k) => !idsInOrder.includes(k.id));
    this.keys = [...ordered, ...rest];
  }

  async validateKey(): Promise<NicheforgeKeyValidation> {
    return this.config.validateResult ?? 'valid';
  }

  async callProvider(input: { slot: NicheforgeKeySlot; modelId: string; prompt: string }): Promise<ProviderCallResult> {
    const callIndex = this.providerCalls.length;
    this.providerCalls.push(input);
    if (this.config.provider) return this.config.provider({ ...input, callIndex });
    return { status: 'error', kind: 'unknown', detail: 'No stub provider configured.' };
  }

  async readRun(runId: string) {
    const run = this.runs.get(runId);
    if (!run) throw new BridgeError('storage', 'Run not found.');
    return run;
  }

  async writeRun(run: NicheforgeRunRecord) {
    this.runs.set(run.id, structuredClone(run));
  }

  async readIndex() {
    return [...this.index];
  }

  async writeIndex(entries: NicheforgeRunIndexEntry[]) {
    this.index.length = 0;
    this.index.push(...entries);
  }

  async deleteRun(runId: string) {
    this.runs.delete(runId);
  }

  async cleanRunTemp(runId: string) {
    this.cleanCalls.push(runId);
  }

  async saveMarkdownReport() {
    return { saved: true, cancelled: false };
  }
}

export const BREAKDOWN_JSON = JSON.stringify({
  hook: 'The mug complains in the first second',
  hookType: 'bold-claim',
  structure: ['Hook: complaint', 'Payoff: sip'],
  pacing: 'Fast cuts, no dead air.',
  topic: 'Office coffee',
  format: 'short-form vertical',
  whyItWorked: 'It names a shared annoyance immediately. The payoff lands fast.',
  replicableTakeaways: ['Open on the complaint, not the setup.'],
  transcriptAvailable: true,
  transcriptTruncated: false,
  confidence: 'high',
  confidenceReason: 'Full transcript analysed.',
});

export const REPORT_JSON = JSON.stringify({
  recurringHooks: [{ hookType: 'bold-claim', count: 2, exampleVideoIds: [] }],
  commonFormats: [{ format: 'short-form vertical', count: 2 }],
  lengthInsights: ['Videos cluster under 60 seconds.'],
  postingPatterns: [],
  topicClusters: [{ topic: 'Office coffee', videoIds: [] }],
  actionablePlaybook: [{ kind: 'do', text: 'Open on the complaint.', sourceVideoIds: [] }],
  coverage: { attempted: 2, analysed: 2, transcriptBased: 2, metadataOnly: 0 },
  modelId: 'gemini-2.5-flash',
  provider: 'gemini',
  promptVersion: '1',
  generatedAt: '2026-10-24T00:01:00Z',
});

/** Default scripted provider: breakdown JSON for analysis prompts,
 *  report JSON for mining prompts (detected by prompt wording). */
export function defaultProviderHandler(call: { prompt: string }): ProviderCallResult {
  if (call.prompt.includes('mine patterns')) return { status: 'ok', text: REPORT_JSON };
  return { status: 'ok', text: BREAKDOWN_JSON };
}
