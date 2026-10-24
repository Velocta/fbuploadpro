/**
 * NicheForge local store layer (spec 147, plan §4).
 *
 * Thin wrapper over the bridge's filesystem operations. Every workspace
 * mount re-reads the index and every detail open re-reads the run file —
 * no stale cache survives a restart. A corrupt run file surfaces as a
 * damaged sentinel, never as a crash.
 */
import {
  NICHEFORGE_FAILURE_COPY,
  NicheforgeRunIndexEntrySchema,
  NicheforgeRunRecordSchema,
  type NicheforgeRunIndexEntry,
  type NicheforgeRunRecord,
} from '@fbuploadpro/contracts';
import { BridgeError, type NicheforgeBridge } from './bridge-adapter';

export class DamagedRunError extends Error {
  constructor(public readonly runId: string) {
    super('This research run is damaged and cannot be opened.');
    this.name = 'DamagedRunError';
  }
}

export function indexEntryForRun(run: NicheforgeRunRecord): NicheforgeRunIndexEntry {
  return {
    id: run.id,
    title: run.title,
    status: run.status,
    createdAt: run.createdAt,
    videoCount: run.videos.length,
    successCount: run.videos.filter((v) => v.status === 'done' && v.breakdown !== null).length,
  };
}

/** Read the index; a missing index is an empty library, a corrupt one is
 *  a loud storage error (the list renders a damaged state, not silence). */
export async function listRuns(bridge: NicheforgeBridge): Promise<NicheforgeRunIndexEntry[]> {
  const entries = await bridge.readIndex();
  const parsed = NicheforgeRunIndexEntrySchema.array().safeParse(entries);
  if (!parsed.success) throw new BridgeError('storage', 'The research list could not be read.');
  return [...parsed.data].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getRun(bridge: NicheforgeBridge, runId: string): Promise<NicheforgeRunRecord> {
  try {
    const run = await bridge.readRun(runId);
    const parsed = NicheforgeRunRecordSchema.safeParse(run);
    if (!parsed.success) throw new DamagedRunError(runId);
    return parsed.data;
  } catch (err) {
    if (err instanceof DamagedRunError) throw err;
    if (err instanceof BridgeError && err.kind === 'storage') throw new DamagedRunError(runId);
    throw err;
  }
}

/** Save a run and keep the index in sync in the same logical save. */
export async function saveRun(bridge: NicheforgeBridge, run: NicheforgeRunRecord): Promise<void> {
  const parsed = NicheforgeRunRecordSchema.safeParse(run);
  if (!parsed.success) throw new BridgeError('storage', 'The research run failed validation before saving.');
  await bridge.writeRun(parsed.data);
  let entries: NicheforgeRunIndexEntry[];
  try {
    entries = await bridge.readIndex();
  } catch {
    entries = [];
  }
  const next = entries.filter((e) => e.id !== run.id);
  next.push(indexEntryForRun(parsed.data));
  await bridge.writeIndex(next);
}

export async function deleteRunRecord(bridge: NicheforgeBridge, runId: string): Promise<void> {
  await bridge.deleteRun(runId);
  let entries: NicheforgeRunIndexEntry[];
  try {
    entries = await bridge.readIndex();
  } catch {
    entries = [];
  }
  await bridge.writeIndex(entries.filter((e) => e.id !== runId));
}

export function searchRuns(entries: NicheforgeRunIndexEntry[], query: string): NicheforgeRunIndexEntry[] {
  const q = query.trim().toLowerCase();
  if (q === '') return entries;
  return entries.filter((e) => e.title.toLowerCase().includes(q));
}

const TERMINAL = new Set(['done', 'failed', 'cancelled', 'interrupted']);

/**
 * On app start, runs left non-terminal by a previous session are marked
 * `interrupted` with partial results kept and temp files cleaned. No
 * silent resume, no orphaned process.
 */
export async function reconcileInterruptedRuns(bridge: NicheforgeBridge): Promise<number> {
  let entries: NicheforgeRunIndexEntry[];
  try {
    entries = await bridge.readIndex();
  } catch {
    return 0;
  }
  let reconciled = 0;
  for (const entry of entries) {
    if (TERMINAL.has(entry.status)) continue;
    let run: NicheforgeRunRecord;
    try {
      run = await bridge.readRun(entry.id);
    } catch {
      continue;
    }
    const parsed = NicheforgeRunRecordSchema.safeParse(run);
    if (!parsed.success) continue;
    const next: NicheforgeRunRecord = {
      ...parsed.data,
      status: 'interrupted',
      updatedAt: new Date().toISOString(),
      completedAt: parsed.data.completedAt ?? new Date().toISOString(),
      videos: parsed.data.videos.map((v) =>
        v.status === 'downloading' || v.status === 'analysing'
          ? { ...v, status: 'failed' as const, failureReason: 'INTERRUPTED' as const, failureDetail: NICHEFORGE_FAILURE_COPY.INTERRUPTED }
          : v,
      ),
    };
    try {
      await saveRun(bridge, next);
      await bridge.cleanRunTemp(entry.id);
      reconciled += 1;
    } catch {
      // A run we cannot persist stays as-is; the next mount retries.
    }
  }
  return reconciled;
}
