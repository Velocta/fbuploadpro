/**
 * Worker heartbeat persistence (spec 116).
 *
 * The scheduled handler upserts one row per tick — including the
 * early-return / skip paths — so the web internal health tier can detect a
 * dead or silently-skipping publishing pipeline. Skip reasons are stable
 * machine codes, never raw error text.
 */

export const WORKER_HEARTBEAT_NAME = 'fbuploadpro-worker';

export type HeartbeatSkipReason =
  | 'missing_token_encryption_key'
  | 'db_unconfigured'
  | 'dispatch_error';

export interface HeartbeatRecord {
  success: boolean;
  claimed?: number;
  settled?: number;
  skipReason?: HeartbeatSkipReason | null;
  now?: Date;
}

interface HeartbeatDb {
  from?: (table: string) => {
    upsert: (
      row: Record<string, unknown>,
      options: { onConflict: string }
    ) => Promise<{ error: unknown }>;
  };
  query?: (
    text: string,
    params?: unknown[]
  ) => Promise<unknown>;
}

/**
 * Writes the heartbeat row. Never throws: a heartbeat failure must not
 * break the dispatch cycle it is observing. Returns whether it was written.
 */
export async function recordHeartbeat(
  db: HeartbeatDb | null | undefined,
  record: HeartbeatRecord
): Promise<boolean> {
  if (!db) return false;
  const now = (record.now ?? new Date()).toISOString();
  const row: Record<string, unknown> = {
    worker_name: WORKER_HEARTBEAT_NAME,
    last_run_at: now,
    last_claimed_count: record.claimed ?? 0,
    last_settled_count: record.settled ?? 0,
    last_skip_reason: record.success ? null : (record.skipReason ?? null),
    updated_at: now,
  };
  if (record.success) {
    row.last_success_at = now;
  }

  try {
    if (typeof db.from === 'function') {
      const { error } = await db
        .from('worker_heartbeats')
        .upsert(row, { onConflict: 'worker_name' });
      if (error) {
        console.error('[heartbeat] upsert failed:', error);
        return false;
      }
      return true;
    }
    if (typeof db.query === 'function') {
      await db.query(
        `INSERT INTO worker_heartbeats
           (worker_name, last_run_at, last_success_at, last_claimed_count, last_settled_count, last_skip_reason, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $2)
         ON CONFLICT (worker_name) DO UPDATE SET
           last_run_at = EXCLUDED.last_run_at,
           last_success_at = COALESCE(EXCLUDED.last_success_at, worker_heartbeats.last_success_at),
           last_claimed_count = EXCLUDED.last_claimed_count,
           last_settled_count = EXCLUDED.last_settled_count,
           last_skip_reason = EXCLUDED.last_skip_reason,
           updated_at = EXCLUDED.updated_at`,
        [
          WORKER_HEARTBEAT_NAME,
          now,
          record.success ? now : null,
          record.claimed ?? 0,
          record.settled ?? 0,
          record.success ? null : (record.skipReason ?? null),
        ]
      );
      return true;
    }
  } catch (err) {
    console.error('[heartbeat] write failed:', err);
  }
  return false;
}

/** True when a raw TOKEN_ENCRYPTION_KEY value is present and well-formed (64 hex chars or 32 bytes). */
export function isTokenEncryptionKeyWellFormed(raw: string | undefined | null): boolean {
  if (!raw || raw.trim().length === 0) return false;
  const trimmed = raw.trim();
  if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) return true;
  return new TextEncoder().encode(trimmed).length === 32;
}
