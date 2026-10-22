/**
 * @file unified-schema-migration.test.ts
 * @description Spec 120 (Option C): unified schema migration.
 * Verifies the migration file:
 * 1. Renames queue_items -> legacy_queue_items and publish_logs ->
 *    legacy_publish_logs (and their PK constraints) before reusing the names.
 * 2. Creates the platform enum and the six unified tables with RLS enabled.
 * 3. Creates the three new RPC overloads with service-role-only grants, and
 *    re-points the legacy RPC overloads at the legacy tables.
 * 4. Backfills in FK order with platform='facebook', ids preserved, and the
 *    non-1:1 status/format mappings as explicit CASE expressions.
 * 5. Drops nothing.
 * Live-database verification (row counts, spot hashes, FK orphans, ACL dump,
 * legacy + new RPC behaviour on a fixture) was run against a local
 * PostgreSQL restore and is recorded verbatim in the spec 120 PR.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve(process.cwd(), '../../supabase/migrations');
const migrationFile = fs
  .readdirSync(migrationsDir)
  .find((f) => f.includes('unified_schema_migration'));

const sql = migrationFile
  ? fs.readFileSync(path.join(migrationsDir, migrationFile), 'utf-8')
  : '';

describe('Spec 120: unified schema migration (Option C)', () => {
  it('ships as a single forward migration file', () => {
    expect(migrationFile).toBeDefined();
    expect(migrationFile).toMatch(/^\d{14}_unified_schema_migration\.sql$/);
  });

  it('renames the colliding tables and their PK constraints to legacy_*', () => {
    expect(sql).toMatch(/ALTER TABLE public\.queue_items RENAME TO legacy_queue_items;/);
    expect(sql).toMatch(/ALTER TABLE public\.publish_logs RENAME TO legacy_publish_logs;/);
    expect(sql).toMatch(
      /ALTER TABLE public\.legacy_queue_items RENAME CONSTRAINT queue_items_pkey TO legacy_queue_items_pkey;/
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.legacy_publish_logs RENAME CONSTRAINT publish_logs_pkey TO legacy_publish_logs_pkey;/
    );
  });

  it('drops nothing', () => {
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/DROP COLUMN/i);
    expect(sql).not.toMatch(/DROP TYPE/i);
  });

  it('creates the platform enum and all six unified tables with RLS enabled', () => {
    expect(sql).toMatch(
      /CREATE TYPE public\.platform AS ENUM \('facebook', 'instagram', 'threads', 'youtube', 'x', 'tiktok'\)/
    );
    for (const table of [
      'social_accounts',
      'destinations',
      'queue_items',
      'posting_slots',
      'publish_logs',
      'platform_credentials',
    ]) {
      expect(sql, `missing CREATE TABLE for ${table}`).toMatch(
        new RegExp(`CREATE TABLE public\\.${table} \\(`)
      );
      expect(sql, `missing RLS enable for ${table}`).toMatch(
        new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`)
      );
    }
  });

  it('creates the new RPC overloads with service-role-only grants', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.claim_due_queue_items\(\s*p_platform public\.platform,/
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.claim_due_queue_items\(public\.platform, TEXT\[\], INT, INT\) FROM PUBLIC, anon, authenticated;/
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.claim_due_queue_items\(public\.platform, TEXT\[\], INT, INT\) TO service_role;/
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.settle_queue_item_outcome\(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, SMALLINT\) FROM PUBLIC, anon, authenticated;/
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.settle_queue_item_outcome\(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, SMALLINT\) TO service_role;/
    );
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.recover_stuck_publishing_items\(\s*p_platform public\.platform,/
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.recover_stuck_publishing_items\(public\.platform, INT\) FROM PUBLIC, anon, authenticated;/
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.recover_stuck_publishing_items\(public\.platform, INT\) TO service_role;/
    );
  });

  it('caps the new claim RPC p_limit at 1000 (never truncates a 500 round)', () => {
    expect(sql).toMatch(/LEAST\(GREATEST\(1, COALESCE\(p_limit, 500\)\), 1000\)/);
  });

  it('re-points the legacy RPC overloads at the legacy tables', () => {
    expect(sql).toMatch(/FROM public\.legacy_queue_items qi/);
    expect(sql).toMatch(/UPDATE public\.legacy_queue_items/);
    expect(sql).toMatch(/INSERT INTO public\.legacy_publish_logs/);
    // The legacy signatures stay intact for current callers.
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.claim_due_queue_items\(\s*p_limit INT DEFAULT 10,\s*p_max_per_page INT DEFAULT 3\s*\)/
    );
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.recover_stuck_publishing_items\(\s*p_timeout_minutes INT DEFAULT 10\s*\)/
    );
  });

  it('backfills in FK order with facebook platform and explicit CASE mappings', () => {
    // Search inside the backfill section only: the new settle RPC also
    // contains an INSERT INTO public.publish_logs earlier in the file.
    const backfillStart = sql.indexOf('7. Backfill');
    expect(backfillStart).toBeGreaterThan(0);
    const order = [
      'INSERT INTO public.platform_credentials',
      'INSERT INTO public.social_accounts',
      'INSERT INTO public.destinations',
      'INSERT INTO public.posting_slots',
      'INSERT INTO public.queue_items',
      'INSERT INTO public.publish_logs',
    ].map((needle) => sql.indexOf(needle, backfillStart));
    expect(order.every((idx) => idx >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    // Non-1:1 mappings are explicit CASEs, never silent defaults.
    expect(sql).toMatch(/WHEN 'disconnected' THEN 'revoked'/);
    expect(sql).toMatch(/WHEN 'fb_rate_limited' THEN 'rate_limited'/);
    expect(sql).toMatch(/WHEN 'paused' THEN 'disconnected'/);
    expect(sql).toMatch(/WHEN 'reel' THEN 'video'/);
    expect(sql).toMatch(/WHEN 'skipped' THEN 'cancelled'/);
    // Backfilled queue rows carry empty platform_options.
    expect(sql).toMatch(/'\{\}'::jsonb, qi\.scheduled_time, qi\.slot_id/);
  });
});
