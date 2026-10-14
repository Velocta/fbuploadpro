/**
 * @file updated-at-triggers-migration.test.ts
 * @description Regression test for ISSUE-43: Missing updated_at Auto-Update Triggers Across Core Tables
 * Verifies that:
 * 1. A forward migration creates the set_updated_at() trigger function.
 * 2. Triggers (trg_set_updated_at / set_updated_at) are attached BEFORE UPDATE across all core tables with updated_at:
 *    - users
 *    - facebook_accounts
 *    - facebook_pages
 *    - user_storage_quotas
 *    - media_folders
 *    - caption_templates
 *    - media_items
 *    - page_queue_slots
 *    - queue_items
 *    - page_insights_daily_snapshots
 *    - workspaces
 *    - workspace_byoc_credentials
 * 3. The function uses NEW.updated_at = now() and returns NEW.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ISSUE-43: updated_at Auto-Update Triggers Across Core Tables', () => {
  const migrationsDir = path.resolve(process.cwd(), '../../supabase/migrations');

  it('provides a forward database migration creating set_updated_at function and triggers', () => {
    const files = fs.readdirSync(migrationsDir);
    const migrationFile = files.find((f) => f.includes('auto_update_updated_at_triggers'));

    expect(migrationFile).toBeDefined();

    const sqlContent = fs.readFileSync(path.join(migrationsDir, migrationFile!), 'utf-8');

    // Asserts function definition
    expect(sqlContent).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?set_updated_at\(\)/i);
    expect(sqlContent).toMatch(/NEW\.updated_at\s*=\s*(?:now\(\)|CURRENT_TIMESTAMP)/i);
    expect(sqlContent).toMatch(/RETURN\s+NEW;/i);

    // Asserts triggers for all core tables
    const expectedTables = [
      'users',
      'facebook_accounts',
      'facebook_pages',
      'user_storage_quotas',
      'media_folders',
      'caption_templates',
      'media_items',
      'page_queue_slots',
      'queue_items',
      'page_insights_daily_snapshots',
      'workspaces',
      'workspace_byoc_credentials',
    ];

    for (const table of expectedTables) {
      const regex = new RegExp(`CREATE\\s+TRIGGER\\s+.*\\s+BEFORE\\s+UPDATE\\s+ON\\s+(?:public\\.)?${table}`, 'i');
      expect(sqlContent, `Missing BEFORE UPDATE trigger for ${table}`).toMatch(regex);
    }
  });
});
