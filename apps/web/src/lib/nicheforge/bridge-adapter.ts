/**
 * NicheForge bridge adapter INTERFACE (spec 147, plan §2).
 *
 * This file contains NO Tauri command names — the production implementation
 * (tauri-bridge-adapter.ts) binds this interface to the frozen desktop
 * bridge contract v1.0. Tests run against stub doubles of this interface
 * only; production components never import a stub.
 */
import {
  type NicheforgeKeyCreate,
  type NicheforgeKeySlot,
  type NicheforgeKeyValidation,
  type NicheforgeProviderErrorKind,
  type NicheforgeRunIndexEntry,
  type NicheforgeRunRecord,
} from '@fbuploadpro/contracts';

export type BridgeErrorKind = 'not-ready' | 'cancelled' | 'timeout' | 'storage' | 'provider' | 'unknown';

export class BridgeError extends Error {
  readonly kind: BridgeErrorKind;
  constructor(kind: BridgeErrorKind, message: string) {
    super(message);
    this.name = 'BridgeError';
    this.kind = kind;
  }
}

export interface BridgeMetadata {
  title: string | null;
  uploader: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
}

export interface SubtitleAvailability {
  manual: { language: string }[];
  automatic: { language: string }[];
}

export interface DownloadProgress {
  percent: number | null;
  detail: string | null;
}

export interface DownloadResult {
  subtitleText: string | null;
  subtitleLanguage: string | null;
}

export type ProviderCallResult =
  | { status: 'ok'; text: string }
  | { status: 'error'; kind: NicheforgeProviderErrorKind; detail: string }
  | { status: 'cancelled' };

export interface NicheforgeBridge {
  checkReadiness(): Promise<{ binaryReady: boolean; storageReady: boolean; detail?: string }>;
  /** Resolve the research-store folder scope (cached id, verified live). */
  resolveStoreScope(): Promise<{ scopeId: string } | { needsPick: true }>;
  /** Ask the user to pick a research folder (save-dialog scope grant). */
  pickStoreFolder(): Promise<{ scopeId: string } | { cancelled: true }>;
  setStoreScope(scopeId: string): void;
  getStoreScope(): string | null;

  fetchMetadata(url: string): Promise<BridgeMetadata>;
  fetchSubtitleAvailability(url: string): Promise<SubtitleAvailability>;
  downloadMedia(input: {
    url: string;
    runId: string;
    videoId: string;
    subtitleLanguage: string | null;
    onProgress?: (progress: DownloadProgress) => void;
  }): Promise<DownloadResult>;
  /** Cancel the currently in-flight download or provider call, if any. */
  cancelCurrentOperation(): Promise<void>;

  listKeySlots(): Promise<NicheforgeKeySlot[]>;
  storeKey(input: NicheforgeKeyCreate): Promise<NicheforgeKeySlot>;
  deleteKey(slotId: string): Promise<void>;
  updateKeySlot(slot: NicheforgeKeySlot): Promise<void>;
  reorderKeySlots(idsInOrder: string[]): Promise<void>;
  validateKey(slot: NicheforgeKeySlot): Promise<NicheforgeKeyValidation>;
  callProvider(input: { slot: NicheforgeKeySlot; modelId: string; prompt: string }): Promise<ProviderCallResult>;

  readRun(runId: string): Promise<NicheforgeRunRecord>;
  writeRun(run: NicheforgeRunRecord): Promise<void>;
  readIndex(): Promise<NicheforgeRunIndexEntry[]>;
  writeIndex(entries: NicheforgeRunIndexEntry[]): Promise<void>;
  deleteRun(runId: string): Promise<void>;
  cleanRunTemp(runId: string): Promise<void>;
  saveMarkdownReport(filename: string, markdown: string): Promise<{ saved: boolean; cancelled: boolean }>;
}
