/**
 * @file preserve-paused-pages-migration.test.ts
 * @description Regression test for ISSUE-41: Migration Silently Reactivated All Paused Pages to Active
 * Verifies that:
 * 1. Migration 20261010073500 had omitted 'paused' from the excluded list when updating facebook_pages status.
 * 2. Corrective forward migration 20261014150000_preserve_paused_facebook_pages.sql exists.
 * 3. The corrective migration preserves 'paused' status and only normalizes invalid/null statuses while including 'paused'.
 * 4. FacebookPageStatusEnum includes 'paused' and domain contracts support the paused state.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FacebookPageStatusEnum, FacebookPageStatusSchema } from '@fbuploadpro/contracts';

describe('ISSUE-41: Migration Preserves Paused Facebook Pages Status', () => {
  const migrationsDir = path.resolve(process.cwd(), '../../supabase/migrations');

  it('detects the omission of paused in historical migration 20261010073500', () => {
    const historicalMigration = path.join(migrationsDir, '20261010073500_facebook_profile_picture_url.sql');
    expect(fs.existsSync(historicalMigration)).toBe(true);

    const content = fs.readFileSync(historicalMigration, 'utf-8');
    // In 20261010073500, line 73 omitted 'paused'
    expect(content).toContain("WHERE status IS NULL OR status::text NOT IN ('active', 'fb_rate_limited', 'page_checkpoint', 'invalid_token', 'disconnected');");
  });

  it('provides a corrective forward migration ensuring paused pages are never overwritten to active', () => {
    const files = fs.readdirSync(migrationsDir);
    const correctiveMigration = files.find((f) => f.includes('preserve_paused_facebook_pages'));

    expect(correctiveMigration).toBeDefined();

    const sqlContent = fs.readFileSync(path.join(migrationsDir, correctiveMigration!), 'utf-8');

    // Asserts that the corrective migration guards against reactivation and explicitly includes 'paused'
    expect(sqlContent).toContain('facebook_pages');
    expect(sqlContent).toContain('paused');

    // If an update or sanity check is executed, it must explicitly recognize and preserve 'paused'
    expect(sqlContent).toMatch(/status::text\s+NOT\s+IN\s+\([^)]*'paused'[^)]*\)/i);
  });

  it('validates FacebookPageStatusSchema and FacebookPageStatusEnum domain contract supports paused', () => {
    expect(FacebookPageStatusSchema.options).toContain('paused');
    expect(FacebookPageStatusEnum.paused).toBe('paused');
  });
});
