/**
 * @file folder-cycle-cascade-migration.test.ts
 * @description Regression test for ISSUE-44: Multi-Node Folder Cycle Race and Orphaned Cloudflare R2 Files on Cascade Delete
 * Verifies that:
 * 1. Migration 20261014170000_folder_cycle_detection_and_safe_cascade.sql exists.
 * 2. It implements a PL/pgSQL function `check_media_folders_cycle` that detects multi-node loops via recursive traversal.
 * 3. It attaches `trg_media_folders_cycle_check` BEFORE INSERT OR UPDATE OF parent_id ON `media_folders`.
 * 4. It updates `media_items` foreign key `fk_media_items_user_folder` to ON DELETE RESTRICT to prevent silent DB cascade deletions without R2 object purge.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ISSUE-44: Multi-Node Folder Cycle Prevention and Safe Cascade Migration', () => {
  const migrationsDir = path.resolve(process.cwd(), '../../supabase/migrations');

  it('provides a forward database migration creating check_media_folders_cycle function and trigger', () => {
    const files = fs.readdirSync(migrationsDir);
    const migrationFile = files.find((f) => f.includes('folder_cycle_detection_and_safe_cascade'));

    expect(migrationFile).toBeDefined();

    const sqlContent = fs.readFileSync(path.join(migrationsDir, migrationFile!), 'utf-8');

    // Asserts function definition
    expect(sqlContent).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?check_media_folders_cycle\(\)/i);
    expect(sqlContent).toMatch(/WITH\s+RECURSIVE\s+ancestors\s+AS/i);
    expect(sqlContent).toMatch(/RAISE\s+EXCEPTION/i);
    expect(sqlContent).toMatch(/Circular folder reference detected/i);

    // Asserts trigger
    expect(sqlContent).toMatch(/CREATE\s+TRIGGER\s+trg_media_folders_cycle_check/i);
    expect(sqlContent).toMatch(/BEFORE\s+INSERT\s+OR\s+UPDATE\s+(?:OF\s+parent_id\s+)?ON\s+(?:public\.)?media_folders/i);
    expect(sqlContent).toMatch(/EXECUTE\s+FUNCTION\s+(?:public\.)?check_media_folders_cycle\(\)/i);

    // Asserts ON DELETE RESTRICT constraint on media_items(folder_id)
    expect(sqlContent).toMatch(/ALTER\s+TABLE\s+(?:public\.)?media_items/i);
    expect(sqlContent).toMatch(/fk_media_items_user_folder/i);
    expect(sqlContent).toMatch(/ON\s+DELETE\s+RESTRICT/i);
  });
});
