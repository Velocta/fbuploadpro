/**
 * @file claim-rpc-performance-migration.test.ts
 * @description Spec 138: claim RPC grouped-usage performance migration.
 * Verifies the migration file:
 * 1. Ships as ONE new forward migration named
 *    20261022140000_claim_rpc_grouped_usage.sql, sorting immediately after
 *    the spec 121 migration 20261022130000_claim_limits_and_refresh_lease.sql,
 *    and never drops a table, function, or column.
 * 2. Replaces claim_due_queue_items(platform, TEXT[], INT, INT) via
 *    CREATE OR REPLACE with the unchanged signature, defaults, SECURITY
 *    DEFINER posture, and the p_limit 1000 hard cap — and replaces no
 *    other function.
 * 3. Re-asserts the service-role-only ACLs exactly as spec 121 does.
 * 4. Computes per-(destination x rule) usage ONCE per call into a
 *    transaction-local temp snapshot (pg_temp.claim138_rule_usage,
 *    drop-guarded, ON COMMIT DROP) built from grouped passes over
 *    publish_logs (GROUP BY destination x rule) and in-flight queue_items
 *    (GROUP BY destination) — with NO correlated per-(destination x rule)
 *    subqueries against publish_logs / queue_items remaining.
 * 5. Does not touch the destination_claim_limits config table or its seed
 *    values.
 * 6. Sets the queue_items autovacuum storage parameters (0.02 / 0.01) as
 *    a separate ALTER TABLE statement.
 * Behavioural parity against a real Postgres (the spec 138 parity suite
 * in apps/worker/tests/claim-rpc/) is run locally and recorded in the
 * spec 138 PR description.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve(process.cwd(), '../../supabase/migrations');
const allFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const migrationFile = allFiles.find((f) => f.includes('claim_rpc_grouped_usage'));

const sql = migrationFile
  ? fs.readFileSync(path.join(migrationsDir, migrationFile), 'utf-8')
  : '';

describe('Spec 138: claim RPC grouped-usage performance migration', () => {
  it('ships as the single forward migration 20261022140000, after spec 121', () => {
    expect(migrationFile).toBe('20261022140000_claim_rpc_grouped_usage.sql');
    expect(allFiles).toContain('20261022130000_claim_limits_and_refresh_lease.sql');
    expect(
      (migrationFile as string) > '20261022130000_claim_limits_and_refresh_lease.sql',
    ).toBe(true);
  });

  it('drops nothing', () => {
    expect(sql).not.toMatch(/DROP TABLE(?! IF EXISTS pg_temp\.claim138_rule_usage)/);
    expect(sql).not.toMatch(/DROP FUNCTION/);
    expect(sql).not.toMatch(/DROP COLUMN/);
  });

  it('replaces exactly one function: claim_due_queue_items, signature unchanged', () => {
    const replacements = sql.match(/CREATE OR REPLACE FUNCTION/g) ?? [];
    expect(replacements).toHaveLength(1);
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.claim_due_queue_items\(\s+p_platform public\.platform,\s+p_lane_kind_set TEXT\[\],\s+p_limit INT DEFAULT 500,\s+p_max_per_destination INT DEFAULT 3\s+\)/,
    );
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
    expect(sql).toMatch(/LEAST\(GREATEST\(1, COALESCE\(p_limit, 500\)\), 1000\)/);
  });

  it('keeps the claim RPC service-role-only (spec 121 ACL pattern)', () => {
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.claim_due_queue_items\(public\.platform, TEXT\[\], INT, INT\) FROM PUBLIC, anon, authenticated;/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.claim_due_queue_items\(public\.platform, TEXT\[\], INT, INT\) TO service_role;/,
    );
  });

  it('materialises the usage snapshot once per call into a guarded temp table', () => {
    expect(sql).toMatch(/DROP TABLE IF EXISTS pg_temp\.claim138_rule_usage;/);
    expect(sql).toMatch(
      /CREATE TEMP TABLE pg_temp\.claim138_rule_usage ON COMMIT DROP AS/,
    );
    // Both the deferral pass and the headroom pass read the snapshot.
    const snapshotReads = sql.match(/FROM pg_temp\.claim138_rule_usage/g) ?? [];
    expect(snapshotReads.length).toBeGreaterThanOrEqual(2);
  });

  it('builds the snapshot with grouped passes, not per-destination subqueries', () => {
    // Grouped pass over publish_logs, grouped by (destination, metric, window).
    expect(sql).toMatch(
      /FROM rules r\s+INNER JOIN public\.publish_logs pl\s+ON pl\.destination_id = r\.destination_id/,
    );
    expect(sql).toMatch(
      /GROUP BY r\.destination_id, r\.metric, r\.window_seconds/,
    );
    // 'calls' counts every log row in the window; 'published' only successes.
    expect(sql).toMatch(/\(r\.metric = 'calls' OR pl\.result = 'success'\)/);
    // Grouped pass over in-flight queue_items, grouped by destination only,
    // with no window predicate on in-flight rows.
    expect(sql).toMatch(
      /FROM public\.queue_items q\s+INNER JOIN due_destinations dd ON dd\.destination_id = q\.destination_id\s+WHERE q\.status = 'publishing'\s+GROUP BY q\.destination_id/,
    );
  });

  it('contains no correlated per-(destination x rule) usage subqueries', () => {
    // The four correlated-subquery patterns of the spec 121 body.
    expect(sql).not.toMatch(/\(SELECT COUNT\(\*\) FROM public\.publish_logs pl/);
    expect(sql).not.toMatch(/\(SELECT MIN\(pl\.created_at\) FROM public\.publish_logs pl/);
    expect(sql).not.toMatch(/\(SELECT COUNT\(\*\) FROM public\.queue_items q/);
    expect(sql).not.toMatch(
      /\(SELECT MIN\(COALESCE\(q\.claimed_at, q\.updated_at\)\) FROM public\.queue_items q/,
    );
  });

  it('preserves the deferral and headroom formulas verbatim', () => {
    expect(sql).toMatch(
      /LEAST\(ru\.oldest_log_at, ru\.oldest_inflight_at\),\s+ru\.oldest_log_at,\s+ru\.oldest_inflight_at,\s+now\(\)\s+\) \+ make_interval\(secs => ru\.window_seconds\),\s+now\(\) \+ INTERVAL '1 minute'/,
    );
    expect(sql).toMatch(/ru\.log_count \+ ru\.inflight_count >= ru\.cap/);
    expect(sql).toMatch(/MAX\(b\.release_at\) AS release_at/);
    expect(sql).toMatch(/MIN\(ru\.cap - ru\.counted_total\)::INT AS headroom/);
    expect(sql).toMatch(/snap\.log_count \+ snap\.inflight_count/);
  });

  it('does not modify destination_claim_limits or any seed values', () => {
    expect(sql).not.toMatch(/INSERT INTO public\.destination_claim_limits/);
    expect(sql).not.toMatch(/UPDATE public\.destination_claim_limits/);
    expect(sql).not.toMatch(/DELETE FROM public\.destination_claim_limits/);
    expect(sql).not.toMatch(/ALTER TABLE public\.destination_claim_limits/);
    expect(sql).not.toMatch(/CREATE TABLE public\.destination_claim_limits/);
  });

  it('sets the queue_items autovacuum thresholds as a separate statement', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.queue_items SET \(autovacuum_vacuum_scale_factor = 0\.02, autovacuum_analyze_scale_factor = 0\.01\);/,
    );
  });
});
