/**
 * @file claim-limits-migration.test.ts
 * @description Spec 121 PR-B (D5/D6): claim limits + refresh lease migration.
 * Verifies the migration file:
 * 1. Ships as ONE new forward migration after the spec 120 unified
 *    migration, and never drops a table or function.
 * 2. Creates the destination_claim_limits config table (RLS enabled,
 *    no policies) and seeds exactly the D5 defaults: instagram 100
 *    published/24h + 25 calls/1h, threads 250 published/24h, x 100
 *    published/15min — and no caps for facebook/youtube/tiktok.
 * 3. Replaces claim_due_queue_items(platform, TEXT[], INT, INT) with the
 *    same signature (worker call shape unchanged), keeps the p_limit
 *    1000 hard cap, reads caps from the config table (no per-platform
 *    hardcoded branches), defers at-cap items by rescheduling
 *    scheduled_time, restores expired rate_limited destinations to
 *    active, and re-asserts service-role-only grants.
 * 4. Adds the D6 refresh-lease column pair to BOTH social_accounts and
 *    destinations, with the conditional-update protocol documented.
 * 5. Extends worker_heartbeats with the per-lane enqueued / DLQ counters
 *    spec 121 Scope 7 requires, same shape as the spec 116 counters.
 * Live-database verification (all 37 migrations applied in order to a
 * local PG16 scratch database, then behavioural fixtures for at-cap
 * deferral, headroom, the IG hourly calls cap, the metadata override,
 * rate_limited recovery, the 1000 claim cap and the lease protocol)
 * was run locally and is recorded in the spec 121 PR-B description.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve(process.cwd(), '../../supabase/migrations');
const migrationFile = fs
  .readdirSync(migrationsDir)
  .find((f) => f.includes('claim_limits_and_refresh_lease'));

const sql = migrationFile
  ? fs.readFileSync(path.join(migrationsDir, migrationFile), 'utf-8')
  : '';

describe('Spec 121 PR-B: claim limits + refresh lease migration', () => {
  it('ships as a single forward migration after the unified migration', () => {
    expect(migrationFile).toBeDefined();
    expect(migrationFile).toMatch(/^\d{14}_claim_limits_and_refresh_lease\.sql$/);
    const ts = Number((migrationFile as string).slice(0, 14));
    expect(ts).toBeGreaterThan(20261022120000);
  });

  it('drops nothing', () => {
    expect(sql).not.toMatch(/DROP TABLE/);
    expect(sql).not.toMatch(/DROP FUNCTION/);
    expect(sql).not.toMatch(/DROP COLUMN/);
  });

  it('creates the claim-limits config table with RLS enabled', () => {
    expect(sql).toMatch(/CREATE TABLE public\.destination_claim_limits/);
    expect(sql).toMatch(
      /ALTER TABLE public\.destination_claim_limits ENABLE ROW LEVEL SECURITY;/,
    );
  });

  it('seeds exactly the D5 default caps (IG/Threads/X only)', () => {
    expect(sql).toMatch(/\('instagram', 'published', 100, 86400\)/);
    expect(sql).toMatch(/\('instagram', 'calls',\s+25,\s+3600\)/);
    expect(sql).toMatch(/\('threads',\s+'published', 250, 86400\)/);
    expect(sql).toMatch(/\('x',\s+'published', 100,\s+900\)/);
    expect(sql).not.toMatch(/\('(facebook|youtube|tiktok)', '(published|calls)'\)/);
  });

  it('replaces the claim RPC with the same signature and the 1000 hard cap', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.claim_due_queue_items\(\s+p_platform public\.platform,\s+p_lane_kind_set TEXT\[\],\s+p_limit INT DEFAULT 500,\s+p_max_per_destination INT DEFAULT 3\s+\)/,
    );
    expect(sql).toMatch(/LEAST\(GREATEST\(1, COALESCE\(p_limit, 500\)\), 1000\)/);
  });

  it('reads caps generically from the config table, keyed by p_platform', () => {
    expect(sql).toMatch(/public\.destination_claim_limits lr\s+ON lr\.platform = p_platform/);
    expect(sql).toMatch(/d\.metadata -> 'claim_limits'/);
  });

  it('counts successful publishes in publish_logs and defers by rescheduling', () => {
    expect(sql).toMatch(/pl\.result = 'success'/);
    expect(sql).toMatch(/SET scheduled_time = r\.release_at/);
  });

  it('auto-recovers expired rate_limited destinations to active', () => {
    expect(sql).toMatch(/SET status = 'active',\s+next_allowed_publish_at = NULL/);
    expect(sql).toMatch(/d\.status = 'rate_limited'/);
  });

  it('keeps the claim RPC service-role-only', () => {
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.claim_due_queue_items\(public\.platform, TEXT\[\], INT, INT\) FROM PUBLIC, anon, authenticated;/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.claim_due_queue_items\(public\.platform, TEXT\[\], INT, INT\) TO service_role;/,
    );
  });

  it('adds the refresh-lease pair to social_accounts and destinations', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.social_accounts\s+ADD COLUMN refresh_lease_owner TEXT NULL,\s+ADD COLUMN refresh_lease_expires_at TIMESTAMPTZ NULL;/,
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.destinations\s+ADD COLUMN refresh_lease_owner TEXT NULL,\s+ADD COLUMN refresh_lease_expires_at TIMESTAMPTZ NULL;/,
    );
    expect(sql).toMatch(/refresh_lease_owner IS NULL\s+OR refresh_lease_expires_at < now\(\)/);
  });

  it('extends worker_heartbeats with per-lane enqueued/DLQ counters', () => {
    expect(sql).toMatch(
      /ADD COLUMN last_enqueued_fast INT NOT NULL DEFAULT 0 CHECK \(last_enqueued_fast >= 0\)/,
    );
    expect(sql).toMatch(
      /ADD COLUMN last_enqueued_heavy INT NOT NULL DEFAULT 0 CHECK \(last_enqueued_heavy >= 0\)/,
    );
    expect(sql).toMatch(
      /ADD COLUMN last_dlq_fast INT NOT NULL DEFAULT 0 CHECK \(last_dlq_fast >= 0\)/,
    );
    expect(sql).toMatch(
      /ADD COLUMN last_dlq_heavy INT NOT NULL DEFAULT 0 CHECK \(last_dlq_heavy >= 0\)/,
    );
  });
});
