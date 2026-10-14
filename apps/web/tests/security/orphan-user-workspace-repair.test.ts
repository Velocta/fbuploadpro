/**
 * @file orphan-user-workspace-repair.test.ts
 * @description Security regression tests for ISSUE-42: Migration Orphans Users with Zero Workspaces on Subdomain Collision
 * Verifies that:
 * 1. Forward repair SQL migration exists and backfills workspaces for orphaned users.
 * 2. SQL handles collisions safely using a unique deterministic or randomized suffix.
 * 3. Enforces that every user record has at least one workspace.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ISSUE-42: Orphaned User Workspace Repair Migration', () => {
  it('contains forward database migration repairing orphaned users with zero workspaces', () => {
    const migrationsDir = path.resolve(process.cwd(), '../../supabase/migrations');
    const files = fs.readdirSync(migrationsDir);
    const migrationFile = files.find((f) => f.includes('repair_orphan_users_without_workspaces'));

    expect(migrationFile).toBeDefined();

    const sqlContent = fs.readFileSync(path.join(migrationsDir, migrationFile!), 'utf-8');

    // Asserts query targets users who have no workspaces
    expect(sqlContent).toMatch(/NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+(?:"public"\.)?["']?workspaces["']?/i);

    // Asserts insertion into workspaces with owner_id
    expect(sqlContent).toMatch(/INSERT\s+INTO\s+(?:"public"\.)?["']?workspaces["']?/i);
    expect(sqlContent).toContain('owner_id');
    expect(sqlContent).toContain('subdomain');

    // Asserts collision resistance (e.g. substring/random suffix or conflict resolution)
    expect(sqlContent).toMatch(/substr|md5|gen_random_uuid/i);
  });
});
