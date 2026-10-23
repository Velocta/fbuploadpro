/**
 * Retention cleanup job (spec 139 residue): unit tests for the batch
 * loop, env flags, and cron routing. The terminal-only deletion
 * guarantee itself is proven against real Postgres by the SQL rig in
 * tests/retention-rpc — here the RPC is mocked and the WORKER side is
 * what is under test: predicate arguments (cutoff = now − 30 days),
 * loop termination, the per-run cap, the kill-switch, dry-run, error
 * propagation, and that the retention cron routes to this job only.
 */
import { describe, expect, it, vi } from 'vitest';
import { handleScheduled, RETENTION_CRON, type Env } from '../src/index.js';
import {
  runRetentionCleanup,
  RETENTION_DAYS,
  type RetentionDbClient,
  type RetentionRpcResult,
} from '../src/retention.js';

const NOW = new Date('2026-10-24T02:00:00.000Z');
const EXPECTED_CUTOFF = new Date(NOW.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

function counts(publishLogsDeleted: number, queueItemsDeleted: number): RetentionRpcResult {
  return {
    data: [{ publish_logs_deleted: publishLogsDeleted, queue_items_deleted: queueItemsDeleted }],
    error: null,
  };
}

/** Mock DB whose rpc() replays a scripted sequence (last entry repeats). */
function mockDb(script: RetentionRpcResult[]): { db: RetentionDbClient; calls: RpcCall[] } {
  const calls: RpcCall[] = [];
  let index = 0;
  const db: RetentionDbClient = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      const result = script[Math.min(index, script.length - 1)] as RetentionRpcResult;
      index++;
      return result;
    }),
  };
  return { db, calls };
}

describe('runRetentionCleanup', () => {
  it('passes the 30-day cutoff and loops until both tables come back short', async () => {
    const { db, calls } = mockDb([counts(3, 3), counts(3, 1), counts(1, 0)]);

    const result = await runRetentionCleanup(db, {}, NOW, { batchSize: 3, maxBatchesPerRun: 10 });

    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.fn).toBe('cleanup_expired_publish_history');
      expect(call.args).toEqual({
        p_cutoff: EXPECTED_CUTOFF,
        p_batch_size: 3,
        p_dry_run: false,
      });
    }
    expect(result).toEqual({
      skipped: false,
      dryRun: false,
      batches: 3,
      publishLogsDeleted: 7,
      queueItemsDeleted: 4,
      capReached: false,
      cutoff: EXPECTED_CUTOFF,
    });
  });

  it('a single empty round ends the run (idempotent steady state)', async () => {
    const { db, calls } = mockDb([counts(0, 0)]);

    const result = await runRetentionCleanup(db, {}, NOW, { batchSize: 5 });

    expect(calls).toHaveLength(1);
    expect(result.batches).toBe(1);
    expect(result.publishLogsDeleted).toBe(0);
    expect(result.queueItemsDeleted).toBe(0);
    expect(result.capReached).toBe(false);
  });

  it('stops at the per-run batch cap while a full batch is still coming back', async () => {
    const { db, calls } = mockDb([counts(2, 2)]);

    const result = await runRetentionCleanup(db, {}, NOW, { batchSize: 2, maxBatchesPerRun: 3 });

    expect(calls).toHaveLength(3);
    expect(result.batches).toBe(3);
    expect(result.publishLogsDeleted).toBe(6);
    expect(result.queueItemsDeleted).toBe(6);
    expect(result.capReached).toBe(true);
  });

  it('keeps looping while EITHER table still returns a full batch', async () => {
    const { db, calls } = mockDb([counts(4, 0), counts(0, 0)]);

    const result = await runRetentionCleanup(db, {}, NOW, { batchSize: 4 });

    expect(calls).toHaveLength(2);
    expect(result.publishLogsDeleted).toBe(4);
    expect(result.queueItemsDeleted).toBe(0);
    expect(result.capReached).toBe(false);
  });

  it('kill-switch: RETENTION_DISABLED skips the run without any RPC call', async () => {
    const { db, calls } = mockDb([counts(9, 9)]);

    const result = await runRetentionCleanup(db, { RETENTION_DISABLED: 'true' }, NOW);

    expect(calls).toHaveLength(0);
    expect(result.skipped).toBe(true);
    expect(result.publishLogsDeleted).toBe(0);
    expect(result.queueItemsDeleted).toBe(0);
    expect(result.cutoff).toBe(EXPECTED_CUTOFF);
  });

  it('dry-run: exactly one count-only RPC call, nothing deleted by the loop', async () => {
    const { db, calls } = mockDb([counts(123, 45)]);

    const result = await runRetentionCleanup(db, { RETENTION_DRY_RUN: '1' }, NOW, { batchSize: 7 });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.args).toEqual({
      p_cutoff: EXPECTED_CUTOFF,
      p_batch_size: 7,
      p_dry_run: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.batches).toBe(1);
    expect(result.publishLogsDeleted).toBe(123);
    expect(result.queueItemsDeleted).toBe(45);
  });

  it('an RPC error aborts the run loudly (thrown, not read as zero)', async () => {
    const { db } = mockDb([{ data: null, error: new Error('connection reset') }]);

    await expect(runRetentionCleanup(db, {}, NOW)).rejects.toThrow('connection reset');
  });

  it('a malformed RPC payload is a plumbing failure, not zero deletions', async () => {
    const { db } = mockDb([{ data: [{ publish_logs_deleted: 'many' }], error: null }]);

    await expect(runRetentionCleanup(db, {}, NOW)).rejects.toThrow(/malformed counts/);
  });

  it('an empty RPC payload is a plumbing failure, not zero deletions', async () => {
    const { db } = mockDb([{ data: [], error: null }]);

    await expect(runRetentionCleanup(db, {}, NOW)).rejects.toThrow(/no result row/);
  });
});

describe('retention cron routing (handleScheduled)', () => {
  const routingEnv: Env = {
    ENVIRONMENT: 'test',
    TOKEN_ENCRYPTION_KEY: 'test-master-key',
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  };
  const ctx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  function controller(cron: string): ScheduledController {
    return { cron, scheduledTime: NOW.getTime(), noRetry: () => {} };
  }

  it('the retention cron runs the cleanup RPC and NOT the claimer', async () => {
    const rpcCalls: string[] = [];
    const rpc = vi.fn(async (fn: string, _args: Record<string, unknown>) => {
      rpcCalls.push(fn);
      return {
        data: [{ publish_logs_deleted: 0, queue_items_deleted: 0 }],
        error: null,
      };
    });
    const from = vi.fn(() => {
      throw new Error('retention run must not touch table queries');
    });
    const db = { rpc, from };

    await handleScheduled(controller(RETENTION_CRON), routingEnv, ctx, {
      db: db as never,
      now: NOW,
    });

    expect(rpcCalls).toEqual(['cleanup_expired_publish_history']);
    expect(from).not.toHaveBeenCalled();
  });

  it('RETENTION_CRON is the daily 02:00 UTC trigger', () => {
    expect(RETENTION_CRON).toBe('0 2 * * *');
  });
});
